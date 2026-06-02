import { useEffect, useState } from "react";
import { supabase } from ".././lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .adoc-root{padding:28px}
  .adoc-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .adoc-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .adoc-search:focus{border-color:#7c3aed}
  .adoc-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .adoc-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .adoc-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .adoc-table td{padding:12px 16px;font-size:13px;color:#1c1917;border-bottom:1px solid #faf9f8;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .adoc-table tr:last-child td{border-bottom:none}
  .adoc-table tr:hover td{background:#faf8ff}
  .adoc-format{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700}
  .adoc-format.pdf{background:#fee2e2;color:#dc2626}
  .adoc-format.docx{background:#dbeafe;color:#2563eb}
  .adoc-format.new{background:#dcfce7;color:#16a34a}
  .adoc-status{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600}
  .adoc-status.pending{background:#fef3c7;color:#b45309}
  .adoc-status.completed{background:#dcfce7;color:#16a34a}
  .adoc-status.declined{background:#fee2e2;color:#dc2626}
  .adoc-status.draft{background:#f5f3ef;color:#78716c}
  .adoc-del-btn{padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid #fecaca;background:transparent;color:#dc2626;font-family:'DM Sans',sans-serif;transition:all .15s}
  .adoc-del-btn:hover{background:#fee2e2}
`;

export default function AdminDocumentsPage() {
  const [docs, setDocs]       = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "adoc-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id,title,format,status,owner_id,created_at")
      .neq("status","deleted")
      .order("created_at",{ascending:false})
      .limit(200);

    if (data?.length) {
      const ownerIds = [...new Set(data.map((d:any)=>d.owner_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles").select("id,email").in("id", ownerIds);
      const emailMap: Record<string,string> = {};
      for (const p of (profiles||[])) emailMap[p.id] = p.email;
      setDocs(data.map((d:any)=>({ ...d, ownerEmail: emailMap[d.owner_id]||"—" })));
    } else {
      setDocs([]);
    }
    setLoading(false);
  }

  async function deleteDoc(doc: any) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await supabase.from("documents").update({ status:"deleted" }).eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  const filtered = docs.filter(d => {
    const q = d.title?.toLowerCase().includes(search.toLowerCase()) ||
              d.ownerEmail?.toLowerCase().includes(search.toLowerCase());
    const f = filter === "all" || d.status === filter;
    return q && f;
  });

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
    return d===0?"Today":d===1?"Yesterday":`${d}d ago`;
  }

  return (
    <AdminLayout title="Documents">
      <div className="adoc-root">
        <div className="adoc-bar">
          <input className="adoc-search" placeholder="Search by title or owner…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="adoc-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
          </select>
          <span style={{fontSize:12,color:"#78716c"}}>{filtered.length} documents</span>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"#78716c"}}>Loading…</div>
        ) : (
          <table className="adoc-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Format</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td title={d.title}>{d.title || "Untitled"}</td>
                  <td style={{color:"#78716c",fontSize:12}}>{d.ownerEmail}</td>
                  <td><span className={`adoc-format ${d.format||"new"}`}>{(d.format||"new").toUpperCase()}</span></td>
                  <td><span className={`adoc-status ${d.status||"draft"}`}>{d.status||"draft"}</span></td>
                  <td style={{color:"#78716c"}}>{timeAgo(d.created_at)}</td>
                  <td><button className="adoc-del-btn" onClick={()=>deleteDoc(d)}>Delete</button></td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={6} style={{textAlign:"center",padding:32,color:"#a8a29e"}}>No documents found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}