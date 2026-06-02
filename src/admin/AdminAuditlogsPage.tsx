import { useEffect, useState } from "react";
import { supabase } from ".././lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .aaudit-root{padding:28px}
  .aaudit-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .aaudit-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .aaudit-search:focus{border-color:#7c3aed}
  .aaudit-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .aaudit-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .aaudit-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .aaudit-table td{padding:11px 16px;font-size:12.5px;color:#1c1917;border-bottom:1px solid #faf9f8;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aaudit-table tr:last-child td{border-bottom:none}
  .aaudit-table tr:hover td{background:#faf8ff}
  .aaudit-action{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;white-space:nowrap}
  .aaudit-action.document{background:#ede9fe;color:#7c3aed}
  .aaudit-action.support{background:#dbeafe;color:#2563eb}
  .aaudit-action.member{background:#dcfce7;color:#16a34a}
  .aaudit-action.partner{background:#fef3c7;color:#b45309}
  .aaudit-action.other{background:#f5f3ef;color:#78716c}
  .aaudit-meta{font-size:11px;color:#78716c;font-family:'DM Mono',monospace;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aaudit-load-more{width:100%;padding:12px;background:#faf9f8;border:none;border-top:1px solid #e7e4df;font-size:13px;font-weight:600;color:#7c3aed;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
  .aaudit-load-more:hover{background:#ede9fe}
`;

const ACTION_CATEGORIES: Record<string,string> = {
  document_received:"document", document_approved:"document",
  document_signed:"document",   document_declined:"document",
  document_comment:"document",  proof_issued:"document",
  support_message:"support",    support_reply:"support",
  member_joined:"member",       org_invite_received:"member",
  partnership_invite_received:"partner", partnership_accepted:"partner",
  partnership_ended:"partner",
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const id = "aaudit-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load(0);
  }, []);

  async function load(pageNum: number) {
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const { data } = await supabase
      .from("activity_logs")
      .select("id,user_id,action,metadata,created_at")
      .order("created_at",{ascending:false})
      .range(from, from + PAGE_SIZE - 1);

    if (data?.length) {
      const userIds = [...new Set(data.map((l:any)=>l.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles").select("id,email").in("id", userIds);
      const emailMap: Record<string,string> = {};
      for (const p of (profiles||[])) emailMap[p.id] = p.email;
      const enriched = data.map((l:any) => ({ ...l, email: emailMap[l.user_id]||"—" }));
      setLogs(prev => pageNum === 0 ? enriched : [...prev, ...enriched]);
    }
    setPage(pageNum);
    setLoading(false);
  }

  function metaSummary(action: string, meta: any) {
    if (!meta) return "—";
    if (action.startsWith("document")) return meta.document_title || meta.title || "—";
    if (action === "support_message" || action === "support_reply")
      return (meta.message||"").slice(0,60) + ((meta.message||"").length > 60 ? "…" : "");
    if (action === "member_joined") return meta.member_email || "—";
    if (action.startsWith("partner")) return meta.partner_org_name || meta.requester_org_name || "—";
    return JSON.stringify(meta).slice(0,60);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB",{
      day:"2-digit", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    });
  }

  const filtered = logs.filter(l => {
    const q = l.email?.toLowerCase().includes(search.toLowerCase()) ||
              l.action?.toLowerCase().includes(search.toLowerCase());
    const cat = ACTION_CATEGORIES[l.action] || "other";
    const f = filter === "all" || cat === filter;
    return q && f;
  });

  return (
    <AdminLayout title="Audit Logs">
      <div className="aaudit-root">
        <div className="aaudit-bar">
          <input className="aaudit-search" placeholder="Search by email or action…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="aaudit-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="document">Documents</option>
            <option value="support">Support</option>
            <option value="member">Members</option>
            <option value="partner">Partnerships</option>
            <option value="other">Other</option>
          </select>
          <span style={{fontSize:12,color:"#78716c"}}>{filtered.length} entries</span>
        </div>

        {loading && page === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"#78716c"}}>Loading…</div>
        ) : (
          <table className="aaudit-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const cat = ACTION_CATEGORIES[l.action] || "other";
                return (
                  <tr key={l.id}>
                    <td style={{color:"#78716c",fontSize:11}}>{l.email}</td>
                    <td>
                      <span className={`aaudit-action ${cat}`}>
                        {l.action?.replace(/_/g," ")}
                      </span>
                    </td>
                    <td className="aaudit-meta" title={JSON.stringify(l.metadata)}>
                      {metaSummary(l.action, l.metadata)}
                    </td>
                    <td style={{color:"#78716c",fontSize:11,whiteSpace:"nowrap"}}>
                      {fmtDate(l.created_at)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{textAlign:"center",padding:32,color:"#a8a29e"}}>No logs found</td></tr>
              )}
            </tbody>
          </table>
        )}
        {!loading && filtered.length >= PAGE_SIZE && (
          <button className="aaudit-load-more" onClick={()=>load(page+1)}>
            Load more logs
          </button>
        )}
      </div>
    </AdminLayout>
  );
}