// ════════════════════════════════════════════════════════════════
// Supabase Edge Function: send-document-email
// ────────────────────────────────────────────────────────────────
// Emails a document (PDF attached) directly to any email address,
// with a NkoAha "join" marketing CTA that links to signup.
//
// Deploy:  supabase functions deploy send-document-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//
// Requires a verified domain in Resend so FROM_EMAIL works.
// ════════════════════════════════════════════════════════════════
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
// Must be an address on a domain you've verified in Resend.
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "NkoAha <documents@nkoaha.space>";
const SITE_URL   = "https://nkoaha.space";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  to: string;              // recipient email
  senderName: string;      // who is sending (display name / email prefix)
  senderEmail?: string;    // optional reply-to
  documentTitle: string;
  message?: string;        // optional personal note from sender
  pdfBase64: string;       // baked PDF, base64 (no data: prefix)
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] as string
  ));
}

function buildEmailHtml(p: Payload): string {
  const sender = escapeHtml(p.senderName || "A NkoAha user");
  const title  = escapeHtml(p.documentTitle || "a document");
  const note   = p.message ? escapeHtml(p.message) : "";
  const signupUrl = `${SITE_URL}/signup`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px"><img src="https://nkoaha.space/logo.png" alt="NkoAha" width="48" height="48" style="display:block;margin:0 auto 12px"/>
      <div style="display:inline-block;background:#7c3aed;color:#fff;font-size:20px;font-weight:800;padding:10px 18px;border-radius:12px;letter-spacing:-.02em">NkoAha</div>
    </div>

    <!-- Card -->
    <div style="background:#fff;border:1px solid #e7e4df;border-radius:16px;overflow:hidden">
      <div style="height:6px;background:linear-gradient(90deg,#7c3aed,#a855f7,#2563eb)"></div>
      <div style="padding:28px 28px 24px">
        <p style="margin:0 0 4px;font-size:13px;color:#78716c">You have received a document</p>
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1c1917">${title}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#44403c">
          <strong>${sender}</strong> has sent you a document through NkoAha.
          The document is attached to this email as a PDF.
        </p>
        ${note ? `<div style="background:#faf9f8;border-left:3px solid #7c3aed;border-radius:6px;padding:12px 14px;margin:0 0 16px">
          <p style="margin:0;font-size:13px;color:#57534e;font-style:italic">"${note}"</p>
        </div>` : ""}
        <div style="background:#ede9fe;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">📎</span>
          <span style="font-size:13px;color:#5b21b6;font-weight:600">${title}.pdf is attached above</span>
        </div>
      </div>
    </div>

    <!-- Marketing / Join CTA -->
    <div style="background:#18181b;border-radius:16px;padding:28px;margin-top:20px;text-align:center">
      <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#fff">Want to send and sign documents like this?</h2>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:rgba(255,255,255,.7)">
        NkoAha lets you route, sign, and get verified proof on documents — for individuals and organisations.
        Join free and start in minutes.
      </p>
      <a href="${signupUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:9px">
        Join NkoAha — it's free
      </a>
      <p style="margin:14px 0 0;font-size:11px;color:rgba(255,255,255,.4)">
        Sign up as an individual or an organisation
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#a8a29e;margin:20px 0 0;line-height:1.6">
      Sent via NkoAha · <a href="${SITE_URL}" style="color:#7c3aed;text-decoration:none">nkoaha.space</a><br/>
      You received this because ${sender} sent you a document.
    </p>

  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const p = await req.json() as Payload;
    if (!p.to || !p.pdfBase64) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'pdfBase64'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeTitle = (p.documentTitle || "document").replace(/[^a-zA-Z0-9._-]/g, "_");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [p.to],
        reply_to: p.senderEmail || undefined,
        subject: `${p.senderName || "Someone"} sent you a document: ${p.documentTitle || "Document"}`,
        html: buildEmailHtml(p),
        attachments: [
          { filename: `${safeTitle}.pdf`, content: p.pdfBase64 },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return new Response(JSON.stringify({ error: "Resend failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});