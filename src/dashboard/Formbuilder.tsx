import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// NkoAha Form Builder (Stage 1)
// Drag-and-drop builder for digital forms. Produces a FormSchema that is
// saved as a `documents` row (format "form") and surfaced in Drive as a
// reusable template. Filling + routing + certified PDF is handled by the
// form renderer in the document editor (Stage 2) and the existing
// routing/certify pipeline.
// ─────────────────────────────────────────────────────────────

export type FormFieldType =
  | "heading" | "paragraph" | "text" | "longtext" | "number"
  | "date" | "dropdown" | "radio" | "checkbox" | "signature" | "file" | "image";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];       // dropdown / radio / checkbox
  width?: "full" | "half";
  src?: string;             // image data URL (logo/picture)
}

export interface FormSchema {
  title: string;
  logo?: string;            // data URL
  fields: FormField[];
}

const PALETTE: { type: FormFieldType; label: string; icon: string }[] = [
  { type: "heading",   label: "Heading",        icon: "H" },
  { type: "paragraph", label: "Paragraph text", icon: "¶" },
  { type: "text",      label: "Short answer",   icon: "▭" },
  { type: "longtext",  label: "Long answer",    icon: "☰" },
  { type: "number",    label: "Number",         icon: "#" },
  { type: "date",      label: "Date",           icon: "📅" },
  { type: "dropdown",  label: "Dropdown",       icon: "▾" },
  { type: "radio",     label: "Single choice",  icon: "◉" },
  { type: "checkbox",  label: "Checkboxes",     icon: "☑" },
  { type: "signature", label: "Signature",      icon: "✍" },
  { type: "file",      label: "File upload",    icon: "📎" },
  { type: "image",     label: "Image / logo",   icon: "🖼" },
];

const uid = () => "f_" + Math.random().toString(36).slice(2, 9);

function defaultField(type: FormFieldType): FormField {
  const base: FormField = { id: uid(), type, label: "", width: "full" };
  switch (type) {
    case "heading":   return { ...base, label: "Section heading" };
    case "paragraph": return { ...base, label: "Add descriptive text for the person filling this form." };
    case "text":      return { ...base, label: "Question", placeholder: "Short answer", width: "half" };
    case "longtext":  return { ...base, label: "Question", placeholder: "Long answer" };
    case "number":    return { ...base, label: "Amount", placeholder: "0", width: "half" };
    case "date":      return { ...base, label: "Date", width: "half" };
    case "dropdown":  return { ...base, label: "Choose one", options: ["Option 1", "Option 2"], width: "half" };
    case "radio":     return { ...base, label: "Select one", options: ["Yes", "No"] };
    case "checkbox":  return { ...base, label: "Select all that apply", options: ["Option 1", "Option 2"] };
    case "signature": return { ...base, label: "Signature", width: "half" };
    case "file":      return { ...base, label: "Attach a file", width: "half" };
    case "image":     return { ...base, label: "Image" };
    default:          return base;
  }
}

const STYLES = `
  .fb-overlay{position:fixed;inset:0;background:#f5f3ef;z-index:200;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;color:#1c1917}
  .fb-top{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid #e7e4df;flex-shrink:0}
  .fb-title-input{flex:1;min-width:0;font-size:16px;font-weight:700;border:none;outline:none;background:transparent;color:#1c1917}
  .fb-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
  .fb-btn.ghost{background:transparent;color:#78716c;border-color:#e7e4df}
  .fb-btn.ghost:hover{background:#f5f3ef}
  .fb-btn.primary{background:#7c3aed;color:#fff}
  .fb-btn.primary:hover{background:#5b21b6}
  .fb-btn:disabled{opacity:.55;cursor:not-allowed}
  .fb-body{flex:1;display:flex;min-height:0;overflow:hidden}
  .fb-palette{width:210px;flex-shrink:0;background:#fff;border-right:1px solid #e7e4df;padding:12px;overflow-y:auto}
  .fb-palette h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e;margin:4px 0 10px}
  .fb-pal-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;margin-bottom:6px;border:1px solid #e7e4df;border-radius:9px;background:#fff;cursor:pointer;font-size:13px;color:#1c1917;text-align:left}
  .fb-pal-item:hover{border-color:#c4b5fd;background:#faf7ff}
  .fb-pal-ic{width:24px;height:24px;border-radius:6px;background:#ede9fe;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
  .fb-canvas{flex:1;overflow-y:auto;padding:24px;display:flex;justify-content:center}
  .fb-sheet{width:100%;max-width:720px}
  .fb-logo-wrap{display:flex;justify-content:center;margin-bottom:14px}
  .fb-logo{max-height:90px;max-width:260px;object-fit:contain}
  .fb-row{display:flex;flex-wrap:wrap;gap:12px}
  .fb-field{background:#fff;border:1px solid #e7e4df;border-radius:11px;padding:12px 14px;margin-bottom:12px;position:relative;cursor:pointer;transition:border-color .12s,box-shadow .12s}
  .fb-field.half{width:calc(50% - 6px)}
  .fb-field.full{width:100%}
  .fb-field:hover{border-color:#c4b5fd}
  .fb-field.sel{border-color:#7c3aed;box-shadow:0 0 0 3px #ede9fe}
  .fb-field-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .fb-ftype{font-size:10px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#7c3aed;background:#ede9fe;padding:1px 7px;border-radius:20px}
  .fb-req-dot{color:#dc2626;font-weight:700}
  .fb-fctrls{margin-left:auto;display:flex;gap:2px}
  .fb-ic-btn{width:26px;height:26px;border:none;background:transparent;color:#a8a29e;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px}
  .fb-ic-btn:hover{background:#f5f3ef;color:#1c1917}
  .fb-ic-btn.danger:hover{background:#fee2e2;color:#dc2626}
  .fb-flabel{font-size:14px;font-weight:600;color:#1c1917}
  .fb-fhead{font-size:18px;font-weight:700}
  .fb-fpara{font-size:13px;color:#57534e;line-height:1.5}
  .fb-fprev{margin-top:8px}
  .fb-input{width:100%;padding:8px 10px;border:1px solid #d6d3d1;border-radius:7px;font-size:13px;background:#fafaf9;font-family:inherit;color:#44403c;pointer-events:none}
  .fb-opt{display:flex;align-items:center;gap:7px;font-size:13px;color:#44403c;margin:3px 0}
  .fb-sigbox{border:1.5px dashed #c4b5fd;border-radius:8px;height:54px;display:flex;align-items:center;justify-content:center;color:#a78bfa;font-size:12px;font-style:italic}
  .fb-filebox{border:1.5px dashed #d6d3d1;border-radius:8px;padding:10px;text-align:center;color:#a8a29e;font-size:12px}
  /* Settings drawer */
  .fb-settings{width:290px;flex-shrink:0;background:#fff;border-left:1px solid #e7e4df;padding:16px;overflow-y:auto}
  .fb-settings h4{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e;margin:0 0 12px}
  .fb-set-row{margin-bottom:12px}
  .fb-set-row label{display:block;font-size:12px;font-weight:600;color:#57534e;margin-bottom:5px}
  .fb-set-input{width:100%;padding:8px 10px;border:1px solid #d6d3d1;border-radius:7px;font-size:13px;font-family:inherit;box-sizing:border-box}
  .fb-set-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#44403c;cursor:pointer}
  .fb-seg{display:flex;border:1px solid #d6d3d1;border-radius:7px;overflow:hidden}
  .fb-seg button{flex:1;padding:7px;border:none;background:#fff;font-size:12px;cursor:pointer;color:#78716c}
  .fb-seg button.on{background:#7c3aed;color:#fff}
  .fb-opt-edit{display:flex;gap:6px;margin-bottom:6px}
  .fb-opt-edit input{flex:1;padding:6px 8px;border:1px solid #d6d3d1;border-radius:6px;font-size:12.5px}
  .fb-empty{text-align:center;color:#a8a29e;padding:60px 20px;border:2px dashed #e7e4df;border-radius:14px;background:#fff}
  @media (max-width:860px){
    .fb-palette{width:150px;padding:8px}
    .fb-pal-item{font-size:12px;padding:8px}
    .fb-settings{position:fixed;right:0;top:0;bottom:0;width:86vw;max-width:320px;z-index:210;box-shadow:-8px 0 30px rgba(0,0,0,.18)}
    .fb-field.half{width:100%}
    .fb-canvas{padding:14px}
  }
`;

interface FormBuilderProps {
  open: boolean;
  initialSchema?: FormSchema | null;
  initialTitle?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (schema: FormSchema, title: string) => void;
}

export default function FormBuilder({ open, initialSchema, initialTitle, saving, onClose, onSave }: FormBuilderProps) {
  const [title, setTitle]   = useState(initialTitle || "Untitled form");
  const [logo, setLogo]     = useState<string | undefined>(initialSchema?.logo);
  const [fields, setFields] = useState<FormField[]>(initialSchema?.fields || []);
  const [selId, setSelId]   = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const imgInputFor = useRef<string | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle || initialSchema?.title || "Untitled form");
    setLogo(initialSchema?.logo);
    setFields(initialSchema?.fields || []);
    setSelId(null);
  }, [open]); // eslint-disable-line

  if (!open) return null;

  const sel = fields.find(f => f.id === selId) || null;
  const update = (id: string, patch: Partial<FormField>) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const add = (type: FormFieldType) => {
    const f = defaultField(type);
    setFields(prev => [...prev, f]);
    setSelId(f.id);
    if (type === "image") { imgInputFor.current = f.id; setTimeout(() => imgInput.current?.click(), 50); }
  };
  const remove = (id: string) => { setFields(prev => prev.filter(f => f.id !== id)); if (selId === id) setSelId(null); };
  const move = (id: string, dir: -1 | 1) => setFields(prev => {
    const i = prev.findIndex(f => f.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const u = [...prev]; [u[i], u[j]] = [u[j], u[i]]; return u;
  });
  const readAsDataUrl = (file: File, cb: (d: string) => void) => {
    const r = new FileReader(); r.onload = () => cb(String(r.result || "")); r.readAsDataURL(file);
  };

  const save = () => {
    const clean = fields.map(f => ({ ...f, label: (f.label || "").trim() }));
    onSave({ title: title.trim() || "Untitled form", logo, fields: clean }, title.trim() || "Untitled form");
  };

  return (
    <div className="fb-overlay">
      <style>{STYLES}</style>
      <div className="fb-top">
        <button className="fb-btn ghost" onClick={onClose} aria-label="Close">✕</button>
        <input className="fb-title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Form title" />
        <button className="fb-btn ghost" onClick={() => logoInput.current?.click()}>🖼 Logo</button>
        <button className="fb-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</button>
        <input ref={logoInput} type="file" accept="image/*" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) readAsDataUrl(f, setLogo); e.currentTarget.value = ""; }} />
        <input ref={imgInput} type="file" accept="image/*" hidden
          onChange={e => { const f = e.target.files?.[0]; const id = imgInputFor.current; if (f && id) readAsDataUrl(f, d => update(id, { src: d })); e.currentTarget.value = ""; }} />
      </div>

      <div className="fb-body">
        {/* Palette */}
        <div className="fb-palette">
          <h4>Add a field</h4>
          {PALETTE.map(p => (
            <button key={p.type} className="fb-pal-item" onClick={() => add(p.type)}>
              <span className="fb-pal-ic">{p.icon}</span>{p.label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="fb-canvas" onClick={() => setSelId(null)}>
          <div className="fb-sheet" onClick={e => e.stopPropagation()}>
            {logo && <div className="fb-logo-wrap"><img className="fb-logo" src={logo} alt="logo" /></div>}
            {fields.length === 0 && (
              <div className="fb-empty">Pick fields from the left to start building your form.<br/>Drag the handle (⋮⋮) to reorder.</div>
            )}
            <div className="fb-row">
              {fields.map((f, idx) => (
                <div
                  key={f.id}
                  className={`fb-field ${f.width || "full"} ${selId === f.id ? "sel" : ""}`}
                  onClick={() => setSelId(f.id)}
                  draggable
                  onDragStart={() => { dragIndex.current = idx; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    const from = dragIndex.current; dragIndex.current = null;
                    if (from == null || from === idx) return;
                    setFields(prev => { const u = [...prev]; const [m] = u.splice(from, 1); u.splice(idx, 0, m); return u; });
                  }}
                >
                  <div className="fb-field-top">
                    <span style={{ cursor: "grab", color: "#cbd5e1", fontSize: 13 }} title="Drag to reorder">⋮⋮</span>
                    <span className="fb-ftype">{f.type}</span>
                    {f.required && <span className="fb-req-dot" title="Required">*</span>}
                    <div className="fb-fctrls">
                      <button className="fb-ic-btn" title="Move up"   onClick={e => { e.stopPropagation(); move(f.id, -1); }}>↑</button>
                      <button className="fb-ic-btn" title="Move down" onClick={e => { e.stopPropagation(); move(f.id, 1); }}>↓</button>
                      <button className="fb-ic-btn danger" title="Delete" onClick={e => { e.stopPropagation(); remove(f.id); }}>🗑</button>
                    </div>
                  </div>
                  {renderFieldPreview(f)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Settings */}
        {sel && (
          <div className="fb-settings" onClick={e => e.stopPropagation()}>
            <h4>{sel.type} settings</h4>
            <div className="fb-set-row">
              <label>{sel.type === "heading" ? "Heading text" : sel.type === "paragraph" ? "Text" : "Label / question"}</label>
              {sel.type === "paragraph"
                ? <textarea className="fb-set-input" rows={3} value={sel.label} onChange={e => update(sel.id, { label: e.target.value })} />
                : <input className="fb-set-input" value={sel.label} onChange={e => update(sel.id, { label: e.target.value })} />}
            </div>

            {(sel.type === "text" || sel.type === "longtext" || sel.type === "number") && (
              <div className="fb-set-row">
                <label>Placeholder</label>
                <input className="fb-set-input" value={sel.placeholder || ""} onChange={e => update(sel.id, { placeholder: e.target.value })} />
              </div>
            )}

            {(sel.type === "dropdown" || sel.type === "radio" || sel.type === "checkbox") && (
              <div className="fb-set-row">
                <label>Options</label>
                {(sel.options || []).map((opt, i) => (
                  <div className="fb-opt-edit" key={i}>
                    <input value={opt} onChange={e => { const o = [...(sel.options || [])]; o[i] = e.target.value; update(sel.id, { options: o }); }} />
                    <button className="fb-ic-btn danger" onClick={() => { const o = (sel.options || []).filter((_, j) => j !== i); update(sel.id, { options: o }); }}>✕</button>
                  </div>
                ))}
                <button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                  onClick={() => update(sel.id, { options: [...(sel.options || []), `Option ${(sel.options?.length || 0) + 1}`] })}>+ Add option</button>
              </div>
            )}

            {sel.type === "image" && (
              <div className="fb-set-row">
                <label>Picture</label>
                <button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { imgInputFor.current = sel.id; imgInput.current?.click(); }}>Choose image…</button>
              </div>
            )}

            {sel.type !== "heading" && sel.type !== "paragraph" && sel.type !== "image" && (
              <label className="fb-set-check" style={{ marginBottom: 14 }}>
                <input type="checkbox" checked={!!sel.required} onChange={e => update(sel.id, { required: e.target.checked })} />
                Required field
              </label>
            )}

            {sel.type !== "heading" && sel.type !== "paragraph" && (
              <div className="fb-set-row">
                <label>Width</label>
                <div className="fb-seg">
                  <button className={sel.width !== "half" ? "on" : ""} onClick={() => update(sel.id, { width: "full" })}>Full</button>
                  <button className={sel.width === "half" ? "on" : ""} onClick={() => update(sel.id, { width: "half" })}>Half</button>
                </div>
              </div>
            )}

            <button className="fb-btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => setSelId(null)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Static preview of a field as it appears in the builder canvas.
function renderFieldPreview(f: FormField) {
  const L = (req?: boolean) => <div className="fb-flabel">{f.label || "Untitled"}{req && <span className="fb-req-dot"> *</span>}</div>;
  switch (f.type) {
    case "heading":   return <div className="fb-fhead">{f.label || "Section heading"}</div>;
    case "paragraph": return <div className="fb-fpara">{f.label}</div>;
    case "text":      return <>{L(f.required)}<input className="fb-input fb-fprev" placeholder={f.placeholder} readOnly /></>;
    case "longtext":  return <>{L(f.required)}<textarea className="fb-input fb-fprev" rows={3} placeholder={f.placeholder} readOnly /></>;
    case "number":    return <>{L(f.required)}<input className="fb-input fb-fprev" placeholder={f.placeholder} readOnly /></>;
    case "date":      return <>{L(f.required)}<input className="fb-input fb-fprev" placeholder="dd / mm / yyyy" readOnly /></>;
    case "dropdown":  return <>{L(f.required)}<select className="fb-input fb-fprev" disabled><option>{(f.options || [])[0] || "Select…"}</option></select></>;
    case "radio":     return <>{L(f.required)}<div className="fb-fprev">{(f.options || []).map((o, i) => <div className="fb-opt" key={i}>◯ {o}</div>)}</div></>;
    case "checkbox":  return <>{L(f.required)}<div className="fb-fprev">{(f.options || []).map((o, i) => <div className="fb-opt" key={i}>☐ {o}</div>)}</div></>;
    case "signature": return <>{L(f.required)}<div className="fb-sigbox fb-fprev">Signature will be captured here</div></>;
    case "file":      return <>{L(f.required)}<div className="fb-filebox fb-fprev">📎 File will be attached here</div></>;
    case "image":     return f.src ? <img src={f.src} alt="" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} /> : <div className="fb-filebox">No image chosen — pick one in settings</div>;
    default:          return null;
  }
}