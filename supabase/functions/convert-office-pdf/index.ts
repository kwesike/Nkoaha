// @ts-nocheck
// Supabase Edge Function: convert-office-pdf   (Office → PDF)
//
// Switchable providers, chosen from the admin panel, with AUTO-FALLBACK:
//   • iLovePDF   (ILOVEPDF_PUBLIC_KEY)                 — primary
//   • OnlyOffice (ONLYOFFICE_URL [+ ONLYOFFICE_JWT_SECRET]) — backup, both directions
// app_settings.active_convert_provider: 'default' (iLovePDF) | 'onlyoffice'.
// A form field "provider" can override per request. If the chosen provider
// errors, the other is tried automatically.
//
// OnlyOffice needs a running Document Server (self-hosted via Docker) reachable
// at ONLYOFFICE_URL; the function uploads the input to a short-lived temp path
// in the 'documents' bucket so the Document Server can fetch it by URL, then
// cleans it up. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy: supabase functions deploy convert-office-pdf --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { unzipSync, zipSync } from "https://esm.sh/fflate@0.8.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ILOVE_API = "https://api.ilovepdf.com";

const OFFICE_MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc:  "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls:  "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt:  "application/vnd.ms-powerpoint",
};

// ── Spreadsheet fit-to-width (provider-agnostic preprocessing) ─────────────
function fitXlsxToWidth(bytes: Uint8Array): Uint8Array {
  try {
    const files = unzipSync(bytes);
    const dec = new TextDecoder(); const enc = new TextEncoder();
    let changed = false;
    for (const path of Object.keys(files)) {
      if (!path.startsWith("xl/worksheets/sheet") || !path.endsWith(".xml") || path.includes("/_rels/")) continue;
      let xml = dec.decode(files[path]);
      if (/<sheetPr\b[^>]*\/>/.test(xml)) {
        xml = xml.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
      } else if (/<sheetPr\b[^>]*>/.test(xml)) {
        if (/<pageSetUpPr\b[^>]*>/.test(xml)) {
          xml = xml.replace(/<pageSetUpPr\b([^>]*?)\s*\/?>/, (_m, a) => {
            let attrs = a as string;
            attrs = /fitToPage\s*=/.test(attrs) ? attrs.replace(/fitToPage\s*=\s*"[^"]*"/, 'fitToPage="1"') : attrs + ' fitToPage="1"';
            return `<pageSetUpPr${attrs}/>`;
          });
        } else { xml = xml.replace(/<\/sheetPr>/, '<pageSetUpPr fitToPage="1"/></sheetPr>'); }
      } else { xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'); }
      if (/<pageSetup\b[^>]*>/.test(xml)) {
        xml = xml.replace(/<pageSetup\b([^>]*?)\s*\/?>/, (_m, a) => {
          let attrs = a as string;
          const set = (n: string, v: string) => { const re = new RegExp(n + '\\s*=\\s*"[^"]*"'); attrs = re.test(attrs) ? attrs.replace(re, `${n}="${v}"`) : attrs + ` ${n}="${v}"`; };
          set("orientation", "landscape"); set("fitToWidth", "1"); set("fitToHeight", "0");
          return `<pageSetup${attrs}/>`;
        });
      } else if (/<pageMargins\b[^>]*>/.test(xml)) {
        xml = xml.replace(/(<pageMargins\b[^>]*\/?>)/, '$1<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
      } else { xml = xml.replace(/<\/worksheet>/, '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>'); }
      files[path] = enc.encode(xml); changed = true;
    }
    return changed ? zipSync(files) : bytes;
  } catch (_e) { return bytes; }
}

// ── iLovePDF (officepdf / pdfoffice) ───────────────────────────────────────
async function convertWithIlovePdf(uploadBlob: Blob, filename: string, tool: string): Promise<Uint8Array> {
  const PUBLIC_KEY = Deno.env.get("ILOVEPDF_PUBLIC_KEY");
  if (!PUBLIC_KEY) throw new Error("ILOVEPDF_PUBLIC_KEY missing");
  const authRes = await fetch(`${ILOVE_API}/v1/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ public_key: PUBLIC_KEY }) });
  if (!authRes.ok) throw new Error("iLovePDF auth failed: " + await safeText(authRes));
  const { token } = await authRes.json();
  if (!token) throw new Error("iLovePDF auth returned no token");
  const bearer = { Authorization: `Bearer ${token}` };
  const startRes = await fetch(`${ILOVE_API}/v1/start/${tool}`, { headers: bearer });
  if (!startRes.ok) throw new Error("iLovePDF start failed: " + await safeText(startRes));
  const sd = await startRes.json(); const server = sd.server, task = sd.task;
  if (!server || !task) throw new Error("iLovePDF start missing server/task");
  const base = `https://${server}`;
  const upForm = new FormData(); upForm.append("task", task); upForm.append("file", uploadBlob, filename);
  const upRes = await fetch(`${base}/v1/upload`, { method: "POST", headers: bearer, body: upForm });
  if (!upRes.ok) throw new Error("iLovePDF upload failed: " + await safeText(upRes));
  const serverFilename = (await upRes.json()).server_filename;
  if (!serverFilename) throw new Error("iLovePDF upload returned no server_filename");
  const procRes = await fetch(`${base}/v1/process`, { method: "POST", headers: { ...bearer, "Content-Type": "application/json" }, body: JSON.stringify({ task, tool, files: [{ server_filename: serverFilename, filename }] }) });
  if (!procRes.ok) throw new Error("iLovePDF process failed: " + await safeText(procRes));
  const dlRes = await fetch(`${base}/v1/download/${task}`, { headers: bearer });
  if (!dlRes.ok) throw new Error("iLovePDF download failed: " + await safeText(dlRes));
  return new Uint8Array(await dlRes.arrayBuffer());
}

// ── Adobe PDF Services (both directions) ───────────────────────────────────
// Free tier: 500 document transactions / month. Credentials (server-side only):
//   ADOBE_CLIENT_ID + ADOBE_CLIENT_SECRET.  op "createpdf" = Office→PDF,
//   "exportpdf" (+ targetFormat) = PDF→Office.
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

// ── OnlyOffice Document Server conversion (both directions) ────────────────
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
export async function convertWithOnlyOffice(inputBytes: Uint8Array, inFiletype: string, outputtype: string): Promise<Uint8Array> {
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

    const params: any = {
      async: false, filetype: inFiletype, outputtype,
      key: `nk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: `input.${inFiletype}`, url: inputUrl,
    };
    if (SECRET) params.token = await signJwt(params, SECRET); // in-body JWT (ConvertService)
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
    try { await sb.storage.from("documents").remove([tmpPath]); } catch (_e) { /* best-effort cleanup */ }
  }
}

// 'default' (iLovePDF) | 'adobe' | 'onlyoffice'
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
    const filename = (file.name || "document.docx").replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = (filename.split(".").pop() || "docx").toLowerCase();

    const TOOLS = ["officepdf", "pdfoffice"];
    const requestedTool = String(form.get("tool") || "officepdf");
    const tool = TOOLS.includes(requestedTool) ? requestedTool : "officepdf";
    const chosen = await activeProvider(form.get("provider") as string | null);

    // PDF→Office (pdfoffice): iLovePDF primary, Adobe + OnlyOffice backups.
    if (tool === "pdfoffice") {
      const first = chosen === "onlyoffice" ? "onlyoffice" : chosen === "adobe" ? "adobe" : "ilovepdf";
      const order = [first, ...["ilovepdf", "adobe", "onlyoffice"].filter(p => p !== first)];
      const errs: string[] = [];
      for (const prov of order) {
        try {
          const bytes = prov === "onlyoffice"
            ? await convertWithOnlyOffice(new Uint8Array(await file.arrayBuffer()), "pdf", "docx")
            : prov === "adobe"
            ? await convertWithAdobe(new Uint8Array(await file.arrayBuffer()), "application/pdf", "exportpdf", "docx")
            : await convertWithIlovePdf(file, filename, "pdfoffice");
          return fileResponse(bytes, filename, "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", prov);
        } catch (e) { errs.push(`${prov}: ${String((e as Error)?.message || e)}`); }
      }
      return json({ error: "All conversion providers failed.", detail: errs.join(" | ") }, 502);
    }

    // Office→PDF: fit spreadsheets first (provider-agnostic).
    let uploadBytes = new Uint8Array(await file.arrayBuffer());
    if (/\.xlsx$/i.test(filename)) { try { uploadBytes = fitXlsxToWidth(uploadBytes); } catch (_e) { /* keep original */ } }
    const uploadBlob = new Blob([uploadBytes]);

    const first = chosen === "onlyoffice" ? "onlyoffice" : chosen === "adobe" ? "adobe" : "ilovepdf";
    const order = [first, ...["ilovepdf", "adobe", "onlyoffice"].filter(p => p !== first)];
    const errors: string[] = [];
    for (const prov of order) {
      try {
        const bytes = prov === "onlyoffice"
          ? await convertWithOnlyOffice(uploadBytes, ext, "pdf")
          : prov === "adobe"
          ? await convertWithAdobe(uploadBytes, OFFICE_MIME[ext] || OFFICE_MIME.docx, "createpdf")
          : await convertWithIlovePdf(uploadBlob, filename, "officepdf");
        return fileResponse(bytes, filename, "pdf", "application/pdf", prov);
      } catch (e) { errors.push(`${prov}: ${String((e as Error)?.message || e)}`); }
    }
    return json({ error: "All conversion providers failed.", detail: errors.join(" | ") }, 502);
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function fileResponse(bytes: Uint8Array, filename: string, ext: string, mime: string, provider: string) {
  return new Response(bytes, {
    headers: { ...CORS, "Content-Type": mime, "X-Convert-Provider": provider, "Content-Disposition": `attachment; filename="${filename.replace(/\.[^.]+$/, "")}.${ext}"` },
  });
}
function json(obj: unknown, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }
async function safeText(r: Response) { try { return await r.text(); } catch { return "(no body)"; } }