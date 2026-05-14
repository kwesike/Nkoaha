import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";
import "../components/organization/dash.css";

/* ─── STYLES ─── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;
    --green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;
    --red:#dc2626;--red-bg:#fee2e2;--blue:#2563eb;--blue-bg:#dbeafe;
    --teal:#0d9488;--teal-bg:#ccfbf1;
    --surface:#fff;--border:#e7e4df;--text:#1c1917;--muted:#78716c;
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
  }
  .og-page-header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px 0;margin-bottom:24px;flex-wrap:wrap;gap:12px}
  .og-org-info{display:flex;align-items:center;gap:14px}
  .og-logo{width:48px;height:48px;border-radius:12px;object-fit:cover;border:2px solid var(--purple-light);flex-shrink:0}
  .og-logo-fallback{width:48px;height:48px;border-radius:12px;flex-shrink:0;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--purple-light)}
  .og-org-name{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.02em}
  .og-org-sub{font-size:12px;color:var(--muted);margin-top:1px}
  .og-header-actions{display:flex;align-items:center;gap:8px}
  .og-btn-invite{display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}
  .og-btn-invite:hover{background:var(--purple-dark)}
  .og-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:0 28px 24px}
  .og-stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;position:relative;overflow:hidden;transition:box-shadow .18s,transform .18s}
  .og-stat-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.07);transform:translateY(-1px)}
  .og-stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0}
  .og-stat-card.purple::before{background:var(--purple)}.og-stat-card.green::before{background:var(--green)}
  .og-stat-card.amber::before{background:#d97706}.og-stat-card.blue::before{background:var(--blue)}
  .og-stat-card.teal::before{background:var(--teal)}.og-stat-card.red::before{background:var(--red)}
  .og-stat-icon{font-size:18px;margin-bottom:10px}
  .og-stat-label{font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .og-stat-value{font-size:28px;font-weight:700;letter-spacing:-.03em;color:var(--text)}
  .og-stat-card.purple .og-stat-value{color:var(--purple)}
  .og-members-strip{margin:0 28px 24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
  .og-members-head{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
  .og-members-title{font-size:13.5px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:7px}
  .og-members-dot{width:7px;height:7px;border-radius:50%;background:var(--purple)}
  .og-members-count{font-size:11px;font-family:var(--mono);background:var(--purple-light);color:var(--purple);padding:2px 7px;border-radius:20px}
  .og-members-list{display:flex;flex-wrap:wrap;gap:0}
  .og-member-row{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid #faf9f8;flex:1 1 280px;min-width:0;transition:background .12s}
  .og-member-row:last-child{border-bottom:none}.og-member-row:hover{background:#faf9f8}
  .og-member-avatar{width:32px;height:32px;border-radius:8px;background:var(--purple-light);color:var(--purple);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .og-member-info{flex:1;min-width:0}
  .og-member-name{font-size:12.5px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .og-member-email{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .og-member-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap;flex-shrink:0}
  .og-member-badge.active{background:var(--green-bg);color:var(--green)}
  .og-member-badge.pending{background:#fef9c3;color:var(--amber)}
  .og-member-badge.inactive{background:var(--red-bg);color:var(--red)}
  .og-members-empty{padding:24px 18px;text-align:center;color:var(--muted);font-size:13px}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .og-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}

  /* ── ADD MEMBER MODAL (inlined) ── */
  .ams-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)}
  .ams-modal{background:#fff;border-radius:16px;padding:28px;width:440px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:ams-in .16s ease}
  @keyframes ams-in{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  .ams-title{font-size:17px;font-weight:700;color:#7c3aed;margin-bottom:4px;font-family:'DM Sans',sans-serif}
  .ams-sub{font-size:12.5px;color:#78716c;margin-bottom:20px;font-family:'DM Sans',sans-serif}
  .ams-input-wrap{display:flex;gap:8px;margin-bottom:16px}
  .ams-input{flex:1;padding:9px 13px;border:1.5px solid #e7e4df;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13.5px;color:#1c1917;outline:none;transition:border-color .15s}
  .ams-input:focus{border-color:#7c3aed}.ams-input::placeholder{color:#a8a29e}
  .ams-btn{padding:9px 16px;border-radius:8px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
  .ams-btn.primary{background:#7c3aed;color:#fff}.ams-btn.primary:hover{background:#6d28d9}.ams-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .ams-btn.ghost{background:transparent;color:#78716c;border:1px solid #e7e4df}.ams-btn.ghost:hover{background:#f5f3ef}
  .ams-result{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:#faf9f8;border:1px solid #e7e4df;margin-bottom:12px}
  .ams-result-avatar{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ams-result-info{flex:1;min-width:0}
  .ams-result-email{font-size:13px;font-weight:500;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'DM Sans',sans-serif}
  .ams-result-label{font-size:11px;color:#78716c;font-family:'DM Mono',monospace}
  .ams-status{font-size:13px;padding:10px 12px;border-radius:8px;font-family:'DM Sans',sans-serif;text-align:center}
  .ams-status.success{background:#dcfce7;color:#15803d}.ams-status.error{background:#fee2e2;color:#dc2626}.ams-status.info{background:#ede9fe;color:#7c3aed}
  .ams-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
`;

interface Organization { id: string; name: string; logo: string | null; }

function initials(name: string) {
  return name ? name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "?";
}

/* ─── INLINED ADD MEMBER MODAL ─── */
interface AddMemberProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
}

function AddMemberModal({ organizationId, organizationName, onClose }: AddMemberProps) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{ type: "success"|"error"|"info"; msg: string }|null>(null);
  const [found, setFound]     = useState<{ id: string; email: string }|null>(null);

  const searchUser = async () => {
    if (!email.trim()) return;
    setLoading(true); setStatus(null); setFound(null);
    const { data, error } = await supabase
      .from("profiles").select("id,email,role")
      .eq("email", email.trim().toLowerCase()).single();
    setLoading(false);
    if (error || !data) { setStatus({ type:"error", msg:"No user found with that email address." }); return; }
    if (data.role === "organization") { setStatus({ type:"error", msg:"This user is an organization owner and cannot be added as a member." }); return; }
    setFound({ id: data.id, email: data.email });
    setStatus({ type:"info", msg:"User found — click Add to invite them." });
  };

  const addMember = async () => {
    if (!found) return;
    setLoading(true); setStatus(null);
    const { data:{ user } } = await supabase.auth.getUser(); if (!user) return;

    // Check already a member of this org
    const { data: existing } = await supabase.from("profiles").select("organization_id").eq("id", found.id).single();
    if (existing?.organization_id === organizationId) {
      setStatus({ type:"error", msg:"This user is already in your organization." });
      setLoading(false); return;
    }

    // Check for existing pending invite — table is organization_invites
    const { data: existingInvite } = await supabase
      .from("organization_invites").select("id,status")
      .eq("organization_id", organizationId).eq("email", found.email).single();
    if (existingInvite?.status === "pending") {
      setStatus({ type:"error", msg:"An invite has already been sent to this user." });
      setLoading(false); return;
    }

    // Insert invite
    const { error: inviteErr } = await supabase.from("organization_invites").insert({
      organization_id: organizationId,
      email:           found.email,
      invited_by:      user.id,
      status:          "pending",
    });
    if (inviteErr) { setStatus({ type:"error", msg:"Failed to invite: " + inviteErr.message }); setLoading(false); return; }

    // Notify user via activity_logs — they accept in their inbox
    await supabase.from("activity_logs").insert({
      user_id:  found.id,
      action:   "org_invite_received",
      metadata: {
        organization_id:   organizationId,
        organization_name: organizationName,
        invited_by:        user.id,
        status:            "pending",
      },
    });

    setStatus({ type:"success", msg:`Invitation sent to ${found.email}. They will see it in their inbox.` });
    setFound(null); setEmail("");
    setLoading(false);
    // Don't call onMemberAdded yet — member list updates when they accept
  };

  return (
    <div className="ams-backdrop" onClick={onClose}>
      <div className="ams-modal" onClick={e => e.stopPropagation()}>
        <div className="ams-title">Add Team Member</div>
        <div className="ams-sub">Search by email to add someone to <strong>{organizationName}</strong></div>
        <div className="ams-input-wrap">
          <input className="ams-input" type="email" placeholder="Enter email address…"
            value={email} onChange={e => { setEmail(e.target.value); setStatus(null); setFound(null); }}
            onKeyDown={e => e.key === "Enter" && searchUser()} autoFocus/>
          <button className="ams-btn primary" onClick={searchUser} disabled={loading || !email.trim()}>
            {loading ? "…" : "Search"}
          </button>
        </div>
        {found && (
          <div className="ams-result">
            <div className="ams-result-avatar">{found.email[0].toUpperCase()}</div>
            <div className="ams-result-info">
              <div className="ams-result-email">{found.email}</div>
              <div className="ams-result-label">Ready to add</div>
            </div>
            <button className="ams-btn primary" onClick={addMember} disabled={loading}>
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
        )}
        {status && <div className={`ams-status ${status.type}`}>{status.msg}</div>}
        <div className="ams-footer">
          <button className="ams-btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function OrganizationDashboard() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [organization, setOrganization]   = useState<Organization|null>(null);
  const [loading, setLoading]             = useState(true);
  const [statsLoading, setStatsLoading]   = useState(true);
  const [members, setMembers]             = useState<any[]>([]);
  const [stats, setStats]                 = useState({ totalDocs:0, signed:0, pending:0, members:0, activeMembers:0 });

  useEffect(() => {
    const id = "og-dash-styles";
    if (!document.getElementById(id)) { const el = document.createElement("style"); el.id=id; el.textContent=STYLES; document.head.appendChild(el); }
  }, []);

  const loadData = async () => {
    const { data:{ user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return; }
    const { data, error } = await supabase.from("organizations").select("id,name,logo").eq("owner_id", user.id).single();
    if (error) console.error("Error loading organization:", error.message);
    else setOrganization(data);
    setLoading(false);
    if (!data?.id) return;
    setStatsLoading(true);
    const [docsRes, membersRes, invitesRes] = await Promise.all([
      supabase.from("documents").select("status").eq("owner_id", user.id).neq("status","deleted"),
      supabase.from("profiles").select("id,email,status").eq("organization_id", data.id),
      supabase.from("organization_invites").select("id,email,status").eq("organization_id", data.id).eq("status","pending"),
    ]);
    const docs    = docsRes.data    || [];
    const mems    = membersRes.data || [];
    const invites = invitesRes.data || [];
    // Show accepted members + pending invites (pending badge until they accept)
    const pendingRows = invites
      .filter((inv:any) => !mems.find((m:any) => m.email === inv.email))
      .map((inv:any) => ({ id: inv.id, email: inv.email, status: "pending" }));
    const allMems = [...mems, ...pendingRows];
    setStats({
      totalDocs:     docs.length,
      signed:        docs.filter((d:any) => d.status==="signed").length,
      pending:       docs.filter((d:any) => d.status==="pending"||d.status==="draft").length,
      members:       allMems.length,
      activeMembers: mems.filter((m:any) => !m.status||m.status==="active").length,
    });
    setMembers(allMems.slice(0, 8));
    setStatsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return (
    <DashboardLayout>
      <div className="dashboard-page" style={{ padding:28 }}>
        <p style={{ color:"#78716c", fontSize:14 }}>Loading organization…</p>
      </div>
    </DashboardLayout>
  );

  if (!organization) return (
    <DashboardLayout>
      <div className="dashboard-page" style={{ padding:28 }}>
        <p style={{ color:"#dc2626", fontSize:14 }}>No organization found. Please complete your organization setup.</p>
      </div>
    </DashboardLayout>
  );

  const cards = [
    { label:"Documents",      value:stats.totalDocs,     icon:"📄", color:"purple" },
    { label:"Signed",         value:stats.signed,        icon:"✍️",  color:"green"  },
    { label:"Pending",        value:stats.pending,       icon:"⏳",  color:"amber"  },
    { label:"Team Members",   value:stats.members,       icon:"👥",  color:"blue"   },
    { label:"Active Members", value:stats.activeMembers, icon:"✅",  color:"teal"   },
  ];

  return (
    <DashboardLayout>
      <div className="dashboard-page">

        {/* HEADER */}
        <div className="og-page-header">
          <div className="og-org-info">
            {organization.logo
              ? <img src={organization.logo} alt={organization.name} className="og-logo" crossOrigin="anonymous"
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
              : <div className="og-logo-fallback">{organization.name[0]?.toUpperCase()}</div>
            }
            <div>
              <div className="og-org-name">{organization.name}</div>
              <div className="og-org-sub">Organization Dashboard</div>
            </div>
          </div>
          <div className="og-header-actions">
            <button className="og-btn-invite" onClick={() => setShowAddMember(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
              Add Member
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="og-stats">
          {statsLoading
            ? Array.from({length:5}).map((_,i) => (
                <div key={i} className="og-stat-card" style={{minHeight:100}}>
                  <div className="og-skel" style={{width:24,height:24,borderRadius:6,marginBottom:10}}/>
                  <div className="og-skel" style={{width:70,height:9,marginBottom:6}}/>
                  <div className="og-skel" style={{width:40,height:28}}/>
                </div>
              ))
            : cards.map(card => (
                <div key={card.label} className={`og-stat-card ${card.color}`}>
                  <div className="og-stat-icon">{card.icon}</div>
                  <div className="og-stat-label">{card.label}</div>
                  <div className="og-stat-value">{card.value}</div>
                </div>
              ))
          }
        </div>

        {/* MEMBERS STRIP */}
        <div className="og-members-strip">
          <div className="og-members-head">
            <div className="og-members-title"><div className="og-members-dot"/>Team Members</div>
            {members.length > 0 && <span className="og-members-count">{stats.members}</span>}
          </div>
          {statsLoading ? (
            <div style={{padding:"12px 18px"}}>
              {Array.from({length:3}).map((_,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div className="og-skel" style={{width:32,height:32,borderRadius:8}}/>
                  <div style={{flex:1}}>
                    <div className="og-skel" style={{width:"45%",height:10,marginBottom:5}}/>
                    <div className="og-skel" style={{width:"65%",height:9}}/>
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="og-members-empty">No members yet — click <strong>Add Member</strong> to invite your team.</div>
          ) : (
            <div className="og-members-list">
              {members.map((m:any) => (
                <div key={m.id} className="og-member-row">
                  <div className="og-member-avatar">{initials(m.email||"?")}</div>
                  <div className="og-member-info">
                    <div className="og-member-name">{m.email?.split("@")[0]||"Unnamed"}</div>
                    <div className="og-member-email">{m.email}</div>
                  </div>
                  <span className={`og-member-badge ${m.status==="inactive"?"inactive":m.status==="pending"?"pending":"active"}`}>
                    {m.status==="inactive"?"Inactive":m.status==="pending"?"Pending":"Active"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        

        {/* ADD MEMBER MODAL */}
        {showAddMember && organization && (
          <AddMemberModal
            organizationId={organization.id}
            organizationName={organization.name}
            onClose={() => setShowAddMember(false)}
          />
        )}

      </div>
    </DashboardLayout>
  );
}