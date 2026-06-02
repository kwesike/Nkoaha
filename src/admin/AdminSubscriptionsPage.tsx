import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .asub-root{padding:28px;max-width:1200px}
  .asub-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px}
  .asub-stat{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:16px 20px}
  .asub-stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a78bfa;margin-bottom:6px}
  .asub-stat-val{font-size:26px;font-weight:800;color:#1c1917;font-family:'DM Mono',monospace;line-height:1}
  .asub-stat-sub{font-size:11px;color:#78716c;margin-top:4px}
  .asub-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .asub-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .asub-search:focus{border-color:#7c3aed}
  .asub-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .asub-count{font-size:12px;color:#78716c;margin-left:auto}
  .asub-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .asub-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .asub-table td{padding:12px 16px;font-size:13px;color:#1c1917;border-bottom:1px solid #faf9f8}
  .asub-table tr:last-child td{border-bottom:none}
  .asub-table tr:hover td{background:#faf8ff}
  .asub-plan{font-size:11px;padding:3px 9px;border-radius:20px;font-weight:700}
  .asub-plan.starter{background:#dbeafe;color:#2563eb}
  .asub-plan.growth{background:#dcfce7;color:#16a34a}
  .asub-plan.enterprise{background:#fef3c7;color:#b45309}
  .asub-plan.individual{background:#ede9fe;color:#7c3aed}
  .asub-plan.free{background:#f5f3ef;color:#78716c}
  .asub-status{font-size:11px;padding:3px 9px;border-radius:20px;font-weight:700}
  .asub-status.active{background:#dcfce7;color:#16a34a}
  .asub-status.expired{background:#fee2e2;color:#dc2626}
  .asub-status.cancelled{background:#f5f3ef;color:#78716c}
  .asub-mono{font-family:'DM Mono',monospace;font-size:12px}
  .asub-actions{display:flex;gap:6px}
  .asub-btn{padding:4px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .15s}
  .asub-btn.danger{background:transparent;color:#dc2626;border:1px solid #fecaca}.asub-btn.danger:hover{background:#fee2e2}
  .asub-btn.ghost{background:transparent;color:#7c3aed;border:1px solid #c4b5fd}.asub-btn.ghost:hover{background:#ede9fe}
  .asub-empty{padding:48px;text-align:center;color:#a8a29e;font-size:13px}
`;

export default function AdminSubscriptionsPage() {
  const [subs, setSubs]     = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "asub-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("id,user_id,plan_id,plan_type,status,period,doc_quota,org_doc_limit,activated_at,expires_at,created_at")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase
      .from("profiles").select("id,email");

    const emailMap: Record<string, string> = {};
    for (const p of (profiles || [])) emailMap[p.id] = p.email;

    setSubs(subscriptions || []);
    setEmails(emailMap);
    setLoading(false);
  }

  async function cancelSub(id: string) {
    if (!confirm("Cancel this subscription?")) return;
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id);
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: "cancelled" } : s));
  }

  async function expireSub(id: string) {
    if (!confirm("Mark this subscription as expired?")) return;
    await supabase.from("subscriptions").update({ status: "expired" }).eq("id", id);
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: "expired" } : s));
  }

  function planClass(plan: string, type: string) {
    if (!plan && !type) return "free";
    if (plan?.includes("starter"))    return "starter";
    if (plan?.includes("growth"))     return "growth";
    if (plan?.includes("enterprise")) return "enterprise";
    if (type === "individual")        return "individual";
    return "free";
  }

  function planDisplay(s: any) {
    if (!s.plan_id && !s.plan_type) return "Free";
    const base = s.plan_id || s.plan_type || "";
    return base.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  const active = subs.filter(s => s.status === "active").length;
  const expired = subs.filter(s => s.status === "expired").length;
  const cancelled = subs.filter(s => s.status === "cancelled").length;

  const filtered = subs.filter(s => {
    const email = emails[s.user_id] || "";
    const matchSearch = email.toLowerCase().includes(search.toLowerCase()) ||
      (s.plan_id || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <AdminLayout title="Subscriptions">
      <div className="asub-root">
        <div className="asub-stats">
          {[
            { label: "Total",     val: subs.length,  sub: "all time" },
            { label: "Active",    val: active,        sub: "paying now" },
            { label: "Expired",   val: expired,       sub: "lapsed" },
            { label: "Cancelled", val: cancelled,     sub: "churned" },
          ].map(s => (
            <div key={s.label} className="asub-stat">
              <div className="asub-stat-label">{s.label}</div>
              <div className="asub-stat-val">{s.val}</div>
              <div className="asub-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="asub-bar">
          <input
            className="asub-search"
            placeholder="Search by email or plan…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="asub-filter" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="asub-count">{filtered.length} subscription{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#78716c" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="asub-empty">No subscriptions found</div>
        ) : (
          <table className="asub-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Status</th>
                <th>Quota</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="asub-mono" style={{ maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {emails[s.user_id] || s.user_id.slice(0, 12) + "…"}
                    </div>
                  </td>
                  <td>
                    <span className={`asub-plan ${planClass(s.plan_id, s.plan_type)}`}>
                      {planDisplay(s)}
                    </span>
                  </td>
                  <td style={{ color: "#78716c", fontSize: 12 }}>
                    {s.plan_type || "—"}{s.period ? ` · ${s.period}` : ""}
                  </td>
                  <td>
                    <span className={`asub-status ${s.status}`}>{s.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "#78716c" }}>
                    {s.org_doc_limit ? `${s.org_doc_limit}/mo` : s.doc_quota ? `${s.doc_quota} docs` : "—"}
                  </td>
                  <td style={{ color: "#78716c", fontSize: 12 }}>{formatDate(s.expires_at)}</td>
                  <td>
                    <div className="asub-actions">
                      {s.status === "active" && (
                        <>
                          <button className="asub-btn danger" onClick={() => cancelSub(s.id)}>Cancel</button>
                          <button className="asub-btn ghost" onClick={() => expireSub(s.id)}>Expire</button>
                        </>
                      )}
                      {s.status !== "active" && (
                        <span style={{ fontSize: 11, color: "#a8a29e" }}>—</span>
                      )}
                    </div>
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