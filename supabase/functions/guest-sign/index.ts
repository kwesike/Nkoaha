// ════════════════════════════════════════════════════════════════
// NkoAha — guest-sign  (external signer flow, Phase 1: email OTP)
// ----------------------------------------------------------------
// One public, token-guarded function with three actions:
//   start  → validate the link, send a one-time code to the signer's email
//   verify → check the code, return a short-lived signed URL + the document
//   submit → stamp the signature onto the PDF, record the proof, advance the
//            chain exactly like the in-app signer, and certify when final
//
// Runs with the SERVICE ROLE key (bypasses RLS) and is reachable without a
// login, so EVERY action is gated by the secret sign_token and, past `start`,
// by a verified OTP. Deploy with:
//   supabase functions deploy guest-sign --no-verify-jwt
// ════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL   = Deno.env.get("AUTOMATION_FROM_EMAIL") || "NkoAha <noreply@nkoaha.space>";
const APP_URL      = Deno.env.get("APP_URL") || "https://app.nkoaha.space";
const BUCKET       = "documents";

const OTP_TTL_MIN     = 10;   // code lifetime
const VERIFY_TTL_MIN  = 30;   // how long a verified session can submit
const MAX_ATTEMPTS    = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── helpers ───────────────────────────────────────────────────────
async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}
const sixDigit = () => String(Math.floor(100000 + Math.random() * 900000));
const minsAgo  = (d: string | null, m: number) => !!d && (Date.now() - new Date(d).getTime()) < m * 60000;

// log a suspicious / notable guest event into the shared security_events feed
// (the admin Security + Monitoring pages read it; IP blocking already applies).
async function logEvent(eventType: string, email: string, ip: string, metadata: Record<string, unknown>) {
  try {
    await db.from("security_events").insert({
      user_id: null, email: email || null, event_type: eventType,
      ip_address: ip || null, user_agent: "guest-sign", metadata,
    });
  } catch { /* non-fatal */ }
}

async function routeByToken(token: string) {
  const { data } = await db.from("document_routes").select("*").eq("sign_token", token).maybeSingle();
  return data;
}

// generic sender
async function email(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    return r.ok;
  } catch { return false; }
}

const shell = (inner: string) => `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:14px;overflow:hidden">
  <div style="height:6px;background:linear-gradient(90deg,#7c3aed,#a855f7,#2563eb)"></div>
  <div style="padding:22px 24px"><div style="font-weight:800;color:#7c3aed;font-size:18px;margin-bottom:10px">NkoAha</div>${inner}
  <p style="color:#aaa;font-size:11px;margin-top:20px">This is an automated message from NkoAha.</p></div></div>`;

// receipt sent to an external signer right after they sign
function proofReceiptHtml(name: string, mail: string, docTitle: string, when: string, action: string): string {
  return shell(`<h2 style="font-size:16px;margin:0 0 10px">Your signing receipt</h2>
    <p style="font-size:14px;color:#333">${name ? name + "," : "Hello,"} this confirms that you <strong>${action}</strong> the document below.</p>
    <table style="font-size:13px;color:#333;margin:12px 0;width:100%">
      <tr><td style="color:#888;padding:3px 0;width:120px">Document</td><td><strong>${docTitle}</strong></td></tr>
      <tr><td style="color:#888;padding:3px 0">Signed by</td><td>${name || "—"} (${mail})</td></tr>
      <tr><td style="color:#888;padding:3px 0">Date</td><td>${when}</td></tr>
      <tr><td style="color:#888;padding:3px 0">Verified via</td><td>Email one-time code</td></tr>
    </table>
    <p style="font-size:12.5px;color:#666">Keep this email as proof of your signature. A certified copy of the completed document will follow once all parties have signed.</p>`);
}

// certificate of completion sent to every party when the last signature lands
function completionHtml(docTitle: string, signers: string[], certId: string): string {
  const verify = `${APP_URL}/verify/${certId}`;
  const list = signers.map(s => `<li style="margin:3px 0">${s}</li>`).join("");
  return shell(`<h2 style="font-size:16px;margin:0 0 10px">✓ Document completed</h2>
    <p style="font-size:14px;color:#333"><strong>“${docTitle}”</strong> has been signed by all parties and certified by NkoAha.</p>
    <p style="font-size:13px;color:#333;margin-bottom:4px"><strong>Signers</strong></p>
    <ul style="font-size:13px;color:#333;padding-left:18px;margin:0 0 14px">${list}</ul>
    <a href="${verify}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-size:13px;font-weight:600">Verify this document</a>
    <p style="font-size:12px;color:#888;margin-top:10px">Certificate ID: ${certId} · Verify anytime at ${verify}</p>`);
}

// invitation email with the signing link — sent when it becomes a signer's turn
async function sendInvite(route: any): Promise<boolean> {
  if (!route?.recipient_email || !route?.sign_token) return false;
  const { data: doc } = await db.from("documents").select("title").eq("id", route.document_id).maybeSingle();
  const link = `${APP_URL}/sign/${route.sign_token}`;
  return await email(route.recipient_email, `You've been asked to sign: ${doc?.title || "a document"}`,
    shell(`<h2 style="font-size:16px;margin:0 0 10px">A document needs your signature</h2>
      <p style="font-size:14px;color:#333">${route.recipient_name ? route.recipient_name + "," : "Hello,"} you've been invited to review and sign <strong>“${doc?.title || "a document"}”</strong>.</p>
      <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:600;margin:12px 0">Open &amp; sign</a>
      <p style="font-size:12px;color:#888">For your security you'll confirm a one-time code sent to this email. This link is unique to you — don't share it.</p>`));
}

async function sendOtpEmail(to: string, code: string, docTitle: string): Promise<boolean> {
  if (!RESEND_KEY || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL, to,
        subject: `Your NkoAha signing code: ${code}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:420px">
          <h2 style="color:#7c3aed">NkoAha</h2>
          <p>Use this code to open and sign <strong>“${docTitle}”</strong>:</p>
          <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
          <p style="color:#888;font-size:13px">This code expires in ${OTP_TTL_MIN} minutes. If you didn't request it, ignore this email.</p>
        </div>`,
      }),
    });
    return r.ok;
  } catch { return false; }
}

// ── ACTION: start ─────────────────────────────────────────────────
async function start(token: string) {
  const route = await routeByToken(token);
  if (!route) return json({ error: "invalid_link" }, 404);
  if (route.status === "completed") return json({ error: "already_signed" }, 409);
  if (route.status !== "pending")   return json({ error: "not_your_turn" }, 409);
  if (route.token_expires_at && new Date(route.token_expires_at) < new Date()) return json({ error: "expired" }, 410);
  if (!route.recipient_email)       return json({ error: "no_channel" }, 400);

  const code = sixDigit();
  await db.from("document_routes").update({
    otp_hash: await sha256(token + ":" + code),
    otp_expires_at: new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString(),
    otp_attempts: 0,
  }).eq("id", route.id);

  const { data: doc } = await db.from("documents").select("title").eq("id", route.document_id).maybeSingle();
  const sent = await sendOtpEmail(route.recipient_email, code, doc?.title || "a document");
  if (!sent) return json({ error: "send_failed" }, 502);

  const mask = route.recipient_email.replace(/^(.).*(@.*)$/, "$1***$2");
  return json({ ok: true, signerName: route.recipient_name, docTitle: doc?.title || "", channel: mask });
}

// ── ACTION: verify ────────────────────────────────────────────────
async function verify(token: string, code: string, ip: string) {
  const route = await routeByToken(token);
  if (!route) { await logEvent("guest_invalid_token", "", ip, { where: "verify" }); return json({ error: "invalid_link" }, 404); }
  if (route.status !== "pending") return json({ error: "not_your_turn" }, 409);
  if (!route.otp_hash || !route.otp_expires_at) return json({ error: "no_code" }, 400);
  if (new Date(route.otp_expires_at) < new Date()) return json({ error: "code_expired" }, 410);
  if ((route.otp_attempts ?? 0) >= MAX_ATTEMPTS) {
    await logEvent("guest_otp_locked", route.recipient_email, ip, { document_id: route.document_id });
    return json({ error: "too_many_attempts" }, 429);
  }

  const ok = (await sha256(token + ":" + code)) === route.otp_hash;
  if (!ok) {
    const attempts = (route.otp_attempts ?? 0) + 1;
    await db.from("document_routes").update({ otp_attempts: attempts }).eq("id", route.id);
    await logEvent("guest_otp_failed", route.recipient_email, ip, { document_id: route.document_id, attempts });
    return json({ error: "wrong_code", remaining: MAX_ATTEMPTS - attempts }, 401);
  }

  await db.from("document_routes").update({ otp_verified_at: new Date().toISOString() }).eq("id", route.id);

  // short-lived signed URL to view the PDF
  const { data: doc } = await db.from("documents").select("title,file_url,pdf_url,pages").eq("id", route.document_id).maybeSingle();
  const path = doc?.pdf_url || doc?.file_url || "";
  let signedUrl = "";
  if (path) {
    const { data: s } = await db.storage.from(BUCKET).createSignedUrl(path, VERIFY_TTL_MIN * 60);
    signedUrl = s?.signedUrl || "";
  }
  return json({ ok: true, docTitle: doc?.title || "", pages: doc?.pages || 1, fileUrl: signedUrl, routeOrder: route.route_order });
}

// ── ACTION: submit ────────────────────────────────────────────────
async function submit(token: string, signaturePng: string, typedName: string) {
  const route = await routeByToken(token);
  if (!route) return json({ error: "invalid_link" }, 404);
  if (route.status === "completed") return json({ error: "already_signed" }, 409);
  if (route.status !== "pending")   return json({ error: "not_your_turn" }, 409);
  if (!minsAgo(route.otp_verified_at, VERIFY_TTL_MIN)) return json({ error: "verify_expired" }, 440);

  const { data: doc } = await db.from("documents").select("*").eq("id", route.document_id).maybeSingle();
  if (!doc) return json({ error: "doc_missing" }, 404);

  // ── 1. store the signature image ──
  let sigUrl = "";
  try {
    if (signaturePng?.startsWith("data:image")) {
      const bytes = Uint8Array.from(atob(signaturePng.split(",")[1]), c => c.charCodeAt(0));
      const sigPath = `guest-signatures/${route.id}.png`;
      await db.storage.from(BUCKET).upload(sigPath, bytes, { contentType: "image/png", upsert: true });
      const { data: pub } = await db.storage.from(BUCKET).createSignedUrl(sigPath, 60 * 60 * 24 * 365);
      sigUrl = pub?.signedUrl || "";
    }
  } catch { /* non-fatal */ }

  // ── 2. stamp a signature block onto the PDF (last page, bottom) ──
  //  Phase 1: a clear, legally-sound signature block. Field-accurate
  //  placement to the sender's designated box is Phase 1.5.
  try {
    const path = doc.pdf_url || doc.file_url;
    if (path) {
      const { data: file } = await db.storage.from(BUCKET).download(path);
      if (file) {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = pdf.getPages();
        const page = pages[pages.length - 1];
        const { width } = page.getSize();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bx = 40, by = 60, bw = width - 80;
        page.drawRectangle({ x: bx, y: by, width: bw, height: 72, borderColor: rgb(0.49, 0.23, 0.93), borderWidth: 1 });
        if (signaturePng?.startsWith("data:image")) {
          try {
            const img = await pdf.embedPng(Uint8Array.from(atob(signaturePng.split(",")[1]), c => c.charCodeAt(0)));
            const sw = 120, sh = (img.height / img.width) * sw;
            page.drawImage(img, { x: bx + 10, y: by + 30, width: sw, height: Math.min(sh, 34) });
          } catch { /* ignore bad image */ }
        }
        page.drawText(`Signed by: ${route.recipient_name || typedName || route.recipient_email}`, { x: bx + 10, y: by + 20, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`${route.recipient_email}  •  ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC  •  verified by email OTP`, { x: bx + 10, y: by + 8, size: 7.5, font, color: rgb(0.4, 0.4, 0.4) });
        const out = await pdf.save();
        const ab = (out as Uint8Array).buffer.slice((out as Uint8Array).byteOffset, (out as Uint8Array).byteOffset + (out as Uint8Array).byteLength) as ArrayBuffer;
        await db.storage.from(BUCKET).upload(path, new Blob([ab], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
      }
    }
  } catch { /* stamping is best-effort; proof below is the record of record */ }

  // ── 3. record the proof (mirrors the in-app document_proofs insert) ──
  const isFinal = route.is_final || route.route_order >= (route.total_steps || route.route_order);
  await db.from("document_proofs").insert({
    document_id: route.document_id,
    recipient_id: null,
    recipient_email: route.recipient_email,
    action_type: isFinal ? "signed" : "approved",
    route_order: route.route_order,
    total_steps: route.total_steps,
    signature_url: sigUrl,
    proof_html: `<p>Signed by ${route.recipient_name || ""} (${route.recipient_email}) via secure email-OTP link on ${new Date().toISOString()}.</p>`,
    actioned_at: new Date().toISOString(),
  });

  // ── 3b. email this external signer their proof receipt (their "inbox") ──
  const whenStr = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  await email(route.recipient_email, `Your signing receipt — ${doc.title}`,
    proofReceiptHtml(route.recipient_name || "", route.recipient_email, doc.title, whenStr, isFinal ? "signed" : "approved & forwarded"));

  // ── 4. complete this step, advance the chain (same logic as the app) ──
  await db.from("document_routes").update({ status: "completed", actioned_at: new Date().toISOString() }).eq("id", route.id);
  const nextOrder = route.route_order + 1;
  const { data: next } = await db.from("document_routes")
    .select("id,recipient_id,is_external,recipient_email,recipient_name,sign_token,document_id")
    .eq("document_id", route.document_id).eq("route_order", nextOrder).maybeSingle();
  if (next) {
    await db.from("document_routes").update({ status: "pending" })
      .eq("document_id", route.document_id).eq("route_order", nextOrder).in("status", ["waiting", "pending"]);
    // if the next signer is external, email them their signing link now
    if (next.recipient_email && next.sign_token) await sendInvite(next);
    // (internal next signers are notified via their in-app inbox as before)
    else if (next.recipient_id) {
      try {
        await db.from("activity_logs").insert({
          user_id: next.recipient_id, action: "document_received", document_id: route.document_id,
          metadata: { document_title: doc.title, step_order: nextOrder, total_steps: route.total_steps, status: "pending" },
        });
      } catch { /* non-fatal */ }
    }
  }

  // ── 5. if final: mark the document signed, certify, and send the
  //       certificate of completion to EVERY party (external → email;
  //       internal also keep their in-app proof). ──
  let certified = false;
  if (isFinal || !next) {
    await db.from("documents").update({ status: "signed" }).eq("id", route.document_id);
    let certId = "";
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/certify-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: route.document_id }),
      });
      certified = r.ok;
      if (r.ok) { try { certId = (await r.json())?.certId || ""; } catch { /* ignore */ } }
    } catch { /* certify best-effort */ }

    // gather every party's email + display name
    try {
      const { data: allRoutes } = await db.from("document_routes")
        .select("recipient_id,recipient_email,recipient_name,route_order")
        .eq("document_id", route.document_id).order("route_order", { ascending: true });
      const signers: string[] = [];
      const recipients = new Set<string>();
      for (const r of allRoutes || []) {
        let mail = r.recipient_email || "";
        let name = r.recipient_name || "";
        if (!mail && r.recipient_id) {
          const { data: p } = await db.from("profiles").select("email").eq("id", r.recipient_id).maybeSingle();
          mail = p?.email || "";
        }
        if (mail) { recipients.add(mail); signers.push(`${name ? name + " — " : ""}${mail}`); }
      }
      // include the document owner
      const { data: owner } = await db.from("profiles").select("email").eq("id", doc.owner_id).maybeSingle();
      if (owner?.email) recipients.add(owner.email);

      if (certId && recipients.size) {
        const html = completionHtml(doc.title, signers, certId);
        for (const to of recipients) await email(to, `Completed & certified — ${doc.title}`, html);
      }
    } catch { /* completion email best-effort */ }
  }

  // notify the document owner
  try {
    await db.from("activity_logs").insert({
      user_id: doc.owner_id, action: isFinal ? "document_signed" : "document_approved", document_id: route.document_id,
      metadata: { document_title: doc.title, signed_by: route.recipient_email, step: route.route_order, total: route.total_steps, status: "pending", external: true },
    });
  } catch { /* non-fatal */ }

  return json({ ok: true, final: isFinal || !next, certified });
}

// ── router ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const token = String(body.token || "");
  if (!token) return json({ error: "no_token" }, 400);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  switch (body.action) {
    case "invite": {   // email the signing link to an external signer whose turn it is
      const route = await routeByToken(token);
      if (!route) return json({ error: "invalid_link" }, 404);
      if (route.status !== "pending") return json({ ok: true, skipped: "not_active" });
      const sent = await sendInvite(route);
      return json({ ok: sent });
    }
    case "start":  return await start(token);
    case "verify": return await verify(token, String(body.code || ""), ip);
    case "submit": return await submit(token, String(body.signature || ""), String(body.typedName || ""));
    default:       return json({ error: "unknown_action" }, 400);
  }
});