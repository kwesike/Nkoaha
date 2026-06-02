import { useEffect, useState } from "react";
import { supabase } from ".././lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .at-root{padding:28px;max-width:900px}
  .at-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
  .at-title{font-size:18px;font-weight:700;color:#1c1917}
  .at-sub{font-size:13px;color:#78716c;margin-top:2px}
  .at-add-btn{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s}
  .at-add-btn:hover{background:#5b21b6}
  .at-cards{display:flex;flex-direction:column;gap:12px}
  .at-card{background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden}
  .at-card-head{padding:16px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #f0ede8}
  .at-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .at-card-info{flex:1;min-width:0}
  .at-card-email{font-size:13.5px;font-weight:600;color:#1c1917}
  .at-card-role{font-size:11px;color:#78716c;margin-top:2px;display:flex;align-items:center;gap:6px}
  .at-super-badge{font-size:10px;padding:1px 7px;border-radius:20px;background:#fef3c7;color:#b45309;font-weight:700}
  .at-admin-badge{font-size:10px;padding:1px 7px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:700}
  .at-card-actions{display:flex;gap:7px}
  .at-btn{padding:6px 13px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #e7e4df;background:transparent;color:#78716c;font-family:inherit;transition:all .15s}
  .at-btn:hover{background:#f5f3ef}
  .at-btn.danger{color:#dc2626;border-color:#fecaca}.at-btn.danger:hover{background:#fee2e2}
  .at-perms{padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
  .at-perm{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #f0ede8;border-radius:8px;background:#faf9f8}
  .at-perm-label{font-size:12px;color:#1c1917;font-weight:500}
  .at-toggle{position:relative;width:36px;height:20px;flex-shrink:0}
  .at-toggle input{opacity:0;width:0;height:0}
  .at-toggle-slider{position:absolute;cursor:pointer;inset:0;background:#e7e4df;border-radius:20px;transition:.2s}
  .at-toggle-slider:before{content:"";position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
  .at-toggle input:checked + .at-toggle-slider{background:#7c3aed}
  .at-toggle input:checked + .at-toggle-slider:before{transform:translateX(16px)}
  .at-save-row{padding:12px 18px;border-top:1px solid #f0ede8;display:flex;justify-content:flex-end;gap:8px}
  .at-save-btn{padding:7px 16px;background:#7c3aed;color:#fff;border:none;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s}
  .at-save-btn:hover{background:#5b21b6}
  .at-save-btn:disabled{opacity:.5;cursor:not-allowed}
  .at-saved{font-size:11px;color:#16a34a;background:#dcfce7;padding:3px 9px;border-radius:6px;font-weight:600}
  .at-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:200}
  .at-modal{background:#fff;border-radius:14px;padding:26px;width:420px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .at-modal h3{font-size:16px;font-weight:700;margin:0 0 4px;color:#1c1917}
  .at-modal p{font-size:13px;color:#78716c;margin:0 0 16px}
  .at-modal-input{width:100%;padding:9px 12px;border:1.5px solid #e7e4df;border-radius:8px;font-size:13px;font-family:inherit;color:#1c1917;outline:none;box-sizing:border-box;margin-bottom:10px}
  .at-modal-input:focus{border-color:#7c3aed}
  .at-modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
  .at-modal-btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit}
  .at-modal-btn.primary{background:#7c3aed;color:#fff}.at-modal-btn.primary:hover{background:#5b21b6}
  .at-modal-btn.ghost{background:transparent;border:1px solid #e7e4df;color:#78716c}.at-modal-btn.ghost:hover{background:#f5f3ef}
  .at-modal-msg{font-size:12px;padding:8px 11px;border-radius:7px;margin-bottom:8px}
  .at-modal-msg.error{background:#fee2e2;color:#dc2626}
  .at-modal-msg.success{background:#dcfce7;color:#16a34a}
  .at-empty{padding:40px;text-align:center;color:#a8a29e;font-size:13px;background:#fff;border:1px solid #e7e4df;border-radius:12px}
`;

interface Permission {
  id?: string; admin_id: string;
  can_view_users: boolean;         can_edit_users: boolean;
  can_view_orgs: boolean;          can_edit_orgs: boolean;
  can_view_subscriptions: boolean; can_edit_subscriptions: boolean;
  can_view_documents: boolean;     can_delete_documents: boolean;
  can_view_audit: boolean;
  can_view_support: boolean;       can_reply_support: boolean;
}

interface Admin {
  id: string; email: string; is_super_admin: boolean;
  perms: Permission | null;
}

const PERM_LABELS: { key: keyof Permission; label: string }[] = [
  { key:"can_view_users",          label:"View Users" },
  { key:"can_edit_users",          label:"Edit Users" },
  { key:"can_view_orgs",           label:"View Orgs" },
  { key:"can_edit_orgs",           label:"Edit Orgs" },
  { key:"can_view_subscriptions",  label:"View Subscriptions" },
  { key:"can_edit_subscriptions",  label:"Edit Subscriptions" },
  { key:"can_view_documents",      label:"View Documents" },
  { key:"can_delete_documents",    label:"Delete Documents" },
  { key:"can_view_audit",          label:"View Audit Logs" },
  { key:"can_view_support",        label:"View Support" },
  { key:"can_reply_support",       label:"Reply to Support" },
];

function defaultPerms(adminId: string): Permission {
  return {
    admin_id:adminId, can_view_users:true, can_edit_users:false,
    can_view_orgs:true, can_edit_orgs:false,
    can_view_subscriptions:true, can_edit_subscriptions:false,
    can_view_documents:true, can_delete_documents:false,
    can_view_audit:true, can_view_support:true, can_reply_support:true,
  };
}

export default function AdminTeamPage() {
  const [admins, setAdmins]       = useState<Admin[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myId, setMyId]           = useState("");
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [addEmail, setAddEmail]   = useState("");
  const [addMsg, setAddMsg]       = useState<{t:"success"|"error";m:string}|null>(null);
  const [adding, setAdding]       = useState(false);
  const [saving, setSaving]       = useState<Record<string,boolean>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string,boolean>>({});
  const [localPerms, setLocalPerms] = useState<Record<string,Permission>>({});

  useEffect(() => {
    const id = "at-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setMyId(user.id);
      const { data: profile } = await supabase
        .from("profiles").select("is_super_admin").eq("id",user.id).single();
      setIsSuperAdmin(!!profile?.is_super_admin);
      load();
    });
  }, []);

  async function load() {
    setLoading(true);
    const { data: adminProfiles } = await supabase
      .from("profiles").select("id,email,is_super_admin")
      .eq("role","admin");
    const { data: permsData } = await supabase
      .from("admin_permissions").select("*");

    const permsMap: Record<string,Permission> = {};
    for (const p of (permsData||[])) permsMap[p.admin_id] = p;

    const list: Admin[] = (adminProfiles||[]).map(a => ({
      id:a.id, email:a.email, is_super_admin:!!a.is_super_admin,
      perms: permsMap[a.id] || null,
    }));
    setAdmins(list);

    // Init local perms state
    const lp: Record<string,Permission> = {};
    for (const a of list) lp[a.id] = a.perms || defaultPerms(a.id);
    setLocalPerms(lp);
    setLoading(false);
  }

  async function addAdmin() {
    if (!addEmail.trim()) return;
    setAdding(true); setAddMsg(null);
    const { data: profile } = await supabase
      .from("profiles").select("id,role").eq("email",addEmail.trim().toLowerCase()).single();
    if (!profile) {
      setAddMsg({t:"error",m:"No account found with that email."});
      setAdding(false); return;
    }
    if (profile.role === "admin") {
      setAddMsg({t:"error",m:"This user is already an admin."});
      setAdding(false); return;
    }
    await supabase.from("profiles").update({ role:"admin" }).eq("id",profile.id);
    // Create default permissions
    await supabase.from("admin_permissions").upsert({ ...defaultPerms(profile.id) });
    setAddMsg({t:"success",m:`${addEmail.trim()} is now an admin.`});
    setAdding(false); setAddEmail("");
    load();
  }

  async function removeAdmin(admin: Admin) {
    if (admin.is_super_admin) { alert("Cannot remove a super admin."); return; }
    if (!confirm(`Remove admin access from ${admin.email}?`)) return;
    await supabase.from("profiles").update({ role:"individual" }).eq("id",admin.id);
    await supabase.from("admin_permissions").delete().eq("admin_id",admin.id);
    load();
  }

  async function savePerms(adminId: string) {
    setSaving(prev => ({ ...prev, [adminId]:true }));
    const p = localPerms[adminId];
    if (!p) return;
    await supabase.from("admin_permissions").upsert({ ...p, admin_id:adminId, updated_at:new Date().toISOString() });
    setSaving(prev => ({ ...prev, [adminId]:false }));
    setSavedFlash(prev => ({ ...prev, [adminId]:true }));
    setTimeout(() => setSavedFlash(prev => ({ ...prev, [adminId]:false })), 2000);
  }

  function togglePerm(adminId: string, key: keyof Permission) {
    setLocalPerms(prev => ({
      ...prev,
      [adminId]: { ...prev[adminId], [key]: !prev[adminId][key] },
    }));
  }

  if (!isSuperAdmin && !loading) return (
    <AdminLayout title="Admin Team">
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:10,color:"#78716c"}}>
        <div style={{fontSize:36}}>🔒</div>
        <div style={{fontSize:16,fontWeight:600,color:"#1c1917"}}>Super Admin Only</div>
        <div style={{fontSize:13}}>Only the super admin can manage the admin team.</div>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Admin Team">
      <div className="at-root">
        <div className="at-header">
          <div>
            <div className="at-title">Admin Team</div>
            <div className="at-sub">Manage admins and control what each one can see and do</div>
          </div>
          {isSuperAdmin && (
            <button className="at-add-btn" onClick={()=>{setShowAdd(true);setAddMsg(null);setAddEmail("");}}>
              + Add Admin
            </button>
          )}
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"#78716c"}}>Loading…</div>
        ) : admins.length === 0 ? (
          <div className="at-empty">No other admins yet. Add one above.</div>
        ) : (
          <div className="at-cards">
            {admins.map(admin => {
              const perms = localPerms[admin.id] || defaultPerms(admin.id);
              const isMe = admin.id === myId;
              return (
                <div key={admin.id} className="at-card">
                  <div className="at-card-head">
                    <div className="at-avatar">{admin.email[0]?.toUpperCase()}</div>
                    <div className="at-card-info">
                      <div className="at-card-email">
                        {admin.email} {isMe && <span style={{fontSize:10,color:"#a8a29e"}}>(you)</span>}
                      </div>
                      <div className="at-card-role">
                        {admin.is_super_admin
                          ? <span className="at-super-badge">⭐ Super Admin</span>
                          : <span className="at-admin-badge">Admin</span>
                        }
                      </div>
                    </div>
                    {isSuperAdmin && !admin.is_super_admin && (
                      <div className="at-card-actions">
                        <button className="at-btn danger" onClick={()=>removeAdmin(admin)}>Remove Admin</button>
                      </div>
                    )}
                  </div>

                  {/* Permissions grid — only super admin can edit, others are read-only */}
                  {!admin.is_super_admin && (
                    <>
                      <div className="at-perms">
                        {PERM_LABELS.map(({ key, label }) => (
                          <div key={key} className="at-perm">
                            <span className="at-perm-label">{label}</span>
                            <label className="at-toggle">
                              <input
                                type="checkbox"
                                checked={!!(perms[key] as boolean)}
                                onChange={() => isSuperAdmin && togglePerm(admin.id, key)}
                                disabled={!isSuperAdmin}
                              />
                              <span className="at-toggle-slider"/>
                            </label>
                          </div>
                        ))}
                      </div>
                      {isSuperAdmin && (
                        <div className="at-save-row">
                          {savedFlash[admin.id] && <span className="at-saved">✓ Saved</span>}
                          <button className="at-save-btn" onClick={()=>savePerms(admin.id)}
                            disabled={saving[admin.id]}>
                            {saving[admin.id]?"Saving…":"Save Permissions"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {admin.is_super_admin && (
                    <div style={{padding:"12px 18px",fontSize:12,color:"#78716c",fontStyle:"italic",borderTop:"1px solid #f0ede8"}}>
                      Super admins have full access to all features and cannot be restricted.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="at-modal-bg" onClick={()=>setShowAdd(false)}>
          <div className="at-modal" onClick={e=>e.stopPropagation()}>
            <h3>Add Admin</h3>
            <p>Enter the email of an existing NkoAha user to grant them admin access.</p>
            {addMsg && <div className={`at-modal-msg ${addMsg.t}`}>{addMsg.m}</div>}
            <input className="at-modal-input" type="email" placeholder="Email address…"
              autoFocus value={addEmail}
              onChange={e=>{setAddEmail(e.target.value);setAddMsg(null);}}
              onKeyDown={e=>e.key==="Enter"&&addAdmin()}/>
            <div className="at-modal-footer">
              <button className="at-modal-btn ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="at-modal-btn primary" onClick={addAdmin} disabled={adding||!addEmail.trim()}>
                {adding?"Adding…":"Add Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}