import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { JSONContent } from "@tiptap/react";
import debounce from "lodash.debounce";
import DocumentEditor from "./DocumentEditor";
import { EMPTY_DOC } from "./emptyDoc";

type SaveStatus = "saved" | "saving" | "unsaved";
type DocFormat  = "docx" | "pdf" | "new";

interface PdfOverlay {
  id: string; pageIdx: number;
  x: number; y: number;
  type: "text" | "date" | "signature" | "image";
  content: string;
  fontSize: number; // px — user can resize with scroll wheel or +/- buttons
}
interface DocumentItem {
  id: string; title: string; fileUrl: string;
  format: DocFormat; pages: number;
  pdfUrl?: string;
  pdfReady?: boolean;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#e8e6e1;--sidebar:#18181b;--sidebar-w:260px;
    --accent:#7c3aed;--accent-dark:#6d28d9;--accent-light:#ede9fe;
    --text:#1c1917;--muted:#78716c;--border:#e7e4df;
    --page:#fff;--shadow:0 1px 4px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;--page-w:816px;
  }
  .dp-root{display:flex;height:100vh;font-family:var(--font);background:var(--bg);overflow:hidden;color:var(--text)}
  .dp-sidebar{width:var(--sidebar-w);background:var(--sidebar);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid rgba(255,255,255,.05)}
  .dp-sb-head{padding:18px 12px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
  .dp-brand{display:flex;align-items:center;gap:9px;margin-bottom:14px}
  .dp-brand-mark{width:28px;height:28px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(124,58,237,.2)}
  .dp-brand-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:.04em}
  .dp-sb-actions{display:flex;flex-direction:column;gap:6px}
  .dp-sb-btn{width:100%;padding:8px 12px;border:none;border-radius:7px;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .15s}
  .dp-sb-btn.primary{background:var(--accent);color:#fff}.dp-sb-btn.primary:hover{background:var(--accent-dark)}
  .dp-sb-btn.ghost{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7)}.dp-sb-btn.ghost:hover{background:rgba(255,255,255,.1);color:#fff}
  .dp-doc-list{flex:1;overflow-y:auto;padding:6px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
  .dp-doc-section{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.22);padding:10px 8px 4px}
  .dp-doc-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;cursor:pointer;transition:background .12s;position:relative}
  .dp-doc-item:hover{background:rgba(255,255,255,.05)}
  .dp-doc-item.active{background:rgba(124,58,237,.2)}
  .dp-doc-item.active::before{content:'';position:absolute;left:0;top:22%;bottom:22%;width:2px;background:#a78bfa;border-radius:2px}
  .dp-doc-icon{width:24px;height:24px;border-radius:5px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .dp-doc-icon.pdf{color:#f87171}.dp-doc-icon.docx{color:#a78bfa}.dp-doc-icon.new{color:#6ee7b7}
  .dp-doc-meta{flex:1;min-width:0}
  .dp-doc-name{font-size:12px;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
  .dp-doc-pages{font-size:10px;color:rgba(255,255,255,.3);font-family:var(--mono);margin-top:1px}
  .dp-doc-delete{opacity:0;background:none;border:none;color:rgba(255,255,255,.25);cursor:pointer;padding:3px;border-radius:4px;display:flex;flex-shrink:0;transition:opacity .15s}
  .dp-doc-item:hover .dp-doc-delete{opacity:1}.dp-doc-delete:hover{color:#f87171}
  .dp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
  .dp-topbar{height:50px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .dp-title-input{border:none;outline:none;font-family:var(--font);font-size:15px;font-weight:500;color:var(--text);background:transparent;flex:1;min-width:0;padding:4px 8px;border-radius:6px;transition:background .15s}
  .dp-title-input:hover,.dp-title-input:focus{background:var(--bg)}
  .dp-save-badge{font-size:11px;font-family:var(--mono);padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
  .dp-save-badge.saved{background:#f0fdf4;color:#15803d}
  .dp-save-badge.saving{background:#fefce8;color:#b45309}
  .dp-save-badge.unsaved{background:#fef2f2;color:#dc2626}
  .dp-btn{padding:6px 13px;border-radius:7px;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;border:none;transition:all .15s;display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
  .dp-btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.dp-btn-ghost:hover{background:var(--bg)}
  .dp-btn-primary{background:var(--accent);color:#fff}.dp-btn-primary:hover{background:var(--accent-dark)}
  .dp-canvas{flex:1;overflow-y:auto;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:0 24px 80px;scrollbar-width:thin;scrollbar-color:#c4bfba transparent}
  .dp-page-card{width:var(--page-w);max-width:100%;background:var(--page);box-shadow:var(--shadow);border-radius:2px;flex-shrink:0;margin-bottom:20px;position:relative;overflow:hidden;box-sizing:border-box}
  .dp-hf-bar{display:flex;align-items:center;justify-content:space-between;padding:0 96px;height:36px;border-bottom:1px dashed rgba(124,58,237,.12)}
  .dp-hf-bar.footer{border-bottom:none;border-top:1px dashed rgba(124,58,237,.12)}
  .dp-hf-input{flex:1;border:none;outline:none;background:transparent;font-family:var(--font);font-size:10.5px;color:#7c3aed;font-style:italic}
  .dp-hf-input::placeholder{color:rgba(124,58,237,.28)}
  .dp-hf-pagenum{font-size:10px;font-family:var(--mono);color:#c4b5fd}
  .dp-page-body{padding:48px 96px;min-height:912px}
  .dp-docx-wrap{position:relative;width:100%;overflow:hidden}
  .dp-docx-toolbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--border);padding:6px 12px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;box-shadow:0 1px 4px rgba(0,0,0,.06);width:100%;box-sizing:border-box}
  .dp-docx-tool{padding:3px 8px;border-radius:4px;border:1px solid transparent;background:transparent;font-family:var(--font);font-size:12px;cursor:pointer;transition:all .12s;height:26px;display:inline-flex;align-items:center;gap:4px;color:var(--text)}
  .dp-docx-tool:hover{background:var(--bg);border-color:var(--border)}
  .dp-docx-tool.active{background:var(--accent-light);color:var(--accent);border-color:#c4b5fd}
  .dp-docx-sep{width:1px;height:18px;background:var(--border);margin:0 3px;flex-shrink:0}
  .dp-docx-sel{border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-family:var(--font);font-size:12px;cursor:pointer;background:#fff;height:26px;color:var(--text)}
  .dp-docx-iframe{display:block;width:100%;max-width:100%;border:none;min-height:912px;background:#fff;overflow:hidden;-webkit-font-smoothing:antialiased;image-rendering:crisp-edges}
  .dp-pdf-stage{position:relative;line-height:0;display:block}
  .dp-pdf-canvas{display:block;max-width:100%;height:auto}
  .dp-pdf-overlay-item{position:absolute;cursor:move;user-select:none;z-index:10;display:flex;align-items:flex-start}
  .dp-overlay-img{display:block;object-fit:contain;pointer-events:none;border-radius:3px;max-width:400px;}
  .dp-pdf-overlay-item:hover .dp-pdf-overlay-del{opacity:1}
  .dp-pdf-overlay-del{opacity:0;position:absolute;top:-8px;right:-8px;width:16px;height:16px;background:#ef4444;color:#fff;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:opacity .15s;z-index:11}
  .dp-overlay-resize{position:absolute;top:-22px;left:0;display:none;align-items:center;gap:3px;background:rgba(0,0,0,0.7);border-radius:4px;padding:2px 5px;z-index:12}
  .dp-pdf-overlay-item:hover .dp-overlay-resize{display:flex}
  .dp-overlay-resize button{background:none;border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:0 2px;line-height:1}
  .dp-overlay-resize span{color:#ccc;font-size:10px;font-family:monospace;min-width:28px;text-align:center}
  .dp-pdf-overlay-text{background:transparent;border:1px dashed rgba(124,58,237,.4);border-radius:2px;padding:2px 5px;font-size:13px;font-weight:700;min-width:80px;outline:none;font-family:var(--font);color:#1c1917;white-space:pre;cursor:move}
  .dp-pdf-overlay-text:focus{border-color:#7c3aed;border-style:solid;cursor:text}
  .dp-pdf-overlay-date{background:transparent;padding:2px 4px;font-size:13px;font-weight:700;font-family:var(--font);color:#1c1917;white-space:nowrap;display:block;pointer-events:none}
  .dp-pdf-toolbar{position:sticky;top:0;z-index:30;width:100%;background:#fff;border-bottom:1px solid var(--border);padding:8px 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.08);flex-shrink:0}
  .dp-pdf-toolbar-label{font-size:11px;color:var(--muted);font-family:var(--mono);margin-right:4px;flex-shrink:0}
  .dp-pdf-tool{display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:6px;border:1px solid var(--border);background:transparent;font-family:var(--font);font-size:12px;cursor:pointer;color:var(--text);transition:all .15s}
  .dp-pdf-tool:hover{background:var(--accent-light);border-color:var(--accent);color:var(--accent)}
  .dp-pdf-tool.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .dp-pdf-tool-hint{font-size:11px;color:var(--accent);font-family:var(--mono);background:var(--accent-light);padding:3px 8px;border-radius:4px}
  .dp-page-gap{display:flex;align-items:center;gap:10px;padding:4px 0 8px;font-size:10px;font-family:var(--mono);color:#a8a29e;letter-spacing:.06em;width:var(--page-w);max-width:100%}
  .dp-page-gap::before,.dp-page-gap::after{content:'';flex:1;height:1px;background:#ccc9c4}
  .dp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted)}
  .dp-empty-icon{width:72px;height:72px;border-radius:18px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin-bottom:8px}
  .dp-empty p{font-size:15px;font-weight:500;color:#44403c}
  .dp-empty span{font-size:12.5px;color:#a8a29e;text-align:center;max-width:280px;line-height:1.5}
  .dp-converting{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
  .dp-spinner{width:36px;height:36px;border:3px solid var(--accent-light);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .dp-converting p{font-size:14px;font-weight:500;color:#44403c}
  .dp-converting span{font-size:12px;color:#a8a29e}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .dp-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f3f1ee 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:4px}
  .dp-statusbar{height:28px;background:#fff;border-top:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:14px;flex-shrink:0;font-size:11px;color:var(--muted);font-family:var(--mono)}
  .dp-statusbar-r{margin-left:auto;display:flex;align-items:center;gap:6px}
  .dp-page-nav button{width:20px;height:20px;border:1px solid var(--border);background:transparent;border-radius:4px;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;transition:background .12s}
  .dp-page-nav button:disabled{opacity:.35;cursor:not-allowed}
  .dp-page-nav button:not(:disabled):hover{background:var(--bg)}
  .dp-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(3px)}
  .dp-modal{background:#fff;border-radius:14px;padding:26px;width:480px;max-width:96vw;box-shadow:0 20px 60px rgba(0,0,0,.16);animation:modal-in .16s ease}
  @keyframes modal-in{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
  .dp-modal h3{font-size:16px;font-weight:600;color:var(--accent);margin-bottom:4px}
  .dp-modal-sub{font-size:12.5px;color:var(--muted);margin-bottom:16px}
  /* Route list */
  .dp-route-list{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;padding:2px 0}
  .dp-route-user{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;cursor:pointer;transition:background .12s;border:1px solid var(--border);background:#faf9f8}
  .dp-route-user:hover{background:var(--accent-light);border-color:#c4b5fd}
  .dp-route-user.selected{background:var(--accent-light);border-color:var(--accent)}
  .dp-route-step{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .dp-route-step.unselected{background:var(--border);color:var(--muted)}
  .dp-route-user-info{flex:1;min-width:0}
  .dp-route-user-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dp-route-user-role{font-size:11px;color:var(--muted)}
  .dp-route-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap;flex-shrink:0}
  .dp-route-badge.final{background:#dcfce7;color:#16a34a}
  .dp-route-badge.middle{background:#dbeafe;color:#2563eb}
  /* Drag arrows between steps */
  .dp-route-arrow{display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:16px;opacity:.5;height:14px}
  .dp-modal-footer{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}
  .dp-ctx{position:fixed;background:#fff;border:1px solid var(--border);border-radius:9px;padding:5px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:200;min-width:160px}
  .dp-ctx-item{display:flex;align-items:center;gap:9px;padding:7px 11px;border-radius:5px;font-size:13px;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:var(--font);color:var(--text);transition:background .12s}
  .dp-ctx-item:hover{background:var(--accent-light);color:var(--accent)}
`;

const Ico = {
  Upload:  () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  NewDoc:  () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>),
  FileDoc: () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>),
  Trash:   () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>),
  Route:   () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>),
};

async function logActivity(action: string, docId: string, title: string, userId?: string) {
  await supabase.from("activity_logs").insert({ user_id: userId, action, document_id: docId, metadata: { title } });
}

async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { const lib = (window as any).pdfjsLib; lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; resolve(lib); };
    s.onerror = reject; document.head.appendChild(s);
  });
}

/* ── FIX 1: Resolve any storage path to a working signed URL ──
   Tries multiple bucket/path combos so it works regardless of
   how the signature was stored (full URL, path, with/without prefix).
*/
async function resolveStorageUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  // Already a full URL — return as-is
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  // Try all known bucket+path combinations
  const attempts = [
    ["avatars",    pathOrUrl],
    ["avatars",    `avatars/${pathOrUrl}`],
    ["avatars",    `signatures/${pathOrUrl}`],
    ["signatures", pathOrUrl],
    ["documents",  pathOrUrl],
  ] as [string, string][];
  for (const [bucket, path] of attempts) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return "";
}

async function renderPdfPage(pdfDoc: any, pageNum: number, canvas: HTMLCanvasElement) {
  const page = await pdfDoc.getPage(pageNum);
  // Use at least 2x for crisp rendering — clamp to 3x max to avoid memory issues
  const dpr   = Math.min(window.devicePixelRatio || 2, 3);
  const pageW = 816;
  const baseVp = page.getViewport({ scale: 1 });
  const scale  = (pageW / baseVp.width) * dpr;
  const vp     = page.getViewport({ scale });
  canvas.width  = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width  = pageW + "px";
  canvas.style.height = Math.floor(vp.height / dpr) + "px";
  // Force crisp rendering
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
}

async function docxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await (mammoth as any).convertToHtml({
    arrayBuffer,
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh","p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh","p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh","p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Title'] => h1:fresh","p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "b => strong","i => em","u => u","strike => s",
    ],
    convertImage: (mammoth as any).images.imgElement((img: any) =>
      img.read("base64").then((d: string) => ({ src: `data:${img.contentType};base64,${d}` }))
    ),
    includeDefaultStyleMap: true,
  } as any);
  return value || "";
}

function buildDocxIframeHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html{margin:0;padding:0;width:100%;overflow-x:hidden;
    -webkit-font-smoothing:subpixel-antialiased;
    -moz-osx-font-smoothing:auto;
    text-rendering:geometricPrecision;
    zoom:1;
  }
  body{margin:0;padding:48px 96px;background:#fff;font-family:'Times New Roman',Georgia,serif;
    font-size:12pt;line-height:1.6;color:#000;min-height:900px;outline:none;
    width:100%;max-width:100%;overflow-x:hidden;word-wrap:break-word;overflow-wrap:break-word;
    -webkit-font-smoothing:subpixel-antialiased;
    -moz-osx-font-smoothing:auto;
    text-rendering:geometricPrecision;
    font-feature-settings:"kern" 1,"liga" 1,"calt" 1;
    -webkit-text-stroke:0;
    font-smooth:always;
  }
  img{max-width:100%;height:auto;image-rendering:high-quality;image-rendering:-webkit-optimize-contrast}
  p,li,td,th,h1,h2,h3,h4{-webkit-font-smoothing:subpixel-antialiased;text-rendering:geometricPrecision}
  h1{font-size:26pt;font-weight:700;margin:14pt 0 7pt}h2{font-size:20pt;font-weight:700;margin:12pt 0 6pt}
  h3{font-size:15pt;font-weight:700;margin:10pt 0 5pt}h4{font-size:13pt;font-weight:700;margin:8pt 0 4pt}
  p{margin:0 0 8pt}p:empty::before{content:'\\00a0'}
  ul,ol{margin:0 0 8pt 2em;padding:0}li{margin:2pt 0}
  table{border-collapse:collapse;width:100%;margin:8pt 0}
  td,th{border:1px solid #bbb;padding:4pt 8pt;vertical-align:top}th{background:#f0f0f0;font-weight:700}
  strong,b{font-weight:700}em,i{font-style:italic}u{text-decoration:underline}s{text-decoration:line-through}
  blockquote{border-left:4px solid #ccc;margin:8pt 0 8pt 2em;padding-left:1em;color:#555;font-style:italic}
  a{color:#1155cc;text-decoration:underline}
  img{max-width:100%;height:auto;margin:4pt 0;display:inline-block;vertical-align:middle}
  ::selection{background:rgba(124,58,237,.2)}body{cursor:text}
</style></head>
<body contenteditable="true" spellcheck="true">${bodyHtml}</body></html>`;
}

function DocxIframeEditor({ html, onSave }: { html: string; onSave: (html: string) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    doc.open(); doc.write(buildDocxIframeHtml(html)); doc.close();
    const body = doc.body;
    if (!body) return;
    const onChange = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { onSave(body.innerHTML); }, 600);
    };
    body.addEventListener("input", onChange);
    body.addEventListener("keyup", onChange);
    const resize = () => {
      if (!iframe || !doc.body) return;
      iframe.style.height = "0px";
      iframe.style.height = Math.max(912, doc.body.scrollHeight + 2) + "px";
    };
    new (window as any).ResizeObserver(resize).observe(doc.body);
    new MutationObserver(resize).observe(doc.body, { childList:true, subtree:true, characterData:true });
    resize();
  }, [html, onSave]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.addEventListener("load", initIframe);
    iframe.src = "about:blank";
    return () => iframe.removeEventListener("load", initIframe);
  }, [initIframe]);

  const exec = (cmd: string, val?: string) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.execCommand(cmd, false, val ?? "");
    iframeRef.current?.contentWindow?.focus();
  };
  const qState = (cmd: string) => {
    try { return iframeRef.current?.contentDocument?.queryCommandState(cmd) ?? false; } catch { return false; }
  };

  return (
    <div className="dp-docx-wrap">
      <div className="dp-docx-toolbar" onMouseDown={e => e.preventDefault()}>
        <select className="dp-docx-sel" onChange={e=>exec("fontName",e.target.value)} defaultValue="" title="Font">
          <option value="" disabled>Font</option>
          {["Times New Roman","Arial","Calibri","Georgia","Verdana","Courier New","Helvetica","Garamond"].map(f=>(
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select className="dp-docx-sel" onChange={e=>exec("fontSize",e.target.value)} defaultValue="" style={{width:64}}>
          <option value="" disabled>Size</option>
          {[["1","8"],["2","10"],["3","12"],["4","14"],["5","18"],["6","24"],["7","36"]].map(([v,l])=>(
            <option key={v} value={v}>{l}pt</option>
          ))}
        </select>
        <input type="color" className="dp-docx-sel" defaultValue="#000000" title="Text colour" style={{width:28,padding:"1px 2px"}} onChange={e=>exec("foreColor",e.target.value)}/>
        <input type="color" className="dp-docx-sel" defaultValue="#ffff00" title="Highlight" style={{width:28,padding:"1px 2px"}} onChange={e=>exec("hiliteColor",e.target.value)}/>
        <div className="dp-docx-sep"/>
        <button className={`dp-docx-tool${qState("bold")?" active":""}`} onClick={()=>exec("bold")}><b>B</b></button>
        <button className={`dp-docx-tool${qState("italic")?" active":""}`} onClick={()=>exec("italic")}><i>I</i></button>
        <button className={`dp-docx-tool${qState("underline")?" active":""}`} onClick={()=>exec("underline")}><u>U</u></button>
        <button className="dp-docx-tool" onClick={()=>exec("strikeThrough")}><s>S</s></button>
        <div className="dp-docx-sep"/>
        <button className={`dp-docx-tool${qState("justifyLeft")?" active":""}`} onClick={()=>exec("justifyLeft")} title="Left"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
        <button className={`dp-docx-tool${qState("justifyCenter")?" active":""}`} onClick={()=>exec("justifyCenter")} title="Center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
        <button className={`dp-docx-tool${qState("justifyRight")?" active":""}`} onClick={()=>exec("justifyRight")} title="Right"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
        <button className={`dp-docx-tool${qState("justifyFull")?" active":""}`} onClick={()=>exec("justifyFull")} title="Justify"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <div className="dp-docx-sep"/>
        <button className="dp-docx-tool" onClick={()=>exec("insertUnorderedList")} title="Bullets"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg></button>
        <button className="dp-docx-tool" onClick={()=>exec("insertOrderedList")} title="Numbered"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" strokeLinecap="round"/><path d="M4 10h2" strokeLinecap="round"/><path d="M6 18H4l2-2a1 1 0 0 0-1-1H4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <button className="dp-docx-tool" onClick={()=>exec("outdent")} title="Outdent"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="7 8 3 12 7 16"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="18" x2="11" y2="18"/></svg></button>
        <button className="dp-docx-tool" onClick={()=>exec("indent")} title="Indent"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 8 7 12 3 16"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="18" x2="11" y2="18"/></svg></button>
        <div className="dp-docx-sep"/>
        <button className="dp-docx-tool" onClick={()=>exec("undo")} title="Undo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>
        <button className="dp-docx-tool" onClick={()=>exec("redo")} title="Redo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg></button>
      </div>
      <iframe ref={iframeRef} className="dp-docx-iframe" title="Document editor"
        sandbox="allow-same-origin allow-scripts"
        style={{
          minHeight:912,width:"100%",maxWidth:"100%",display:"block",
          imageRendering:"crisp-edges",
          WebkitFontSmoothing:"subpixel-antialiased",
        }}/>
    </div>
  );
}

function splitJsonIntoPages(doc: JSONContent): JSONContent[] {
  const blocks = doc.content || [];
  if (!blocks.length) return [{ type:"doc", content:[{ type:"paragraph" }] }];
  const LPP=38, CPL=83;
  function chars(n: JSONContent): number { return n.type==="text"?(n.text||"").length:(n.content||[]).reduce((s,c)=>s+chars(c),0); }
  function lines(b: JSONContent): number {
    const c=chars(b);
    if (b.type==="heading") return Math.ceil(c/(CPL*.7))+1;
    if (b.type==="table")   return (b.content||[]).length*2+1;
    return Math.max(1,Math.ceil(c/CPL));
  }
  const pages: JSONContent[]=[]; let cur: JSONContent[]=[], used=0;
  for (const b of blocks) {
    const l=lines(b);
    if (used+l>LPP&&cur.length) { pages.push({ type:"doc",content:cur }); cur=[]; used=0; }
    cur.push(b); used+=l;
  }
  if (cur.length) pages.push({ type:"doc",content:cur });
  return pages.length?pages:[{ type:"doc",content:[{ type:"paragraph" }] }];
}

async function convertDocxToPdfViaCloudConvert(
  docxFileUrl: string, documentId: string,
  onConverted: (pdfBlob: Blob) => Promise<void>
): Promise<void> {
  const API_KEY = import.meta.env.VITE_CLOUDCONVERT_API_KEY as string;
  if (!API_KEY) throw new Error("VITE_CLOUDCONVERT_API_KEY not set in .env");
  const BASE="https://api.cloudconvert.com/v2";
  const headers={"Authorization":`Bearer ${API_KEY}`,"Content-Type":"application/json"};
  const jobRes=await fetch(`${BASE}/jobs`,{method:"POST",headers,body:JSON.stringify({
    tag:`nkoaha-${documentId}`,
    tasks:{
      "import-file":{operation:"import/url",url:docxFileUrl,filename:"document.docx"},
      "convert-file":{operation:"convert",input:"import-file",input_format:"docx",output_format:"pdf",engine:"libreoffice"},
      "export-file":{operation:"export/url",input:"convert-file",inline:false},
    },
  })});
  if (!jobRes.ok) throw new Error(`CloudConvert failed: ${await jobRes.text()}`);
  const jobId=(await jobRes.json()).data.id;
  let pdfDownloadUrl="";
  for (let i=0;i<60;i++) {
    await new Promise(r=>setTimeout(r,2000));
    const s=await(await fetch(`${BASE}/jobs/${jobId}`,{headers})).json();
    if (s.data?.status==="finished") {
      pdfDownloadUrl=s.data.tasks?.find((t:any)=>t.name==="export-file"&&t.status==="finished")?.result?.files?.[0]?.url??"";
      break;
    }
    if (s.data?.status==="error") throw new Error("CloudConvert error");
  }
  if (!pdfDownloadUrl) throw new Error("Conversion timed out");
  const pdfRes=await fetch(pdfDownloadUrl);
  if (!pdfRes.ok) throw new Error("Failed to download PDF");
  await onConverted(await pdfRes.blob());
}

export default function DocumentsPage() {
  const [documents, setDocuments]     = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc]     = useState<DocumentItem|null>(null);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>("saved");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [converting, setConverting]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [docTitle, setDocTitle]       = useState("");
  const [header, setHeader]           = useState("");
  const [footer, setFooter]           = useState("");
  const [avatarUrl, setAvatarUrl]     = useState("");
  const [contextPos, setContextPos]   = useState<{x:number;y:number}|null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [users, setUsers]             = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string[]>([]); // ordered list of user IDs
  const [currentOrgId, setCurrentOrgId]     = useState<string|null>(null);
  const [docxHtmlPages, setDocxHtmlPages] = useState<string[]>([]);
  const [docxOverlays, setDocxOverlays]   = useState<PdfOverlay[]>([]);
  const [docxTool, setDocxTool]           = useState<"none"|"text"|"date"|"signature">("none");
  const [docxPdfDoc, setDocxPdfDoc]       = useState<any>(null);
  const [docxPdfReady, setDocxPdfReady]   = useState(false);
  const [converting2Pdf, setConverting2Pdf] = useState(false);
  const docxPdfCanvasRefs = useRef<(HTMLCanvasElement|null)[]>([]);
  const [pdfDoc, setPdfDoc]           = useState<any>(null);
  const [pdfOverlays, setPdfOverlays] = useState<PdfOverlay[]>([]);
  const [pdfTool, setPdfTool]         = useState<"none"|"text"|"date"|"signature">("none");
  const [dragOverlay, setDragOverlay] = useState<string|null>(null);
  const [dragStart, setDragStart]     = useState<{x:number;y:number}>({x:0,y:0});
  const [focusId, setFocusId]         = useState<string|null>(null);
  // Route action state — set when current user is a recipient of the active doc
  const [myRoute, setMyRoute] = useState<{id:string;is_final:boolean;status:string;route_order:number;total_steps:number}|null>(null);
  const [routeActioning, setRouteActioning] = useState(false);
  const overlayRefs = useRef<Record<string,HTMLDivElement|null>>({});
  const [editorPages, setEditorPages]       = useState<JSONContent[]>([EMPTY_DOC]);
  const [newDocOverlays, setNewDocOverlays]   = useState<PdfOverlay[]>([]);
  const location          = useLocation();
  const fileInputRef      = useRef<HTMLInputElement|null>(null);
  const imageInputRef     = useRef<HTMLInputElement|null>(null);
  const imageInputTarget  = useRef<"pdf"|"docx"|"new">("pdf"); // which doc type triggered upload
  const imagePickerOpen   = useRef<boolean>(false); // blocks PDF stage click while picker is open
  const canvasAreaRef = useRef<HTMLDivElement|null>(null);
  const pdfCanvasRefs = useRef<(HTMLCanvasElement|null)[]>([]);
  const insertDateRef = useRef<((d:string)=>void)|null>(null);
  const insertSigRef  = useRef<((s:string)=>void)|null>(null);
  const insertImgRef  = useRef<((s:string)=>void)|null>(null);

  useEffect(()=>{
    const id="dp-styles";
    if (!document.getElementById(id)){const el=document.createElement("style");el.id=id;el.textContent=STYLES;document.head.appendChild(el);}
  },[]);
  useEffect(()=>{ const fn=()=>setContextPos(null); window.addEventListener("click",fn); return()=>window.removeEventListener("click",fn); },[]);

  const autosave=useMemo(()=>debounce(async(id:string,pages:JSONContent[],title:string,hdr:string,ftr:string,overlays?:PdfOverlay[])=>{
    setSaveStatus("saving");
    const merged={type:"doc",content:pages.flatMap(p=>p.content||[])};
    await supabase.from("documents").update({content:merged,title,pages:pages.length,header:hdr,footer:ftr,annotations:overlays?JSON.stringify({newDocOverlays:overlays}):undefined}).eq("id",id);
    setSaveStatus("saved");
  },800),[]);
  useEffect(()=>()=>autosave.cancel(),[autosave]);

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user)return;
      supabase.from("profiles").select("avatar_url").eq("id",user.id).single()
        .then(({data})=>{if(data?.avatar_url)setAvatarUrl(data.avatar_url);});
    });
  },[]);

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
      // Also load documents shared/routed to this user via document_routes
      const [ownedRes, routedRes] = await Promise.all([
        supabase.from("documents")
          .select("id,title,file_url,document_kind,pages,status,format,pdf_url,pdf_ready")
          .eq("owner_id",user.id).neq("status","deleted").order("created_at",{ascending:false}),
        supabase.from("document_routes")
          .select("document_id")
          .eq("recipient_id",user.id),
      ]);
      const owned = (ownedRes.data||[]).map((d:any)=>({
        id:d.id,title:d.title,fileUrl:d.file_url||"",
        format:d.format||(d.document_kind==="upload"?"pdf":"new"),pages:d.pages||1,
        pdfUrl:d.pdf_url||"",pdfReady:d.pdf_ready||false,
      }));
      // Fetch routed documents separately to avoid join RLS issues
      const routedDocIds = (routedRes.data||[]).map((r:any)=>r.document_id).filter(Boolean);
      const ownedIds = owned.map((d:any)=>d.id);
      const newIds = routedDocIds.filter((id:string)=>!ownedIds.includes(id));
      let routedDocs:any[] = [];
      if(newIds.length>0){
        const{data:sharedDocs}=await supabase.from("documents")
          .select("id,title,file_url,document_kind,pages,status,format,pdf_url,pdf_ready")
          .in("id",newIds);
        routedDocs = (sharedDocs||[]).map((d:any)=>({
          id:d.id,title:d.title,fileUrl:d.file_url||"",
          format:d.format||(d.document_kind==="upload"?"pdf":"new"),pages:d.pages||1,
          pdfUrl:d.pdf_url||"",pdfReady:d.pdf_ready||false,
          isShared:true,
        }));
      }
      const allDocs=[...owned,...routedDocs];
      setDocuments(allDocs);

      // Auto-open document if navigated here with openDocId in state
      const openDocId=(location.state as any)?.openDocId;
      if(openDocId){
        const target=allDocs.find((d:any)=>d.id===openDocId);
        if(target) setTimeout(()=>openDocument(target),100);
      }
    })();
  },[]);

  useEffect(()=>{
    if(!pdfDoc||activeDoc?.format!=="pdf")return;
    const go=async()=>{for(let i=0;i<pdfDoc.numPages;i++){const c=pdfCanvasRefs.current[i];if(c)await renderPdfPage(pdfDoc,i+1,c);}};
    setTimeout(go,80);
  },[pdfDoc,activeDoc,totalPages]);

  useEffect(()=>{
    if(!docxPdfDoc||activeDoc?.format!=="docx")return;
    const go=async()=>{for(let i=0;i<docxPdfDoc.numPages;i++){const c=docxPdfCanvasRefs.current[i];if(c)await renderPdfPage(docxPdfDoc,i+1,c);}};
    setTimeout(go,80);
  },[docxPdfDoc,activeDoc,totalPages]);

  useEffect(()=>{
    if(!focusId)return;
    const el=overlayRefs.current[focusId];
    if(el){el.focus();const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s?.removeAllRanges();s?.addRange(r);}
    setFocusId(null);
  },[focusId,pdfOverlays]);

  const splitDocxHtmlIntoPages=(html:string):string[]=>{
    if(html.includes("page-break")||html.includes("<hr")){
      const parts=html.split(/<hr[^>]*>|<div[^>]*page-break[^>]*>.*?<\/div>/gi).map(s=>s.trim()).filter(Boolean);
      if(parts.length>1)return parts;
    }
    const PARAS=35;
    const dom=new DOMParser().parseFromString(html,"text/html");
    const children=Array.from(dom.body.children);
    if(!children.length)return[html];
    const pages:string[]=[]; let cur:string[]=[],count=0;
    for(const el of children){
      const t=el.tagName.toLowerCase();
      const w=t==="table"?Math.max(2,el.querySelectorAll("tr").length):/^h[1-3]$/.test(t)?2:1;
      if(count+w>PARAS&&cur.length){pages.push(cur.join("\n"));cur=[];count=0;}
      cur.push(el.outerHTML);count+=w;
    }
    if(cur.length)pages.push(cur.join("\n"));
    return pages.length?pages:[html];
  };

  const openDocument=async(doc:DocumentItem)=>{
    setLoading(true);
    setPdfDoc(null);setPdfOverlays([]);setPdfTool("none");
    setDocxHtmlPages([]);setDocxOverlays([]);setDocxTool('none');setDocxPdfDoc(null);setDocxPdfReady(false);
    setEditorPages([EMPTY_DOC]);
    setNewDocOverlays([]);
    setMyRoute(null);
    pdfCanvasRefs.current=[];docxPdfCanvasRefs.current=[];

    const{data,error}=await supabase.from("documents")
      .select("content,file_url,pages,title,header,footer,format,html_content,document_kind,annotations,pdf_url,pdf_ready")
      .eq("id",doc.id).single();
    if(error){console.error(error);setLoading(false);return;}

    setActiveDoc(doc);
    setDocTitle(data?.title??doc.title);
    setHeader(data?.header||"");
    setFooter(data?.footer||"");
    setCurrentPage(1);setSaveStatus("saved");

    const fmt=data?.format||doc.format;

    if(fmt==="pdf"){
      const url=data?.file_url||doc.fileUrl;
      if(!url){setLoading(false);return;}
      try{
        const pdfjs=await loadPdfJs();
        const resp=await fetch(url);
        const buf=await resp.arrayBuffer();
        const loaded=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
        setPdfDoc(loaded);setTotalPages(loaded.numPages);
        const saved=data?.annotations;
        if(saved){const p=typeof saved==="string"?JSON.parse(saved):saved;if(p?.pdfOverlays)setPdfOverlays(p.pdfOverlays);}
      }catch(e){console.error(e);}

    }else if(fmt==="docx"){
      const savedContent=data?.content?(typeof data.content==="string"?JSON.parse(data.content):data.content):null;
      if(savedContent?.format==="docx-html-edited"&&Array.isArray(savedContent.pages)){
        setDocxHtmlPages(savedContent.pages);setTotalPages(savedContent.pages.length);
        if(savedContent.overlays) setDocxOverlays(savedContent.overlays);
      }else{
        const html=data?.html_content||"";
        if(html){const pages=splitDocxHtmlIntoPages(html);setDocxHtmlPages(pages);setTotalPages(pages.length);}
        else{setDocxHtmlPages(["<p>No content. Please re-upload.</p>"]);setTotalPages(1);}
      }
      if(data?.pdf_ready&&data?.pdf_url){
        setDocxPdfReady(true);
        try{
          const pdfjs=await loadPdfJs();
          const resp=await fetch(data.pdf_url);
          const buf=await resp.arrayBuffer();
          const loaded=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
          setDocxPdfDoc(loaded);setTotalPages(loaded.numPages);
        }catch(e){console.error(e);}
      }else{
        setConverting2Pdf(true);
        try{
          await convertDocxToPdfViaCloudConvert(data?.file_url||doc.fileUrl,doc.id,async(pdfBlob:Blob)=>{
            const pdfPath=`docs/converted_${doc.id}_${Date.now()}.pdf`;
            const{error:upErr}=await supabase.storage.from("documents").upload(pdfPath,pdfBlob,{contentType:"application/pdf",upsert:true});
            if(upErr)throw new Error("PDF upload failed: "+upErr.message);
            const pdfUrl=supabase.storage.from("documents").getPublicUrl(pdfPath).data.publicUrl;
            await supabase.from("documents").update({pdf_url:pdfUrl,pdf_ready:true}).eq("id",doc.id);
            setDocxPdfReady(true);
            const pdfjs=await loadPdfJs();
            const buf=await pdfBlob.arrayBuffer();
            const loaded=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
            setDocxPdfDoc(loaded);setTotalPages(loaded.numPages);
          });
        }catch(e){console.error("CloudConvert failed:",e);}
        finally{setConverting2Pdf(false);}
      }
    }else{
      const raw=data?.content?(typeof data.content==="string"?JSON.parse(data.content):data.content):EMPTY_DOC;
      const pages=splitJsonIntoPages(raw);setEditorPages(pages);setTotalPages(pages.length);
      // Restore image overlays
      const saved=data?.annotations;
      if(saved){const p=typeof saved==="string"?JSON.parse(saved):saved;if(p?.newDocOverlays)setNewDocOverlays(p.newDocOverlays);}
    }
    setLoading(false);

    // Check if current user is a recipient of this doc
    const{data:{user:currentUser}}=await supabase.auth.getUser();
    if(currentUser){
      const{data:myRouteData}=await supabase.from("document_routes")
        .select("id,is_final,status,route_order,total_steps")
        .eq("document_id",doc.id)
        .eq("recipient_id",currentUser.id)
        .maybeSingle();
      setMyRoute(myRouteData||null);
    }
  };

  const createNew=async()=>{
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const{data,error}=await supabase.from("documents").insert({
      owner_id:user.id,sender_id:user.id,uploaded_by:user.id,
      owner_type:"individual",document_kind:"editor",format:"new",
      title:"Untitled Document",content:EMPTY_DOC,file_url:"",status:"draft",pages:1,
    }).select().single();
    if(error){alert("Could not create: "+error.message);return;}
    if(!data)return;
    const nd:DocumentItem={id:data.id,title:data.title,fileUrl:"",format:"new",pages:1};
    setDocuments(prev=>[nd,...prev]);
    await logActivity("document_created",data.id,data.title,user.id);
    openDocument(nd);
  };

  const uploadFile=async(file:File)=>{
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
    if(!file.name.match(/\.(docx|pdf)$/i)){alert("Only .docx and .pdf files are supported.");return;}
    setConverting(true);
    let fileUrl="",htmlContent="",format:DocFormat="new",pages=1;
    try{
      const path=`docs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const{error:upErr}=await supabase.storage.from("documents").upload(path,file);
      if(!upErr)fileUrl=supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
      if(file.name.match(/\.docx$/i)){
        format="docx";htmlContent=await docxToHtml(await file.arrayBuffer());
        pages=splitDocxHtmlIntoPages(htmlContent).length;
      }else{
        format="pdf";
        const pdfjs=await loadPdfJs();
        const tmp=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        pages=tmp.numPages;
      }
    }catch(e){console.error(e);setConverting(false);alert(`Could not process "${file.name}".`);return;}
    setConverting(false);
    const{data}=await supabase.from("documents").insert({
      owner_id:user.id,sender_id:user.id,uploaded_by:user.id,
      owner_type:"individual",document_kind:"upload",
      format,title:file.name,file_url:fileUrl,
      html_content:htmlContent||null,content:EMPTY_DOC,status:"draft",pages,
    }).select().single();
    if(!data)return;
    const nd:DocumentItem={id:data.id,title:data.title,fileUrl:fileUrl,format,pages};
    setDocuments(prev=>[nd,...prev]);
    await logActivity("document_uploaded",data.id,data.title,user.id);
    // Kick off PDF conversion in background for DOCX
    if(format==="docx"&&fileUrl){
      convertDocxToPdfViaCloudConvert(fileUrl,data.id,async(pdfBlob:Blob)=>{
        const pdfPath=`docs/converted_${data.id}.pdf`;
        const{error:upErr}=await supabase.storage.from("documents").upload(pdfPath,pdfBlob,{contentType:"application/pdf",upsert:true});
        if(!upErr){
          const pdfUrl=supabase.storage.from("documents").getPublicUrl(pdfPath).data.publicUrl;
          await supabase.from("documents").update({pdf_url:pdfUrl,pdf_ready:true}).eq("id",data.id);
        }
      }).catch(e=>console.warn("Background conversion failed:",e));
    }
    openDocument(nd);
  };

  const deleteDocument=async(e:React.MouseEvent,doc:DocumentItem)=>{
    e.stopPropagation();
    if(!confirm(`Delete "${doc.title}"?`))return;
    const{data:{user}}=await supabase.auth.getUser();
    await supabase.from("documents").update({status:"deleted"}).eq("id",doc.id);
    setDocuments(prev=>prev.filter(d=>d.id!==doc.id));
    if(activeDoc?.id===doc.id){setActiveDoc(null);setPdfDoc(null);}
    await logActivity("document_deleted",doc.id,doc.title,user?.id);
  };

  const handleTitleChange=(val:string)=>{
    setDocTitle(val);setSaveStatus("unsaved");
    if(activeDoc?.format==="new")autosave(activeDoc.id,editorPages,val,header,footer);
  };

  useEffect(()=>{
    if(!activeDoc||saveStatus!=="unsaved")return;
    if(activeDoc.format==="new"){autosave(activeDoc.id,editorPages,docTitle,header,footer,newDocOverlays);}
    else if(activeDoc.format==="docx"){
      supabase.from("documents").update({
        content:{format:"docx-html-edited",pages:docxHtmlPages,overlays:docxOverlays},
        title:docTitle,header,footer,
      }).eq("id",activeDoc.id).then(()=>setSaveStatus("saved"));
    }else if(activeDoc.format==="pdf"){
      supabase.from("documents").update({
        annotations:JSON.stringify({pdfOverlays}),
        title:docTitle,header,footer,
      }).eq("id",activeDoc.id).then(()=>setSaveStatus("saved"));
    }
  },[editorPages,newDocOverlays,docxHtmlPages,docxOverlays,pdfOverlays,saveStatus,activeDoc,docTitle,header,footer,autosave]);

  const openRoutingModal=async()=>{
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const{data:myProfile}=await supabase.from("profiles").select("role,organization_id").eq("id",user.id).single();
    const role=myProfile?.role;
    const orgId=myProfile?.organization_id||null;
    setCurrentOrgId(orgId);

    let allUsers:any[]=[];

    console.log("[Route] user role:", role, "orgId:", orgId);

    // Strategy: try multiple approaches until we get users
    // Approach 1: build user list based on role + partnerships
    const buildQuery=async()=>{
      // Helper: get partner org member IDs for a given org
      const getPartnerMembers=async(myOrgId:string)=>{
        const{data:partnerships,error:pe}=await supabase.from("organization_partnerships")
          .select("requester_id,partner_id")
          .or(`requester_id.eq.${myOrgId},partner_id.eq.${myOrgId}`)
          .eq("status","accepted");
        console.log("[Route] partnerships for org",myOrgId,":",partnerships?.length,"rows, error:",pe?.message);
        const partnerOrgIds=(partnerships||[]).map((p:any)=>p.requester_id===myOrgId?p.partner_id:p.requester_id);
        console.log("[Route] partner org IDs:",partnerOrgIds);
        if(partnerOrgIds.length===0) return [];
        const{data:pm,error:me}=await supabase.from("profiles")
          .select("id,email,role,organization_id").in("organization_id",partnerOrgIds).neq("id",user.id);
        console.log("[Route] partner members found:",pm?.length,"error:",me?.message);
        return pm||[];
      };

      if(role==="organization_member"&&orgId){
        // Org member → own org members + partner org members
        const{data:ownMembers}=await supabase.from("profiles")
          .select("id,email,role,organization_id").eq("organization_id",orgId).neq("id",user.id);
        const partnerMembers=await getPartnerMembers(orgId);
        return [...(ownMembers||[]),...partnerMembers];
      }

      if(role==="organization"){
        // Org admin → own org members + partner org members
        const{data:myOrg}=await supabase.from("organizations")
          .select("id").eq("owner_id",user.id).maybeSingle();
        if(myOrg?.id){
          const{data:ownMembers}=await supabase.from("profiles")
            .select("id,email,role,organization_id").eq("organization_id",myOrg.id).neq("id",user.id);
          const partnerMembers=await getPartnerMembers(myOrg.id);
          return [...(ownMembers||[]),...partnerMembers];
        }
      }

      // Individuals → everyone
      const{data}=await supabase.from("profiles").select("id,email,role,organization_id").neq("id",user.id);
      return data||[];
    };

    const directData=await buildQuery();
    console.log("[Route] profiles query result:", directData?.length,"rows");

    if(directData&&directData.length>0){
      allUsers=directData;
    }

    // Approach 2: if empty, try org members + partners directly
    if(allUsers.length===0&&orgId){
      console.log("[Route] trying org members + partners directly...");
      const{data:orgData}=await supabase.from("profiles")
        .select("id,email,role,organization_id").eq("organization_id",orgId).neq("id",user.id);
      // Also try to get partner org members
      const{data:partnerData}=await supabase.from("organization_partnerships")
        .select("requester_id,partner_id").or(`requester_id.eq.${orgId},partner_id.eq.${orgId}`).eq("status","accepted");
      const partnerOrgIds=(partnerData||[]).map((p:any)=>p.requester_id===orgId?p.partner_id:p.requester_id);
      let partnerMembers:any[]=[];
      if(partnerOrgIds.length>0){
        const{data:pm}=await supabase.from("profiles").select("id,email,role,organization_id").in("organization_id",partnerOrgIds).neq("id",user.id);
        partnerMembers=pm||[];
        console.log("[Route] partner members from fallback:", partnerMembers.length);
      }
      const combined=[...(orgData||[]),...partnerMembers];
      if(combined.length>0) allUsers=combined;
    }

    // Approach 3: read from organizations table to get org owner as fallback
    if(allUsers.length===0){
      console.log("[Route] trying organizations fallback...");
      const{data:orgs}=await supabase.from("organizations").select("owner_id,name");
      if(orgs&&orgs.length>0){
        const ownerIds=orgs.map((o:any)=>o.owner_id).filter((id:string)=>id!==user.id);
        if(ownerIds.length>0){
          const{data:owners}=await supabase.from("profiles")
            .select("id,email,role").in("id",ownerIds);
          if(owners&&owners.length>0) allUsers=owners;
        }
      }
    }

    // Approach 4: last resort — read from document_routes to find known users
    if(allUsers.length===0){
      console.log("[Route] trying document_routes fallback...");
      const{data:routes}=await supabase.from("document_routes")
        .select("recipient_id").neq("recipient_id",user.id).limit(50);
      const ids=[...new Set((routes||[]).map((r:any)=>r.recipient_id))].filter(Boolean);
      if(ids.length>0){
        const{data:routeUsers}=await supabase.from("profiles")
          .select("id,email,role").in("id",ids);
        if(routeUsers&&routeUsers.length>0) allUsers=routeUsers;
      }
    }

    console.log("[Route] final user count:",allUsers.length);
    setUsers(allUsers);
    setSelectedRoute([]);
    setShowRouteModal(true);
  };
  const saveRoute=async()=>{
    if(!activeDoc||selectedRoute.length===0)return;
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const totalSteps=selectedRoute.length;

    // Insert ALL route steps — but only activate step 1 initially
    for(let i=0;i<totalSteps;i++){
      await supabase.from("document_routes").insert({
        document_id:activeDoc.id,
        recipient_id:selectedRoute[i],
        route_order:i+1,
        total_steps:totalSteps,
        is_final:i===totalSteps-1,
        status:i===0?"pending":"waiting", // only first step is pending
      });
    }

    // ── Only notify the FIRST recipient ──
    // Everyone else is notified when the person before them clicks Approve
    await supabase.from("activity_logs").insert({
      user_id:selectedRoute[0],
      action:"document_received",
      document_id:activeDoc.id,
      metadata:{
        document_title:docTitle,
        sender_id:user.id,
        step_order:1,
        total_steps:totalSteps,
        is_final:totalSteps===1,
        status:"pending",
      },
    });

    await supabase.from("documents").update({status:"sent"}).eq("id",activeDoc.id);
    await logActivity("document_sent",activeDoc.id,docTitle,user.id);
    setShowRouteModal(false);setSelectedRoute([]);
    alert(`Document routed to ${totalSteps} recipient${totalSteps>1?"s":""} successfully.`);
  };

  /* ── Route action handlers (for recipients) ── */
  const handleApprove=async()=>{
    if(!myRoute||!activeDoc)return;
    setRouteActioning(true);
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;

    // ── Save all current overlays/changes before approving ──
    // This persists this user's additions so the next recipient sees them
    if(activeDoc.format==="pdf"){
      await supabase.from("documents").update({
        annotations:JSON.stringify({pdfOverlays}),
      }).eq("id",activeDoc.id);
    } else if(activeDoc.format==="docx"){
      await supabase.from("documents").update({
        content:{format:"docx-html-edited",pages:docxHtmlPages,overlays:docxOverlays},
      }).eq("id",activeDoc.id);
    } else if(activeDoc.format==="new"){
      const merged={type:"doc",content:editorPages.flatMap((p:any)=>p.content||[])};
      await supabase.from("documents").update({
        content:merged,
        annotations:JSON.stringify({newDocOverlays}),
      }).eq("id",activeDoc.id);
    }

    // Mark this route step complete
    await supabase.from("document_routes").update({status:"completed",actioned_at:new Date().toISOString()}).eq("id",myRoute.id);
    // Update activity_log
    const{data:logRow}=await supabase.from("activity_logs").select("id,metadata").eq("user_id",user.id).eq("document_id",activeDoc.id).eq("action","document_received").maybeSingle();
    if(logRow){await supabase.from("activity_logs").update({metadata:{...logRow.metadata,status:"actioned",actioned_at:new Date().toISOString(),action_type:"forward"}}).eq("id",logRow.id);}
    // Activate next step + notify next recipient
    const nextOrder = myRoute.route_order + 1;
    const{data:nextRoute}=await supabase.from("document_routes")
      .select("recipient_id,is_final,total_steps,route_order")
      .eq("document_id",activeDoc.id)
      .eq("route_order",nextOrder)
      .maybeSingle();
    if(nextRoute){
      await supabase.from("document_routes").update({status:"pending"}).eq("document_id",activeDoc.id).eq("route_order",nextOrder).in("status",["waiting","pending"]);
      // Update next recipient's inbox activity_log to pending so they get notified
      const{data:nextLog}=await supabase.from("activity_logs")
        .select("id,metadata").eq("user_id",nextRoute.recipient_id).eq("document_id",activeDoc.id).eq("action","document_received").maybeSingle();
      if(nextLog){
        // Already has a log row — mark it pending so it shows in their inbox
        await supabase.from("activity_logs").update({
          metadata:{...nextLog.metadata,status:"pending",step_order:nextOrder,forwarded_by:user.id,forwarded_at:new Date().toISOString()},
        }).eq("id",nextLog.id);
      } else {
        // No log row yet — insert one
        await supabase.from("activity_logs").insert({
          user_id:nextRoute.recipient_id,
          action:"document_received",
          document_id:activeDoc.id,
          metadata:{
            document_title:docTitle,
            sender_id:user.id,
            step_order:nextOrder,
            total_steps:nextRoute.total_steps,
            is_final:nextRoute.is_final,
            status:"pending",
          },
        });
      }
    }
    setMyRoute({...myRoute,status:"completed"});
    setRouteActioning(false);
    alert("Document approved and forwarded to next recipient.");
  };

  const handleSaveDoc=async()=>{
    if(!myRoute||!activeDoc)return;
    setRouteActioning(true);
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;

    // Save all overlays/changes before marking as signed
    if(activeDoc.format==="pdf"){
      await supabase.from("documents").update({
        annotations:JSON.stringify({pdfOverlays}),status:"signed",
      }).eq("id",activeDoc.id);
    } else if(activeDoc.format==="docx"){
      await supabase.from("documents").update({
        content:{format:"docx-html-edited",pages:docxHtmlPages,overlays:docxOverlays},status:"signed",
      }).eq("id",activeDoc.id);
    } else {
      const merged={type:"doc",content:editorPages.flatMap((p:any)=>p.content||[])};
      await supabase.from("documents").update({
        content:merged,annotations:JSON.stringify({newDocOverlays}),status:"signed",
      }).eq("id",activeDoc.id);
    }

    await supabase.from("document_routes").update({status:"completed",actioned_at:new Date().toISOString()}).eq("id",myRoute.id);
    const{data:logRow}=await supabase.from("activity_logs").select("id,metadata").eq("user_id",user.id).eq("document_id",activeDoc.id).eq("action","document_received").maybeSingle();
    if(logRow){await supabase.from("activity_logs").update({metadata:{...logRow.metadata,status:"actioned",actioned_at:new Date().toISOString(),action_type:"save"}}).eq("id",logRow.id);}
    setMyRoute({...myRoute,status:"completed"});
    setRouteActioning(false);
    alert("Document approved and saved.");
  };

  /* ── Bake page canvases + overlays into JPEG data URLs ── */
  const bakePages=async():Promise<string[]>=>{
    if(!activeDoc)return[];

   

    const isDocx = activeDoc.format==="docx";
    const refs   = isDocx ? docxPdfCanvasRefs : pdfCanvasRefs;
    const ovs    = isDocx ? docxOverlays      : pdfOverlays;
    const total  = isDocx ? (docxPdfDoc?.numPages||0) : (pdfDoc?.numPages||0);
    if(total===0)return[];

    const images:string[]=[];
    for(let i=0;i<total;i++){
      const base=refs.current[i];
      if(!base||base.width===0)continue;

      const merged=document.createElement("canvas");
      merged.width =base.width;
      merged.height=base.height;
      const ctx=merged.getContext("2d")!;
      ctx.drawImage(base,0,0);

      // Overlay positions are stored as % of the DISPLAYED size.
      // canvas.width/height are at devicePixelRatio scale.
      // So we must scale overlay coords by (canvas.width / display width).
      // We get display width from the canvas style (set in renderPdfPage).
      const dispW = parseFloat(base.style.width)  || base.offsetWidth  || 816;
      const sX = base.width  / dispW;

      for(const ov of ovs.filter(o=>o.pageIdx===i)){
        const x = (ov.x/100)*base.width;
        const y = (ov.y/100)*base.height;
        const fs = (ov.fontSize||16);

        if(ov.type==="text"||ov.type==="date"){
          ctx.save();
          ctx.font=`bold ${fs*sX}px sans-serif`;
          ctx.fillStyle="#1c1917";
          // y offset: text baseline is at y+fontSize in screen coords
          ctx.fillText(ov.content, x, y + fs*sX);
          ctx.restore();
        } else {
          await new Promise<void>(res=>{
            const img=new Image(); img.crossOrigin="anonymous";
            img.onload=()=>{
              const w = ov.type==="image" ? fs*8*sX : fs*3*sX;
              const h = w*(img.naturalHeight/(img.naturalWidth||1));
              ctx.drawImage(img,x,y,w,h); res();
            };
            img.onerror=()=>res();
            img.src=ov.content;
          });
        }
      }
      images.push(merged.toDataURL("image/jpeg",0.95));
    }
    return images;
  };

  /* ── Print: only the document pages, no app chrome ── */
  const handlePrintDoc=async()=>{
    const pages=await bakePages();
    if(!pages.length){alert("Document not ready. Scroll through all pages first.");return;}
    const isHtml=pages[0].startsWith("__html__:");
    const frame=document.createElement("iframe");
    frame.style.cssText="position:fixed;top:-9999px;left:-9999px;width:816px;height:1056px;border:none;visibility:hidden;";
    document.body.appendChild(frame);
    const fdoc=frame.contentDocument||frame.contentWindow?.document;
    if(!fdoc){window.print();return;}
    const bodyHtml=isHtml
      ?`<div style="padding:48px 96px;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;color:#000;">${pages[0].slice(9)}</div>`
      :pages.map((src,i)=>`<div style="page-break-after:${i<pages.length-1?"always":"avoid"};margin:0;line-height:0;"><img src="${src}" style="width:100%;display:block;"/></div>`).join("");
    fdoc.open();
    fdoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>*{margin:0;padding:0}body{background:#fff}
      @media print{@page{margin:0;size:A4 portrait}body{margin:0}}</style>
      </head><body>${bodyHtml}</body></html>`);
    fdoc.close();
    frame.contentWindow?.focus();
    setTimeout(()=>{
      frame.contentWindow?.print();
      setTimeout(()=>{ try{document.body.removeChild(frame);}catch(e){} },2000);
    },500);
  }
  const handleDownloadDoc=async()=>{
    const pages=await bakePages();
    if(!pages.length){alert("Document not ready. Scroll through all pages first.");return;}

    const isNew=pages[0]?.startsWith("__new__:");
    const safeTitle=(docTitle||"document").replace(/[<>"&/\\]/g,"_");

    const bodyHtml = isNew
      ? `<div style="padding:48px 96px;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;color:#000;">${pages[0].slice(8)}</div>`
      : pages.map((src,i)=>`<div style="page-break-after:${i<pages.length-1?"always":"avoid"};margin:0;line-height:0;"><img src="${src}" style="width:100%;display:block;"/></div>`).join("");

    // Open in a new tab — user clicks Ctrl+P → Save as PDF
    // This is the most reliable cross-browser way to get a real PDF without a paid library
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#fff;font-family:'Times New Roman',serif}
        @media print{@page{margin:0;size:A4 portrait}body{margin:0}}
        @media screen{
          body{max-width:816px;margin:20px auto;background:#e8e6e1;padding:20px}
          .page-wrap{background:#fff;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
        }
      </style>
      </head><body>
      <div class="page-wrap">${bodyHtml}</div>
      <script>
        // Auto open print dialog so user can Save as PDF
        window.onload=function(){
          document.title="${safeTitle}";
          setTimeout(function(){window.print();},400);
        };
      <\/script>
      </body></html>`;

    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,"_blank");
    if(!win){
      // Fallback if popup blocked: download as html
      const a=document.createElement("a");
      a.href=url; a.download=safeTitle+".html";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
    }
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  const handleDeclineRoute=async()=>{
    if(!myRoute||!activeDoc)return;
    if(!confirm("Decline this document? Everyone who has been involved will be notified."))return;
    setRouteActioning(true);
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;

    // 1. Mark all route steps as declined
    await supabase.from("document_routes")
      .update({status:"declined",actioned_at:new Date().toISOString()})
      .eq("document_id",activeDoc.id);

    // 2. Mark document as declined
    await supabase.from("documents").update({status:"declined"}).eq("id",activeDoc.id);

    // 3. Mark current user's activity log as actioned/declined
    const{data:myLog}=await supabase.from("activity_logs")
      .select("id,metadata").eq("user_id",user.id).eq("document_id",activeDoc.id).eq("action","document_received").maybeSingle();
    if(myLog){
      await supabase.from("activity_logs").update({
        metadata:{...myLog.metadata,status:"actioned",actioned_at:new Date().toISOString(),action_type:"declined"},
      }).eq("id",myLog.id);
    }

    // 4. Get ALL route steps to know who was involved and who wasn't yet
    const{data:allRoutes}=await supabase.from("document_routes")
      .select("recipient_id,route_order,status")
      .eq("document_id",activeDoc.id)
      .order("route_order",{ascending:true});

    const myOrder = myRoute.route_order;
    const notifyIds: string[] = [];

    for(const route of (allRoutes||[])){
      if(route.recipient_id === user.id) continue; // skip self

      if(route.route_order < myOrder){
        // Already acted on document — notify them it was declined
        notifyIds.push(route.recipient_id);
      } else if(route.route_order === myOrder){
        // Same step (shouldn't happen) — skip
      }
      // route_order > myOrder → not yet involved, do NOT notify
    }

    // 5. Also notify the document owner/sender (get sender_id from metadata)
    const senderId = myLog?.metadata?.sender_id;
    if(senderId && senderId !== user.id){
      notifyIds.push(senderId);
    }

    // 6. Insert decline notifications for those who were involved
    for(const recipientId of [...new Set(notifyIds)]){
      // Check if they already have an activity log for this doc
      const{data:existingLog}=await supabase.from("activity_logs")
        .select("id").eq("user_id",recipientId).eq("document_id",activeDoc.id).maybeSingle();
      if(existingLog){
        // Update their existing log
        await supabase.from("activity_logs").update({
          metadata:{document_title:docTitle,status:"actioned",action_type:"chain_declined",declined_by:user.id,declined_at:new Date().toISOString()},
        }).eq("id",existingLog.id);
      } else {
        // Insert a fresh notification
        await supabase.from("activity_logs").insert({
          user_id:recipientId,
          action:"document_declined",
          document_id:activeDoc.id,
          metadata:{document_title:docTitle,declined_by:user.id,status:"pending"},
        });
      }
    }

    setMyRoute({...myRoute,status:"declined"});
    setRouteActioning(false);
    alert("Document declined. All involved parties have been notified.");
  };

  const handleRightClick=(e:React.MouseEvent)=>{e.preventDefault();if(!activeDoc)return;setContextPos({x:e.clientX,y:e.clientY});};

  // FIX 5: insertDate handles all doc types
  const insertDate=()=>{
    const dateStr=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    if(insertDateRef.current){
      insertDateRef.current(dateStr);
    }else if(activeDoc?.format==="docx"){
      document.querySelectorAll<HTMLIFrameElement>(".dp-docx-iframe").forEach(iframe=>{
        iframe.contentDocument?.execCommand("insertText",false,dateStr);
      });
    }
    setContextPos(null);
  };

  // FIX 6: insertSignature resolves URL and handles all doc types
  const insertSignature=async()=>{
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const{data:prof}=await supabase.from("profiles").select("signature_url").eq("id",user.id).single();
    if(!prof?.signature_url){alert("No signature uploaded yet. Please upload your signature in Settings.");return;}
    const sigUrl=await resolveStorageUrl(prof.signature_url);
    if(!sigUrl){alert("Could not load signature. Please check your Settings.");return;}
    if(insertSigRef.current){
      // New doc TipTap editor
      insertSigRef.current(sigUrl);
    }else if(activeDoc?.format==="docx"){
      // DOCX iframe
      document.querySelectorAll<HTMLIFrameElement>(".dp-docx-iframe").forEach(iframe=>{
        const doc=iframe.contentDocument;
        if(doc){
          const img=doc.createElement("img");
          img.src=sigUrl;img.style.cssText="height:48px;vertical-align:middle;margin:0 4px;display:inline-block;";
          doc.execCommand("insertHTML",false,img.outerHTML);
        }
      });
    }
    setContextPos(null);
  };

  const handleInsertDate=useCallback((fn:(d:string)=>void)=>{insertDateRef.current=fn;},[]);
  const handleInsertSig =useCallback((fn:(s:string)=>void)=>{insertSigRef.current=fn;},[]);
  const handleInsertImg =useCallback((fn:(s:string)=>void)=>{insertImgRef.current=fn;},[]);

  /* ── Image upload handler ── */
  const handleImageUpload = useCallback(async(file: File) => {
    imagePickerOpen.current = false; // picker closed, file selected
    if (!activeDoc) return;
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      alert("Only JPG, PNG, GIF, and WebP images are supported.");
      return;
    }
    // Upload to Supabase Storage
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext  = file.name.split('.').pop() || 'jpg';
    const path = `docs/img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { alert("Image upload failed: " + upErr.message); return; }
    const imgUrl = supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;

    const newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const overlay: PdfOverlay = { id:newId, pageIdx:0, x:10, y:10, type:"image", content:imgUrl, fontSize:20 };

    const target = imageInputTarget.current;
    if (target === "pdf") {
      setPdfOverlays(prev => [...prev, overlay]);
    } else if (target === "docx") {
      setDocxOverlays(prev => [...prev, overlay]);
    } else {
      // new doc — place as draggable overlay (same as PDF/DOCX)
      setNewDocOverlays(prev => [...prev, overlay]);
    }
    setSaveStatus("unsaved");
    setContextPos(null);
  }, [activeDoc]);

  const PAGE_SLOT=1076;
  useEffect(()=>{
    const el=canvasAreaRef.current; if(!el)return;
    const fn=()=>setCurrentPage(Math.min(Math.max(Math.floor(el.scrollTop/PAGE_SLOT)+1,1),totalPages));
    el.addEventListener("scroll",fn,{passive:true}); return()=>el.removeEventListener("scroll",fn);
  },[totalPages,PAGE_SLOT]);
  const goToPage=useCallback((p:number)=>{canvasAreaRef.current?.scrollTo({top:(p-1)*PAGE_SLOT,behavior:"smooth"});setCurrentPage(p);},[PAGE_SLOT]);

  return (
    <div className="dp-root">
      <aside className="dp-sidebar">
        <div className="dp-sb-head">
          <div className="dp-brand">
            <div className="dp-brand-mark"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.5" fill="none"/></svg></div>
            <span className="dp-brand-name">Documents</span>
          </div>
          <div className="dp-sb-actions">
            <button className="dp-sb-btn primary" onClick={()=>fileInputRef.current?.click()}><Ico.Upload/> Upload .docx or .pdf</button>
            <button className="dp-sb-btn ghost" onClick={createNew}><Ico.NewDoc/> New Document</button>
            <input hidden ref={fileInputRef} type="file" accept=".docx,.pdf"
              onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f);e.target.value="";}}/>
            <input hidden ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={e=>{const f=e.target.files?.[0];if(f)handleImageUpload(f);e.target.value="";}}/>
          </div>
        </div>
        <div className="dp-doc-list">
          {documents.length===0
            ?<div style={{padding:"24px 10px",textAlign:"center",color:"rgba(255,255,255,.18)",fontSize:12,lineHeight:1.5}}>No documents yet.<br/>Upload a .docx or .pdf.</div>
            :<>
              <div className="dp-doc-section">My Documents</div>
              {documents.map(doc=>(
                <div key={doc.id} className={`dp-doc-item ${activeDoc?.id===doc.id?"active":""}`} onClick={()=>openDocument(doc)}>
                  <div className={`dp-doc-icon ${doc.format}`}><Ico.FileDoc/></div>
                  <div className="dp-doc-meta">
                    <div className="dp-doc-name">{doc.title}</div>
                    <div className="dp-doc-pages">
                      {(doc as any).isShared && <span style={{color:"#a78bfa",marginRight:3}}>↗</span>}
                      {doc.format.toUpperCase()} · {doc.pages}p
                    </div>
                  </div>
                  {!(doc as any).isShared && <button className="dp-doc-delete" onClick={e=>deleteDocument(e,doc)}><Ico.Trash/></button>}
                </div>
              ))}
            </>
          }
        </div>
      </aside>

      <main className="dp-main">
        <div className="dp-topbar">
          {activeDoc?(
            <>
              <input className="dp-title-input" value={docTitle} onChange={e=>handleTitleChange(e.target.value)} placeholder="Untitled"/>
              <span className={`dp-save-badge ${saveStatus}`}>{saveStatus==="saved"?"● Saved":saveStatus==="saving"?"⟳ Saving…":"● Unsaved"}</span>
              {activeDoc.format!=="new"&&<span style={{fontSize:10,fontFamily:"var(--mono)",background:"var(--accent-light)",color:"var(--accent)",padding:"2px 8px",borderRadius:20}}>{activeDoc.format.toUpperCase()}</span>}
              {/* Show route action buttons if user is a recipient, otherwise show Route button */}
              {myRoute && myRoute.status === "pending" ? (
                myRoute.is_final ? (
                  // Final recipient: Decline | Approve — then Print & Download unlock
                  <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                    <button className="dp-btn" style={{background:"transparent",color:"#dc2626",border:"1px solid #dc2626"}} onClick={handleDeclineRoute} disabled={routeActioning}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Decline
                    </button>
                    <button className="dp-btn dp-btn-primary" style={{background:"#16a34a"}} onClick={handleSaveDoc} disabled={routeActioning}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {routeActioning?"Approving…":"Approve"}
                    </button>
                    <div style={{width:1,height:20,background:"var(--border)",flexShrink:0,margin:"0 2px"}}/>
                    <button className="dp-btn dp-btn-ghost" onClick={handleDownloadDoc} title="Download as PDF">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </button>
                    <button className="dp-btn dp-btn-ghost" onClick={handlePrintDoc} title="Print document">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      Print
                    </button>
                  </div>
                ) : (
                  // Middle recipient: Decline | Approve
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button className="dp-btn" style={{background:"transparent",color:"#dc2626",border:"1px solid #dc2626"}} onClick={handleDeclineRoute} disabled={routeActioning}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Decline
                    </button>
                    <button className="dp-btn dp-btn-primary" onClick={handleApprove} disabled={routeActioning}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {routeActioning?"Approving…":"Approve"}
                    </button>
                  </div>
                )
              ) : myRoute && myRoute.status === "completed" && myRoute.is_final ? (
                // Final recipient already approved — keep Download & Print active
                <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                  <span style={{fontSize:11,fontFamily:"var(--mono)",background:"#dcfce7",color:"#16a34a",padding:"3px 10px",borderRadius:20}}>✓ Approved</span>
                  <div style={{width:1,height:20,background:"var(--border)",flexShrink:0,margin:"0 2px"}}/>
                  <button className="dp-btn dp-btn-ghost" onClick={handleDownloadDoc} title="Download as PDF">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                  <button className="dp-btn dp-btn-ghost" onClick={handlePrintDoc} title="Print document">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                  </button>
                </div>
              ) : myRoute && myRoute.status !== "pending" ? (
                <span style={{fontSize:11,fontFamily:"var(--mono)",background:myRoute.status==="declined"?"#fee2e2":"#f5f3ef",color:myRoute.status==="declined"?"#dc2626":"#78716c",padding:"3px 10px",borderRadius:20}}>
                  {myRoute.status==="declined"?"✗ Declined":"✓ Actioned"}
                </span>
              ) : (
                // Owner/sender: show Route button
                !(activeDoc as any).isShared && <button className="dp-btn dp-btn-ghost" onClick={openRoutingModal}><Ico.Route/> Route</button>
              )}
              {avatarUrl&&<img src={avatarUrl} alt="avatar" crossOrigin="anonymous" style={{width:30,height:30,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid var(--accent-light)"}}/>}
            </>
          ):(
            <span style={{fontSize:14,color:"var(--muted)"}}>Select or upload a document</span>
          )}
        </div>

        {converting&&<div className="dp-converting"><div className="dp-spinner"/><p>Processing document…</p><span>Preserving all formatting and content</span></div>}

        {!activeDoc&&!loading&&!converting&&(
          <div className="dp-empty">
            <div className="dp-empty-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
            <p>No document open</p>
            <span>Upload a .docx or .pdf, or create a new document from the sidebar</span>
          </div>
        )}

        {loading&&!converting&&(
          <div className="dp-canvas" style={{justifyContent:"center"}}>
            <div className="dp-page-card" style={{width:816,padding:"48px 96px"}}>
              {[280,420,200,380,160,320].map((w,i)=><div key={i} className="dp-skel" style={{height:14,width:w,maxWidth:"100%",marginBottom:16}}/>)}
            </div>
          </div>
        )}

        {activeDoc&&!loading&&!converting&&(
          <div className="dp-canvas" ref={canvasAreaRef} onContextMenu={handleRightClick}
            onMouseMove={e=>{
              if(!dragOverlay)return;
              const stage=canvasAreaRef.current?.querySelector(".dp-pdf-stage") as HTMLElement;
              if(!stage)return;
              const rect=stage.getBoundingClientRect();
              const dx=((e.clientX-dragStart.x)/rect.width)*100;
              const dy=((e.clientY-dragStart.y)/rect.height)*100;
              const mover=(prev:PdfOverlay[])=>prev.map(o=>o.id===dragOverlay?{...o,x:Math.max(0,Math.min(95,o.x+dx)),y:Math.max(0,Math.min(97,o.y+dy))}:o);
              setPdfOverlays(mover);
              setDocxOverlays(mover);
              setDragStart({x:e.clientX,y:e.clientY});
            }}
            onMouseUp={()=>{if(dragOverlay){setDragOverlay(null);setSaveStatus("unsaved");}}}
          >
            {/* ══ PDF ══ */}
            {activeDoc.format==="pdf"&&pdfDoc&&(<>
              <div className="dp-pdf-toolbar">
                <span className="dp-pdf-toolbar-label">Place on document:</span>
                {(["text","date","signature","image"] as const).map(tool=>(
                  <button key={tool} className={`dp-pdf-tool ${pdfTool===tool?"active":""}`} onClick={()=>{
                    if(tool==="image"){
                      imageInputTarget.current="pdf";
                      imagePickerOpen.current=true;
                      imageInputRef.current?.click();
                    } else {
                      setPdfTool(t=>t===tool?"none":tool);
                    }
                  }}>
                    {tool==="text"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> Text Box</>}
                    {tool==="date"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Date</>}
                    {tool==="signature"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M8 18h1l9.1-9.1-1-1L8 17z"/></svg> Signature</>}
                    {tool==="image"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</>}
                  </button>
                ))}
                {pdfTool!=="none"&&<span className="dp-pdf-tool-hint">Click anywhere on the page to place</span>}
                {pdfOverlays.length>0&&<button className="dp-pdf-tool" style={{marginLeft:"auto",color:"#dc2626"}} onClick={()=>{setPdfOverlays([]);setSaveStatus("unsaved");}}>Clear All</button>}
              </div>
              {Array.from({length:totalPages}).map((_,i)=>(
                <div key={i}>
                  {i>0&&<div className="dp-page-gap">Page {i+1}</div>}
                  <div className="dp-page-card">
                    <div className="dp-hf-bar">
                      <input className="dp-hf-input" value={header} onChange={e=>setHeader(e.target.value)} placeholder={i===0?"Add header…":""} readOnly={i>0}/>
                      <span className="dp-hf-pagenum">{i+1} / {totalPages}</span>
                    </div>
                    <div className="dp-pdf-stage" style={{cursor:pdfTool!=="none"?"crosshair":"default"}}
                      onClick={async e=>{
                        if(pdfTool==="none")return;
                        if(imagePickerOpen.current){ imagePickerOpen.current=false; return; }
                        const rect=e.currentTarget.getBoundingClientRect();
                        const x=((e.clientX-rect.left)/rect.width)*100;
                        const y=((e.clientY-rect.top)/rect.height)*100;
                        let content="";
                        if(pdfTool==="date"){
                          content=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
                        }else if(pdfTool==="signature"){
                          // FIX 2: resolve signature URL before storing
                          const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
                          const{data:prof}=await supabase.from("profiles").select("signature_url").eq("id",user.id).single();
                          if(!prof?.signature_url){alert("No signature uploaded yet.");return;}
                          content=await resolveStorageUrl(prof.signature_url);
                          if(!content){alert("Could not load signature.");return;}
                        }else{
                          content="Text here…";
                        }
                        const newId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
                        setPdfOverlays(prev=>[...prev,{id:newId,pageIdx:i,x,y,type:pdfTool,content,fontSize:16}]);
                        setSaveStatus("unsaved");
                        if(pdfTool==="text")setFocusId(newId);
                        setPdfTool("none");
                      }}
                    >
                      <canvas ref={el=>{pdfCanvasRefs.current[i]=el;}} className="dp-pdf-canvas"/>
                      {pdfOverlays.filter(o=>o.pageIdx===i).map(ov=>(
                        <div key={ov.id} className="dp-pdf-overlay-item" style={{left:`${ov.x}%`,top:`${ov.y}%`}}
                          onMouseDown={e=>{e.stopPropagation();setDragOverlay(ov.id);setDragStart({x:e.clientX,y:e.clientY});}}
                          onWheel={e=>{
                            e.stopPropagation();
                            const delta=e.deltaY<0?2:-2;
                            setPdfOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.max(8,Math.min(120,(o.fontSize||16)+delta))}:o));
                            setSaveStatus("unsaved");
                          }}>
                          <div className="dp-overlay-resize">
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPdfOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.min(120,(o.fontSize||16)+4)}:o));setSaveStatus("unsaved");}}>+</button>
                            <span>{ov.fontSize||16}px</span>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPdfOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.max(8,(o.fontSize||16)-4)}:o));setSaveStatus("unsaved");}}>−</button>
                          </div>
                          {ov.type==="image"?(
                            <img src={ov.content} alt="attachment" crossOrigin="anonymous"
                              style={{width:ov.fontSize?ov.fontSize*8:160,maxWidth:400,display:"block",objectFit:"contain",pointerEvents:"none",borderRadius:3}}
                              onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                          ):ov.type==="signature"?(
                            <img src={ov.content} alt="sig" crossOrigin="anonymous"
                              style={{height:ov.fontSize?ov.fontSize*3:48,maxWidth:300,display:"block",objectFit:"contain",pointerEvents:"none"}}
                              onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                          ):ov.type==="date"?(
                            <span className="dp-pdf-overlay-date" style={{fontSize:ov.fontSize||16}}>{ov.content}</span>
                          ):(
                            <div ref={el=>{overlayRefs.current[ov.id]=el;}} contentEditable suppressContentEditableWarning
                              className="dp-pdf-overlay-text"
                              style={{fontSize:ov.fontSize||16}}
                              onMouseDown={e=>{
                                if(document.activeElement===e.currentTarget)e.stopPropagation();
                              }}
                              onClick={e=>e.stopPropagation()}
                              onBlur={e=>{const txt=e.currentTarget.textContent||"";setPdfOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,content:txt}:o));setSaveStatus("unsaved");}}
                            >{ov.content}</div>
                          )}
                          <button className="dp-pdf-overlay-del"
                            onClick={e=>{e.stopPropagation();setPdfOverlays(prev=>prev.filter(o=>o.id!==ov.id));setSaveStatus("unsaved");}}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className="dp-hf-bar footer">
                      <input className="dp-hf-input" value={footer} onChange={e=>setFooter(e.target.value)} placeholder={i===0?"Add footer…":""} readOnly={i>0}/>
                    </div>
                  </div>
                </div>
              ))}
            </>)}

            {/* ══ DOCX ══ */}
            {activeDoc.format==="docx"&&(<>
              {converting2Pdf&&(
                <div style={{width:"var(--page-w)",maxWidth:"100%",padding:"10px 0",display:"flex",alignItems:"center",gap:8,fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)"}}>
                  <div className="dp-spinner" style={{width:14,height:14,borderWidth:2}}/> Converting to high-fidelity view…
                </div>
              )}
              {docxPdfReady&&docxPdfDoc&&(<>
                {/* Same toolbar as PDF */}
                <div className="dp-pdf-toolbar">
                  <span className="dp-pdf-toolbar-label">Place on document:</span>
                  {(["text","date","signature","image"] as const).map(tool=>(
                    <button key={tool} className={`dp-pdf-tool ${docxTool===tool?"active":""}`} onClick={()=>{
                      if(tool==="image"){
                        imageInputTarget.current="docx";
                        imagePickerOpen.current=true;
                        imageInputRef.current?.click();
                      } else {
                        setDocxTool(t=>t===tool?"none":tool);
                      }
                    }}>
                      {tool==="text"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> Text Box</>}
                      {tool==="date"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Date</>}
                      {tool==="signature"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M8 18h1l9.1-9.1-1-1L8 17z"/></svg> Signature</>}
                      {tool==="image"&&<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</>}
                    </button>
                  ))}
                  {docxTool!=="none"&&<span className="dp-pdf-tool-hint">Click anywhere on the page to place</span>}
                  {docxOverlays.length>0&&<button className="dp-pdf-tool" style={{marginLeft:"auto",color:"#dc2626"}} onClick={()=>{setDocxOverlays([]);setSaveStatus("unsaved");}}>Clear All</button>}
                </div>
                {Array.from({length:docxPdfDoc.numPages}).map((_,i)=>(
                  <div key={`${activeDoc.id}-docxpdf-${i}`}>
                    {i>0&&<div className="dp-page-gap">Page {i+1}</div>}
                    <div className="dp-page-card">
                      <div className="dp-hf-bar">
                        <input className="dp-hf-input" value={header} onChange={e=>setHeader(e.target.value)} placeholder={i===0?"Add header…":""} readOnly={i>0}/>
                        <span className="dp-hf-pagenum">{i+1} / {docxPdfDoc.numPages}</span>
                      </div>
                      <div className="dp-pdf-stage" style={{cursor:docxTool!=="none"?"crosshair":"default"}}
                        onClick={async e=>{
                          if(docxTool==="none")return;
                          const rect=e.currentTarget.getBoundingClientRect();
                          const x=((e.clientX-rect.left)/rect.width)*100;
                          const y=((e.clientY-rect.top)/rect.height)*100;
                          let content="";
                          if(docxTool==="date"){content=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});}
                          else if(docxTool==="signature"){
                            const{data:{user}}=await supabase.auth.getUser(); if(!user)return;
                            const{data:prof}=await supabase.from("profiles").select("signature_url").eq("id",user.id).single();
                            if(!prof?.signature_url){alert("No signature uploaded yet.");return;}
                            content=await resolveStorageUrl(prof.signature_url);
                            if(!content){alert("Could not load signature.");return;}
                          }else{content="Text here…";}
                          const newId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
                          setDocxOverlays(prev=>[...prev,{id:newId,pageIdx:i,x,y,type:docxTool,content,fontSize:16}]);
                          setSaveStatus("unsaved");
                          if(docxTool==="text")setFocusId(newId);
                          setDocxTool("none");
                        }}
                      >
                        <canvas ref={el=>{docxPdfCanvasRefs.current[i]=el;}} style={{display:"block",maxWidth:"100%"}}/>
                        {docxOverlays.filter(o=>o.pageIdx===i).map(ov=>(
                          <div key={ov.id} className="dp-pdf-overlay-item" style={{left:`${ov.x}%`,top:`${ov.y}%`}}
                            onMouseDown={e=>{e.stopPropagation();setDragOverlay(ov.id);setDragStart({x:e.clientX,y:e.clientY});}}
                            onWheel={e=>{
                              e.stopPropagation();
                              const delta=e.deltaY<0?2:-2;
                              setDocxOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.max(8,Math.min(120,(o.fontSize||16)+delta))}:o));
                              setSaveStatus("unsaved");
                            }}>
                            <div className="dp-overlay-resize">
                              <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setDocxOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.min(120,(o.fontSize||16)+4)}:o));setSaveStatus("unsaved");}}>+</button>
                              <span>{ov.fontSize||16}px</span>
                              <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setDocxOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.max(8,(o.fontSize||16)-4)}:o));setSaveStatus("unsaved");}}>−</button>
                            </div>
                            {ov.type==="image"?(
                              <img src={ov.content} alt="attachment" crossOrigin="anonymous"
                                style={{width:ov.fontSize?ov.fontSize*8:160,maxWidth:400,display:"block",objectFit:"contain",pointerEvents:"none",borderRadius:3}}
                                onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                            ):ov.type==="signature"?(
                              <img src={ov.content} alt="sig" crossOrigin="anonymous"
                                style={{height:ov.fontSize?ov.fontSize*3:48,maxWidth:300,display:"block",objectFit:"contain",pointerEvents:"none"}}
                                onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                            ):ov.type==="date"?(
                              <span className="dp-pdf-overlay-date" style={{fontSize:ov.fontSize||16}}>{ov.content}</span>
                            ):(
                              <div ref={el=>{overlayRefs.current[ov.id]=el;}} contentEditable suppressContentEditableWarning
                                className="dp-pdf-overlay-text"
                                style={{fontSize:ov.fontSize||16}}
                                onMouseDown={e=>{if(document.activeElement===e.currentTarget)e.stopPropagation();}}
                                onClick={e=>e.stopPropagation()}
                                onBlur={e=>{const txt=e.currentTarget.textContent||"";setDocxOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,content:txt}:o));setSaveStatus("unsaved");}}
                              >{ov.content}</div>
                            )}
                            <button className="dp-pdf-overlay-del"
                              onClick={e=>{e.stopPropagation();setDocxOverlays(prev=>prev.filter(o=>o.id!==ov.id));setSaveStatus("unsaved");}}>×</button>
                          </div>
                        ))}
                      </div>
                      <div className="dp-hf-bar footer">
                        <input className="dp-hf-input" value={footer} onChange={e=>setFooter(e.target.value)} placeholder={i===0?"Add footer…":""} readOnly={i>0}/>
                      </div>
                    </div>
                  </div>
                ))}
              </>)}
              {docxHtmlPages.length>0&&(
                <div style={{width:"var(--page-w)",maxWidth:"100%",marginTop:docxPdfReady?20:0}}>
                  {docxPdfReady&&(
                    <div style={{padding:"8px 0 6px",fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",display:"flex",alignItems:"center",gap:8}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit document below — changes save automatically
                    </div>
                  )}
                  {docxHtmlPages.map((pageHtml,i)=>(
                    <div key={`${activeDoc.id}-docx-edit-${i}`}>
                      {i>0&&<div className="dp-page-gap">Page {i+1}</div>}
                      <div className="dp-page-card" style={{overflow:"visible"}}>
                        {!docxPdfReady&&<div className="dp-hf-bar"><input className="dp-hf-input" value={header} onChange={e=>setHeader(e.target.value)} placeholder={i===0?"Add header…":""} readOnly={i>0}/><span className="dp-hf-pagenum">{i+1} / {totalPages}</span></div>}
                        <DocxIframeEditor key={`${activeDoc.id}-iframe-${i}`} html={pageHtml}
                          onSave={(newHtml:string)=>{setDocxHtmlPages(prev=>{const u=[...prev];u[i]=newHtml;return u;});setSaveStatus("unsaved");}}/>
                        {!docxPdfReady&&<div className="dp-hf-bar footer"><input className="dp-hf-input" value={footer} onChange={e=>setFooter(e.target.value)} placeholder={i===0?"Add footer…":""} readOnly={i>0}/></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ══ NEW DOCUMENT ══ */}
            {activeDoc.format==="new"&&(<>
              {editorPages.map((pageContent,i)=>(
                <div key={`${activeDoc.id}-p${i}`}>
                  {i>0&&<div className="dp-page-gap">Page {i+1}</div>}
                  <div className="dp-page-card">
                    <div className="dp-hf-bar">
                      <input className="dp-hf-input" value={header} onChange={e=>setHeader(e.target.value)} placeholder={i===0?"Add header…":""} readOnly={i>0}/>
                      <span className="dp-hf-pagenum">{i+1} / {totalPages}</span>
                    </div>
                    <div className="dp-page-body" style={{position:"relative"}}>
                      <DocumentEditor
                        key={`${activeDoc.id}-p${i}`}
                        content={pageContent} editable
                        onUpdate={c=>{setEditorPages(prev=>{const u=[...prev];u[i]=c;return u;});setSaveStatus("unsaved");}}
                        onInsertDate={handleInsertDate} onInsertSignature={handleInsertSig} onInsertImage={handleInsertImg}
                      />
                      {/* Image overlays for new docs — draggable/resizable like PDF overlays */}
                      {newDocOverlays.filter(o=>o.pageIdx===i).map(ov=>(
                        <div key={ov.id} style={{position:"absolute",left:`${ov.x}%`,top:`${ov.y}%`,cursor:"move",userSelect:"none",zIndex:10}}
                          onMouseDown={e=>{
                            e.stopPropagation();
                            const startX=e.clientX,startY=e.clientY;
                            const startOx=ov.x,startOy=ov.y;
                            const parent=(e.currentTarget as HTMLElement).closest(".dp-page-body") as HTMLElement;
                            const rect=parent?.getBoundingClientRect()||{width:816,height:1056};
                            const onMove=(ev:MouseEvent)=>{
                              const dx=((ev.clientX-startX)/rect.width)*100;
                              const dy=((ev.clientY-startY)/rect.height)*100;
                              setNewDocOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,x:Math.max(0,Math.min(90,startOx+dx)),y:Math.max(0,Math.min(95,startOy+dy))}:o));
                            };
                            const onUp=()=>{
                              document.removeEventListener("mousemove",onMove);
                              document.removeEventListener("mouseup",onUp);
                              setSaveStatus("unsaved");
                            };
                            document.addEventListener("mousemove",onMove);
                            document.addEventListener("mouseup",onUp);
                          }}>
                          {/* Resize controls */}
                          <div style={{position:"absolute",top:-22,left:0,display:"flex",alignItems:"center",gap:3,background:"rgba(0,0,0,0.7)",borderRadius:4,padding:"2px 5px",zIndex:12,opacity:0}}
                            className="nd-img-ctrl"
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0";}}>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setNewDocOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.min(120,(o.fontSize||20)+8)}:o));setSaveStatus("unsaved");}}
                              style={{background:"none",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",padding:"0 2px"}}>+</button>
                            <span style={{color:"#ccc",fontSize:10,fontFamily:"monospace",minWidth:28,textAlign:"center"}}>{ov.fontSize||20}0px</span>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setNewDocOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,fontSize:Math.max(4,(o.fontSize||20)-8)}:o));setSaveStatus("unsaved");}}
                              style={{background:"none",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",padding:"0 2px"}}>−</button>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setNewDocOverlays(prev=>prev.filter(o=>o.id!==ov.id));setSaveStatus("unsaved");}}
                              style={{background:"#ef4444",border:"none",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",padding:"0 3px",borderRadius:3,marginLeft:2}}>×</button>
                          </div>
                          <img src={ov.content} alt="attachment" crossOrigin="anonymous"
                            style={{width:(ov.fontSize||20)*10,maxWidth:700,display:"block",objectFit:"contain",pointerEvents:"none",borderRadius:4,border:"2px solid rgba(124,58,237,0.3)"}}
                            onError={e=>{(e.target as HTMLImageElement).style.display="none";}}
                            onMouseEnter={e=>{const ctrl=(e.currentTarget as HTMLElement).previousElementSibling as HTMLElement;if(ctrl)ctrl.style.opacity="1";}}
                            onMouseLeave={e=>{const ctrl=(e.currentTarget as HTMLElement).previousElementSibling as HTMLElement;if(ctrl)ctrl.style.opacity="0";}}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="dp-hf-bar footer">
                      <input className="dp-hf-input" value={footer} onChange={e=>setFooter(e.target.value)} placeholder={i===0?"Add footer…":""} readOnly={i>0}/>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                <button onClick={()=>{setEditorPages(prev=>[...prev,{type:"doc",content:[{type:"paragraph"}]}]);setTotalPages(prev=>prev+1);setSaveStatus("unsaved");}}
                  style={{padding:"8px 20px",background:"transparent",border:"1.5px dashed #c4b5fd",borderRadius:8,color:"#7c3aed",fontFamily:"var(--font)",fontSize:12.5,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:16,lineHeight:1}}>+</span> Add Page
                </button>
                <button onClick={()=>{imageInputTarget.current="new";imagePickerOpen.current=true;imageInputRef.current?.click();}}
                  style={{padding:"8px 16px",background:"transparent",border:"1.5px dashed #c4b5fd",borderRadius:8,color:"#7c3aed",fontFamily:"var(--font)",fontSize:12.5,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Add Image
                </button>
              </div>
            </>)}
          </div>
        )}

        {activeDoc&&(
          <div className="dp-statusbar">
            <span style={{color:"var(--accent)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{docTitle}</span>
            <span style={{color:"#d6d3ce"}}>|</span>
            <span>Page {currentPage} of {totalPages}</span>
            <div className="dp-statusbar-r">
              <div className="dp-page-nav" style={{display:"flex",alignItems:"center",gap:4}}>
                <button disabled={currentPage<=1} onClick={()=>goToPage(currentPage-1)}>‹</button>
                <span style={{padding:"0 4px"}}>{currentPage} / {totalPages}</span>
                <button disabled={currentPage>=totalPages} onClick={()=>goToPage(currentPage+1)}>›</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {showRouteModal&&(
        <div className="dp-modal-backdrop" onClick={()=>setShowRouteModal(false)}>
          <div className="dp-modal" onClick={e=>e.stopPropagation()}>
            <h3>Establish Routing</h3>
            <p className="dp-modal-sub">
              Click users to add them in approval order. The <strong>last person</strong> selected is the final approver and can print or save the document.
            </p>

            {/* Selected route — ordered steps */}
            {selectedRoute.length>0&&(
              <div style={{marginBottom:12,background:"var(--accent-light)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--accent)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>
                  Approval Chain ({selectedRoute.length} step{selectedRoute.length>1?"s":""})
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  {selectedRoute.map((uid,i)=>{
                    const u=users.find(x=>x.id===uid);
                    const isFinal=i===selectedRoute.length-1;
                    return (
                      <div key={uid} style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,background:"#fff",border:`1.5px solid ${isFinal?"#16a34a":"var(--accent)"}`,borderRadius:6,padding:"3px 8px",fontSize:12}}>
                          <span style={{width:18,height:18,borderRadius:"50%",background:isFinal?"#16a34a":"var(--accent)",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                          <span style={{fontWeight:500,color:"var(--text)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u?.email?.split("@")[0]||"?"}</span>
                          {isFinal&&<span style={{fontSize:9,background:"#dcfce7",color:"#16a34a",padding:"1px 4px",borderRadius:3,fontWeight:600}}>FINAL</span>}
                          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>setSelectedRoute(prev=>prev.filter(id=>id!==uid))}
                            style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1}}>×</button>
                        </div>
                        {i<selectedRoute.length-1&&<span style={{color:"var(--accent)",fontSize:14}}>→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User list */}
            <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>
              {currentOrgId?"Organization Members":"All Users"} — click to add
            </div>
            <div className="dp-route-list">
              {users.length===0
                ?<p style={{fontSize:13,color:"var(--muted)",padding:"8px 10px",textAlign:"center"}}>No users found</p>
                :users.filter(u=>!selectedRoute.includes(u.id)).map(u=>(
                  <div key={u.id} className="dp-route-user"
                    onClick={()=>setSelectedRoute(prev=>[...prev,u.id])}>
                    <div className="dp-route-step unselected">+</div>
                    <div className="dp-route-user-info">
                      <div className="dp-route-user-name">{u.email?.split("@")[0]||"Unnamed"}</div>
                      <div className="dp-route-user-role">{u.email}</div>
                    </div>
                    <span style={{fontSize:10,color:"var(--muted)",background:"var(--bg)",padding:"2px 7px",borderRadius:20,border:"1px solid var(--border)"}}>
                      {u.role==="organization"?"Admin":u.role==="organization_member"?"Member":"Individual"}
                    </span>
                  </div>
                ))
              }
              {users.filter(u=>!selectedRoute.includes(u.id)).length===0&&selectedRoute.length>0&&(
                <p style={{fontSize:13,color:"var(--muted)",padding:"8px 10px",textAlign:"center"}}>All users added to chain</p>
              )}
            </div>

            <div className="dp-modal-footer">
              <button className="dp-btn dp-btn-ghost" onClick={()=>{setShowRouteModal(false);setSelectedRoute([]);}}>Cancel</button>
              <button className="dp-btn dp-btn-primary" onClick={saveRoute} disabled={selectedRoute.length===0}>
                Send to {selectedRoute.length} Recipient{selectedRoute.length!==1?"s":""}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextPos&&(
        <div className="dp-ctx" style={{top:contextPos.y,left:contextPos.x}} onClick={e=>e.stopPropagation()}>
          <button className="dp-ctx-item" onClick={insertDate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Insert Date
          </button>
          <button className="dp-ctx-item" onClick={insertSignature}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M8 18h1l9.1-9.1-1-1L8 17z"/></svg>
            Insert Signature
          </button>
          <button className="dp-ctx-item" onClick={()=>{
            if(activeDoc?.format==="pdf") imageInputTarget.current="pdf";
            else if(activeDoc?.format==="docx") imageInputTarget.current="docx";
            else imageInputTarget.current="new";
            imagePickerOpen.current=true;
            imageInputRef.current?.click();
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Insert Image
          </button>
        </div>
      )}
    </div>
  );
}