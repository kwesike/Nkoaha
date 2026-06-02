import { useEffect, useState } from "react";
import { supabase } from ".././lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .asub-root{padding:28px}
  .asub-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .asub-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .asub-search:focus{border-color:#7c3aed}
  .asub-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .asub-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .asub-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .asub-table td{padding:12px 16px;font-size:13px;color:#1c1917;border-bottom:1px solid #faf9f8}
  .asub-table tr:last-child td{border-bottom:none}
  .asub-table tr:hover td{background:#faf8ff}
  .asub-status{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700}
  .asub-status.active{background:#dcfce7;color:#16a34a}
  .asub-status.expired{background:#fee2e2;color:#dc2626}
  .asub-status.cancelled{background:#f5f3ef;color:#78716c}
  .asub-plan{font-size:10px;padding:2px 8px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:600}
  .asub-btn{padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid #e7e4df;background:transparent;color:#78716c;font-family:'DM Sans',sans-serif;transition:all .15s}
  .asub-btn:hover{background:#f5f3ef}
  .asub-btn.danger{color:#dc2626;border-color:#fecaca}.asub-btn.danger:hover{background:#fee2e2}
  .asub-btn.success{color:#16a34a;border-color:#bbf7d0}.asub-btn.success:hover{background:#dcfce7}
  .asub-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:200}
  .asub-modal{background:#fff;border-radius:14px;padding:26px;width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .asub-modal h3{font-size:16px;font-weight:700;margin:0 0 4px}
  .asub-modal p{font-size:13px;color:#78716c;margin:0 0 18px}
  .asub-row{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
  .asub-row label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa}
  .asub-row input,.asub-row select{padding:9px 12px;border:1.5px solid #e7e4df;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none}
  .asub-row input:focus,.asub-row select:focus{border-color:#7c3aed}
  .asub-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
  .asub-mBtn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif}
  .asub-mBtn.primary{background:#7c3aed;color:#fff}.asub-mBtn.primary:hover{background:#5b21b6}
  .asub-mBtn.ghost{background:transparent;border:1px solid #e7e4df;color:#78716c}
  .asub-msg{font-size:12px;padding:8px 12px;border-radius:7px;margin-bottom:10px}
  .asub-msg.success{background:#dcfce7;color:#16a34a}
  .asub-msg.error{background:#fee2e2;color:#dc2626}
`;

export default function AdminSubscriptionsPage() {
  const [subs, setSubs]       = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any|null>(null);
  const [editPlan, setEditPlan]     = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editMsg, setEditMsg]       = useState<{t:"success"|"error",m:string}|null>(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    const id = "asub-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("id,user_id,org_id,plan_id,plan_type,status,activated_at,expires_at,amount_ngn")
      .order("created_at",{ascending:false});

    // Enrich with emails
    if (data?.length) {
      const userIds = [...new Set(data.map((s:any)=>s.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles").select("id,email").in("id", userIds);
      const emailMap: Record<string,string> = {};
      for (const p of (profiles||[])) emailMap[p.id] = p.email;
      setSubs(data.map((s:any) => ({ ...s, email: emailMap[s.user_id] || "—" })));
    } else {
      setSubs([]);
    }
    setLoading(false);
  }

  function openEdit(sub: any) {
    setEditing(sub);
    setEditPlan(sub.plan_id||"free");
    setEditStatus(sub.status||"active");
    setEditExpiry(sub.expires_at ? sub.expires_at.slice(0,10) : "");
    setEditMsg(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true); setEditMsg(null);
    const { error } = await supabase.from("subscriptions").update({
      plan_id:    editPlan,
      status:     editStatus,
      expires_at: editExpiry ? new Date(editExpiry).toISOString() : null,
    }).eq("id", editing.id);

    if (error) { setEditMsg({t:"error",m:error.message}); setSaving(false); return; }
    setEditMsg({t:"success",m:"Subscription updated."});
    setSaving(false);
    load();
  }

  async function cancelSub(sub: any) {
    if (!confirm(`Cancel subscription for ${sub.email}?`)) return;
    await supabase.from("subscriptions").update({ status:"cancelled" }).eq("id", sub.id);
    load();
  }

  async function reactivateSub(sub: any) {
    await supabase.from("subscriptions").update({
      status: "active",
      expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    }).eq("id", sub.id);
    load();
  }

  function planLabel(p: string) {
    if (!p || p === "free") return "Free";
    return p.replace("org_","Org ").replace("ind_","Ind ")
      .replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  }

  const filtered = subs.filter(s => {
    const q = s.email?.toLowerCase().includes(search.toLowerCase()) ||
              s.plan_id?.toLowerCase().includes(search.toLowerCase());
    const f = filter === "all" || s.status === filter;
    return q && f;
  });

  return (
    <AdminLayout title="Subscriptions">
      <div className="asub-root">
        <div className="asub-bar">
          <input className="asub-search" placeholder="Search by email or plan…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="asub-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span style={{fontSize:12,color:"#78716c"}}>{filtered.length} subscriptions</span>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"#78716c"}}>Loading…</div>
        ) : (
          <table className="asub-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{fontSize:12,color:"#78716c"}}>{s.email}</td>
                  <td><span className="asub-plan">{planLabel(s.plan_id)}</span></td>
                  <td style={{fontSize:12,color:"#78716c",textTransform:"capitalize"}}>{s.plan_type||"—"}</td>
                  <td><span className={`asub-status ${s.status}`}>{s.status}</span></td>
                  <td style={{fontSize:12,color:"#78716c"}}>{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</td>
                  <td style={{fontFamily:"monospace",fontSize:12}}>{s.amount_ngn ? `₦${Number(s.amount_ngn).toLocaleString()}` : "—"}</td>
                  <td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button className="asub-btn" onClick={()=>openEdit(s)}>Edit</button>
                    {s.status === "active"
                      ? <button className="asub-btn danger" onClick={()=>cancelSub(s)}>Cancel</button>
                      : <button className="asub-btn success" onClick={()=>reactivateSub(s)}>Reactivate</button>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#a8a29e"}}>No subscriptions found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="asub-modal-bg" onClick={()=>setEditing(null)}>
          <div className="asub-modal" onClick={e=>e.stopPropagation()}>
            <h3>Edit Subscription</h3>
            <p>{editing.email}</p>
            {editMsg && <div className={`asub-msg ${editMsg.t}`}>{editMsg.m}</div>}
            <div className="asub-row">
              <label>Plan</label>
              <select value={editPlan} onChange={e=>setEditPlan(e.target.value)}>
                <option value="free">Free</option>
                <option value="ind_daily">Individual Daily</option>
                <option value="ind_weekly">Individual Weekly</option>
                <option value="ind_monthly">Individual Monthly</option>
                <option value="ind_yearly">Individual Yearly</option>
                <option value="org_starter">Org Starter</option>
                <option value="org_growth">Org Growth</option>
                <option value="org_enterprise">Org Enterprise</option>
              </select>
            </div>
            <div className="asub-row">
              <label>Status</label>
              <select value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="asub-row">
              <label>Expiry Date</label>
              <input type="date" value={editExpiry} onChange={e=>setEditExpiry(e.target.value)}/>
            </div>
            <div className="asub-footer">
              <button className="asub-mBtn ghost" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="asub-mBtn primary" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}