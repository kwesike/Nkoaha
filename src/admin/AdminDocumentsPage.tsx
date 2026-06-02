import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .adoc-root{padding:28px;max-width:1200px}
  .adoc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px}
  .adoc-stat{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:16px 20px}
  .adoc-stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a78bfa;margin-bottom:6px}
  .adoc-stat-val{font-size:26px;font-weight:800;color:#1c1917;font-family:'DM Mono',monospace;line-height:1}
  .adoc-stat-sub{font-size:11px;color:#78716c;margin-top:4px}
  .adoc-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .adoc-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .adoc-search:focus{border-color:#7c3aed}
  .adoc-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .adoc-count{font-size:12px;color:#78716c;margin-left:auto}
  .adoc-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .adoc-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .adoc-table td{padding:11px 16px;font-size:13px;color:#1c1917;border-bottom:1px solid #faf9f8;vertical-align:middle}
  .adoc-table tr:last-child td{border-bottom:none}
  .adoc-table tr:hover td{background:#faf8ff}
  .adoc-title{font-weight:600;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .adoc-format{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;flex-shrink:0}
  .adoc-format.pdf{background:#fee2e2;color:#dc2626}
  .adoc-format.docx{background:#dbeafe;color:#2563eb}
  .adoc-format.new{background:#dcfce7;color:#16a34a}
  .adoc-status{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700}
  .adoc-status.draft{background:#f5f3ef;color:#78716c}
  .adoc-status.sent{background:#dbeafe;color:#2563eb}
  .adoc-status.signed{background:#dcfce7;color:#16a34a}
  .adoc-status.declined{background:#fee2e2;color:#dc2626}
  .adoc-owner{font-size:11px;color:#78716c;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .adoc-btn{padding:4px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #fecaca;background:transparent;color:#dc2626;font-family:'DM Sans',sans-serif;transition:all .15s}
  .adoc-btn:hover{background:#fee2e2}
  .adoc-empty{padding:48px;text-align:center;color:#a8a29e;font-size:13px}
`;

export default function AdminDocumentsPage() {
  const [docs, setDocs]     = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [fmtFilter, setFmtFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "adoc-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: documents } = await supabase
      .from("documents")
      .select("id,title,format,status,pages,owner_id,created_at")
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase
      .from("profiles").select("id,email");

    const emailMap: Record<string, string> = {};
    for (const p of (profiles || [])) emailMap[p.id] = p.email;

    setDocs(documents || []);
    setEmails(emailMap);
    setLoading(false);
  }

  async function deleteDoc(id: string, title: string) {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    await supabase.from("documents").update({ status: "deleted" }).eq("id", id);
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
  }

  const total  = docs.length;
  const pdfs   = docs.filter(d => d.format === "pdf").length;
  const docxs  = docs.filter(d => d.format === "docx").length;
  const signed = docs.filter(d => d.status === "signed").length;

  const filtered = docs.filter(d => {
    const email = emails[d.owner_id] || "";
    const matchSearch =
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase());
    const matchFmt    = fmtFilter === "all"    || d.format === fmtFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchFmt && matchStatus;
  });

  return (
    <AdminLayout title="Documents">
      <div className="adoc-root">
        <div className="adoc-stats">
          {[
            { label: "Total",    val: total,  sub: "active documents" },
            { label: "PDFs",     val: pdfs,   sub: "uploaded PDFs" },
            { label: "DOCX",     val: docxs,  sub: "uploaded Word docs" },
            { label: "Signed",   val: signed, sub: "fully executed" },
          ].map(s => (
            <div key={s.label} className="adoc-stat">
              <div className="adoc-stat-label">{s.label}</div>
              <div className="adoc-stat-val">{s.val}</div>
              <div className="adoc-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="adoc-bar">
          <input
            className="adoc-search"
            placeholder="Search by title or owner email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="adoc-filter" value={fmtFilter} onChange={e => setFmtFilter(e.target.value)}>
            <option value="all">All Formats</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="new">New Doc</option>
          </select>
          <select className="adoc-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="declined">Declined</option>
          </select>
          <span className="adoc-count">{filtered.length} doc{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#78716c" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="adoc-empty">No documents found</div>
        ) : (
          <table className="adoc-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Format</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Pages</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><div className="adoc-title" title={d.title}>{d.title}</div></td>
                  <td><span className={`adoc-format ${d.format}`}>{d.format?.toUpperCase()}</span></td>
                  <td><span className={`adoc-status ${d.status}`}>{d.status}</span></td>
                  <td><div className="adoc-owner" title={emails[d.owner_id]}>{emails[d.owner_id] || "—"}</div></td>
                  <td style={{ color: "#78716c", fontSize: 12 }}>{d.pages || 1}</td>
                  <td style={{ color: "#78716c", fontSize: 12 }}>{timeAgo(d.created_at)}</td>
                  <td>
                    <button className="adoc-btn" onClick={() => deleteDoc(d.id, d.title)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}