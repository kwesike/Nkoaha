import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// NkoAha Form Builder — free-canvas designer
// Objects (fields, text, images, shapes) are positioned anywhere on an A4
// page and can be dragged + resized. Coordinates are stored as PERCENTAGES
// of the page, so the layout is resolution-independent and maps cleanly to
// a printed/PDF page. Saved as a `documents` row (format "form").
// ─────────────────────────────────────────────────────────────

export type FormObjType =
  | "text" | "longtext" | "number" | "date" | "dropdown" | "radio" | "checkbox" | "signature" | "file"
  | "heading" | "paragraph" | "image"
  | "rect" | "ellipse" | "line";

export interface FormObject {
  id: string;
  type: FormObjType;
  page?: number;                                 // 0-based page index
  x: number; y: number; w: number; h: number;   // % of page
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  src?: string;                                   // image data URL
  fontSize?: number;                              // px (text/heading)
  align?: "left" | "center" | "right";
  fill?: string; stroke?: string; strokeW?: number; // shapes
}

export interface FormSchema {
  title: string;
  logo?: string;
  pageCount?: number;
  objects: FormObject[];
}

const uid = () => "o_" + Math.random().toString(36).slice(2, 9);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const PALETTE: { group: string; items: { type: FormObjType; label: string; icon: string }[] }[] = [
  { group: "Fields", items: [
    { type: "text",      label: "Short answer", icon: "▭" },
    { type: "longtext",  label: "Long answer",  icon: "☰" },
    { type: "number",    label: "Number",       icon: "#" },
    { type: "date",      label: "Date",         icon: "📅" },
    { type: "dropdown",  label: "Dropdown",     icon: "▾" },
    { type: "radio",     label: "Single choice",icon: "◉" },
    { type: "checkbox",  label: "Checkboxes",   icon: "☑" },
    { type: "signature", label: "Signature",    icon: "✍" },
    { type: "file",      label: "File upload",  icon: "📎" },
  ]},
  { group: "Content", items: [
    { type: "heading",   label: "Heading",      icon: "H" },
    { type: "paragraph", label: "Text",         icon: "¶" },
    { type: "image",     label: "Image / logo", icon: "🖼" },
  ]},
  { group: "Shapes", items: [
    { type: "rect",      label: "Rectangle",    icon: "▢" },
    { type: "ellipse",   label: "Ellipse",      icon: "◯" },
    { type: "line",      label: "Line",         icon: "─" },
  ]},
];

function defaults(type: FormObjType, n: number): FormObject {
  const base: FormObject = { id: uid(), type, x: clamp(8 + (n % 6) * 2, 4, 60), y: clamp(8 + (n % 10) * 3, 4, 85), w: 40, h: 7 };
  switch (type) {
    case "text":      return { ...base, label: "Short answer", placeholder: "" , required: false };
    case "longtext":  return { ...base, label: "Long answer", h: 16, w: 70 };
    case "number":    return { ...base, label: "Number", w: 28 };
    case "date":      return { ...base, label: "Date", w: 28 };
    case "dropdown":  return { ...base, label: "Choose one", options: ["Option 1", "Option 2"] };
    case "radio":     return { ...base, label: "Select one", options: ["Yes", "No"], h: 14, w: 46 };
    case "checkbox":  return { ...base, label: "Select all that apply", options: ["Option 1", "Option 2"], h: 14, w: 46 };
    case "signature": return { ...base, label: "Signature", w: 36, h: 10 };
    case "file":      return { ...base, label: "Attach a file", w: 40 };
    case "heading":   return { ...base, label: "Section heading", w: 80, h: 6, fontSize: 22, align: "left" };
    case "paragraph": return { ...base, label: "Descriptive text for the person filling this form.", w: 80, h: 10, fontSize: 13, align: "left" };
    case "image":     return { ...base, w: 24, h: 12 };
    case "rect":      return { ...base, w: 40, h: 12, fill: "transparent", stroke: "#9ca3af", strokeW: 1 };
    case "ellipse":   return { ...base, w: 22, h: 12, fill: "transparent", stroke: "#9ca3af", strokeW: 1 };
    case "line":      return { ...base, w: 50, h: 1, stroke: "#374151", strokeW: 2 };
    default:          return base;
  }
}

// Convert a legacy stacked-field schema (fields[]) to canvas objects.
function migrate(schema: any): FormObject[] {
  if (schema?.objects) return (schema.objects as FormObject[]).map(o => ({ ...o, page: o.page || 0 }));
  if (Array.isArray(schema?.fields)) {
    let y = 6;
    return schema.fields.map((f: any) => {
      const h = f.type === "longtext" ? 14 : (f.type === "radio" || f.type === "checkbox") ? 12 : f.type === "heading" ? 6 : 7;
      const o: FormObject = { id: uid(), type: f.type, page: 0, x: 8, y, w: f.width === "half" ? 44 : 84, h, label: f.label, placeholder: f.placeholder, required: f.required, options: f.options, src: f.src };
      y += h + 2;
      return o;
    });
  }
  return [];
}

const STYLES = `
  .fb-overlay{position:fixed;inset:0;background:#f5f3ef;z-index:200;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;color:#1c1917}
  .fb-top{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#fff;border-bottom:1px solid #e7e4df;flex-shrink:0}
  .fb-title-input{flex:1;min-width:0;font-size:15px;font-weight:700;border:none;outline:none;background:transparent}
  .fb-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
  .fb-btn.ghost{background:transparent;color:#78716c;border-color:#e7e4df}.fb-btn.ghost:hover{background:#f5f3ef}
  .fb-btn.primary{background:#7c3aed;color:#fff}.fb-btn.primary:hover{background:#5b21b6}
  .fb-btn:disabled{opacity:.55;cursor:not-allowed}
  .fb-pagebar{display:flex;align-items:center;justify-content:center;gap:8px;padding:6px;background:#fff;border-bottom:1px solid #e7e4df;flex-shrink:0}
  .fb-pglabel{font-size:12.5px;font-weight:600;color:#44403c;min-width:98px;text-align:center}
  .fb-pgbtn{border:1px solid #e7e4df;background:#fff;border-radius:7px;padding:5px 9px;font-size:12px;cursor:pointer;color:#57534e}
  .fb-pgbtn.wide{font-weight:600}
  .fb-pgbtn.danger{color:#dc2626;border-color:#fecaca}
  .fb-pgbtn:disabled{opacity:.4;cursor:not-allowed}
  .fb-pgbtn:not(:disabled):hover{background:#f5f3ef}
  .fb-body{flex:1;display:flex;min-height:0;overflow:hidden}
  .fb-palette{width:168px;flex-shrink:0;background:#fff;border-right:1px solid #e7e4df;padding:10px;overflow-y:auto}
  .fb-palette h4{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e;margin:10px 0 7px}
  .fb-pal-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;margin-bottom:5px;border:1px solid #e7e4df;border-radius:8px;background:#fff;cursor:pointer;font-size:12.5px;text-align:left}
  .fb-pal-item:hover{border-color:#c4b5fd;background:#faf7ff}
  .fb-pal-ic{width:22px;height:22px;border-radius:6px;background:#ede9fe;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
  .fb-stage{flex:1;overflow:auto;padding:22px;display:flex;justify-content:center;align-items:flex-start;background:#eceae6}
  .fb-page{position:relative;width:100%;max-width:794px;aspect-ratio:1 / 1.414;background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.14);border-radius:2px;flex-shrink:0}
  .fb-logo{position:absolute;top:3%;left:50%;transform:translateX(-50%);max-height:70px;max-width:40%;object-fit:contain}
  .fb-obj{position:absolute;box-sizing:border-box;cursor:move;user-select:none;touch-action:none}
  .fb-obj.sel{outline:2px solid #7c3aed;outline-offset:1px}
  .fb-handle{position:absolute;right:-6px;bottom:-6px;width:13px;height:13px;background:#7c3aed;border:2px solid #fff;border-radius:3px;cursor:nwse-resize;touch-action:none}
  .fb-objbar{position:absolute;top:-24px;right:0;display:flex;gap:3px;background:#fff;border:1px solid #e7e4df;border-radius:6px;padding:2px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .fb-objbar button{border:none;background:transparent;cursor:pointer;width:22px;height:20px;border-radius:4px;font-size:12px;color:#57534e}
  .fb-objbar button:hover{background:#f5f3ef}
  .fb-flabel{font-size:11px;font-weight:600;color:#44403c;margin-bottom:2px;line-height:1.2;overflow:hidden}
  .fb-box{border:1px solid #cbd5e1;border-radius:5px;background:#fbfbfa;width:100%;height:100%;min-height:14px}
  .fb-boxline{display:flex;align-items:center;padding:0 7px;font-size:11px;color:#9ca3af}
  .fb-opt{display:flex;align-items:center;gap:6px;font-size:12px;color:#44403c;margin:2px 0}
  .fb-dash{border:1.4px dashed #c4b5fd;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#a78bfa;font-size:11px;font-style:italic;width:100%;height:100%}
  /* Settings */
  .fb-set{width:270px;flex-shrink:0;background:#fff;border-left:1px solid #e7e4df;padding:14px;overflow-y:auto}
  .fb-set h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e;margin:0 0 12px}
  .fb-set-row{margin-bottom:11px}
  .fb-set-row label{display:block;font-size:12px;font-weight:600;color:#57534e;margin-bottom:5px}
  .fb-in{width:100%;padding:7px 9px;border:1px solid #d6d3d1;border-radius:7px;font-size:13px;font-family:inherit;box-sizing:border-box}
  .fb-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#44403c;cursor:pointer}
  .fb-opt-edit{display:flex;gap:6px;margin-bottom:6px}
  .fb-opt-edit input{flex:1;padding:6px 8px;border:1px solid #d6d3d1;border-radius:6px;font-size:12.5px}
  .fb-seg{display:flex;border:1px solid #d6d3d1;border-radius:7px;overflow:hidden}
  .fb-seg button{flex:1;padding:6px;border:none;background:#fff;font-size:12px;cursor:pointer;color:#78716c}
  .fb-seg button.on{background:#7c3aed;color:#fff}
  .fb-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b8b4ad;font-size:13px;text-align:center;pointer-events:none;padding:20px}
  @media (max-width:860px){
    .fb-palette{width:120px;padding:7px}.fb-pal-item{font-size:11.5px;padding:6px}
    .fb-set{position:fixed;right:0;top:0;bottom:0;width:84vw;max-width:300px;z-index:210;box-shadow:-8px 0 30px rgba(0,0,0,.18)}
    .fb-stage{padding:10px}
  }
`;

interface Props {
  open: boolean;
  initialSchema?: FormSchema | null;
  initialTitle?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (schema: FormSchema, title: string) => void;
}

export default function FormBuilder({ open, initialSchema, initialTitle, saving, onClose, onSave }: Props) {
  const [title, setTitle]     = useState("Untitled form");
  const [logo, setLogo]       = useState<string | undefined>();
  const [objects, setObjects] = useState<FormObject[]>([]);
  const [selId, setSelId]     = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [curPage, setCurPage]     = useState(0);
  const pageRef   = useRef<HTMLDivElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const imgInput  = useRef<HTMLInputElement>(null);
  const imgFor    = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle || initialSchema?.title || "Untitled form");
    setLogo(initialSchema?.logo);
    const objs = migrate(initialSchema);
    setObjects(objs);
    const maxPage = objs.reduce((m, o) => Math.max(m, o.page || 0), 0);
    setPageCount(Math.max(initialSchema?.pageCount || 1, maxPage + 1));
    setCurPage(0);
    setSelId(null);
  }, [open]); // eslint-disable-line

  if (!open) return null;

  const sel = objects.find(o => o.id === selId) || null;
  const update = (id: string, patch: Partial<FormObject>) => setObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  const add = (type: FormObjType) => {
    const o = { ...defaults(type, objects.filter(x => (x.page || 0) === curPage).length), page: curPage };
    setObjects(prev => [...prev, o]); setSelId(o.id);
    if (type === "image") { imgFor.current = o.id; setTimeout(() => imgInput.current?.click(), 40); }
  };
  const addPage = () => { const n = pageCount; setPageCount(pageCount + 1); setCurPage(n); setSelId(null); };
  const deletePage = () => {
    if (pageCount <= 1) return;
    const p = curPage;
    setObjects(prev => prev.filter(o => (o.page || 0) !== p).map(o => ({ ...o, page: (o.page || 0) > p ? (o.page || 0) - 1 : (o.page || 0) })));
    setPageCount(c => c - 1);
    setCurPage(Math.max(0, p - 1));
    setSelId(null);
  };
  const removeObj = (id: string) => { setObjects(prev => prev.filter(o => o.id !== id)); if (selId === id) setSelId(null); };
  const dup = (id: string) => { const o = objects.find(x => x.id === id); if (!o) return; const c = { ...o, id: uid(), x: clamp(o.x + 3, 0, 100 - o.w), y: clamp(o.y + 3, 0, 100 - o.h) }; setObjects(prev => [...prev, c]); setSelId(c.id); };
  const readImg = (file: File, cb: (d: string) => void) => { const r = new FileReader(); r.onload = () => cb(String(r.result || "")); r.readAsDataURL(file); };

  // Pointer drag / resize against the live page rect → scale-independent.
  const startDrag = (e: React.PointerEvent, o: FormObject, mode: "move" | "resize") => {
    e.stopPropagation(); e.preventDefault();
    setSelId(o.id);
    const rect = pageRef.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY; const o0 = { ...o };
    const onMove = (ev: PointerEvent) => {
      const dxp = (ev.clientX - sx) / rect.width * 100;
      const dyp = (ev.clientY - sy) / rect.height * 100;
      setObjects(prev => prev.map(ob => {
        if (ob.id !== o.id) return ob;
        if (mode === "move") return { ...ob, x: clamp(o0.x + dxp, 0, 100 - ob.w), y: clamp(o0.y + dyp, 0, 100 - ob.h) };
        return { ...ob, w: clamp(o0.w + dxp, 3, 100 - ob.x), h: clamp(o0.h + dyp, 2, 100 - ob.y) };
      }));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  const save = () => onSave({ title: title.trim() || "Untitled form", logo, pageCount, objects }, title.trim() || "Untitled form");
  const downloadPdf = () => printForm({ title, logo, pageCount, objects });

  return (
    <div className="fb-overlay">
      <style>{STYLES}</style>
      <div className="fb-top">
        <button className="fb-btn ghost" onClick={onClose} aria-label="Close">✕</button>
        <input className="fb-title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Form title" />
        <button className="fb-btn ghost" onClick={() => logoInput.current?.click()}>🖼 Logo</button>
        <button className="fb-btn ghost" onClick={downloadPdf}>⬇ PDF</button>
        <button className="fb-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</button>
        <input ref={logoInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) readImg(f, setLogo); e.currentTarget.value = ""; }} />
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; const id = imgFor.current; if (f && id) readImg(f, d => update(id, { src: d })); e.currentTarget.value = ""; }} />
      </div>

      <div className="fb-pagebar">
        <button className="fb-pgbtn" onClick={() => setCurPage(p => Math.max(0, p - 1))} disabled={curPage === 0}>◀</button>
        <span className="fb-pglabel">Page {curPage + 1} of {pageCount}</span>
        <button className="fb-pgbtn" onClick={() => setCurPage(p => Math.min(pageCount - 1, p + 1))} disabled={curPage >= pageCount - 1}>▶</button>
        <span style={{ width: 14 }} />
        <button className="fb-pgbtn wide" onClick={addPage}>＋ Add page</button>
        {pageCount > 1 && <button className="fb-pgbtn wide danger" onClick={deletePage}>🗑 Delete page</button>}
      </div>

      <div className="fb-body">
        {/* Palette */}
        <div className="fb-palette">
          {PALETTE.map(g => (
            <div key={g.group}>
              <h4>{g.group}</h4>
              {g.items.map(it => (
                <button key={it.type} className="fb-pal-item" onClick={() => add(it.type)}>
                  <span className="fb-pal-ic">{it.icon}</span>{it.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Page / canvas */}
        <div className="fb-stage" onClick={() => setSelId(null)}>
          <div className="fb-page" ref={pageRef} onClick={e => e.stopPropagation()}>
            {logo && curPage === 0 && <img className="fb-logo" src={logo} alt="logo" />}
            {objects.filter(o => (o.page || 0) === curPage).length === 0 && <div className="fb-hint">Add fields, text and shapes from the left, then drag them anywhere and resize with the corner handle.</div>}
            {objects.filter(o => (o.page || 0) === curPage).map(o => (
              <div key={o.id}
                className={`fb-obj ${selId === o.id ? "sel" : ""}`}
                style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.w}%`, height: `${o.h}%`, zIndex: selId === o.id ? 20 : 5 }}
                onPointerDown={e => startDrag(e, o, "move")}
                onClick={e => { e.stopPropagation(); setSelId(o.id); }}
              >
                {renderObject(o)}
                {selId === o.id && (
                  <>
                    <div className="fb-objbar" onPointerDown={e => e.stopPropagation()}>
                      <button title="Duplicate" onClick={e => { e.stopPropagation(); dup(o.id); }}>⧉</button>
                      <button title="Delete" onClick={e => { e.stopPropagation(); removeObj(o.id); }}>🗑</button>
                    </div>
                    <div className="fb-handle" onPointerDown={e => startDrag(e, o, "resize")} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        {sel && <SettingsPanel o={sel} update={update} pickImage={() => { imgFor.current = sel.id; imgInput.current?.click(); }} close={() => setSelId(null)} />}
      </div>
    </div>
  );
}

// ── Object preview inside the builder ──
function renderObject(o: FormObject) {
  const req = o.required ? <span style={{ color: "#dc2626" }}> *</span> : null;
  switch (o.type) {
    case "heading":   return <div style={{ fontSize: o.fontSize || 22, fontWeight: 700, textAlign: o.align || "left", width: "100%", height: "100%", overflow: "hidden" }}>{o.label}</div>;
    case "paragraph": return <div style={{ fontSize: o.fontSize || 13, color: "#57534e", textAlign: o.align || "left", width: "100%", height: "100%", overflow: "hidden", lineHeight: 1.4 }}>{o.label}</div>;
    case "image":     return o.src ? <img src={o.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div className="fb-dash">No image — pick one in settings</div>;
    case "rect":      return <div style={{ width: "100%", height: "100%", background: o.fill, border: `${o.strokeW || 1}px solid ${o.stroke}`, borderRadius: 3 }} />;
    case "ellipse":   return <div style={{ width: "100%", height: "100%", background: o.fill, border: `${o.strokeW || 1}px solid ${o.stroke}`, borderRadius: "50%" }} />;
    case "line":      return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}><div style={{ width: "100%", height: o.strokeW || 2, background: o.stroke }} /></div>;
    case "longtext":  return <div style={{ width: "100%", height: "100%" }}><div className="fb-flabel">{o.label}{req}</div><div className="fb-box" style={{ height: "calc(100% - 15px)" }} /></div>;
    case "dropdown":  return <div style={{ width: "100%", height: "100%" }}><div className="fb-flabel">{o.label}{req}</div><div className="fb-box fb-boxline" style={{ height: "calc(100% - 15px)", justifyContent: "space-between" }}><span>{(o.options || [])[0] || "Select…"}</span><span>▾</span></div></div>;
    case "radio":
    case "checkbox":  return <div style={{ width: "100%", height: "100%", overflow: "hidden" }}><div className="fb-flabel">{o.label}{req}</div>{(o.options || []).map((opt, i) => <div className="fb-opt" key={i}>{o.type === "radio" ? "◯" : "☐"} {opt}</div>)}</div>;
    case "signature": return <div style={{ width: "100%", height: "100%" }}><div className="fb-flabel">{o.label}{req}</div><div className="fb-dash" style={{ height: "calc(100% - 15px)" }}>Signature</div></div>;
    case "file":      return <div style={{ width: "100%", height: "100%" }}><div className="fb-flabel">{o.label}{req}</div><div className="fb-dash" style={{ height: "calc(100% - 15px)" }}>📎 File</div></div>;
    default:          return <div style={{ width: "100%", height: "100%" }}><div className="fb-flabel">{o.label}{req}</div><div className="fb-box fb-boxline" style={{ height: "calc(100% - 15px)" }}>{o.placeholder || ""}</div></div>;
  }
}

// ── Settings panel ──
function SettingsPanel({ o, update, pickImage, close }: { o: FormObject; update: (id: string, p: Partial<FormObject>) => void; pickImage: () => void; close: () => void }) {
  const isField = !["heading", "paragraph", "image", "rect", "ellipse", "line"].includes(o.type);
  const isText  = o.type === "heading" || o.type === "paragraph";
  const isShape = o.type === "rect" || o.type === "ellipse" || o.type === "line";
  const hasOpts = o.type === "dropdown" || o.type === "radio" || o.type === "checkbox";
  return (
    <div className="fb-set" onClick={e => e.stopPropagation()}>
      <h4>{o.type} settings</h4>
      {(isField || isText) && (
        <div className="fb-set-row">
          <label>{isText ? "Text" : "Label / question"}</label>
          {o.type === "paragraph"
            ? <textarea className="fb-in" rows={3} value={o.label || ""} onChange={e => update(o.id, { label: e.target.value })} />
            : <input className="fb-in" value={o.label || ""} onChange={e => update(o.id, { label: e.target.value })} />}
        </div>
      )}
      {(o.type === "text" || o.type === "longtext" || o.type === "number") && (
        <div className="fb-set-row"><label>Placeholder</label><input className="fb-in" value={o.placeholder || ""} onChange={e => update(o.id, { placeholder: e.target.value })} /></div>
      )}
      {hasOpts && (
        <div className="fb-set-row">
          <label>Options</label>
          {(o.options || []).map((opt, i) => (
            <div className="fb-opt-edit" key={i}>
              <input value={opt} onChange={e => { const a = [...(o.options || [])]; a[i] = e.target.value; update(o.id, { options: a }); }} />
              <button className="fb-btn ghost" style={{ padding: "4px 8px" }} onClick={() => update(o.id, { options: (o.options || []).filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => update(o.id, { options: [...(o.options || []), `Option ${(o.options?.length || 0) + 1}`] })}>+ Add option</button>
        </div>
      )}
      {isText && (
        <>
          <div className="fb-set-row"><label>Font size</label><input className="fb-in" type="number" value={o.fontSize || 14} onChange={e => update(o.id, { fontSize: parseInt(e.target.value) || 14 })} /></div>
          <div className="fb-set-row"><label>Align</label>
            <div className="fb-seg">{(["left", "center", "right"] as const).map(a => <button key={a} className={o.align === a ? "on" : ""} onClick={() => update(o.id, { align: a })}>{a}</button>)}</div>
          </div>
        </>
      )}
      {o.type === "image" && <div className="fb-set-row"><label>Picture</label><button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={pickImage}>Choose image…</button></div>}
      {isShape && (
        <>
          {o.type !== "line" && <div className="fb-set-row"><label>Fill</label><input className="fb-in" type="color" value={o.fill === "transparent" || !o.fill ? "#ffffff" : o.fill} onChange={e => update(o.id, { fill: e.target.value })} /><label className="fb-check" style={{ marginTop: 6 }}><input type="checkbox" checked={o.fill === "transparent"} onChange={e => update(o.id, { fill: e.target.checked ? "transparent" : "#ffffff" })} /> Transparent</label></div>}
          <div className="fb-set-row"><label>Line colour</label><input className="fb-in" type="color" value={o.stroke || "#374151"} onChange={e => update(o.id, { stroke: e.target.value })} /></div>
          <div className="fb-set-row"><label>Line thickness</label><input className="fb-in" type="number" value={o.strokeW || 1} onChange={e => update(o.id, { strokeW: parseInt(e.target.value) || 1 })} /></div>
        </>
      )}
      {isField && (
        <label className="fb-check" style={{ margin: "4px 0 12px" }}><input type="checkbox" checked={!!o.required} onChange={e => update(o.id, { required: e.target.checked })} /> Required field</label>
      )}
      <button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={close}>Done</button>
    </div>
  );
}

// ── Render a blank form to printable HTML and open the print dialog ──
// (Shared layout basis for the fill view / PDF; here used for "Download PDF".)
export function formToHtml(schema: FormSchema): string {
  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const objHtml = (o: FormObject) => {
    const pos = `position:absolute;left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%;box-sizing:border-box;`;
    const lbl = `<div style="font-size:11px;font-weight:600;color:#44403c;margin-bottom:2px">${esc(o.label || "")}${o.required ? ' <span style="color:#dc2626">*</span>' : ""}</div>`;
    const box = (h = "calc(100% - 15px)") => `<div style="border:1px solid #9ca3af;border-radius:5px;height:${h};width:100%"></div>`;
    switch (o.type) {
      case "heading":   return `<div style="${pos}font-size:${o.fontSize || 22}px;font-weight:700;text-align:${o.align || "left"}">${esc(o.label || "")}</div>`;
      case "paragraph": return `<div style="${pos}font-size:${o.fontSize || 13}px;color:#57534e;text-align:${o.align || "left"};line-height:1.4">${esc(o.label || "")}</div>`;
      case "image":     return o.src ? `<img src="${o.src}" style="${pos}object-fit:contain"/>` : `<div style="${pos}"></div>`;
      case "rect":      return `<div style="${pos}background:${o.fill};border:${o.strokeW || 1}px solid ${o.stroke};border-radius:3px"></div>`;
      case "ellipse":   return `<div style="${pos}background:${o.fill};border:${o.strokeW || 1}px solid ${o.stroke};border-radius:50%"></div>`;
      case "line":      return `<div style="${pos}display:flex;align-items:center"><div style="width:100%;height:${o.strokeW || 2}px;background:${o.stroke}"></div></div>`;
      case "radio":
      case "checkbox":  return `<div style="${pos}">${lbl}${(o.options || []).map(op => `<div style="font-size:12px;margin:2px 0">${o.type === "radio" ? "◯" : "☐"} ${esc(op)}</div>`).join("")}</div>`;
      case "signature": return `<div style="${pos}">${lbl}<div style="border:1.4px dashed #9ca3af;border-radius:6px;height:calc(100% - 15px)"></div></div>`;
      default:          return `<div style="${pos}">${lbl}${box()}</div>`;
    }
  };
  const logo = schema.logo ? `<img src="${schema.logo}" style="position:absolute;top:3%;left:50%;transform:translateX(-50%);max-height:70px;max-width:40%;object-fit:contain"/>` : "";
  const pageCount = schema.pageCount || (schema.objects.reduce((m, o) => Math.max(m, o.page || 0), 0) + 1) || 1;
  const pages: string[] = [];
  for (let p = 0; p < pageCount; p++) {
    const objs = schema.objects.filter(o => (o.page || 0) === p);
    pages.push(`<div class="pg">${p === 0 ? logo : ""}${objs.map(objHtml).join("")}</div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(schema.title)}</title>
    <style>@page{size:A4;margin:0}body{margin:0;font-family:'DM Sans',Arial,sans-serif}
    .pg{position:relative;width:210mm;height:297mm;overflow:hidden;page-break-after:always}
    .pg:last-child{page-break-after:auto}</style></head>
    <body>${pages.join("")}</body></html>`;
}

function printForm(schema: FormSchema) {
  const html = formToHtml(schema);
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) { alert("Please allow pop-ups to download the form as PDF."); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 350);
}