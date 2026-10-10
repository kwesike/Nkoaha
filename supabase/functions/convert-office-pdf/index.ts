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
import { unzipSync, zipSync } from "https://esm.sh/fflate@0.8.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API = "https://api.ilovepdf.com";

// ── Make a spreadsheet print without clipping ──────────────────────────────
// Excel/LibreOffice print a sheet at 100% scale in portrait by default, so any
// columns past one page width get chopped off when converted to PDF. We edit
// ONLY the page-setup XML inside the .xlsx (no cell/content changes) to:
//   • fit all columns to one page width  (fitToWidth=1, fitToHeight=0)
//   • print landscape for more room
// which is exactly Excel's "Fit All Columns on One Page". Everything else in
// the workbook is preserved byte-for-byte. On ANY failure we return the
// original bytes so conversion still succeeds (worst case = old behaviour).
function fitXlsxToWidth(bytes: Uint8Array): Uint8Array {
  try {
    const files = unzipSync(bytes);
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    let changed = false;
    for (const path of Object.keys(files)) {
      if (
        !path.startsWith("xl/worksheets/sheet") ||
        !path.endsWith(".xml") ||
        path.includes("/_rels/")
      ) continue;
      let xml = dec.decode(files[path]);

      // 1) sheetPr must carry <pageSetUpPr fitToPage="1"/> or fitToWidth/Height
      //    are ignored by the spec.
      if (/<sheetPr\b[^>]*\/>/.test(xml)) {
        xml = xml.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
      } else if (/<sheetPr\b[^>]*>/.test(xml)) {
        if (/<pageSetUpPr\b[^>]*>/.test(xml)) {
          xml = xml.replace(/<pageSetUpPr\b([^>]*?)\s*\/?>/, (_m, a) => {
            let attrs = a as string;
            attrs = /fitToPage\s*=/.test(attrs)
              ? attrs.replace(/fitToPage\s*=\s*"[^"]*"/, 'fitToPage="1"')
              : attrs + ' fitToPage="1"';
            return `<pageSetUpPr${attrs}/>`;
          });
        } else {
          // pageSetUpPr is the last optional child of sheetPr — insert before close.
          xml = xml.replace(/<\/sheetPr>/, '<pageSetUpPr fitToPage="1"/></sheetPr>');
        }
      } else {
        // No sheetPr at all — it must be the first child of <worksheet>.
        xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
      }

      // 2) pageSetup: landscape + fit to width, unlimited pages tall.
      if (/<pageSetup\b[^>]*>/.test(xml)) {
        xml = xml.replace(/<pageSetup\b([^>]*?)\s*\/?>/, (_m, a) => {
          let attrs = a as string;
          const set = (name: string, val: string) => {
            const re = new RegExp(name + '\\s*=\\s*"[^"]*"');
            attrs = re.test(attrs) ? attrs.replace(re, `${name}="${val}"`) : attrs + ` ${name}="${val}"`;
          };
          set("orientation", "landscape");
          set("fitToWidth", "1");
          set("fitToHeight", "0");
          return `<pageSetup${attrs}/>`;
        });
      } else if (/<pageMargins\b[^>]*>/.test(xml)) {
        // pageSetup follows pageMargins in schema order.
        xml = xml.replace(/(<pageMargins\b[^>]*\/?>)/, '$1<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
      } else {
        xml = xml.replace(/<\/worksheet>/, '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');
      }

      files[path] = enc.encode(xml);
      changed = true;
    }
    if (!changed) return bytes;
    return zipSync(files);
  } catch (_e) {
    return bytes; // never block conversion on a page-setup tweak
  }
}

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

    // Which iLovePDF tool to run. Defaults to officepdf (Office→PDF) so existing
    // callers keep working. convert-before-send passes others, e.g. pdfoffice
    // (PDF→Word). Allow-list to avoid arbitrary tool strings.
    const TOOLS = ["officepdf", "pdfoffice"];
    const requestedTool = String(form.get("tool") || "officepdf");
    const tool = TOOLS.includes(requestedTool) ? requestedTool : "officepdf";

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

    // ── 2. Start the conversion task → assigned server + task id ──
    const startRes = await fetch(`${API}/v1/start/${tool}`, { headers: bearer });
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
    // For spreadsheets, first adjust page setup so wide columns aren't clipped
    // when converted to PDF (fit-to-width + landscape). Other formats upload
    // unchanged.
    let uploadBlob: Blob = file;
    if (tool === "officepdf" && /\.xlsx$/i.test(filename)) {
      try {
        const inBytes = new Uint8Array(await file.arrayBuffer());
        const outBytes = fitXlsxToWidth(inBytes);
        uploadBlob = new Blob([outBytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      } catch (_e) {
        uploadBlob = file; // fall back to the original on any error
      }
    }
    const upForm = new FormData();
    upForm.append("task", task);
    upForm.append("file", uploadBlob, filename);
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
        tool,
        files: [{ server_filename: serverFilename, filename }],
      }),
    });
    if (!procRes.ok) {
      return json({ error: "iLovePDF process failed", detail: await safeText(procRes) }, 502);
    }

    // ── 5. Download the result ──
    const dlRes = await fetch(`${base}/v1/download/${task}`, { headers: bearer });
    if (!dlRes.ok) {
      return json({ error: "iLovePDF download failed", detail: await safeText(dlRes) }, 502);
    }
    const outBytes = new Uint8Array(await dlRes.arrayBuffer());

    // Output type depends on the tool: officepdf→pdf, pdfoffice→docx.
    const outExt  = tool === "pdfoffice" ? "docx" : "pdf";
    const outMime = tool === "pdfoffice"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    return new Response(outBytes, {
      headers: {
        ...CORS,
        "Content-Type": outMime,
        "Content-Disposition": `attachment; filename="${filename.replace(/\.[^.]+$/, "")}.${outExt}"`,
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