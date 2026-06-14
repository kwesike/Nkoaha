// ════════════════════════════════════════════════════════════════
// Edge Function: send-org-invite
// Sends a branded NkoAha invite email containing a DIRECT link to
// /join-org?invite=...&org=...  (no Supabase magic-link wrapper, so
// the query params are never stripped).
//
// Body: { to, orgName, joinLink, inviterName? }
// Caller must be authenticated (the inviting org owner).
// ════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Reuses the document-email sender by default; override with INVITE_FROM_EMAIL.
const FROM_EMAIL = Deno.env.get("INVITE_FROM_EMAIL")
  || Deno.env.get("FROM_EMAIL")
  || "NkoAha <support@nkoaha.space>";
const SITE_URL = Deno.env.get("SITE_URL") || "https://nkoaha.space";
// Public logo URL for the email header. Email clients can't use bundled app
// assets, so this must be a publicly reachable image. Override via LOGO_URL.
const LOGO_URL = Deno.env.get("LOGO_URL")
  || `${SUPABASE_URL}/storage/v1/object/public/assets/nkoaha-logo.png`;

function inviteHtml(orgName: string, joinLink: string, inviterName?: string): string {
  const who = inviterName ? `${inviterName} invited you` : "You've been invited";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#f5f3ef;font-family:'Segoe UI',Arial,sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e4df">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:20px 28px;display:flex;align-items:center;gap:10px">
      <img src="${LOGO_URL}" alt="NkoAha" width="32" height="32" style="width:32px;height:32px;object-fit:contain;border-radius:7px;background:#fff;padding:3px"/>
      <span style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.02em">NkoAha</span>
    </div>
    <div style="padding:28px">
      <div style="font-size:16px;font-weight:700;color:#1c1917;margin-bottom:8px">
        ${who} to join ${escapeHtml(orgName)}
      </div>
      <div style="font-size:13.5px;color:#78716c;margin-bottom:22px;line-height:1.6">
        ${escapeHtml(orgName)} uses NkoAha to manage and sign documents. Click below to
        accept the invitation and set up your account. The link is unique to you.
      </div>
      <a href="${joinLink}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:9px">
        Accept Invitation
      </a>
      <div style="font-size:11.5px;color:#a8a29e;margin-top:22px;line-height:1.6;word-break:break-all">
        Or paste this link into your browser:<br/>
        <a href="${joinLink}" style="color:#7c3aed">${joinLink}</a>
      </div>
      <div style="font-size:11px;color:#a8a29e;margin-top:22px;border-top:1px solid #f0ede8;padding-top:14px">
        If you weren't expecting this, you can ignore this email.<br/>
        NkoAha · <a href="${SITE_URL}" style="color:#7c3aed">nkoaha.space</a>
      </div>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing auth token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const to        = String(body.to || "").trim().toLowerCase();
    const orgName   = String(body.orgName || "the organisation");
    const joinLink  = String(body.joinLink || "");
    const inviterName = body.inviterName ? String(body.inviterName) : undefined;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Invalid recipient email" }, 400);
    if (!joinLink.startsWith("http"))           return json({ error: "Invalid join link" }, 400);
    if (!RESEND_API_KEY)                         return json({ error: "Email not configured" }, 500);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: `You're invited to join ${orgName} on NkoAha`,
        html: inviteHtml(orgName, joinLink, inviterName),
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return json({ error: "Could not send email", detail }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Server error", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}