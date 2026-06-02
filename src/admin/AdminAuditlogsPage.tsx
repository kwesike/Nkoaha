import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .aal-root{padding:28px;max-width:1200px}
  .aal-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .aal-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .aal-search:focus{border-color:#7c3aed}
  .aal-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .aal-count{font-size:12px;color:#78716c;margin-left:auto}
  .aal-list{display:flex;flex-direction:column;gap:0;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden}
  .aal-row{display:grid;grid-template-columns:140px 1fr 180px 160px;align-items:start;padding:12px 18px;border-bottom:1px solid #faf9f8;gap:14px;transition:background .1s}
  .aal-row:last-child{border-bottom:none}
  .aal-row:hover{background:#faf8ff}
  .aal-action{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;width:fit-content}
  .aal-action.document_created{background:#dcfce7;color:#16a34a}
  .aal-action.document_uploaded{background:#dbeafe;color:#2563eb}
  .aal-action.document_sent{background:#ede9fe;color:#7c3aed}
  .aal-action.document_signed{background:#dcfce7;color:#16a34a}
  .aal-action.document_approved{background:#d1fae5;color:#059669}
  .aal-action.document_declined{background:#fee2e2;color:#dc2626}
  .aal-action.document_deleted{background:#fef3c7;color:#b45309}
  .aal-action.document_received{background:#dbeafe;color:#2563eb}
  .aal-action.support_message{background:#fef9c3;color:#a16207}
  .aal-action.support_reply{background:#f0fdf4;color:#16a34a}
  .aal-action.proof_issued{background:#f3e8ff;color:#7c3aed}
  .aal-action.document_comment{background:#e0f2fe;color:#0369a1}
  .aal-action.default{background:#f5f3ef;color:#78716c}
  .aal-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
  .aal-doc-title{font-size:13px;font-weight:600;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aal-detail{font-size:11px;color:#78716c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aal-user{font-size:12px;color:#44403c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'DM Mono',monospace}
  .aal-time{font-size:11px;color:#a8a29e;font-family:'DM Mono',monospace;white-space:nowrap}
  .aal-load-more{padding:14px;text-align:center;border-top:1px solid #e7e4df}
  .aal-load-btn{padding:8px 20px;border-radius:8px;border:1.5px solid #e7e4df;background:transparent;font-size:12.5px;font-weight:600;color:#78716c;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
  .aal-load-btn:hover{background:#f5f3ef;color:#1c1917}
  .aal-empty{padding:48px;text-align:center;color:#a8a29e;font-size:13px}
  .aal-thead{display:grid;grid-template-columns:140px 1fr 180px 160px;padding:10px 18px;gap:14px;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .aal-thead span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa}
`;

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  document_created:   "Created",
  document_uploaded:  "Uploaded",
  document_sent:      "Sent",
  document_signed:    "Signed",
  document_approved:  "Approved",
  document_declined:  "Declined",
  document_deleted:   "Deleted",
  document_received:  "Received",
  document_comment:   "Comment",
  support_message:    "Support Msg",
  support_reply:      "Support Reply",
  proof_issued:       "Proof Issued",
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [emails, setEmails]   = useState<Record<string, string>>({});
  const [search, setSearch]   = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "aal-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    loadProfiles();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter]);

  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("id,email");
    const map: Record<string, string> = {};
    for (const p of (data || [])) map[p.id] = p.email;
    setEmails(map);
  }

  async function loadLogs() {
    setLoading(true);
    let query = supabase
      .from("activity_logs")
      .select("id,user_id,action,document_id,metadata,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);

    const { data, count } = await query;
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  function actionClass(action: string) {
    return action in ACTION_LABELS ? action : "default";
  }

  function actionLabel(action: string) {
    return ACTION_LABELS[action] || action.replace(/_/g, " ");
  }

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : `${d}d ago`;
  }

  function absTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function metaSnippet(log: any) {
    const m = log.metadata || {};
    if (m.document_title) return m.document_title;
    if (m.title)          return m.title;
    if (m.message)        return m.message.slice(0, 60);
    if (m.proof_summary)  return m.proof_summary.slice(0, 60);
    return log.document_id ? `doc: ${log.document_id.slice(0, 8)}…` : "—";
  }

  // Client-side search filter over loaded page
  const displayed = logs.filter(l => {
    if (!search) return true;
    const email = emails[l.user_id] || "";
    const meta  = JSON.stringify(l.metadata || "").toLowerCase();
    const q     = search.toLowerCase();
    return email.includes(q) || l.action.includes(q) || meta.includes(q);
  });

  const uniqueActions = Array.from(new Set(
    ["all", "document_created", "document_uploaded", "document_sent", "document_signed",
     "document_approved", "document_declined", "document_deleted", "document_received",
     "document_comment", "support_message", "support_reply", "proof_issued"]
  ));

  return (
    <AdminLayout title="Audit Logs">
      <div className="aal-root">
        <div className="aal-bar">
          <input
            className="aal-search"
            placeholder="Search by email, action, or content…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="aal-filter" value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
            {uniqueActions.map(a => (
              <option key={a} value={a}>
                {a === "all" ? "All Actions" : actionLabel(a)}
              </option>
            ))}
          </select>
          <span className="aal-count">{total.toLocaleString()} log{total !== 1 ? "s" : ""} total</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#78716c" }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="aal-empty">No logs found</div>
        ) : (
          <div className="aal-list">
            <div className="aal-thead">
              <span>Action</span>
              <span>Details</span>
              <span>User</span>
              <span>Time</span>
            </div>
            {displayed.map(log => (
              <div key={log.id} className="aal-row">
                <div>
                  <span className={`aal-action ${actionClass(log.action)}`}>
                    {actionLabel(log.action)}
                  </span>
                </div>
                <div className="aal-meta">
                  <div className="aal-doc-title">{metaSnippet(log)}</div>
                  {log.metadata?.sender_email && (
                    <div className="aal-detail">from: {log.metadata.sender_email}</div>
                  )}
                  {log.metadata?.action_type && (
                    <div className="aal-detail">type: {log.metadata.action_type}</div>
                  )}
                </div>
                <div className="aal-user" title={emails[log.user_id]}>
                  {emails[log.user_id] || log.user_id?.slice(0, 12) + "…"}
                </div>
                <div>
                  <div className="aal-time" title={absTime(log.created_at)}>
                    {relTime(log.created_at)}
                  </div>
                  <div style={{ fontSize: 10, color: "#c4b5fd", fontFamily: "var(--mono)", marginTop: 2 }}>
                    {absTime(log.created_at)}
                  </div>
                </div>
              </div>
            ))}
            {total > page * PAGE_SIZE && (
              <div className="aal-load-more">
                <button className="aal-load-btn" onClick={() => setPage(p => p + 1)}>
                  Load more ({total - page * PAGE_SIZE} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}