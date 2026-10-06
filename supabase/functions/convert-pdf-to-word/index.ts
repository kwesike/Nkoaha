// @ts-nocheck
// Supabase Edge Function: convert-pdf-to-word
//
// Converts a PDF to an editable Word (.docx) using ConvertAPI. iLovePDF's API
// doesn't offer PDF→Word (only Office→PDF), so this uses ConvertAPI for that
// one direction. The secret stays in Supabase, never the browser.
//
// ConvertAPI flow (simplest form — upload + convert in one call):
//   POST https://v2.convertapi.com/convert/pdf/to/docx?Secret=XXXX
//        multipart/form-data with the PDF as "File"
//   → returns JSON with a Files[0].Url (the converted .docx) OR base64 FileData
//
// Required Supabase secret:
//   CONVERTAPI_SECRET   (your ConvertAPI secret token)
//
// Deploy: supabase functions deploy convert-pdf-to-word --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const TOKEN = Deno.env.get("CONVERTAPI_TOKEN");
    if (!TOKEN) return json({ error: "Server not configured: CONVERTAPI_TOKEN missing." }, 500);

    // ── Receive the uploaded PDF ──
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "No file provided (expected multipart field 'file')." }, 400);
    }

    // ── Call ConvertAPI: pdf → docx, return the file as base64 in JSON ──
    // Modern ConvertAPI auth = Bearer API token in the Authorization header.
    const apiForm = new FormData();
    apiForm.append("File", file, file.name || "document.pdf");
    apiForm.append("StoreFile", "false"); // return inline, don't store on their server

    const res = await fetch(
      `https://v2.convertapi.com/convert/pdf/to/docx`,
      { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: apiForm }
    );

    if (!res.ok) {
      return json({ error: "ConvertAPI conversion failed", detail: await safeText(res) }, 502);
    }

    const data = await res.json();
    // ConvertAPI returns { ConversionCost, Files: [{ FileName, FileExt, FileSize,
    //   FileData (base64)  OR  Url (download link) }] } depending on StoreFile.
    const converted = data?.Files?.[0];
    if (!converted) {
      return json({ error: "ConvertAPI returned no file.", detail: JSON.stringify(data).slice(0, 800) }, 502);
    }

    let bytes: Uint8Array;
    if (converted.FileData) {
      // Inline base64.
      bytes = Uint8Array.from(atob(converted.FileData), c => c.charCodeAt(0));
    } else if (converted.Url) {
      // Download link — fetch the actual bytes.
      const fileRes = await fetch(converted.Url);
      if (!fileRes.ok) {
        return json({ error: "Could not download the converted file from ConvertAPI.", detail: await safeText(fileRes) }, 502);
      }
      bytes = new Uint8Array(await fileRes.arrayBuffer());
    } else {
      return json({ error: "ConvertAPI response had neither FileData nor Url.", detail: JSON.stringify(converted).slice(0, 800) }, 502);
    }

    return new Response(bytes, {
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${(file.name || "document").replace(/\.[^.]+$/, "")}.docx"`,
      },
    });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return "(no body)"; }
}