import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from ".././lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

type Kind = "folder" | "file";
interface DriveItem {
  id: string;
  parent_id: string | null;
  kind: Kind;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string | null;
  document_id: string | null;
  owner_id: string;
  is_member_root?: boolean;
  member_id?: string | null;
  created_at: string;
}
interface Crumb { id: string | null; name: string; }

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{--purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;--green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;--amber-bg:#fef9c3;--red:#dc2626;--red-bg:#fee2e2;--surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .dr-root{font-family:var(--font);color:var(--text);padding:28px 28px 64px;max-width:1000px}
  .dr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
  .dr-title{font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
  .dr-actions{display:flex;gap:8px;flex-wrap:wrap}
  .dr-btn{display:flex;align-items:center;gap:6px;padding:9px 15px;border-radius:8px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .15s;white-space:nowrap}
  .dr-btn.primary{background:var(--purple);color:#fff}.dr-btn.primary:hover{background:var(--purple-dark)}
  .dr-btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.dr-btn.ghost:hover{background:var(--bg)}
  .dr-btn:disabled{opacity:.5;cursor:not-allowed}
  /* Storage meter */
  .dr-meter{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px}
  .dr-meter-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .dr-meter-label{font-size:12.5px;font-weight:600;color:var(--text)}
  .dr-meter-nums{font-size:12px;color:var(--muted);font-family:var(--mono)}
  .dr-meter-bar{height:8px;background:var(--bg);border-radius:20px;overflow:hidden}
  .dr-meter-fill{height:100%;border-radius:20px;transition:width .3s}
  .dr-meter-scope{font-size:10.5px;color:var(--muted);margin-top:6px}
  /* Breadcrumbs */
  .dr-crumbs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:14px;font-size:13px}
  .dr-crumb{color:var(--purple);cursor:pointer;font-weight:500}
  .dr-crumb:hover{text-decoration:underline}
  .dr-crumb.current{color:var(--text);cursor:default;font-weight:600}
  .dr-crumb-sep{color:var(--muted)}
  /* Grid */
  .dr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
  .dr-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 14px;cursor:pointer;transition:all .15s;position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
  .dr-card:hover{border-color:#c4b5fd;box-shadow:0 4px 14px rgba(124,58,237,.08)}
  .dr-card-icon{width:46px;height:46px;display:flex;align-items:center;justify-content:center}
  .dr-card-name{font-size:12.5px;font-weight:500;color:var(--text);word-break:break-word;line-height:1.35;max-height:34px;overflow:hidden}
  .dr-card-sub{font-size:10.5px;color:var(--muted);font-family:var(--mono)}
  .dr-card-menu{position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:6px;border:none;background:rgba(245,243,239,.9);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:1;transition:background .12s}
  .dr-card-menu:hover{background:var(--purple-light);color:var(--purple)}
  .dr-card-menu:hover{background:var(--bg)}
  .dr-menu{position:absolute;top:30px;right:6px;background:#fff;border:1px solid var(--border);border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:30;min-width:140px;padding:4px;animation:dr-in .12s ease}
  @keyframes dr-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
  .dr-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:none;background:none;font-family:var(--font);font-size:12.5px;color:var(--text);cursor:pointer;border-radius:5px;text-align:left}
  .dr-menu-item:hover{background:var(--purple-light);color:var(--purple)}
  .dr-menu-item.danger:hover{background:var(--red-bg);color:var(--red)}
  .dr-empty{text-align:center;padding:56px 0;color:var(--muted)}
  .dr-empty-icon{font-size:44px;opacity:.3;margin-bottom:12px}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .dr-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:10px}
  /* Modal */
  .dr-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(3px)}
  .dr-modal{background:#fff;border-radius:14px;padding:24px;width:380px;max-width:94vw;box-shadow:0 20px 60px rgba(0,0,0,.18);animation:dr-in .15s ease}
  .dr-modal h3{font-size:16px;font-weight:700;color:var(--purple);margin-bottom:4px}
  .dr-modal p{font-size:12.5px;color:var(--muted);margin-bottom:14px}
  .dr-input{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:9px;font-family:var(--font);font-size:13.5px;color:var(--text);outline:none;box-sizing:border-box}
  .dr-input:focus{border-color:var(--purple)}
  .dr-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
  .dr-msg{font-size:12.5px;padding:8px 12px;border-radius:8px;margin-bottom:12px}
  .dr-msg.error{background:var(--red-bg);color:var(--red)}
  .dr-msg.info{background:var(--purple-light);color:var(--purple)}
  .dr-up-overlay{position:fixed;inset:0;background:rgba(124,58,237,.06);border:3px dashed var(--purple);z-index:90;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .dr-up-overlay span{background:#fff;padding:14px 24px;border-radius:12px;font-weight:600;color:var(--purple);box-shadow:0 8px 30px rgba(0,0,0,.12)}
`;

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileIcon(name: string, mime: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime?.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg"].includes(ext))
    return { emoji: "🖼️", color: "#0d9488" };
  if (ext === "pdf") return { emoji: "📕", color: "#dc2626" };
  if (["doc","docx"].includes(ext)) return { emoji: "📘", color: "#2563eb" };
  if (["xls","xlsx","csv"].includes(ext)) return { emoji: "📗", color: "#16a34a" };
  if (["ppt","pptx"].includes(ext)) return { emoji: "📙", color: "#ea580c" };
  if (["zip","rar","7z"].includes(ext)) return { emoji: "🗜️", color: "#7c3aed" };
  return { emoji: "📄", color: "#78716c" };
}

export default function DrivePage() {
  const navigate = useNavigate();
  const [items, setItems]       = useState<DriveItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [crumbs, setCrumbs]     = useState<Crumb[]>([{ id: null, name: "My Drive" }]);
  const [orgId, setOrgId]       = useState<string | null>(null);
  const [role, setRole]         = useState<string>("individual");
  const [myUserId, setMyUserId] = useState<string>("");
  const [usage, setUsage]       = useState<{ used: number; limit: number; scope: string } | null>(null);

  const [menuFor, setMenuFor]   = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [renameVal, setRenameVal]   = useState("");
  const [moveItem, setMoveItem]     = useState<DriveItem | null>(null);
  const [moveTargets, setMoveTargets] = useState<DriveItem[]>([]);
  // Grant (share) modal — owner grants a member view/edit on an item.
  const [grantItem, setGrantItem]   = useState<DriveItem | null>(null);
  const [grantMembers, setGrantMembers] = useState<{ id: string; email: string }[]>([]);
  const [grantSel, setGrantSel]     = useState<Record<string, "none" | "view" | "edit">>({});
  const [grantScope, setGrantScope] = useState<Record<string, "all" | "specific">>({});
  const [grantFolderDocs, setGrantFolderDocs] = useState<DriveItem[]>([]);
  const [grantChildSel, setGrantChildSel] = useState<Record<string, Record<string, "none" | "view" | "edit">>>({});
  const [grantBusy, setGrantBusy]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState<{ type: "error" | "info"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentFolder = crumbs[crumbs.length - 1].id;

  useEffect(() => {
    const id = "dr-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setMyUserId(user.id);
    // Determine org context (owner or member) + role for editor routing.
    const { data: ownedOrg } = await supabase.from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
    const { data: prof } = await supabase.from("profiles").select("organization_id,role,email").eq("id", user.id).maybeSingle();
    // Membership lives in organization_members (source of truth), not always on
    // profiles.organization_id — check it for the member branch.
    const { data: membership } = await supabase.from("organization_members")
      .select("organization_id,role").eq("user_id", user.id).maybeSingle();
    const memberOrgId = membership?.organization_id || prof?.organization_id || null;

    if (ownedOrg?.id) {
      // ── ORG OWNER ──
      setOrgId(ownedOrg.id);
      setRole("organization");
      // Self-healing: ensure every current member has an email-named root folder.
      await ensureMemberFolders(ownedOrg.id);
      await Promise.all([loadItems(null), loadUsage()]);
    } else if (memberOrgId) {
      // ── ORG MEMBER ──
      setOrgId(memberOrgId);
      setRole(membership?.role === "admin" || membership?.role === "member" ? "organization_member" : (prof?.role || "organization_member"));
      // Find (or create) this member's own root folder, and start inside it.
      const myFolderId = await ensureMyMemberFolder(memberOrgId, user.id, prof?.email || user.email || "member");
      if (myFolderId) {
        setCrumbs([{ id: null, name: "My Drive" }, { id: myFolderId, name: prof?.email || "My Folder" }]);
        await Promise.all([loadItems(myFolderId), loadUsage()]);
      } else {
        await Promise.all([loadItems(null), loadUsage()]);
      }
    } else {
      // ── INDIVIDUAL ──
      setOrgId(null);
      setRole(prof?.role || "individual");
      await Promise.all([loadItems(null), loadUsage()]);
    }
    setLoading(false);
  }

  // Ensure a single member's email-named root folder exists; returns its id.
  async function ensureMyMemberFolder(orgId: string, memberId: string, email: string): Promise<string | null> {
    const { data: existing } = await supabase.from("drive_items")
      .select("id").eq("org_id", orgId).eq("member_id", memberId).eq("is_member_root", true).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created } = await supabase.from("drive_items").insert({
      owner_id: memberId, org_id: orgId, parent_id: null,
      kind: "folder", name: email, is_member_root: true, member_id: memberId,
    }).select("id").single();
    return created?.id || null;
  }

  // Org owner: ensure EVERY member of the org has an email-named root folder.
  async function ensureMemberFolders(orgId: string) {
    // Membership is tracked two ways across orgs: profiles.organization_id AND
    // organization_members. Gather from BOTH and dedupe so it works either way.
    const [{ data: profMembers }, { data: omMembers }] = await Promise.all([
      supabase.from("profiles").select("id,email").eq("organization_id", orgId),
      supabase.from("organization_members").select("user_id").eq("organization_id", orgId),
    ]);
    const ids = new Set<string>();
    const emailById = new Map<string, string>();
    for (const p of (profMembers || [])) { ids.add(p.id); if (p.email) emailById.set(p.id, p.email); }
    const omIds = (omMembers || []).map((r: any) => r.user_id).filter(Boolean);
    for (const id of omIds) ids.add(id);
    // Resolve emails for any org_members ids we don't have yet.
    const needEmail = omIds.filter((id: string) => !emailById.has(id));
    if (needEmail.length) {
      const { data: extra } = await supabase.from("profiles").select("id,email").in("id", needEmail);
      for (const p of (extra || [])) if (p.email) emailById.set(p.id, p.email);
    }
    // Exclude the org owner — the owner is not a "member" with their own folder.
    const { data: orgRow } = await supabase.from("organizations").select("owner_id").eq("id", orgId).maybeSingle();
    if (orgRow?.owner_id) ids.delete(orgRow.owner_id);
    if (!ids.size) return;
    // Which members already have a member-root folder?
    const { data: existing } = await supabase.from("drive_items")
      .select("member_id").eq("org_id", orgId).eq("is_member_root", true);
    const have = new Set((existing || []).map((r: any) => r.member_id).filter(Boolean));
    const missing = [...ids].filter((id) => !have.has(id));
    if (!missing.length) return;
    const rows = missing.map((id) => ({
      owner_id: id, org_id: orgId, parent_id: null,
      kind: "folder", name: emailById.get(id) || "member", is_member_root: true, member_id: id,
    }));
    const { error: insErr } = await supabase.from("drive_items").insert(rows);
    if (insErr) console.warn("[Drive] member-folder insert:", insErr.message);
  }

  // Route to the document page (role-specific) and tell it which document to open.
  async function openDriveDocument(item: DriveItem) {
    if (!item.document_id) {
      setMsg({ type: "error", text: "This file isn't linked to an editable document. Re-upload it to the Drive." });
      return;
    }
    // Decide how to open:
    //  • Your own document → editable (restore-on-open).
    //  • Granted 'edit' → open READ-ONLY but offer "Edit a copy" (forks to the
    //    member's own folder; original untouched).
    //  • Granted 'view' → read-only, no fork.
    //  • Anything else not yours (e.g. owner viewing member content) → read-only.
    let readOnly = item.owner_id !== myUserId;
    let canForkEdit = false;
    if (readOnly && ((item as any).__access || role === "organization_member")) {
      const access = (item as any).__access
        || (await supabase.rpc("my_grant_access", { p_item: item.id })).data;
      if (access === "edit") canForkEdit = true;   // stays read-only; fork instead
    }
    if (!readOnly && item.owner_id === myUserId) {
      // Owner of the doc: the Drive is the durable home, so opening a
      // soft-deleted doc restores it. (Only the owner may mutate.)
      const { data: doc } = await supabase.from("documents")
        .select("status").eq("id", item.document_id).maybeSingle();
      if (doc?.status === "deleted") {
        await supabase.from("documents").update({ status: "draft" }).eq("id", item.document_id);
      }
    }
    // The member's own folder id (where a fork should land), if they're a member.
    let myFolderId: string | null = null;
    if (canForkEdit && orgId) {
      const { data: mf } = await supabase.from("drive_items")
        .select("id").eq("org_id", orgId).eq("member_id", myUserId).eq("is_member_root", true).maybeSingle();
      myFolderId = mf?.id || null;
    }
    const dest =
      role === "organization" ? "/dashboard/organization" :
      role === "organization_member" ? "/dashboard/member" :
      "/dashboard/individual";
    navigate(dest, { state: { openDocId: item.document_id, readOnly, canForkEdit, myFolderId, sourceDriveItemId: item.id } });
  }

  const loadUsage = useCallback(async () => {
    const { data, error } = await supabase.rpc("drive_usage");
    if (!error && data && data[0]) {
      setUsage({ used: Number(data[0].used_bytes), limit: Number(data[0].limit_bytes), scope: data[0].scope });
    }
  }, []);

  async function loadItems(parentId: string | null) {
    setLoading(true);
    let q = supabase.from("drive_items").select("*").order("kind", { ascending: true }).order("name", { ascending: true });
    q = parentId === null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
    const { data } = await q;
    let rows = (data || []) as DriveItem[];

    // For members at their root view, also surface items SHARED with them that
    // aren't already shown (granted docs/folders living elsewhere in the org).
    if (parentId === null && role === "organization_member") {
      const { data: grants } = await supabase.from("drive_grants")
        .select("drive_item_id,access").eq("member_id", myUserId);
      const grantedIds = (grants || []).map((g: any) => g.drive_item_id);
      const accessById = new Map((grants || []).map((g: any) => [g.drive_item_id, g.access]));
      if (grantedIds.length) {
        const { data: shared } = await supabase.from("drive_items").select("*").in("id", grantedIds);
        const haveIds = new Set(rows.map(r => r.id));
        for (const s of (shared || []) as DriveItem[]) {
          if (!haveIds.has(s.id)) {
            (s as any).__shared = true;
            (s as any).__access = accessById.get(s.id) || "view";
            rows.push(s);
          }
        }
      }
    }
    setItems(rows);
    setLoading(false);
  }

  function openFolder(item: DriveItem) {
    setCrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    loadItems(item.id);
  }
  function goToCrumb(idx: number) {
    const c = crumbs.slice(0, idx + 1);
    setCrumbs(c);
    loadItems(c[c.length - 1].id);
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    setBusy(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("drive_items").insert({
      owner_id: user.id, org_id: orgId, parent_id: currentFolder,
      kind: "folder", name: folderName.trim(),
    });
    setBusy(false);
    if (error) { setMsg({ type: "error", text: "Could not create folder: " + error.message }); return; }
    setShowNewFolder(false); setFolderName("");
    loadItems(currentFolder);
  }

  async function handleUpload(filesInput: File[] | FileList) {
    const files = Array.from(filesInput);
    if (!files.length) return;
    const { data: { user } } = await supabase.auth.getUser();

    // Quota check (sum of incoming + current usage vs limit)
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (usage && usage.used + incoming > usage.limit) {
      setMsg({
        type: "error",
        text: `Not enough space. This upload needs ${fmtBytes(incoming)} but only ${fmtBytes(Math.max(0, usage.limit - usage.used))} is free${usage.scope === "org" ? " in your organisation's pool" : ""}. Upgrade your plan in Billing for more.`,
      });
      return;
    }

    setBusy(true); setMsg({ type: "info", text: `Uploading ${files.length} file${files.length > 1 ? "s" : ""}…` });
    let anyFailed = false;
    for (const file of Array.from(files)) {
      // Only PDF/DOCX are editable documents (the Drive holds documents only).
      if (!file.name.match(/\.(pdf|docx)$/i)) {
        anyFailed = true;
        setMsg({ type: "error", text: `"${file.name}" isn't a PDF or DOCX. The Drive holds documents only.` });
        continue;
      }

      // Store the actual bytes in the existing 'documents' bucket so the
      // editor opens it through its proven public-URL pipeline.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const docPath = `docs/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(docPath, file, {
        contentType: file.type || "application/octet-stream", upsert: false,
      });
      if (upErr) {
        anyFailed = true;
        setMsg({ type: "error", text: `Upload failed for ${file.name}: ${upErr.message}` });
        continue;
      }
      const fileUrl = supabase.storage.from("documents").getPublicUrl(docPath).data.publicUrl;

      // Detect format + page count, like the document page's own uploader.
      const isPdf = /\.pdf$/i.test(file.name);
      let htmlContent: string | null = null;
      if (!isPdf) {
        // DOCX → HTML so the editor can render it immediately (same as the
        // document page's uploader does).
        try {
          const mammoth = await import("mammoth");
          const { value } = await (mammoth as any).convertToHtml({
            arrayBuffer: await file.arrayBuffer(),
            convertImage: (mammoth as any).images.imgElement((img: any) =>
              img.read("base64").then((d: string) => ({ src: `data:${img.contentType};base64,${d}` }))
            ),
          });
          htmlContent = value || "";
        } catch (e) {
          console.warn("DOCX conversion failed at upload:", e);
          htmlContent = "";
        }
      }

      // Create the editable DOCUMENT row (this is the unified record).
      // A DB trigger auto-creates a linked drive_items row at the Drive root;
      // we then move it into the current folder and set its real size.
      const { data: docRow, error: docErr } = await supabase.from("documents").insert({
        owner_id: user.id, sender_id: user.id, uploaded_by: user.id,
        owner_type: orgId ? "organization" : "individual",
        organization_id: orgId,
        document_kind: "upload",
        format: isPdf ? "pdf" : "docx",
        title: file.name,
        file_url: fileUrl,
        html_content: htmlContent,
        status: "draft",
        pages: 1,
      }).select("id").single();
      if (docErr || !docRow) {
        anyFailed = true;
        await supabase.storage.from("documents").remove([docPath]);
        setMsg({ type: "error", text: `Could not create document "${file.name}": ${docErr?.message || "unknown"}` });
        continue;
      }

      // The trigger created the drive entry; update it with folder + size +
      // the real storage path (so download/quota work correctly).
      const { error: updErr } = await supabase.from("drive_items")
        .update({
          parent_id: currentFolder,
          size_bytes: file.size,
          mime_type: file.type || null,
          storage_path: docPath,
        })
        .eq("document_id", docRow.id);
      if (updErr) {
        // Non-fatal: the file exists and is linked; it just may sit at root.
        console.warn("Could not place drive entry in folder:", updErr.message);
      }
    }
    setBusy(false);
    if (!anyFailed) setMsg(null);
    await Promise.all([loadItems(currentFolder), loadUsage()]);
  }

  // Resolve a Drive file's storage path to a working signed URL.
  // New (unified) files live as 'docs/...' in the 'documents' bucket; legacy
  // files (uploaded before unification) live as '{owner}/{itemId}' in the
  // 'drive' bucket. Route by path shape, with a fallback to the other bucket.
  async function signedDriveUrl(
    storagePath: string, expires = 300, opts?: { download?: string }
  ): Promise<string | null> {
    const primary  = storagePath.startsWith("docs/") ? "documents" : "drive";
    const fallback = primary === "documents" ? "drive" : "documents";
    for (const bucket of [primary, fallback]) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expires, opts);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  }

  async function downloadFile(item: DriveItem) {
    if (!item.storage_path) return;
    setMsg({ type: "info", text: "Preparing download…" });
    const url = await signedDriveUrl(item.storage_path, 120, { download: item.name });
    setMsg(null);
    if (!url) { setMsg({ type: "error", text: "Could not download this file. It may have been removed." }); return; }
    const a = document.createElement("a"); a.href = url; a.download = item.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // Load JSZip on demand from CDN (no npm install needed — matches how the
  // document page loads jsPDF/pdf.js).
  function loadJsZip(): Promise<any> {
    if ((window as any).JSZip) return Promise.resolve((window as any).JSZip);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = () => resolve((window as any).JSZip);
      s.onerror = () => reject(new Error("Could not load the zip library"));
      document.head.appendChild(s);
    });
  }

  // Download a whole folder as a .zip, preserving nested folder structure.
  async function downloadFolder(folder: DriveItem) {
    setBusy(true);
    setMsg({ type: "info", text: `Zipping "${folder.name}"…` });
    try {
      const JSZip = await loadJsZip();
      const zip = new JSZip();

      // Walk the folder tree, collecting files with their relative paths.
      // Each entry: { path: "Sub/Folder/name.pdf", storage_path }
      const files: { path: string; storage_path: string }[] = [];
      async function walk(parentId: string, prefix: string) {
        const { data: kids } = await supabase.from("drive_items")
          .select("id,kind,name,storage_path").eq("parent_id", parentId);
        for (const k of (kids || [])) {
          if (k.kind === "folder") {
            await walk(k.id, `${prefix}${k.name}/`);
          } else if (k.storage_path) {
            files.push({ path: `${prefix}${k.name}`, storage_path: k.storage_path });
          }
        }
      }
      await walk(folder.id, "");

      if (files.length === 0) {
        setBusy(false);
        setMsg({ type: "error", text: "That folder is empty — nothing to download." });
        return;
      }

      // Fetch each file's bytes (via a short-lived signed URL) and add to the zip.
      let added = 0;
      for (const f of files) {
        const url = await signedDriveUrl(f.storage_path, 300);
        if (!url) continue;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        zip.file(f.path, await resp.blob());
        added++;
        setMsg({ type: "info", text: `Zipping "${folder.name}"… (${added}/${files.length})` });
      }

      if (added === 0) {
        setBusy(false);
        setMsg({ type: "error", text: "Could not read any files in that folder." });
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${folder.name}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBusy(false);
      setMsg(null);
    } catch (e: any) {
      setBusy(false);
      setMsg({ type: "error", text: "Folder download failed: " + (e?.message || "unknown") });
    }
  }

  async function deleteItem(item: DriveItem) {
    const what = item.kind === "folder" ? "folder and everything inside it" : "file";
    if (!confirm(`Delete "${item.name}"? This removes the ${what} permanently.`)) return;
    setBusy(true);
    // Gather storage paths (in the 'documents' bucket) AND linked document ids
    // to remove. Deleting from the Drive removes the document too — the Drive
    // is the durable home, so its delete is the authoritative one.
    const paths: string[] = [];
    const docIds: string[] = [];
    if (item.kind === "file") {
      if (item.storage_path) paths.push(item.storage_path);
      if (item.document_id) docIds.push(item.document_id);
    }
    if (item.kind === "folder") {
      const toVisit = [item.id];
      while (toVisit.length) {
        const pid = toVisit.shift()!;
        const { data: kids } = await supabase.from("drive_items").select("id,kind,storage_path,document_id").eq("parent_id", pid);
        for (const k of (kids || [])) {
          if (k.kind === "folder") toVisit.push(k.id);
          else {
            if (k.storage_path) paths.push(k.storage_path);
            if (k.document_id) docIds.push(k.document_id);
          }
        }
      }
    }
    // Remove stored files from the documents bucket.
    if (paths.length) await supabase.storage.from("documents").remove(paths);
    // Hard-delete the linked documents (Drive is the master copy).
    if (docIds.length) await supabase.from("documents").delete().in("id", docIds);
    // Delete the drive row(s) — descendants cascade via parent_id FK.
    const { error } = await supabase.from("drive_items").delete().eq("id", item.id);
    setBusy(false); setMenuFor(null);
    if (error) { setMsg({ type: "error", text: "Delete failed: " + error.message }); return; }
    await Promise.all([loadItems(currentFolder), loadUsage()]);
  }

  async function doRename() {
    if (!renameItem || !renameVal.trim()) return;
    setBusy(true);
    const newName = renameVal.trim();
    const { error } = await supabase.from("drive_items")
      .update({ name: newName, updated_at: new Date().toISOString() }).eq("id", renameItem.id);
    // Keep the linked document's title in sync with the Drive name.
    if (!error && renameItem.document_id) {
      await supabase.from("documents").update({ title: newName }).eq("id", renameItem.document_id);
    }
    setBusy(false);
    if (error) { setMsg({ type: "error", text: "Rename failed: " + error.message }); return; }
    setRenameItem(null); setRenameVal("");
    loadItems(currentFolder);
  }

  async function openMove(item: DriveItem) {
    setMenuFor(null);
    setMoveItem(item);
    // Folders we can move INTO = all folders except the item itself and its descendants.
    const { data: allFolders } = await supabase.from("drive_items").select("id,name,parent_id,kind").eq("kind", "folder");
    setMoveTargets((allFolders || []).filter(f => f.id !== item.id) as DriveItem[]);
  }
  async function doMove(targetParentId: string | null) {
    if (!moveItem) return;
    setBusy(true);
    const { error } = await supabase.from("drive_items")
      .update({ parent_id: targetParentId, updated_at: new Date().toISOString() }).eq("id", moveItem.id);
    setBusy(false); setMoveItem(null);
    if (error) { setMsg({ type: "error", text: "Move failed: " + error.message }); return; }
    loadItems(currentFolder);
  }

  // ── Grants (owner shares an item with members) ──
  async function openGrant(item: DriveItem) {
    setMenuFor(null);
    if (!orgId) { setMsg({ type: "error", text: "Grants are for organization drives." }); return; }
    setGrantItem(item);
    setGrantBusy(true);
    // Org members from both membership sources.
    const [{ data: profMembers }, { data: omMembers }] = await Promise.all([
      supabase.from("profiles").select("id,email").eq("organization_id", orgId),
      supabase.from("organization_members").select("user_id").eq("organization_id", orgId),
    ]);
    const byId = new Map<string, string>();
    for (const p of (profMembers || [])) byId.set(p.id, p.email || p.id);
    const omIds = (omMembers || []).map((r: any) => r.user_id).filter((x: string) => !byId.has(x));
    if (omIds.length) {
      const { data: extra } = await supabase.from("profiles").select("id,email").in("id", omIds);
      for (const p of (extra || [])) byId.set(p.id, p.email || p.id);
    }
    byId.delete(item.owner_id as any);
    const members = [...byId.entries()].map(([id, email]) => ({ id, email }));
    setGrantMembers(members);

    // If sharing a FOLDER, load its direct document children (for 'specific').
    let kids: DriveItem[] = [];
    if (item.kind === "folder") {
      const { data: ch } = await supabase.from("drive_items")
        .select("*").eq("parent_id", item.id).eq("kind", "file");
      kids = (ch || []) as DriveItem[];
    }
    setGrantFolderDocs(kids);

    // Pre-fill existing grants: the folder/doc grant (+scope) per member, and
    // any per-child document grants (for specific mode).
    const { data: folderGrants } = await supabase.from("drive_grants")
      .select("member_id,access,scope").eq("drive_item_id", item.id);
    const sel: Record<string, "none" | "view" | "edit"> = {};
    const scopeSel: Record<string, "all" | "specific"> = {};
    for (const m of members) { sel[m.id] = "none"; scopeSel[m.id] = "all"; }
    for (const g of (folderGrants || [])) { sel[g.member_id] = g.access; scopeSel[g.member_id] = g.scope || "all"; }
    setGrantSel(sel);
    setGrantScope(scopeSel);

    // Per-child grants: { memberId: { childId: 'view'|'edit'|'none' } }
    const childSel: Record<string, Record<string, "none" | "view" | "edit">> = {};
    for (const m of members) { childSel[m.id] = {}; for (const k of kids) childSel[m.id][k.id] = "none"; }
    if (kids.length) {
      const { data: childGrants } = await supabase.from("drive_grants")
        .select("member_id,drive_item_id,access").in("drive_item_id", kids.map(k => k.id));
      for (const g of (childGrants || [])) {
        if (childSel[g.member_id]) childSel[g.member_id][g.drive_item_id] = g.access;
      }
    }
    setGrantChildSel(childSel);
    setGrantBusy(false);
  }

  async function saveGrants() {
    if (!grantItem || !orgId) return;
    setGrantBusy(true);
    const isFolder = grantItem.kind === "folder";
    const ops: Promise<any>[] = [];

    for (const [memberId, access] of Object.entries(grantSel)) {
      const scope = isFolder ? (grantScope[memberId] || "all") : "all";

      // The folder/document grant row itself.
      if (access === "none") {
        ops.push(Promise.resolve(
          supabase.from("drive_grants").delete()
            .eq("drive_item_id", grantItem.id).eq("member_id", memberId)
        ));
      } else {
        ops.push(Promise.resolve(
          supabase.from("drive_grants").upsert({
            org_id: orgId, drive_item_id: grantItem.id, member_id: memberId,
            access, scope, granted_by: myUserId,
          }, { onConflict: "drive_item_id,member_id" })
        ));
      }

      // Per-child document grants only matter when sharing a FOLDER as 'specific'
      // and the member actually has access. Otherwise clear any child grants.
      if (isFolder) {
        const childMap = grantChildSel[memberId] || {};
        for (const child of grantFolderDocs) {
          const childAccess = (access !== "none" && scope === "specific")
            ? (childMap[child.id] || "none")
            : "none";
          if (childAccess === "none") {
            ops.push(Promise.resolve(
              supabase.from("drive_grants").delete()
                .eq("drive_item_id", child.id).eq("member_id", memberId)
            ));
          } else {
            ops.push(Promise.resolve(
              supabase.from("drive_grants").upsert({
                org_id: orgId, drive_item_id: child.id, member_id: memberId,
                access: childAccess, scope: "all", granted_by: myUserId,
              }, { onConflict: "drive_item_id,member_id" })
            ));
          }
        }
      }
    }

    const results = await Promise.all(ops);
    setGrantBusy(false);
    const firstErr = results.find((r: any) => r?.error)?.error;
    if (firstErr) { setMsg({ type: "error", text: "Grant failed: " + firstErr.message }); return; }
    setGrantItem(null);
    setMsg({ type: "info", text: "Access updated." });
    setTimeout(() => setMsg(null), 1500);
  }

  const pct = usage && usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const meterColor = pct > 90 ? "#dc2626" : pct > 70 ? "#b45309" : "#7c3aed";

  return (
    <DashboardLayout>
      <div className="dr-root"
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files); }}
      >
        {dragOver && <div className="dr-up-overlay"><span>Drop files to upload</span></div>}

        <div className="dr-head">
          <div className="dr-title">📁 Drive</div>
          <div className="dr-actions">
            <button className="dr-btn ghost" onClick={() => setShowNewFolder(true)} disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              New Folder
            </button>
            <button className="dr-btn primary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload
            </button>
            <input ref={fileInputRef} type="file" multiple hidden
              onChange={e => {
                const picked = e.target.files;
                if (picked && picked.length) {
                  // Copy into a real array BEFORE clearing the input, so the
                  // async upload doesn't lose the file references (which can
                  // make file.size read as 0).
                  const arr = Array.from(picked);
                  handleUpload(arr);
                }
                e.target.value = "";
              }} />
          </div>
        </div>

        {/* Storage meter */}
        <div className="dr-meter">
          <div className="dr-meter-top">
            <span className="dr-meter-label">Storage</span>
            <span className="dr-meter-nums">
              {usage ? `${fmtBytes(usage.used)} of ${fmtBytes(usage.limit)}` : "—"}
            </span>
          </div>
          <div className="dr-meter-bar">
            <div className="dr-meter-fill" style={{ width: `${pct}%`, background: meterColor }} />
          </div>
          {usage && (
            <div className="dr-meter-scope">
              {usage.scope === "org" ? "Shared across your organisation" : "Your personal storage"}
              {pct > 90 && " · almost full — upgrade in Billing for more space"}
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="dr-crumbs">
          {crumbs.map((c, i) => (
            <span key={c.id || "root"} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <span className="dr-crumb-sep">›</span>}
              <span className={`dr-crumb ${i === crumbs.length - 1 ? "current" : ""}`}
                onClick={() => i < crumbs.length - 1 && goToCrumb(i)}>
                {c.name}
              </span>
            </span>
          ))}
        </div>

        {msg && <div className={`dr-msg ${msg.type}`}>{msg.text}</div>}

        {/* Grid */}
        {loading ? (
          <div className="dr-grid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="dr-skel" style={{ height: 120 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="dr-empty">
            <div className="dr-empty-icon">📂</div>
            <p style={{ fontWeight: 500, color: "#44403c", fontSize: 14, marginBottom: 4 }}>This folder is empty</p>
            <span style={{ fontSize: 12.5 }}>Upload files or create a folder to get started. You can also drag files here.</span>
          </div>
        ) : (
          <div className="dr-grid">
            {items.map(item => {
              const ic = item.kind === "folder" ? { emoji: "📁", color: "#7c3aed" } : fileIcon(item.name, item.mime_type);
              return (
                <div key={item.id} className="dr-card"
                  onClick={() => item.kind === "folder" ? openFolder(item) : openDriveDocument(item)}>
                  <button className="dr-card-menu" onClick={e => { e.stopPropagation(); setMenuFor(menuFor === item.id ? null : item.id); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </button>
                  {menuFor === item.id && (
                    <div className="dr-menu" onClick={e => e.stopPropagation()}>
                      {item.kind === "file" && (
                        <button className="dr-menu-item" onClick={() => { setMenuFor(null); downloadFile(item); }}>⬇️ Download</button>
                      )}
                      {item.kind === "folder" && (
                        <button className="dr-menu-item" onClick={() => { setMenuFor(null); downloadFolder(item); }}>⬇️ Download as zip</button>
                      )}
                      {/* Mutating actions ONLY for the item's owner. The org owner
                          viewing member content sees view/download only. */}
                      {item.owner_id === myUserId && (
                        <>
                          {!item.is_member_root && (
                            <>
                              <button className="dr-menu-item" onClick={() => { setMenuFor(null); setRenameItem(item); setRenameVal(item.name); }}>✏️ Rename</button>
                              <button className="dr-menu-item" onClick={() => openMove(item)}>📦 Move</button>
                            </>
                          )}
                          <button className="dr-menu-item danger" onClick={() => deleteItem(item)}>🗑️ Delete</button>
                        </>
                      )}
                      {/* Org owner can SHARE (grant) any item in their org drive. */}
                      {role === "organization" && orgId && !item.is_member_root && (
                        <button className="dr-menu-item" onClick={() => openGrant(item)}>🔗 Share access</button>
                      )}
                    </div>
                  )}
                  <div className="dr-card-icon" style={{ fontSize: 38 }}>{item.is_member_root ? "👤" : ic.emoji}</div>
                  <div className="dr-card-name">{item.name}</div>
                  <div className="dr-card-sub">
                    {(item as any).__shared
                      ? `Shared · ${(item as any).__access === "edit" ? "can edit" : "view only"}`
                      : item.is_member_root ? "Member folder" : item.kind === "folder" ? "Folder" : fmtBytes(item.size_bytes)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New folder modal */}
        {showNewFolder && (
          <div className="dr-backdrop" onClick={() => setShowNewFolder(false)}>
            <div className="dr-modal" onClick={e => e.stopPropagation()}>
              <h3>New Folder</h3>
              <p>Create a folder in {crumbs[crumbs.length - 1].name}.</p>
              <input className="dr-input" placeholder="Folder name" autoFocus
                value={folderName} onChange={e => setFolderName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createFolder()} />
              <div className="dr-modal-foot">
                <button className="dr-btn ghost" onClick={() => setShowNewFolder(false)}>Cancel</button>
                <button className="dr-btn primary" onClick={createFolder} disabled={busy || !folderName.trim()}>
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename modal */}
        {renameItem && (
          <div className="dr-backdrop" onClick={() => setRenameItem(null)}>
            <div className="dr-modal" onClick={e => e.stopPropagation()}>
              <h3>Rename</h3>
              <p>Give "{renameItem.name}" a new name.</p>
              <input className="dr-input" autoFocus value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doRename()} />
              <div className="dr-modal-foot">
                <button className="dr-btn ghost" onClick={() => setRenameItem(null)}>Cancel</button>
                <button className="dr-btn primary" onClick={doRename} disabled={busy || !renameVal.trim()}>
                  {busy ? "Saving…" : "Rename"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move modal */}
        {moveItem && (
          <div className="dr-backdrop" onClick={() => setMoveItem(null)}>
            <div className="dr-modal" onClick={e => e.stopPropagation()}>
              <h3>Move "{moveItem.name}"</h3>
              <p>Choose a destination folder.</p>
              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                <button className="dr-menu-item" style={{ border: "1px solid var(--border)" }} onClick={() => doMove(null)}>
                  📁 My Drive (root)
                </button>
                {moveTargets.map(t => (
                  <button key={t.id} className="dr-menu-item" style={{ border: "1px solid var(--border)" }} onClick={() => doMove(t.id)}>
                    📁 {t.name}
                  </button>
                ))}
                {moveTargets.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 4px" }}>No other folders yet.</div>
                )}
              </div>
              <div className="dr-modal-foot">
                <button className="dr-btn ghost" onClick={() => setMoveItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Grant (Share access) modal ── */}
        {grantItem && (
          <div className="dr-backdrop" onClick={() => setGrantItem(null)}>
            <div className="dr-modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
              <h3>Share "{grantItem.name}"</h3>
              <p>Choose who can access this {grantItem.kind === "folder" ? "folder (and everything inside it)" : "document"}. Editing always forks a personal copy — the original is never changed.</p>
              {grantBusy ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</div>
              ) : grantMembers.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 4px" }}>No members to share with yet.</div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {grantMembers.map(m => (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
                        {(["none", "view", "edit"] as const).map(lvl => (
                          <button key={lvl}
                            onClick={() => setGrantSel(s => ({ ...s, [m.id]: lvl }))}
                            style={{
                              fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer",
                              border: "1px solid " + (grantSel[m.id] === lvl ? "var(--purple)" : "var(--border)"),
                              background: grantSel[m.id] === lvl ? "var(--purple)" : "transparent",
                              color: grantSel[m.id] === lvl ? "#fff" : "var(--muted)",
                              fontFamily: "var(--mono)", textTransform: "capitalize",
                            }}>{lvl}</button>
                        ))}
                      </div>

                      {/* Folder: choose All vs Specific documents when access is granted */}
                      {grantItem.kind === "folder" && grantSel[m.id] !== "none" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                          <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--mono)" }}>Contents:</span>
                          {(["all", "specific"] as const).map(sc => (
                            <button key={sc}
                              onClick={() => setGrantScope(s => ({ ...s, [m.id]: sc }))}
                              style={{
                                fontSize: 10.5, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                                border: "1px solid " + ((grantScope[m.id] || "all") === sc ? "var(--purple)" : "var(--border)"),
                                background: (grantScope[m.id] || "all") === sc ? "var(--purple-light)" : "transparent",
                                color: (grantScope[m.id] || "all") === sc ? "var(--purple)" : "var(--muted)",
                                fontFamily: "var(--mono)",
                              }}>{sc === "all" ? "All documents" : "Specific"}</button>
                          ))}
                        </div>
                      )}

                      {/* Specific: per-document view/edit toggles */}
                      {grantItem.kind === "folder" && grantSel[m.id] !== "none" && (grantScope[m.id] || "all") === "specific" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 8, marginTop: 2 }}>
                          {grantFolderDocs.length === 0 && (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>No documents in this folder yet.</span>
                          )}
                          {grantFolderDocs.map(doc => (
                            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ flex: 1, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {doc.name}</span>
                              {(["none", "view", "edit"] as const).map(lvl => (
                                <button key={lvl}
                                  onClick={() => setGrantChildSel(s => ({ ...s, [m.id]: { ...(s[m.id] || {}), [doc.id]: lvl } }))}
                                  style={{
                                    fontSize: 10, padding: "2px 6px", borderRadius: 5, cursor: "pointer",
                                    border: "1px solid " + (((grantChildSel[m.id] || {})[doc.id] || "none") === lvl ? "var(--purple)" : "var(--border)"),
                                    background: ((grantChildSel[m.id] || {})[doc.id] || "none") === lvl ? "var(--purple)" : "transparent",
                                    color: ((grantChildSel[m.id] || {})[doc.id] || "none") === lvl ? "#fff" : "var(--muted)",
                                    fontFamily: "var(--mono)", textTransform: "capitalize",
                                  }}>{lvl}</button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="dr-modal-foot">
                <button className="dr-btn ghost" onClick={() => setGrantItem(null)}>Cancel</button>
                <button className="dr-btn" style={{ background: "var(--purple)", color: "#fff" }} disabled={grantBusy} onClick={saveGrants}>Save access</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}