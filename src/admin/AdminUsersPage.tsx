import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .au-root{padding:28px}
  .au-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .au-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .au-search:focus{border-color:#7c3aed}
  .au-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .au-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .au-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .au-table td{padding:12px 16px;font-size:13px;color:#1c1917;border-bottom:1px solid #faf9f8}
  .au-table tr:last-child td{border-bottom:none}
  .au-table tr:hover td{background:#faf8ff}
  .au-role{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700}
  .au-role.organization{background:#dbeafe;color:#2563eb}
  .au-role.individual{background:#dcfce7;color:#16a34a}
  .au-role.organization_member{background:#f0fdf4;color:#16a34a}
  .au-role.admin{background:#fef3c7;color:#b45309}
  .au-plan{font-size:10px;padding:2px 8px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:600}
  .au-actions{display:flex;gap:6px}
  .au-btn{padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .15s}
  .au-btn.ghost{background:transparent;color:#78716c;border:1px solid #e7e4df}.au-btn.ghost:hover{background:#f5f3ef}
  .au-btn.danger{background:transparent;color:#dc2626;border:1px solid #fecaca}.au-btn.danger:hover{background:#fee2e2}
  .au-count{font-size:12px;color:#78716c;margin-left:auto}
`;

export default function AdminUsersPage() {
  const [users, setUsers]   = useState<any[]>([]);
  const [subs, setSubs]     = useState<Record<string,string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "au-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles").select("id,email,role,created_at,organization_id").order("created_at",{ascending:false});
    const { data: subscriptions } = await supabase
      .from("subscriptions").select("user_id,plan_id").eq("status","active");

    const subMap: Record<string,string> = {};
    for (const s of (subscriptions||[])) subMap[s.user_id] = s.plan_id;
    setSubs(subMap);
    setUsers(profiles||[]);
    setLoading(false);
  }

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Change this user's role to "${newRole}"?`)) return;
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }

  function planLabel(plan: string) {
    if (!plan) return "Free";
    return plan.replace("org_","Org ").replace("ind_","Ind ")
      .replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
    return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
  }

  const filtered = users.filter(u => {
    const matchSearch = u.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || u.role === filter;
    return matchSearch && matchFilter;
  });

  return (
    <AdminLayout title="Users">
      <div className="au-root">
        <div className="au-bar">
          <input className="au-search" placeholder="Search by email…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="au-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="individual">Individual</option>
            <option value="organization">Organization</option>
            <option value="organization_member">Org Member</option>
            <option value="admin">Admin</option>
          </select>
          <span className="au-count">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"#78716c"}}>Loading…</div>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td><span className={`au-role ${u.role || "individual"}`}>{(u.role||"individual").replace("_"," ")}</span></td>
                  <td><span className="au-plan">{planLabel(subs[u.id])}</span></td>
                  <td style={{color:"#78716c"}}>{timeAgo(u.created_at)}</td>
                  <td>
                    <div className="au-actions">
                      {u.role !== "admin" && (
                        <button className="au-btn ghost" onClick={() => changeRole(u.id, "admin")}>Make Admin</button>
                      )}
                      {u.role === "admin" && (
                        <button className="au-btn danger" onClick={() => changeRole(u.id, "individual")}>Remove Admin</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:"center",padding:32,color:"#a8a29e"}}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}