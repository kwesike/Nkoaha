import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

interface Partnership {
  id: string;
  requester_id: string;
  partner_id: string;
  status: "pending" | "accepted" | "declined" | "ended";
  created_at: string;
  partner_org_name: string;
  partner_org_logo: string | null;
  partner_owner_email: string;
  member_count: number;
  direction: "sent" | "received";
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root{--purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;--green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;--amber-bg:#fef9c3;--red:#dc2626;--red-bg:#fee2e2;--surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .pp-root{font-family:var(--font);color:var(--text);padding:32px 28px 64px;max-width:960px}
  .pp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px}
  .pp-title{font-size:20px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px}
  .pp-count{background:var(--purple-light);color:var(--purple);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;font-family:var(--mono)}
  .pp-btn-primary{display:flex;align-items:center;gap:6px;padding:9px 18px;background:var(--purple);color:#fff;border:none;border-radius:9px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}
  .pp-btn-primary:hover{background:var(--purple-dark)}
  .pp-tabs{display:flex;gap:4px;background:var(--bg);border-radius:9px;padding:3px;margin-bottom:24px;width:fit-content}
  .pp-tab{padding:7px 16px;border-radius:7px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s;white-space:nowrap}
  .pp-tab.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .pp-grid{display:flex;flex-direction:column;gap:12px}
  .pp-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:16px;transition:box-shadow .15s;animation:pp-fade .3s both}
  .pp-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
  @keyframes pp-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .pp-card.accepted{border-left:3px solid var(--green)}
  .pp-card.pending{border-left:3px solid var(--amber)}
  .pp-card.ended,.pp-card.declined{border-left:3px solid #e7e4df;opacity:.65}
  .pp-org-logo{width:48px;height:48px;border-radius:12px;flex-shrink:0;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--purple-light);overflow:hidden}
  .pp-org-logo img{width:100%;height:100%;border-radius:10px;object-fit:cover}
  .pp-org-info{flex:1;min-width:0}
  .pp-org-name{font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pp-org-meta{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .pp-status-badge{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
  .pp-status-badge.accepted{background:var(--green-bg);color:var(--green)}
  .pp-status-badge.pending{background:var(--amber-bg);color:var(--amber)}
  .pp-status-badge.declined{background:var(--red-bg);color:var(--red)}
  .pp-status-badge.ended{background:var(--bg);color:var(--muted)}
  .pp-actions{display:flex;gap:8px;flex-shrink:0}
  .pp-btn{padding:7px 14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
  .pp-btn:hover{background:var(--bg)}
  .pp-btn.accept{background:var(--green);color:#fff;border-color:var(--green)}.pp-btn.accept:hover{background:#15803d}
  .pp-btn.decline{color:var(--red);border-color:var(--red)}.pp-btn.decline:hover{background:var(--red-bg)}
  .pp-btn.delink{color:var(--red);border-color:var(--border)}.pp-btn.delink:hover{background:var(--red-bg);border-color:var(--red)}
  .pp-direction{font-size:10px;font-family:var(--mono);color:var(--muted);background:var(--bg);padding:2px 6px;border-radius:4px}
  .pp-empty{text-align:center;padding:60px 0;color:var(--muted)}
  .pp-empty-icon{font-size:44px;opacity:.3;margin-bottom:14px}
  .pp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
  .pp-modal{background:#fff;border-radius:16px;padding:28px;width:480px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:pp-in .15s ease}
  @keyframes pp-in{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  .pp-modal-title{font-size:17px;font-weight:700;color:var(--purple);margin-bottom:4px}
  .pp-modal-sub{font-size:12.5px;color:var(--muted);margin-bottom:20px;line-height:1.6}
  .pp-input-row{display:flex;gap:8px;margin-bottom:12px}
  .pp-input{flex:1;padding:10px 13px;border:1.5px solid var(--border);border-radius:9px;font-family:var(--font);font-size:13.5px;color:var(--text);outline:none;transition:border-color .15s}
  .pp-input:focus{border-color:var(--purple)}.pp-input::placeholder{color:#a8a29e}
  .pp-modal-btn{padding:10px 18px;border-radius:9px;border:none;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
  .pp-modal-btn.primary{background:var(--purple);color:#fff}.pp-modal-btn.primary:hover{background:var(--purple-dark)}.pp-modal-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .pp-modal-btn.ghost{background:transparent;color:var(--muted);border:1.5px solid var(--border)}.pp-modal-btn.ghost:hover{background:var(--bg)}
  .pp-found-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:#faf9f8;border:1.5px solid var(--border);margin-bottom:12px}
  .pp-found-logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
  .pp-msg{font-size:13px;padding:10px 13px;border-radius:8px;margin-bottom:4px}
  .pp-msg.success{background:var(--green-bg);color:var(--green)}.pp-msg.error{background:var(--red-bg);color:var(--red)}.pp-msg.info{background:var(--purple-light);color:var(--purple)}
  .pp-modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .pp-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}
`;

export default function PartnershipsPage() {
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"active"|"pending"|"ended">("active");
  const [myOrgId, setMyOrgId]           = useState("");
  const [myOrgName, setMyOrgName]       = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [searchEmail, setSearchEmail]   = useState("");
  const [searching, setSearching]       = useState(false);
  const [foundOrg, setFoundOrg]         = useState<{id:string;name:string;logo:string|null;owner_email:string}|null>(null);
  const [msg, setMsg]                   = useState<{type:"success"|"error"|"info";text:string}|null>(null);
  const [sending, setSending]           = useState(false);
  const [actioning, setActioning]       = useState<string|null>(null);

  useEffect(() => {
    const id = "pp-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data: org } = await supabase
      .from("organizations").select("id,name").eq("owner_id", user.id).maybeSingle();
    if (!org) return;
    setMyOrgId(org.id); setMyOrgName(org.name);
    await loadPartnerships(org.id);
  }

  const loadPartnerships = useCallback(async (orgId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_partnerships")
      .select("*")
      .or(`requester_id.eq.${orgId},partner_id.eq.${orgId}`)
      .order("created_at", { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const enriched: Partnership[] = await Promise.all(data.map(async (p: any) => {
      const isRequester  = p.requester_id === orgId;
      const partnerOrgId = isRequester ? p.partner_id : p.requester_id;

      const { data: partnerOrg } = await supabase
        .from("organizations").select("id,name,logo,owner_id").eq("id", partnerOrgId).maybeSingle();

      let partnerOwnerEmail = "";
      if (partnerOrg?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles").select("email").eq("id", partnerOrg.owner_id).maybeSingle();
        partnerOwnerEmail = ownerProfile?.email || "";
      }

      const { count } = await supabase.from("profiles")
        .select("id", { count: "exact", head: true }).eq("organization_id", partnerOrgId);

      return {
        id:                  p.id,
        requester_id:        p.requester_id,
        partner_id:          p.partner_id,
        status:              p.status,
        created_at:          p.created_at,
        partner_org_name:    partnerOrg?.name || "Unknown Organization",
        partner_org_logo:    partnerOrg?.logo || null,
        partner_owner_email: partnerOwnerEmail,
        member_count:        count || 0,
        direction:           isRequester ? "sent" : "received",
      };
    }));

    setPartnerships(enriched);
    setLoading(false);
  }, []);

  async function searchOrg() {
    if (!searchEmail.trim()) return;
    setSearching(true); setMsg(null); setFoundOrg(null);

    const emailToSearch = searchEmail.trim().toLowerCase();

    // ── KEY FIX: use ilike + limit(1) instead of .eq + .maybeSingle()
    // .maybeSingle() throws PGRST116 if no row found — ilike is case-insensitive
    const { data: profiles, error: pe } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", emailToSearch)
      .limit(1);

    if (pe || !profiles || profiles.length === 0) {
      setMsg({ type:"error", text:`No account found with email "${emailToSearch}". Make sure the organization owner is registered.` });
      setSearching(false); return;
    }

    const ownerProfile = profiles[0];

    // Find their organization — use limit(1) not .maybeSingle()
    const { data: orgs, error: oe } = await supabase
      .from("organizations")
      .select("id, name, logo")
      .eq("owner_id", ownerProfile.id)
      .limit(1);

    if (oe || !orgs || orgs.length === 0) {
      setMsg({ type:"error", text:"This user does not own an organization." });
      setSearching(false); return;
    }

    const org = orgs[0];

    if (org.id === myOrgId) {
      setMsg({ type:"error", text:"You cannot partner with your own organization." });
      setSearching(false); return;
    }

    // Check for existing partnership — use limit(1) not .maybeSingle()
    const { data: existing } = await supabase
      .from("organization_partnerships")
      .select("id, status")
      .or(`and(requester_id.eq.${myOrgId},partner_id.eq.${org.id}),and(requester_id.eq.${org.id},partner_id.eq.${myOrgId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      const ex = existing[0];
      if (ex.status === "accepted") {
        setMsg({ type:"error", text:"You are already partnered with this organization." });
        setSearching(false); return;
      }
      if (ex.status === "pending") {
        setMsg({ type:"error", text:"A partnership request already exists between these organizations." });
        setSearching(false); return;
      }
    }

    setFoundOrg({ id: org.id, name: org.name, logo: org.logo, owner_email: ownerProfile.email });
    setMsg({ type:"info", text:`Found: ${org.name} — click Send Request to partner with them.` });
    setSearching(false);
  }

  async function sendRequest() {
    if (!foundOrg || !myOrgId) return;
    setSending(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;

    const { error } = await supabase.from("organization_partnerships").insert({
      requester_id: myOrgId,
      partner_id:   foundOrg.id,
      status:       "pending",
    });
    if (error) { setMsg({ type:"error", text:"Failed to send request: " + error.message }); setSending(false); return; }

    // Notify partner org owner via activity_logs
    const { data: partnerOrg } = await supabase
      .from("organizations").select("owner_id").eq("id", foundOrg.id).maybeSingle();
    if (partnerOrg?.owner_id) {
      await supabase.from("activity_logs").insert({
        user_id:  partnerOrg.owner_id,
        action:   "partnership_invite_received",
        metadata: {
          requester_org_id:   myOrgId,
          requester_org_name: myOrgName,
          requester_owner_id: user.id,
          status:             "pending",
        },
      });
    }

    setMsg({ type:"success", text:`Partnership request sent to ${foundOrg.name}! They will see it in their inbox and partnerships page.` });
    setFoundOrg(null); setSearchEmail("");
    setSending(false);
    await loadPartnerships(myOrgId);
  }

  async function acceptPartnership(p: Partnership) {
    setActioning(p.id);
    await supabase.from("organization_partnerships")
      .update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", p.id);

    const { data: requesterOrg } = await supabase
      .from("organizations").select("owner_id").eq("id", p.requester_id).maybeSingle();
    if (requesterOrg?.owner_id) {
      await supabase.from("activity_logs").insert({
        user_id:  requesterOrg.owner_id,
        action:   "partnership_accepted",
        metadata: { partner_org_id: myOrgId, partner_org_name: myOrgName },
      });
    }
    setActioning(null);
    await loadPartnerships(myOrgId);
  }

  async function declinePartnership(p: Partnership) {
    setActioning(p.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("organization_partnerships")
      .update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", p.id);
    // Log to audit
    if (user) {
      await supabase.from("activity_logs").insert({
        user_id:  user.id,
        action:   "partnership_declined",
        metadata: { partner_org_name: p.partner_org_name, direction: p.direction },
      });
    }
    setActioning(null);
    await loadPartnerships(myOrgId);
  }

  async function endPartnership(p: Partnership) {
    if (!confirm(`End partnership with ${p.partner_org_name}?\n\nMembers will no longer be able to route documents to each other.`)) return;
    setActioning(p.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("organization_partnerships")
      .update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", p.id);
    // Log to audit for both orgs
    if (user) {
      await supabase.from("activity_logs").insert({
        user_id:  user.id,
        action:   "partnership_ended",
        metadata: { partner_org_name: p.partner_org_name, partner_org_id: p.partner_id },
      });
    }
    // Notify partner org owner too
    const { data: partnerOrg } = await supabase.from("organizations")
      .select("owner_id").eq("id", p.direction==="sent"?p.partner_id:p.requester_id).maybeSingle();
    if (partnerOrg?.owner_id) {
      await supabase.from("activity_logs").insert({
        user_id:  partnerOrg.owner_id,
        action:   "partnership_ended",
        metadata: { partner_org_name: myOrgName, status: "pending" },
      });
    }
    setActioning(null);
    await loadPartnerships(myOrgId);
  }

  const filtered = partnerships.filter(p => {
    if (tab === "active")  return p.status === "accepted";
    if (tab === "pending") return p.status === "pending";
    return p.status === "ended" || p.status === "declined";
  });

  const activeCnt  = partnerships.filter(p => p.status === "accepted").length;
  const pendingCnt = partnerships.filter(p => p.status === "pending").length;

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const dy = Math.floor(diff / 86400000);
    if (dy === 0) return "today";
    if (dy === 1) return "yesterday";
    if (dy < 30)  return `${dy}d ago`;
    return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  }

  return (
    <DashboardLayout>
      <div className="pp-root">

        {/* Header */}
        <div className="pp-header">
          <div className="pp-title">
            Partnerships
            {activeCnt > 0 && <span className="pp-count">{activeCnt} active</span>}
            {pendingCnt > 0 && (
              <span style={{background:"#fef9c3",color:"#b45309",fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,fontFamily:"monospace"}}>
                {pendingCnt} pending
              </span>
            )}
          </div>
          <button className="pp-btn-primary"
            onClick={() => { setShowModal(true); setMsg(null); setFoundOrg(null); setSearchEmail(""); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            New Partnership
          </button>
        </div>

        {/* Tabs */}
        <div className="pp-tabs">
          <button className={`pp-tab${tab==="active"?" active":""}`} onClick={()=>setTab("active")}>
            Active {activeCnt > 0 && `(${activeCnt})`}
          </button>
          <button className={`pp-tab${tab==="pending"?" active":""}`} onClick={()=>setTab("pending")}>
            Pending {pendingCnt > 0 && `(${pendingCnt})`}
          </button>
          <button className={`pp-tab${tab==="ended"?" active":""}`} onClick={()=>setTab("ended")}>
            Ended
          </button>
        </div>

        {/* Cards */}
        <div className="pp-grid">
          {loading && Array.from({length:2}).map((_,i) => (
            <div key={i} className="pp-card">
              <div className="pp-skel" style={{width:48,height:48,borderRadius:12,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div className="pp-skel" style={{width:"40%",height:14,marginBottom:8}}/>
                <div className="pp-skel" style={{width:"60%",height:10}}/>
              </div>
              <div className="pp-skel" style={{width:70,height:28,borderRadius:8}}/>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="pp-empty">
              <div className="pp-empty-icon">🤝</div>
              <p style={{fontWeight:600,color:"#44403c",marginBottom:6,fontSize:15}}>
                {tab==="active" ? "No active partnerships" : tab==="pending" ? "No pending requests" : "No ended partnerships"}
              </p>
              <span style={{fontSize:12.5,lineHeight:1.6,display:"block",maxWidth:380,margin:"0 auto"}}>
                {tab==="active" ? "Partner with other organizations so members can route documents across teams." :
                 tab==="pending" ? "No requests are waiting for a response." :
                 "Ended or declined partnerships appear here."}
              </span>
              {tab==="active" && (
                <div style={{marginTop:16}}>
                  <button className="pp-btn-primary" style={{margin:"0 auto"}} onClick={()=>setShowModal(true)}>
                    Send Partnership Request
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && filtered.map(p => (
            <div key={p.id} className={`pp-card ${p.status}`}>
              <div className="pp-org-logo">
                {p.partner_org_logo
                  ? <img src={p.partner_org_logo} alt={p.partner_org_name} crossOrigin="anonymous"
                      onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>
                  : p.partner_org_name[0]?.toUpperCase()
                }
              </div>
              <div className="pp-org-info">
                <div className="pp-org-name">{p.partner_org_name}</div>
                <div className="pp-org-meta">
                  <span>✉️ {p.partner_owner_email}</span>
                  <span>👥 {p.member_count} member{p.member_count!==1?"s":""}</span>
                  <span>🕐 {timeAgo(p.created_at)}</span>
                  <span className="pp-direction">{p.direction==="sent"?"You requested":"They requested"}</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                <span className={`pp-status-badge ${p.status}`}>
                  {p.status==="accepted"?"✓ Active":p.status==="pending"?"⏳ Pending":p.status==="declined"?"✗ Declined":"Ended"}
                </span>
                <div className="pp-actions">
                  {p.status==="pending" && p.direction==="received" && (
                    <>
                      <button className="pp-btn accept" disabled={actioning===p.id} onClick={()=>acceptPartnership(p)}>
                        {actioning===p.id ? "…" : "Accept"}
                      </button>
                      <button className="pp-btn decline" disabled={actioning===p.id} onClick={()=>declinePartnership(p)}>
                        Decline
                      </button>
                    </>
                  )}
                  {p.status==="pending" && p.direction==="sent" && (
                    <button className="pp-btn" disabled={actioning===p.id} onClick={()=>declinePartnership(p)}
                      style={{color:"var(--muted)"}}>
                      Cancel
                    </button>
                  )}
                  {p.status==="accepted" && (
                    <button className="pp-btn delink" disabled={actioning===p.id} onClick={()=>endPartnership(p)}>
                      {actioning===p.id ? "…" : "Delink"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* New Partnership Modal */}
        {showModal && (
          <div className="pp-backdrop" onClick={()=>setShowModal(false)}>
            <div className="pp-modal" onClick={e=>e.stopPropagation()}>
              <div className="pp-modal-title">New Partnership Request</div>
              <div className="pp-modal-sub">
                Enter the <strong>email address of the organization owner</strong> you want to partner with.
                Once they accept, members of both organizations can route documents to each other.
              </div>
              <div className="pp-input-row">
                <input className="pp-input" type="email"
                  placeholder="Organization owner's email…" autoFocus
                  value={searchEmail}
                  onChange={e => { setSearchEmail(e.target.value); setMsg(null); setFoundOrg(null); }}
                  onKeyDown={e => e.key === "Enter" && searchOrg()} />
                <button className="pp-modal-btn primary" onClick={searchOrg}
                  disabled={searching || !searchEmail.trim()}>
                  {searching ? "…" : "Search"}
                </button>
              </div>

              {foundOrg && (
                <div className="pp-found-card">
                  <div className="pp-found-logo">
                    {foundOrg.logo
                      ? <img src={foundOrg.logo} alt={foundOrg.name}
                          style={{width:"100%",height:"100%",borderRadius:8,objectFit:"cover"}} crossOrigin="anonymous"/>
                      : foundOrg.name[0]?.toUpperCase()
                    }
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--text)",marginBottom:2}}>{foundOrg.name}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>{foundOrg.owner_email}</div>
                  </div>
                  <button className="pp-modal-btn primary" onClick={sendRequest} disabled={sending}>
                    {sending ? "Sending…" : "Send Request"}
                  </button>
                </div>
              )}

              {msg && <div className={`pp-msg ${msg.type}`}>{msg.text}</div>}

              <div className="pp-modal-footer">
                <button className="pp-modal-btn ghost" onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}