import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

interface Member {
  id: string;
  email: string;
  status: string;
  isPending?: boolean;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root{--purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;--green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;--amber-bg:#fef9c3;--red:#dc2626;--red-bg:#fee2e2;--surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .mp-root{font-family:var(--font);color:var(--text);padding:32px 28px 64px;max-width:900px}
  .mp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px}
  .mp-heading{font-size:20px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px}
  .mp-badge-count{background:var(--purple-light);color:var(--purple);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;font-family:var(--mono)}
  .mp-badge-pending{background:var(--amber-bg);color:var(--amber);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;font-family:var(--mono)}
  .mp-btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}
  .mp-btn-primary:hover{background:var(--purple-dark)}
  .mp-tabs{display:flex;gap:4px;background:var(--bg);border-radius:8px;padding:3px;margin-bottom:16px;width:fit-content}
  .mp-tab{padding:6px 14px;border-radius:6px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s}
  .mp-tab.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .mp-search{width:100%;max-width:380px;padding:9px 14px;border:1.5px solid var(--border);border-radius:9px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;transition:border-color .15s;margin-bottom:16px;box-sizing:border-box;display:block}
  .mp-search:focus{border-color:var(--purple)}
  .mp-table{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
  .mp-thead{display:grid;grid-template-columns:44px 1fr 1fr 100px 90px;gap:12px;padding:10px 18px;border-bottom:1px solid var(--border);background:var(--bg)}
  .mp-thead span{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
  .mp-row{display:grid;grid-template-columns:44px 1fr 1fr 100px 90px;gap:12px;padding:12px 18px;border-bottom:1px solid #faf9f8;align-items:center;transition:background .12s}
  .mp-row:last-child{border-bottom:none}
  .mp-row:hover{background:#faf9f8}
  .mp-avatar{width:34px;height:34px;border-radius:9px;background:var(--purple-light);color:var(--purple);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .mp-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mp-email{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mp-status{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;white-space:nowrap}
  .mp-status.active{background:var(--green-bg);color:var(--green)}
  .mp-status.pending{background:var(--amber-bg);color:var(--amber)}
  .mp-status.inactive{background:var(--red-bg);color:var(--red)}
  .mp-remove{padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;font-family:var(--font);font-size:11.5px;cursor:pointer;color:var(--red);transition:all .15s}
  .mp-remove:hover{background:var(--red-bg);border-color:var(--red)}
  .mp-empty{text-align:center;padding:52px 0;color:var(--muted)}
  .mp-empty-icon{font-size:40px;opacity:.35;margin-bottom:12px}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .mp-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}

  /* Invite modal */
  .mp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(3px)}
  .mp-modal{background:#fff;border-radius:14px;padding:26px;width:420px;max-width:96vw;box-shadow:0 20px 60px rgba(0,0,0,.16);animation:mp-in .15s ease}
  @keyframes mp-in{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
  .mp-modal-title{font-size:16px;font-weight:700;color:var(--purple);margin-bottom:4px}
  .mp-modal-sub{font-size:12.5px;color:var(--muted);margin-bottom:16px}
  .mp-input-row{display:flex;gap:8px;margin-bottom:12px}
  .mp-input{flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;transition:border-color .15s}
  .mp-input:focus{border-color:var(--purple)}
  .mp-modal-btn{padding:9px 16px;border-radius:8px;border:none;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
  .mp-modal-btn.primary{background:var(--purple);color:#fff}.mp-modal-btn.primary:hover{background:var(--purple-dark)}.mp-modal-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .mp-modal-btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.mp-modal-btn.ghost:hover{background:var(--bg)}
  .mp-found{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:#faf9f8;border:1px solid var(--border);margin-bottom:10px}
  .mp-found-avatar{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .mp-msg{font-size:13px;padding:9px 12px;border-radius:8px;margin-bottom:4px}
  .mp-msg.success{background:var(--green-bg);color:var(--green)}.mp-msg.error{background:var(--red-bg);color:var(--red)}.mp-msg.info{background:var(--purple-light);color:var(--purple)}
  .mp-modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
`;

export default function OrgMembersPage() {
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [orgId, setOrgId]       = useState("");
  const [orgName, setOrgName]   = useState("");
  const [tab, setTab]           = useState<"all"|"active"|"pending">("all");
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg]       = useState<{type:"success"|"error"|"info";msg:string}|null>(null);
  const [foundUser, setFoundUser]       = useState<{id:string;email:string}|null>(null);
  const [planLimit, setPlanLimit]       = useState<number>(20); // default starter

  useEffect(() => {
    const id = "mp-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: org } = await supabase
      .from("organizations").select("id,name").eq("owner_id", user.id).single();
    if (!org) { setLoading(false); return; }
    setOrgId(org.id); setOrgName(org.name);

    const [profRes, invRes] = await Promise.all([
      supabase.from("profiles")
        .select("id,email,status")
        .eq("organization_id", org.id),
      supabase.from("organization_invites")
        .select("id,email,status")
        .eq("organization_id", org.id)
        .eq("status", "pending"),
    ]);

    const accepted: Member[] = (profRes.data || []).map((m: any) => ({
      id: m.id, email: m.email, status: m.status || "active",
    }));

    const pending: Member[] = (invRes.data || [])
      .filter((inv: any) => !accepted.find(a => a.email === inv.email))
      .map((inv: any) => ({
        id: inv.id, email: inv.email, status: "pending", isPending: true,
      }));

    setMembers([...accepted, ...pending]);

    // Fetch real plan member limit from subscriptions
    const { data: sub } = await supabase.from("subscriptions")
      .select("plan_id,member_limit,status,expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.member_limit !== undefined && sub.member_limit !== null) {
      setPlanLimit(sub.member_limit);
    } else if (sub?.plan_id === "org_enterprise") {
      setPlanLimit(Infinity);
    } else {
      setPlanLimit(20); // no active sub = free trial, 20 default
    }

    setLoading(false);
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.email}?`)) return;
    if (m.isPending) {
      await supabase.from("organization_invites").delete().eq("id", m.id);
    } else {
      await supabase.from("profiles")
        .update({ organization_id: null, role: "individual" }).eq("id", m.id);
    }
    load();
  }

  async function searchUser() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteMsg(null); setFoundUser(null);
    const { data, error } = await supabase.from("profiles")
      .select("id,email,role").eq("email", inviteEmail.trim().toLowerCase()).single();
    setInviteLoading(false);
    if (error || !data) { setInviteMsg({ type:"error", msg:"No user found with that email." }); return; }
    if (data.role === "organization") { setInviteMsg({ type:"error", msg:"This user is an org owner." }); return; }
    if (members.find(m => m.email === data.email)) { setInviteMsg({ type:"error", msg:"Already a member or invited." }); return; }
    setFoundUser({ id: data.id, email: data.email });
    setInviteMsg({ type:"info", msg:"User found — click Send Invite." });
  }

  async function sendInvite() {
    if (!foundUser || !orgId) return;
    setInviteLoading(true); setInviteMsg(null);
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;

    // ── Enforce plan limits ──
    // Free: 0 paid members (trial only), Starter: 20, Growth: 100, Enterprise: unlimited
    // For now we enforce Starter limit (20) as default paid tier
    // In production this would check the subscriptions table
    const currentCount = members.filter(m => !m.isPending && m.status === "active").length;
    const PLAN_LIMIT = 20; // Starter plan default — update when billing is live
    if (currentCount >= PLAN_LIMIT) {
      setInviteMsg({
        type: "error",
        msg: `Your current plan allows up to ${PLAN_LIMIT} members. You have ${currentCount}. Please upgrade your plan in Billing to add more members.`
      });
      setInviteLoading(false); return;
    }

    const { error } = await supabase.from("organization_invites").insert({
      organization_id: orgId, email: foundUser.email,
      invited_by: user.id, status: "pending",
    });
    if (error) { setInviteMsg({ type:"error", msg:"Failed: " + error.message }); setInviteLoading(false); return; }

    await supabase.from("activity_logs").insert({
      user_id: foundUser.id, action: "org_invite_received",
      metadata: { organization_id: orgId, organization_name: orgName, invited_by: user.id, status: "pending" },
    });

    setInviteMsg({ type:"success", msg:`Invite sent to ${foundUser.email}!` });
    setFoundUser(null); setInviteEmail("");
    setInviteLoading(false);
    load();
  }

  const filtered = members.filter(m => {
    const s = tab === "all" || (tab === "active" && m.status === "active") || (tab === "pending" && m.status === "pending");
    const q = !search || m.email.toLowerCase().includes(search.toLowerCase());
    return s && q;
  });

  const pendingCount = members.filter(m => m.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="mp-root">

        {/* Header */}
        <div className="mp-header">
          <div className="mp-heading">
            Team Members
            {members.length > 0 && <span className="mp-badge-count">{members.length}</span>}
            {pendingCount > 0 && <span className="mp-badge-pending">{pendingCount} pending</span>}
            {planLimit !== Infinity && (
              <span style={{fontSize:10,fontFamily:"monospace",color:"var(--muted)",background:"var(--bg)",padding:"2px 8px",borderRadius:20,border:"1px solid var(--border)"}}>
                {members.filter(m=>!m.isPending&&m.status==="active").length}/{planLimit} limit
              </span>
            )}
          </div>
          <button className="mp-btn-primary" onClick={() => { setShowModal(true); setInviteMsg(null); setFoundUser(null); setInviteEmail(""); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
            </svg>
            Add Member
          </button>
        </div>

        {/* Tabs */}
        <div className="mp-tabs">
          {(["all","active","pending"] as const).map(t => (
            <button key={t} className={`mp-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
              {t==="all" ? `All (${members.length})` : t==="active" ? `Active (${members.filter(m=>m.status==="active").length})` : `Pending (${pendingCount})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <input className="mp-search" placeholder="Search by email…"
          value={search} onChange={e => setSearch(e.target.value)} />

        {/* Table */}
        <div className="mp-table">
          <div className="mp-thead">
            <span></span>
            <span>Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {loading && Array.from({length:4}).map((_,i) => (
            <div key={i} className="mp-row">
              <div className="mp-skel" style={{width:34,height:34,borderRadius:9}}/>
              <div><div className="mp-skel" style={{width:90,height:11,marginBottom:5}}/><div className="mp-skel" style={{width:130,height:9}}/></div>
              <div className="mp-skel" style={{width:150,height:10}}/>
              <div className="mp-skel" style={{width:60,height:20,borderRadius:20}}/>
              <div className="mp-skel" style={{width:60,height:26,borderRadius:6}}/>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="mp-empty">
              <div className="mp-empty-icon">👥</div>
              <p style={{fontWeight:500,color:"#44403c",marginBottom:4,fontSize:14}}>
                {search ? "No members match your search" : "No members yet"}
              </p>
              <span style={{fontSize:12}}>Click Add Member to invite your team</span>
            </div>
          )}

          {!loading && filtered.map(m => (
            <div key={m.id} className="mp-row">
              <div className="mp-avatar">{m.email[0]?.toUpperCase()}</div>
              <div>
                <div className="mp-name">{m.email.split("@")[0]}</div>
                {m.isPending && <div style={{fontSize:10,color:"#b45309",marginTop:1}}>Invite sent</div>}
              </div>
              <div className="mp-email">{m.email}</div>
              <span className={`mp-status ${m.status==="active"?"active":m.status==="pending"?"pending":"inactive"}`}>
                {m.status==="active"?"Active":m.status==="pending"?"Pending":"Inactive"}
              </span>
              <button className="mp-remove" onClick={()=>removeMember(m)}>
                {m.isPending ? "Cancel" : "Remove"}
              </button>
            </div>
          ))}
        </div>

        {/* Invite Modal */}
        {showModal && (
          <div className="mp-backdrop" onClick={()=>setShowModal(false)}>
            <div className="mp-modal" onClick={e=>e.stopPropagation()}>
              <div className="mp-modal-title">Add Team Member</div>
              <div className="mp-modal-sub">Search by email to invite someone to <strong>{orgName}</strong></div>
              <div className="mp-input-row">
                <input className="mp-input" type="email" placeholder="Email address…" autoFocus
                  value={inviteEmail}
                  onChange={e=>{setInviteEmail(e.target.value);setInviteMsg(null);setFoundUser(null);}}
                  onKeyDown={e=>e.key==="Enter"&&searchUser()}/>
                <button className="mp-modal-btn primary" onClick={searchUser} disabled={inviteLoading||!inviteEmail.trim()}>
                  {inviteLoading?"…":"Search"}
                </button>
              </div>
              {foundUser && (
                <div className="mp-found">
                  <div className="mp-found-avatar">{foundUser.email[0].toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="mp-name">{foundUser.email}</div>
                    <div style={{fontSize:11,color:"#16a34a"}}>Ready to invite</div>
                  </div>
                  <button className="mp-modal-btn primary" onClick={sendInvite} disabled={inviteLoading}>
                    {inviteLoading?"Sending…":"Send Invite"}
                  </button>
                </div>
              )}
              {inviteMsg && <div className={`mp-msg ${inviteMsg.type}`}>{inviteMsg.msg}</div>}
              <div className="mp-modal-footer">
                <button className="mp-modal-btn ghost" onClick={()=>setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}