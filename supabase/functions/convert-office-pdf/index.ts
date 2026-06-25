// @ts-nocheck
// Supabase Edge Function: convert-office-pdf
// Converts an uploaded Office file (DOCX/DOC/PPTX/XLSX) to PDF using the
// iLovePDF (iLoveAPI) REST API. The iLovePDF keys live in Supabase secrets and
// NEVER reach the browser.
//
// Flow (iLovePDF "officepdf" tool):
//   1. auth     -> POST /v1/auth        (public_key)            -> JWT token
//   2. start    -> GET  /v1/start/officepdf (Bearer token)     -> server + task
//   3. upload   -> POST {server}/v1/upload (multipart file)    -> server_filename
//   4. process  -> POST {server}/v1/process                    -> converts
//   5. download -> GET  {server}/v1/download/{task}            -> PDF bytes
//
// Required Supabase secrets:
//   ILOVEPDF_PUBLIC_KEY  (project_public_... from your iLovePDF dashboard)
//
// The client sends the file as multipart/form-data under the field "file".
// Returns the resulting PDF with Content-Type application/pdf.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API = "https://api.ilovepdf.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const PUBLIC_KEY = Deno.env.get("ILOVEPDF_PUBLIC_KEY");
    if (!PUBLIC_KEY) {
      return json({ error: "Server not configured: ILOVEPDF_PUBLIC_KEY missing." }, 500);
    }

    // ── Receive the uploaded file ──
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "No file provided (expected multipart field 'file')." }, 400);
    }
    const filename = (file.name || "document.docx").replace(/[^a-zA-Z0-9._-]/g, "_");

    // ── 1. Auth: get a JWT from the public key ──
    const authRes = await fetch(`${API}/v1/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: PUBLIC_KEY }),
    });
    if (!authRes.ok) {
      return json({ error: "iLovePDF auth failed", detail: await safeText(authRes) }, 502);
    }
    const { token } = await authRes.json();
    if (!token) return json({ error: "iLovePDF auth returned no token." }, 502);
    const bearer = { Authorization: `Bearer ${token}` };

    // ── 2. Start an officepdf task → assigned server + task id ──
    const startRes = await fetch(`${API}/v1/start/officepdf`, { headers: bearer });
    if (!startRes.ok) {
      return json({ error: "iLovePDF start failed", detail: await safeText(startRes) }, 502);
    }
    const startData = await startRes.json();
    const server = startData.server;
    const task = startData.task;
    if (!server || !task) {
      return json({ error: "iLovePDF start missing server/task.", detail: JSON.stringify(startData) }, 502);
    }
    const base = `https://${server}`;

    // ── 3. Upload the file ──
    const upForm = new FormData();
    upForm.append("task", task);
    upForm.append("file", file, filename);
    const upRes = await fetch(`${base}/v1/upload`, {
      method: "POST",
      headers: bearer,
      body: upForm,
    });
    if (!upRes.ok) {
      return json({ error: "iLovePDF upload failed", detail: await safeText(upRes) }, 502);
    }
    const upData = await upRes.json();
    const serverFilename = upData.server_filename;
    if (!serverFilename) {
      return json({ error: "iLovePDF upload returned no server_filename.", detail: JSON.stringify(upData) }, 502);
    }

    // ── 4. Process (convert to PDF) ──
    const procRes = await fetch(`${base}/v1/process`, {
      method: "POST",
      headers: { ...bearer, "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        tool: "officepdf",
        files: [{ server_filename: serverFilename, filename }],
      }),
    });
    if (!procRes.ok) {
      return json({ error: "iLovePDF process failed", detail: await safeText(procRes) }, 502);
    }

    // ── 5. Download the resulting PDF ──
    const dlRes = await fetch(`${base}/v1/download/${task}`, { headers: bearer });
    if (!dlRes.ok) {
      return json({ error: "iLovePDF download failed", detail: await safeText(dlRes) }, 502);
    }
    const pdfBytes = new Uint8Array(await dlRes.arrayBuffer());

    return new Response(pdfBytes, {
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/\.[^.]+$/, "")}.pdf"`,
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