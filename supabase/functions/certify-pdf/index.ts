// @ts-nocheck
// Supabase Edge Function: certify-pdf
// ─────────────────────────────────────────────────────────────
// Makes a signed document tamper-EVIDENT and locked:
//   1. Flattens any interactive form fields (signatures baked into the page
//      stay as page content — not removable annotations).
//   2. Stamps a visible certification seal (cert id + date) on every page.
//   3. Applies a cryptographic digital signature over the WHOLE document, so
//      any later edit breaks the signature and PDF readers flag the file as
//      "altered / signature invalid".
//   4. Records a SHA-256 fingerprint so the file can be verified later.
//
// NOTE (honest): no file can be made impossible to open in an editor. This
// makes tampering DETECTABLE and the signature self-invalidating — the same
// mechanism DocuSign/Adobe use — not literally un-openable.
//
// Certificate: a self-signed cert is used (free). Preferred source is the
// secrets CERT_P12_BASE64 + CERT_PASSPHRASE; if absent, one is generated once
// and cached in app_settings (service-role only) and reused thereafter.
//
// Request body : { pdf: base64, documentId?: string, title?: string, signerName?: string }
// Response     : { pdf: base64(certified), certId, fingerprint }
//
// Deploy: supabase functions deploy certify-pdf
//   with  [functions.certify-pdf]  verify_jwt = false  in config.toml

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import forge from "npm:node-forge@1.3.1";
import { SignPdf } from "npm:@signpdf/signpdf@3.2.4";
import { P12Signer } from "npm:@signpdf/signer-p12@3.2.4";
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.2.4";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Module-level cache of the signing material across warm invocations.
let CACHED_P12: Buffer | null = null;
let CACHED_PASS: string | null = null;

function makeSelfSignedP12(pass: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 15);
  const attrs = [
    { name: "commonName", value: "NkoAha Document Certification" },
    { name: "organizationName", value: "NkoAha" },
    { name: "countryName", value: "NG" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], pass, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

// Get signing material: secrets first, then app_settings, else generate+persist.
async function getSigningMaterial(admin: any): Promise<{ p12: Buffer; pass: string }> {
  if (CACHED_P12 && CACHED_PASS) return { p12: CACHED_P12, pass: CACHED_PASS };

  const envB64 = Deno.env.get("CERT_P12_BASE64");
  const envPass = Deno.env.get("CERT_PASSPHRASE");
  if (envB64 && envPass) {
    CACHED_P12 = Buffer.from(envB64, "base64"); CACHED_PASS = envPass;
    return { p12: CACHED_P12, pass: CACHED_PASS };
  }

  const { data } = await admin.from("app_settings").select("key,value").in("key", ["cert_p12_base64", "cert_passphrase"]);
  const m: Record<string, string> = {};
  for (const r of (data || [])) m[r.key] = r.value;
  if (m["cert_p12_base64"] && m["cert_passphrase"]) {
    CACHED_P12 = Buffer.from(m["cert_p12_base64"], "base64"); CACHED_PASS = m["cert_passphrase"];
    return { p12: CACHED_P12, pass: CACHED_PASS };
  }

  // First run: generate once and persist (service role bypasses RLS).
  const pass = crypto.randomUUID().replace(/-/g, "");
  const p12 = makeSelfSignedP12(pass);
  const b64 = p12.toString("base64");
  await admin.from("app_settings").upsert([
    { key: "cert_p12_base64", value: b64, updated_at: new Date().toISOString() },
    { key: "cert_passphrase", value: pass, updated_at: new Date().toISOString() },
  ], { onConflict: "key" });
  CACHED_P12 = p12; CACHED_PASS = pass;
  return { p12, pass };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const b64In: string = typeof body.pdf === "string" ? body.pdf : "";
    if (!b64In || b64In.length < 100) return json({ error: "No PDF supplied." }, 400);
    const documentId = typeof body.documentId === "string" ? body.documentId : null;
    const signerName = (typeof body.signerName === "string" ? body.signerName : "").slice(0, 160);
    const title = (typeof body.title === "string" ? body.title : "").slice(0, 200);

    // ── Identify the caller ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization bearer token." }, 401);
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await authed.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Load + flatten ──
    const inputBytes = new Uint8Array(Buffer.from(b64In, "base64"));
    let pdfDoc: any;
    try {
      pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
    } catch (_e) {
      return json({ error: "Could not read the PDF to certify." }, 400);
    }
    try { pdfDoc.getForm().flatten(); } catch (_e) { /* no form fields — fine */ }

    // ── Visible certification seal on every page ──
    const certId = "NK-" + crypto.randomUUID().split("-")[0].toUpperCase() + "-" + crypto.randomUUID().split("-")[0].toUpperCase();
    const when = new Date().toISOString().slice(0, 10);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const sealText = `Certified by NkoAha  ·  ${certId}  ·  ${when}  ·  Any change invalidates this certificate`;
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width } = page.getSize();
      page.drawRectangle({ x: 24, y: 16, width: width - 48, height: 18, color: rgb(0.96, 0.95, 0.99), borderColor: rgb(0.49, 0.35, 0.83), borderWidth: 0.6 });
      page.drawText(sealText, { x: 30, y: 21, size: 7, font, color: rgb(0.35, 0.25, 0.55) });
    }
    pdfDoc.setTitle(title || "Certified document");
    pdfDoc.setProducer("NkoAha");
    pdfDoc.setCreator("NkoAha Document Certification");

    const sealedBytes = await pdfDoc.save({ useObjectStreams: false });

    // ── Add signature placeholder + sign ──
    const placeholderDoc = await PDFDocument.load(sealedBytes);
    pdflibAddPlaceholder({
      pdfDoc: placeholderDoc,
      reason: "Certified & locked by NkoAha — tamper-evident",
      contactInfo: "support@nkoaha.space",
      name: signerName ? `NkoAha Certification — signed via ${signerName}` : "NkoAha Certification",
      location: "Nigeria",
      signatureLength: 8192,
    });
    const withPlaceholder = Buffer.from(await placeholderDoc.save({ useObjectStreams: false }));

    const { p12, pass } = await getSigningMaterial(admin);
    let signed: Buffer;
    try {
      const signer = new P12Signer(p12, { passphrase: pass });
      signed = await new SignPdf().sign(withPlaceholder, signer);
    } catch (e) {
      return json({ error: "Certification signing failed.", detail: String((e as Error)?.message || e).slice(0, 600) }, 502);
    }

    const signedBytes = new Uint8Array(signed);
    const fingerprint = await sha256Hex(signedBytes);

    // ── Record the certificate (service role; best-effort) ──
    try {
      await admin.from("document_certifications").insert({
        cert_id: certId,
        document_id: documentId,
        fingerprint,
        signer_name: signerName || null,
        certified_by: user.id,
      });
    } catch (_e) { /* recording must never fail the download */ }

    return json({ pdf: Buffer.from(signedBytes).toString("base64"), certId, fingerprint });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}