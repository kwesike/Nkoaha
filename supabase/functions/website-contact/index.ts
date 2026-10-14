// @ts-nocheck
// supabase/functions/website-contact/index.ts
// Public endpoint for the marketing website contact form + "Request a demo".
// Anonymous visitors have no JWT, so this function MUST be deployed with:
//   verify_jwt = false   (config.toml)  OR  --no-verify-jwt
//
// What it does, for every submission:
//   1. Emails the lead to support@nkoaha.space via Resend (guaranteed delivery).
//   2. If the sender's email matches an existing NkoAha user, it ALSO inserts a
//      `support_message` row into activity_logs so it shows up in the admin
//      Support Inbox chat for that user. (Non-users stay email-only leads.)
//
// Deploy:
//   supabase functions deploy website-contact --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;
const SUPPORT_EMAIL        = "support@nkoaha.space";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));

    const name    = (body.name    || "").toString().trim().slice(0, 200);
    const email   = (body.email   || "").toString().trim().toLowerCase().slice(0, 200);
    const company = (body.company || "").toString().trim().slice(0, 200);
    const message = (body.message || "").toString().trim().slice(0, 5000);
    const kind    = (body.kind === "demo" ? "demo" : "contact"); // "contact" | "demo"

    // Basic validation
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk || (!message && kind !== "demo")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please provide a valid email and a message." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const subject = kind === "demo"
      ? `Demo request from ${name || email}`
      : `Website message from ${name || email}`;

    const safeMsg = esc(message || "(Requested a demo — no message provided)");

    // 1) Email the lead to the support inbox (always)
    let emailed = false;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:     "NkoAha Website <support@nkoaha.space>",
          to:       [SUPPORT_EMAIL],
          reply_to: email,
          subject,
          html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:28px 16px;background:#f5f3ef">
  <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e4df">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:20px 24px">
      <div style="font-size:17px;font-weight:800;color:#fff">New ${kind === "demo" ? "demo request" : "website message"}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.7)">via nkoaha.space</div>
    </div>
    <div style="padding:24px;font-size:14px;color:#1c1917;line-height:1.7">
      <p style="margin:0 0 6px"><strong>Name:</strong> ${esc(name) || "—"}</p>
      <p style="margin:0 0 6px"><strong>Email:</strong> <a href="mailto:${esc(email)}" style="color:#7c3aed">${esc(email)}</a></p>
      <p style="margin:0 0 6px"><strong>Company:</strong> ${esc(company) || "—"}</p>
      <p style="margin:14px 0 6px"><strong>Message:</strong></p>
      <p style="margin:0;white-space:pre-wrap">${safeMsg}</p>
    </div>
    <div style="padding:14px 24px;background:#faf9f8;border-top:1px solid #f0ede8;font-size:12px;color:#78716c">
      Reply directly to this email to respond to ${esc(name) || "the sender"}.
    </div>
  </div>
</div>`,
        }),
      });
      emailed = r.ok;
    } catch (_e) { emailed = false; }

    // 2) If the sender is an existing user, drop it into the admin Support Inbox too
    let inInbox = false;
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: profile } = await supabase
        .from("profiles").select("id").ilike("email", email).maybeSingle();

      if (profile?.id) {
        await supabase.from("activity_logs").insert({
          user_id: profile.id,
          action:  "support_message",
          metadata: {
            message:    message || "(Requested a demo)",
            from_email: email,
            name,
            company,
            source:     kind === "demo" ? "website_demo" : "website_contact",
            sent_at:    new Date().toISOString(),
            read:       false,
          },
        });
        inInbox = true;
      }
    } catch (_e) { /* non-fatal */ }

    return new Response(
      JSON.stringify({ ok: emailed || inInbox, emailed, inInbox }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});