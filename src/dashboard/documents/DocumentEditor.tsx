import { useEditor, EditorContent, Extension, Node as TiptapNode, mergeAttributes } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── CUSTOM EXTENSIONS ─── */

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{ types: ["textStyle"], attributes: { fontSize: { default: null, parseHTML: el => el.style.fontSize || null, renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {} } } }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [{ types: ["paragraph", "heading"], attributes: { lineHeight: { default: null, parseHTML: el => el.style.lineHeight || null, renderHTML: attrs => attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {} } } }];
  },
  addCommands() {
    return { setLineHeight: (lh: string) => ({ commands }: any) => commands.updateAttributes("paragraph", { lineHeight: lh }) } as any;
  },
});

const ParagraphSpacing = Extension.create({
  name: "paragraphSpacing",
  addGlobalAttributes() {
    return [{ types: ["paragraph"], attributes: { paragraphSpacing: { default: null, parseHTML: el => el.style.marginBottom || null, renderHTML: attrs => attrs.paragraphSpacing ? { style: `margin-bottom: ${attrs.paragraphSpacing}` } : {} } } }];
  },
  addCommands() {
    return { setParagraphSpacing: (spacing: string) => ({ commands }: any) => commands.updateAttributes("paragraph", { paragraphSpacing: spacing }) } as any;
  },
});

const BorderBox = TiptapNode.create({
  name: "borderBox", group: "block", content: "block+", defining: true,
  addAttributes() { return { borderStyle: { default: "1px solid #7c3aed" }, borderRadius: { default: "6px" }, padding: { default: "12px 16px" } }; },
  parseHTML() { return [{ tag: "div[data-border-box]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-border-box": "", style: `border: ${HTMLAttributes.borderStyle}; border-radius: ${HTMLAttributes.borderRadius}; padding: ${HTMLAttributes.padding}; margin: 8px 0;` }), 0];
  },
  addCommands() { return { insertBorderBox: () => ({ commands }: any) => commands.insertContent({ type: "borderBox", content: [{ type: "paragraph" }] }) } as any; },
});

const DateStamp = TiptapNode.create({
  name: "dateStamp", group: "inline", inline: true, atom: true,
  addAttributes() { return { date: { default: "" } }; },
  parseHTML() { return [{ tag: "span[data-date-stamp]" }]; },
  renderHTML({ node }) {
    return ["span", { "data-date-stamp": "", style: "display:inline-block;font-weight:700;font-size:inherit;font-family:inherit;color:inherit;cursor:move;", contenteditable: "false" }, node.attrs.date];
  },
  addCommands() { return { insertDateStamp: (date: string) => ({ commands }: any) => commands.insertContent({ type: "dateStamp", attrs: { date } }) } as any; },
});

const SignatureNode = TiptapNode.create({
  name: "signatureNode", group: "inline", inline: true, atom: true,
  addAttributes() { return { src: { default: "" } }; },
  parseHTML() { return [{ tag: "img[data-signature]" }]; },
  renderHTML({ node }) {
    return ["img", { "data-signature": "", src: node.attrs.src, style: "display:inline-block;height:56px;vertical-align:middle;margin:0 4px;border:2px solid rgba(124,58,237,0.3);border-radius:4px;padding:2px;cursor:move;", contenteditable: "false", draggable: "true" }];
  },
  addCommands() { return { insertSignatureNode: (src: string) => ({ commands }: any) => commands.insertContent({ type: "signatureNode", attrs: { src } }) } as any; },
});

/* ─── RESIZABLE IMAGE NODE ───
   Custom TipTap node that stores a width attribute and renders
   with drag handles so the user can resize it inline.
*/
const ResizableImage = TiptapNode.create({
  name: "resizableImage",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src:   { default: null },
      width: { default: 400, parseHTML: el => parseInt(el.getAttribute("width") || "400") },
      alt:   { default: "image" },
    };
  },
  parseHTML() { return [{ tag: "img[data-resizable-image]" }]; },
  renderHTML({ node }) {
    return ["img", {
      "data-resizable-image": "",
      src:   node.attrs.src,
      width: node.attrs.width,
      alt:   node.attrs.alt,
      style: `width:${node.attrs.width}px;max-width:100%;height:auto;display:block;border-radius:4px;margin:8px 0;cursor:default;`,
    }];
  },
  addCommands() {
    return {
      insertResizableImage: (src: string) => ({ commands }: any) =>
        commands.insertContent({ type: "resizableImage", attrs: { src, width: 400 } }),
    } as any;
  },
  addNodeView() {
    return ({ node, getPos, editor: ed }: any) => {
      const outer = document.createElement("div");
      outer.style.cssText = "position:relative;display:inline-block;max-width:100%;margin:8px 0;user-select:none;";

      const img = document.createElement("img");
      img.src   = node.attrs.src;
      img.style.cssText = `width:${node.attrs.width}px;max-width:100%;height:auto;display:block;border-radius:4px;border:2px solid transparent;transition:border-color .15s;cursor:default;`;
      img.draggable = false;
      outer.appendChild(img);

      // Resize handle — bottom-right corner
      const handle = document.createElement("div");
      handle.style.cssText = `
        position:absolute;bottom:4px;right:4px;
        width:14px;height:14px;
        background:#7c3aed;border-radius:3px;
        cursor:se-resize;opacity:0;transition:opacity .15s;
        display:flex;align-items:center;justify-content:center;
      `;
      handle.innerHTML = `<svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M1 7L7 1M4 7L7 4M7 7L7 7"/><line x1="1" y1="7" x2="7" y2="1" stroke="white" stroke-width="1.2"/><line x1="4" y1="7" x2="7" y2="4" stroke="white" stroke-width="1.2"/></svg>`;
      outer.appendChild(handle);

      // Size label
      const label = document.createElement("div");
      label.style.cssText = "position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;opacity:0;transition:opacity .15s;pointer-events:none;font-family:monospace;";
      label.textContent = `${node.attrs.width}px`;
      outer.appendChild(label);

      // Show handles on hover
      outer.addEventListener("mouseenter", () => {
        handle.style.opacity = "1";
        label.style.opacity  = "1";
        img.style.borderColor = "#7c3aed";
      });
      outer.addEventListener("mouseleave", () => {
        handle.style.opacity = "0";
        label.style.opacity  = "0";
        img.style.borderColor = "transparent";
      });

      // Drag to resize
      let startX = 0, startW = 0;
      handle.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startW = img.offsetWidth;

        const onMove = (ev: MouseEvent) => {
          const newW = Math.max(60, Math.min(816, startW + (ev.clientX - startX)));
          img.style.width = newW + "px";
          label.textContent = `${Math.round(newW)}px`;
        };
        const onUp = (ev: MouseEvent) => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          const finalW = Math.max(60, Math.min(816, startW + (ev.clientX - startX)));
          if (typeof getPos === "function") {
            ed.chain().focus().command(({ tr }: any) => {
              tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, width: Math.round(finalW) });
              return true;
            }).run();
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      return { dom: outer };
    };
  },
});

/* ─── TYPES ─── */
interface Props {
  content: JSONContent | null;
  editable?: boolean;
  pageContentHeight?: number;
  pageGap?: number;
  onUpdate?: (content: JSONContent) => void;
  onPageCount?: (pages: number) => void;
  onInsertDate?: (fn: (date: string) => void) => void;
  onInsertSignature?: (fn: (src: string) => void) => void;
  onInsertImage?: (fn: (src: string) => void) => void;
}

const SAFE_EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

const FONT_FAMILIES = ["DM Sans", "Georgia", "Times New Roman", "Courier New", "Arial", "Helvetica", "Verdana", "Trebuchet MS"];
const FONT_SIZES    = ["8px","9px","10px","11px","12px","14px","16px","18px","20px","22px","24px","28px","32px","36px","48px","72px"];
const LINE_HEIGHTS  = [{ label: "Single", value: "1" }, { label: "1.15", value: "1.15" }, { label: "1.5", value: "1.5" }, { label: "Double", value: "2" }, { label: "2.5", value: "2.5" }];
const PARA_SPACINGS = [{ label: "None", value: "0" }, { label: "Small (6px)", value: "6px" }, { label: "Medium (12px)", value: "12px" }, { label: "Large (20px)", value: "20px" }];
const COLORS        = ["#000000","#1c1917","#dc2626","#ea580c","#ca8a04","#16a34a","#0891b2","#2563eb","#7c3aed","#db2777","#ffffff","#f5f5f4","#fecaca","#fed7aa","#fef08a","#bbf7d0","#a5f3fc","#bfdbfe","#ddd6fe","#fbcfe8"];

/* ─── TOOLBAR DROPDOWN ─── */
function ToolDropdown({ label, items, onSelect, width = 120 }: { label: string; items: { label: string; value: string }[]; onSelect: (v: string) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button className="de-tool de-tool-select" onClick={() => setOpen(o => !o)} style={{ minWidth: width, justifyContent: "space-between" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
      </button>
      {open && (
        <div className="de-dropdown">
          {items.map(item => <button key={item.value} className="de-dropdown-item" onClick={() => { onSelect(item.value); setOpen(false); }}>{item.label}</button>)}
        </div>
      )}
    </div>
  );
}

/* ─── COLOR PICKER ─── */
function ColorPicker({ label, onSelect }: { label: string; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("#000000");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="de-tool" onClick={() => setOpen(o => !o)} title={label}><span style={{ fontSize: 12 }}>{label}</span></button>
      {open && (
        <div className="de-color-picker">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,18px)", gap: 3, marginBottom: 8 }}>
            {COLORS.map(c => <button key={c} onClick={() => { onSelect(c); setOpen(false); }} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid #ddd", background: c, cursor: "pointer", padding: 0 }} />)}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={custom} onChange={e => setCustom(e.target.value)} style={{ width: 32, height: 24, border: "none", padding: 0, cursor: "pointer" }} />
            <button className="de-tool" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => { onSelect(custom); setOpen(false); }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

function sanitize(content: JSONContent | null): JSONContent {
  if (!content || typeof content !== "object" || content.type !== "doc") return SAFE_EMPTY;
  if (!content.content || content.content.length === 0) return SAFE_EMPTY;
  return content;
}

/* ─── COMPONENT ─── */
export default function DocumentEditor({
  content, editable = false,
  pageContentHeight = 864,
  pageGap = 24,
  onUpdate, onPageCount, onInsertDate, onInsertSignature, onInsertImage,
}: Props) {
  const [pages, setPages]             = useState(1);
  const [currentFont, setCurrentFont] = useState("DM Sans");
  const [currentSize, setCurrentSize] = useState("14px");
  const contentRef = useRef<HTMLDivElement>(null);

  /* ── STYLES ── */
  useEffect(() => {
    const id = "de-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
      .de-toolbar { display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px 10px;background:#fff;border-bottom:1px solid #e7e4df;position:sticky;top:0;z-index:30;box-shadow:0 1px 4px rgba(0,0,0,0.05); }
      .de-sep { width:1px;height:20px;background:#e7e4df;margin:0 4px;flex-shrink:0; }
      .de-tool { display:inline-flex;align-items:center;justify-content:center;height:28px;min-width:28px;padding:0 6px;border:none;background:transparent;border-radius:5px;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#44403c;cursor:pointer;transition:background .12s,color .12s;flex-shrink:0; }
      .de-tool:hover { background:#f0ede8; }
      .de-tool.active { background:#ede9fe;color:#7c3aed; }
      .de-tool-select { display:inline-flex;align-items:center;height:28px;padding:0 8px;border-radius:5px;border:1px solid #e7e4df;background:#faf9f8;font-family:'DM Sans',sans-serif;font-size:12px;color:#44403c;cursor:pointer;gap:4px; }
      .de-tool-select:hover { background:#f0ede8; }
      .de-dropdown { position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #e7e4df;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.1);z-index:200;min-width:140px;max-height:220px;overflow-y:auto;padding:4px; }
      .de-dropdown-item { display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:transparent;border-radius:5px;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#1c1917;cursor:pointer;transition:background .1s; }
      .de-dropdown-item:hover { background:#f0ede8; }
      .de-color-picker { position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #e7e4df;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;padding:10px;width:220px; }
      .de-prosemirror-host .ProseMirror { outline:none;font-family:'DM Sans',Georgia,serif;font-size:14px;line-height:1.75;color:#1c1917;caret-color:#7c3aed;word-wrap:break-word;overflow-wrap:break-word;min-height:900px; }
      .de-prosemirror-host .ProseMirror p { margin-bottom:0.5em; }
      .de-prosemirror-host .ProseMirror h1 { font-size:26px;font-weight:700;color:#7c3aed;margin:1em 0 0.4em; }
      .de-prosemirror-host .ProseMirror h2 { font-size:20px;font-weight:600;color:#7c3aed;margin:0.9em 0 0.35em; }
      .de-prosemirror-host .ProseMirror h3 { font-size:16px;font-weight:600;color:#7c3aed;margin:0.8em 0 0.3em; }
      .de-prosemirror-host .ProseMirror ul,.de-prosemirror-host .ProseMirror ol { padding-left:1.5em;margin-bottom:0.5em; }
      .de-prosemirror-host .ProseMirror blockquote { border-left:3px solid #7c3aed;padding-left:12px;color:#78716c;margin:0.5em 0; }
      .de-prosemirror-host .ProseMirror table { border-collapse:collapse;width:100%;margin:1em 0; }
      .de-prosemirror-host .ProseMirror td,.de-prosemirror-host .ProseMirror th { border:1px solid #d6d3ce;padding:8px 12px;min-width:60px; }
      .de-prosemirror-host .ProseMirror th { background:#f5f3ef;font-weight:600; }
      .de-prosemirror-host .ProseMirror .selectedCell { background:#ede9fe; }
      .de-prosemirror-host .ProseMirror hr { border:none;border-top:2px solid #e7e4df;margin:1em 0; }
      .de-prosemirror-host .ProseMirror code { background:#f0ede8;border-radius:4px;padding:1px 5px;font-family:'DM Mono',monospace;font-size:.9em; }
      .de-prosemirror-host .ProseMirror pre { background:#1c1917;color:#e7e4df;border-radius:8px;padding:12px 16px;font-family:'DM Mono',monospace;font-size:13px;overflow-x:auto;margin:1em 0; }
      .de-prosemirror-host .ProseMirror img { max-width:100%;height:auto;border-radius:4px;margin:8px 0;display:block;border:2px solid transparent;transition:border-color .15s; }
      .de-prosemirror-host .ProseMirror img.ProseMirror-selectednode { border-color:#7c3aed;outline:2px solid #ede9fe; }
    `;
    document.head.appendChild(el);
  }, []);

  /* ── EDITOR ── */
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ underline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle, Color, Underline, FontFamily, FontSize, LineHeight, ParagraphSpacing,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      BorderBox, DateStamp, SignatureNode,
      ResizableImage,
    ],
    content: sanitize(content),
    onUpdate({ editor }) {
      onUpdate?.(editor.getJSON());
      measurePages();
    },
  });

  /* ── EXPOSE INSERT FUNCTIONS ── */
  useEffect(() => {
    if (!editor) return;
    onInsertDate?.((date: string) => {
      editor.chain().focus().insertContent({ type: "dateStamp", attrs: { date } }).run();
    });
    onInsertSignature?.((src: string) => {
      editor.chain().focus().insertContent({ type: "signatureNode", attrs: { src } }).run();
    });
    onInsertImage?.((src: string) => {
      (editor.chain().focus() as any).insertResizableImage(src).run();
    });
  }, [editor, onInsertDate, onInsertSignature, onInsertImage]);

  /* ── PAGE MEASUREMENT ── */
  const measurePages = useCallback(() => {
    if (!contentRef.current) return;
    const pm = contentRef.current.querySelector(".ProseMirror") as HTMLElement | null;
    if (!pm) return;
    const h = pm.scrollHeight;
    const count = Math.max(1, Math.ceil((h - 8) / pageContentHeight));
    setPages(count);
    onPageCount?.(count);
  }, [pageContentHeight, onPageCount]);

  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(measurePages, 300);
    return () => clearTimeout(t);
  }, [editor, measurePages]);

  useEffect(() => {
    const pm = contentRef.current?.querySelector(".ProseMirror");
    if (!pm) return;
    const ro = new ResizeObserver(measurePages);
    ro.observe(pm);
    return () => ro.disconnect();
  }, [editor, measurePages]);

  if (!editor) return null;

  const isActive = (name: string, opts?: object) => editor.isActive(name, opts);

  /* ── TOOLBAR ── */
  const toolbar = editable && (
    <div className="de-toolbar">
      <button className="de-tool" onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</button>
      <button className="de-tool" onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</button>
      <div className="de-sep" />
      <ToolDropdown label={currentFont} width={110} items={FONT_FAMILIES.map(f => ({ label: f, value: f }))} onSelect={f => { setCurrentFont(f); editor.chain().focus().setFontFamily(f).run(); }} />
      <ToolDropdown label={currentSize} width={70}  items={FONT_SIZES.map(s => ({ label: s, value: s }))} onSelect={s => { setCurrentSize(s); (editor.chain().focus() as any).setFontSize(s).run(); }} />
      <div className="de-sep" />
      <button className={`de-tool${isActive("bold") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><b>B</b></button>
      <button className={`de-tool${isActive("italic") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></button>
      <button className={`de-tool${isActive("underline") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></button>
      <button className={`de-tool${isActive("strike") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike"><s>S</s></button>
      <div className="de-sep" />
      <ColorPicker label="A▾" onSelect={c => editor.chain().focus().setColor(c).run()} />
      <ColorPicker label="🖊▾" onSelect={c => editor.chain().focus().toggleHighlight({ color: c }).run()} />
      <div className="de-sep" />
      <button className={`de-tool${editor.isActive({ textAlign: "left" }) ? " active" : ""}`} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Left">≡</button>
      <button className={`de-tool${editor.isActive({ textAlign: "center" }) ? " active" : ""}`} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center">☰</button>
      <button className={`de-tool${editor.isActive({ textAlign: "right" }) ? " active" : ""}`} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Right">≣</button>
      <button className={`de-tool${editor.isActive({ textAlign: "justify" }) ? " active" : ""}`} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify">⫶</button>
      <div className="de-sep" />
      <ToolDropdown label="↕ Line" width={90}  items={LINE_HEIGHTS}  onSelect={lh => (editor.chain().focus() as any).setLineHeight(lh).run()} />
      <ToolDropdown label="¶ Space" width={100} items={PARA_SPACINGS} onSelect={s => (editor.chain().focus() as any).setParagraphSpacing(s).run()} />
      <div className="de-sep" />
      <button className={`de-tool${isActive("heading", { level: 1 }) ? " active" : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      <button className={`de-tool${isActive("heading", { level: 2 }) ? " active" : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={`de-tool${isActive("heading", { level: 3 }) ? " active" : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <div className="de-sep" />
      <button className={`de-tool${isActive("bulletList") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">• ≡</button>
      <button className={`de-tool${isActive("orderedList") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">1. ≡</button>
      <button className={`de-tool${isActive("blockquote") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">"</button>
      <button className={`de-tool${isActive("code") ? " active" : ""}`} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code">{"</>"}</button>
      <div className="de-sep" />
      <button className="de-tool" onClick={() => (editor.chain().focus() as any).insertBorderBox().run()} title="Border Box">▭</button>
      <button className="de-tool" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Line">─</button>
      <div className="de-sep" />
      <button className="de-tool" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">⊞</button>
      {isActive("table") && (
        <>
          <button className="de-tool" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column after">+Col</button>
          <button className="de-tool" onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row after">+Row</button>
          <button className="de-tool" onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column" style={{ color: "#dc2626" }}>−Col</button>
          <button className="de-tool" onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row" style={{ color: "#dc2626" }}>−Row</button>
          <button className="de-tool" onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table" style={{ color: "#dc2626" }}>✕Tbl</button>
        </>
      )}
    </div>
  );

  const pageBreakLines = pages > 1
    ? Array.from({ length: pages - 1 }, (_, i) => {
        const yOffset = (i + 1) * pageContentHeight + i * pageGap;
        return (
          <div key={i} className="de-page-break-line" style={{ top: yOffset }} title={`Page ${i + 2} starts here`} />
        );
      })
    : null;

  return (
    <div className="de-editor-root">
      {toolbar}
      <div className="de-prosemirror-host" ref={contentRef} style={{ position: "relative" }}>
        <EditorContent editor={editor} />
        {pageBreakLines}
      </div>
    </div>
  );
}