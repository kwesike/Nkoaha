// @ts-nocheck
// Supabase Edge Function: convert-pdf-to-word   (PDF → Office)
//
// Converts a PDF into an editable Office file (docx | xlsx | pptx) with
// switchable providers + AUTO-FALLBACK (each is tried in turn):
//   • ConvertAPI (CONVERTAPI_TOKEN)                         — primary
//   • Adobe PDF Services (ADOBE_CLIENT_ID + ADOBE_CLIENT_SECRET) — free 500/mo
//   • OnlyOffice (ONLYOFFICE_URL [+ ONLYOFFICE_JWT_SECRET]) — self-hosted backup
// app_settings.active_convert_provider: 'default' (ConvertAPI) | 'adobe' | 'onlyoffice'.
// With Adobe creds set, PDF→Word works even on 'default': ConvertAPI is tried
// first, and if it's out of credits the request auto-falls back to Adobe.
// A form field "provider" overrides per request. Pass the target format with a
// "to" field (docx | xlsx | pptx); defaults to docx.
//
// OnlyOffice needs a running Document Server reachable at ONLYOFFICE_URL; the
// function uploads the PDF to a short-lived temp path in the 'documents' bucket
// so the Document Server can fetch it by URL, then cleans it up. Requires
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy: supabase functions deploy convert-pdf-to-word --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TARGETS: Record<string, { mime: string; ext: string }> = {
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   ext: "docx" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         ext: "xlsx" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx" },
};

// ── ConvertAPI (pdf → target) ──────────────────────────────────────────────
async function convertWithConvertApi(file: File, target: string): Promise<Uint8Array> {
  const TOKEN = Deno.env.get("CONVERTAPI_TOKEN");
  if (!TOKEN) throw new Error("CONVERTAPI_TOKEN missing");
  const apiForm = new FormData();
  apiForm.append("File", file, file.name || "document.pdf");
  apiForm.append("StoreFile", "false");
  const res = await fetch(`https://v2.convertapi.com/convert/pdf/to/${target}`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: apiForm });
  if (!res.ok) throw new Error("ConvertAPI failed: " + await safeText(res));
  const data = await res.json();
  const out = data?.Files?.[0];
  if (!out) throw new Error("ConvertAPI returned no file");
  if (out.FileData) return Uint8Array.from(atob(out.FileData), c => c.charCodeAt(0));
  if (out.Url) { const fr = await fetch(out.Url); if (!fr.ok) throw new Error("ConvertAPI download failed: " + await safeText(fr)); return new Uint8Array(await fr.arrayBuffer()); }
  throw new Error("ConvertAPI response had neither FileData nor Url");
}

// ── Adobe PDF Services (pdf → target) ──────────────────────────────────────
// Free tier: 500 document transactions / month (resets monthly). Credentials:
//   ADOBE_CLIENT_ID + ADOBE_CLIENT_SECRET  (server-side Supabase secrets only).
// Flow: token → create asset → PUT upload → exportpdf job → poll → download.
async function convertWithAdobe(inputBytes: Uint8Array, inMediaType: string, op: "exportpdf" | "createpdf", targetFormat?: string): Promise<Uint8Array> {
  const id = Deno.env.get("ADOBE_CLIENT_ID"); const secret = Deno.env.get("ADOBE_CLIENT_SECRET");
  if (!id || !secret) throw new Error("ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET missing");
  const BASE = "https://pdf-services.adobe.io";
  const tr = await fetch(`${BASE}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}` });
  if (!tr.ok) throw new Error("Adobe token failed: " + await safeText(tr));
  const token = (await tr.json())?.access_token;
  if (!token) throw new Error("Adobe token: no access_token");
  const H = { "Authorization": `Bearer ${token}`, "X-API-Key": id };
  const ar = await fetch(`${BASE}/assets`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ mediaType: inMediaType }) });
  if (!ar.ok) throw new Error("Adobe asset create failed: " + await safeText(ar));
  const asset = await ar.json(); const uploadUri = asset?.uploadUri; const assetID = asset?.assetID;
  if (!uploadUri || !assetID) throw new Error("Adobe asset: missing uploadUri/assetID");
  const pr = await fetch(uploadUri, { method: "PUT", headers: { "Content-Type": inMediaType }, body: inputBytes });
  if (!pr.ok) throw new Error("Adobe upload failed: HTTP " + pr.status);
  const jobBody: any = { assetID };
  if (op === "exportpdf") jobBody.targetFormat = targetFormat;
  const jr = await fetch(`${BASE}/operation/${op}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(jobBody) });
  if (jr.status !== 201 && !jr.ok) throw new Error(`Adobe ${op} failed: ` + await safeText(jr));
  const loc = jr.headers.get("location");
  if (!loc) throw new Error(`Adobe ${op}: no polling location header`);
  let downloadUri = "";
  for (let i = 0; i < 30; i++) {
    const sr = await fetch(loc, { headers: H });
    if (!sr.ok) throw new Error("Adobe poll failed: " + await safeText(sr));
    const sd = await sr.json(); const st = String(sd?.status || "").toLowerCase();
    if (st === "done") { downloadUri = sd?.asset?.downloadUri || sd?.asset?.downloadURI || sd?.assetList?.[0]?.downloadUri || ""; break; }
    if (st === "failed") throw new Error("Adobe job failed: " + (sd?.error?.message || JSON.stringify(sd?.error || {})));
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!downloadUri) throw new Error("Adobe job timed out / no downloadUri");
  const dr = await fetch(downloadUri);
  if (!dr.ok) throw new Error("Adobe result download failed: HTTP " + dr.status);
  return new Uint8Array(await dr.arrayBuffer());
}

// ── OnlyOffice Document Server conversion ──────────────────────────────────
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = new Uint8Array(buf as any); let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signJwt(payload: unknown, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${head}.${body}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}
async function convertWithOnlyOffice(inputBytes: Uint8Array, inFiletype: string, outputtype: string): Promise<Uint8Array> {
  const DS = Deno.env.get("ONLYOFFICE_URL");
  if (!DS) throw new Error("ONLYOFFICE_URL missing");
  const SECRET = Deno.env.get("ONLYOFFICE_JWT_SECRET") || "";
  const SB_URL = Deno.env.get("SUPABASE_URL"); const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SB_URL || !SB_KEY) throw new Error("OnlyOffice needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for the temp file URL");
  const sb = createClient(SB_URL, SB_KEY);
  const tmpPath = `onlyoffice-tmp/${Date.now()}_${Math.random().toString(36).slice(2)}.${inFiletype}`;
  const up = await sb.storage.from("documents").upload(tmpPath, new Blob([inputBytes]), { contentType: "application/octet-stream", upsert: true });
  if (up.error) throw new Error("OnlyOffice temp upload failed: " + up.error.message);
  try {
    const signed = await sb.storage.from("documents").createSignedUrl(tmpPath, 600);
    const inputUrl = signed.data?.signedUrl;
    if (!inputUrl) throw new Error("Could not sign OnlyOffice temp URL");
    const params: any = { async: false, filetype: inFiletype, outputtype, key: `nk_${Date.now()}_${Math.random().toString(36).slice(2)}`, title: `input.${inFiletype}`, url: inputUrl };
    if (SECRET) params.token = await signJwt(params, SECRET);
    const headers: any = { "Content-Type": "application/json", "Accept": "application/json" };
    if (SECRET) headers["Authorization"] = `Bearer ${await signJwt({ payload: params }, SECRET)}`;
    const endpoint = `${DS.replace(/\/+$/, "")}/ConvertService.ashx`;
    let fileUrl = "";
    for (let i = 0; i < 20; i++) {
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(params) });
      if (!res.ok) throw new Error("OnlyOffice HTTP " + res.status + ": " + await safeText(res));
      const data = await res.json();
      if (data.error) throw new Error("OnlyOffice error code " + data.error);
      if (data.endConvert && data.fileUrl) { fileUrl = data.fileUrl; break; }
      await new Promise(r => setTimeout(r, 1500));
    }
    if (!fileUrl) throw new Error("OnlyOffice did not finish converting in time");
    const fr = await fetch(fileUrl);
    if (!fr.ok) throw new Error("OnlyOffice result download failed: " + await safeText(fr));
    return new Uint8Array(await fr.arrayBuffer());
  } finally {
    try { await sb.storage.from("documents").remove([tmpPath]); } catch (_e) { /* best-effort */ }
  }
}

async function activeProvider(formOverride: string | null): Promise<string> {
  const o = (formOverride || "").toLowerCase();
  if (o === "onlyoffice" || o === "default" || o === "adobe") return o;
  try {
    const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const sb = createClient(url, key);
      const { data } = await sb.from("app_settings").select("value").eq("key", "active_convert_provider").maybeSingle();
      const v = (data?.value || "").toLowerCase();
      if (v === "onlyoffice" || v === "default" || v === "adobe") return v;
    }
  } catch (_e) { /* default */ }
  return "default";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "No file provided (expected multipart field 'file')." }, 400);
    const requested = String(form.get("to") || "docx").toLowerCase();
    const target = TARGETS[requested] ? requested : "docx";

    const chosen = await activeProvider(form.get("provider") as string | null);
    const first = chosen === "onlyoffice" ? "onlyoffice" : chosen === "adobe" ? "adobe" : "convertapi";
    const order = [first, ...["convertapi", "adobe", "onlyoffice"].filter(p => p !== first)];
    const errors: string[] = [];
    for (const prov of order) {
      try {
        const bytes = prov === "onlyoffice"
          ? await convertWithOnlyOffice(new Uint8Array(await file.arrayBuffer()), "pdf", target)
          : prov === "adobe"
          ? await convertWithAdobe(new Uint8Array(await file.arrayBuffer()), "application/pdf", "exportpdf", target)
          : await convertWithConvertApi(file, target);
        return new Response(bytes, {
          headers: {
            ...CORS,
            "Content-Type": TARGETS[target].mime,
            "X-Convert-Provider": prov,
            "Content-Disposition": `attachment; filename="${(file.name || "document").replace(/\.[^.]+$/, "")}.${TARGETS[target].ext}"`,
          },
        });
      } catch (e) { errors.push(`${prov}: ${String((e as Error)?.message || e)}`); }
    }
    return json({ error: "All conversion providers failed.", detail: errors.join(" | ") }, 502);
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }
async function safeText(r: Response) { try { return await r.text(); } catch { return "(no body)"; } }