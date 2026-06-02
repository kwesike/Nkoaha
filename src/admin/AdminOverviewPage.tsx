import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .ao-root{padding:28px;max-width:1100px}
  .ao-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px}
  .ao-stat{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:18px 20px}
  .ao-stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a78bfa;margin-bottom:8px}
  .ao-stat-val{font-size:28px;font-weight:800;color:#1c1917;font-family:'DM Mono',monospace;line-height:1}
  .ao-stat-sub{font-size:12px;color:#78716c;margin-top:4px}
  .ao-sections{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .ao-card{background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden}
  .ao-card-head{padding:14px 18px;border-bottom:1px solid #f0ede8;font-size:13px;font-weight:600;color:#1c1917;display:flex;align-items:center;justify-content:space-between}
  .ao-card-body{padding:4px 0}
  .ao-row{display:flex;align-items:center;padding:10px 18px;border-bottom:1px solid #faf9f8;font-size:13px;gap:10px}
  .ao-row:last-child{border-bottom:none}
  .ao-row-email{flex:1;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ao-row-meta{font-size:11px;color:#78716c;flex-shrink:0}
  .ao-badge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;flex-shrink:0}
  .ao-badge.org{background:#dbeafe;color:#2563eb}
  .ao-badge.ind{background:#dcfce7;color:#16a34a}
  .ao-badge.adm{background:#fef3c7;color:#b45309}
  .ao-empty{padding:24px;text-align:center;color:#a8a29e;font-size:13px}
`;

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({ users:0, orgs:0, docs:0, messages:0, subs:0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentDocs, setRecentDocs]   = useState<any[]>([]);

  useEffect(() => {
    const id = "ao-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    const [
      { count: userCount },
      { count: orgCount },
      { count: docCount },
      { count: msgCount },
      { count: subCount },
      { data: users },
      { data: docs },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count:"exact", head:true }),
      supabase.from("organizations").select("id", { count:"exact", head:true }),
      supabase.from("documents").select("id", { count:"exact", head:true }).neq("status","deleted"),
      supabase.from("activity_logs").select("id", { count:"exact", head:true }).eq("action","support_message"),
      supabase.from("subscriptions").select("id", { count:"exact", head:true }).eq("status","active"),
      supabase.from("profiles").select("id,email,role,created_at").order("created_at",{ascending:false}).limit(8),
      supabase.from("documents").select("id,title,format,created_at").neq("status","deleted").order("created_at",{ascending:false}).limit(6),
    ]);
    setStats({ users:userCount||0, orgs:orgCount||0, docs:docCount||0, messages:msgCount||0, subs:subCount||0 });
    setRecentUsers(users||[]);
    setRecentDocs(docs||[]);
  }

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
    return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
  }

  const statCards = [
    { label:"Total Users",     val: stats.users,    sub:"all accounts" },
    { label:"Organizations",   val: stats.orgs,     sub:"registered orgs" },
    { label:"Documents",       val: stats.docs,     sub:"active docs" },
    { label:"Active Plans",    val: stats.subs,     sub:"paid subscriptions" },
    { label:"Support Messages",val: stats.messages, sub:"all time" },
  ];

  return (
    <AdminLayout title="Overview">
      <div className="ao-root">
        <div className="ao-stats">
          {statCards.map(s => (
            <div key={s.label} className="ao-stat">
              <div className="ao-stat-label">{s.label}</div>
              <div className="ao-stat-val">{s.val.toLocaleString()}</div>
              <div className="ao-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="ao-sections">
          <div className="ao-card">
            <div className="ao-card-head">Recent Users</div>
            <div className="ao-card-body">
              {recentUsers.length === 0 && <div className="ao-empty">No users yet</div>}
              {recentUsers.map(u => (
                <div key={u.id} className="ao-row">
                  <div className="ao-row-email">{u.email}</div>
                  <span className={`ao-badge ${u.role === "organization" ? "org" : u.role === "admin" ? "adm" : "ind"}`}>
                    {u.role?.replace("_"," ") || "individual"}
                  </span>
                  <div className="ao-row-meta">{timeAgo(u.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ao-card">
            <div className="ao-card-head">Recent Documents</div>
            <div className="ao-card-body">
              {recentDocs.length === 0 && <div className="ao-empty">No documents yet</div>}
              {recentDocs.map(d => (
                <div key={d.id} className="ao-row">
                  <div className="ao-row-email">{d.title}</div>
                  <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:20,fontWeight:600,flexShrink:0}}>
                    {d.format?.toUpperCase()}
                  </span>
                  <div className="ao-row-meta">{timeAgo(d.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}