// ════════════════════════════════════════════════════════════════
// Edge Function: auth-email-otp
// Two actions:
//   { action: "send",   purpose }            → emails a 6-digit code
//   { action: "verify", code, purpose }      → checks the code
// Identifies the user from their JWT (Authorization header), so the
// client never passes a user id. Codes are hashed (sha256) before
// storage and expire after 10 minutes, single-use.
// ════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// OTP gets its own sender, independent of the document-email FROM_EMAIL.
// Falls back to FROM_EMAIL, then to a sensible default on the verified domain.
const OTP_FROM_EMAIL = Deno.env.get("OTP_FROM_EMAIL")
  || Deno.env.get("FROM_EMAIL")
  || "NkoAha noreply <noreply@nkoaha.space>";
const SITE_URL      = Deno.env.get("SITE_URL") || "https://nkoaha.space";
const OTP_TTL_MIN   = 10;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sixDigits(): string {
  // 100000–999999, cryptographically random
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
  return String(n);
}

function emailHtml(code: string, purpose: string): string {
  const reason = purpose === "approve"
    ? "approve a document"
    : purpose === "login"
    ? "sign in to your account"
    : "verify your identity";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#f5f3ef;font-family:'Segoe UI',Arial,sans-serif;padding:32px">
  <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e4df">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:22px 28px">
      <div style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.02em">NkoAha</div>
    </div>
    <div style="padding:28px">
      <div style="font-size:15px;font-weight:700;color:#1c1917;margin-bottom:6px">Your verification code</div>
      <div style="font-size:13px;color:#78716c;margin-bottom:20px;line-height:1.6">
        Use the code below to ${reason}. It expires in ${OTP_TTL_MIN} minutes.
        If you didn't request this, you can ignore this email.
      </div>
      <div style="background:#ede9fe;border-radius:10px;padding:18px;text-align:center;margin-bottom:20px">
        <div style="font-size:34px;font-weight:800;letter-spacing:.34em;color:#5b21b6;font-family:monospace">${code}</div>
      </div>
      <div style="font-size:11px;color:#a8a29e;text-align:center">
        NkoAha · Document Management Platform · <a href="${SITE_URL}" style="color:#7c3aed">nkoaha.space</a>
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing auth token" }, 401);

    // Admin client (service role) — bypasses RLS for email_otps writes.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Identify the caller from their JWT.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action  = body.action as string;
    const purpose = (body.purpose as string) || "verify";

    // ── SEND ──────────────────────────────────────────────────────
    if (action === "send") {
      if (!RESEND_API_KEY) return json({ error: "Email not configured" }, 500);
      const code = sixDigits();
      const code_hash = await sha256(code);
      const expires_at = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

      // Invalidate any prior unconsumed codes for this purpose.
      await admin.from("email_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("purpose", purpose).is("consumed_at", null);

      const { error: insErr } = await admin.from("email_otps")
        .insert({ user_id: user.id, code_hash, purpose, expires_at });
      if (insErr) return json({ error: "Could not create code", detail: insErr.message }, 500);

      // Send via Resend to the user's account email.
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: OTP_FROM_EMAIL,
          to: user.email,
          subject: "Your NkoAha verification code",
          html: emailHtml(code, purpose),
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        return json({ error: "Could not send email", detail }, 502);
      }
      return json({ ok: true, sentTo: maskEmail(user.email || "") });
    }

    // ── VERIFY ────────────────────────────────────────────────────
    if (action === "verify") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code." }, 400);
      const code_hash = await sha256(code);

      const { data: rows } = await admin.from("email_otps")
        .select("id,expires_at,consumed_at,code_hash")
        .eq("user_id", user.id).eq("purpose", purpose)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const row = rows?.[0];
      if (!row)                                   return json({ error: "No active code. Request a new one." }, 400);
      if (new Date(row.expires_at) < new Date())  return json({ error: "Code expired. Request a new one." }, 400);
      if (row.code_hash !== code_hash)            return json({ error: "Incorrect code. Try again." }, 400);

      // Consume it (single use).
      await admin.from("email_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return json({ ok: true, verified: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: "Server error", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!d) return e;
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d;
}