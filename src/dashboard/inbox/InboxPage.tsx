import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import DashboardLayout from "../layout/DashboardLayout";

interface InboxItem {
  id: string;
  action: string;
  document_id: string;
  document_title: string;
  metadata: any;
  created_at: string;
  status: "pending" | "actioned";
  is_final: boolean;
  read_at?: string | null;
  step_order: number;
  total_steps: number;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{
    --purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;
    --green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;--amber-bg:#fef9c3;
    --red:#dc2626;--red-bg:#fee2e2;--blue:#2563eb;--blue-bg:#dbeafe;
    --surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
  }
  .ib-root{font-family:var(--font);color:var(--text);max-width:860px;margin:0 auto;padding:32px 28px 64px}
  .ib-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
  .ib-title{font-size:20px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px}
  .ib-count{display:inline-flex;align-items:center;justify-content:center;background:#dc2626;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;border-radius:20px;padding:0 6px;font-family:var(--mono)}
  .ib-tabs{display:flex;gap:4px;background:var(--bg);border-radius:8px;padding:3px}
  .ib-tab{padding:6px 14px;border-radius:6px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s}
  .ib-tab.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .ib-list{display:flex;flex-direction:column;gap:10px}
  .ib-item{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:14px;transition:box-shadow .15s}
  .ib-item:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)}
  .ib-item.pending{border-left:3px solid var(--purple)}
  .ib-item.actioned{opacity:.65}
  .ib-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
  .ib-body{flex:1;min-width:0}
  .ib-doc-title{font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ib-meta{font-size:12px;color:var(--muted);margin-bottom:8px}
  .ib-step-chain{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:10px}
  .ib-step{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
  .ib-step.done{background:#dcfce7;color:#16a34a}
  .ib-step.current{background:var(--purple);color:#fff;box-shadow:0 0 0 3px var(--purple-light)}
  .ib-step.waiting{background:var(--border);color:var(--muted)}
  .ib-step-arrow{color:var(--muted);font-size:12px}
  .ib-actions{display:flex;gap:8px;flex-wrap:wrap}
  .ib-btn{padding:7px 16px;border-radius:7px;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;border:none;transition:all .15s;display:flex;align-items:center;gap:6px}
  .ib-btn.forward{background:var(--purple);color:#fff}.ib-btn.forward:hover{background:var(--purple-dark)}
  .ib-btn.final{background:#16a34a;color:#fff}.ib-btn.final:hover{background:#15803d}
  .ib-btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.ib-btn.ghost:hover{background:var(--bg)}
  .ib-time{font-size:11px;font-family:var(--mono);color:var(--muted);flex-shrink:0;margin-top:2px}
  .ib-empty{text-align:center;padding:48px 0;color:var(--muted)}
  .ib-empty-icon{font-size:36px;margin-bottom:10px;opacity:.4}
  .ib-empty p{font-size:14px;font-weight:500;color:#44403c;margin-bottom:4px}
  .ib-preview{font-size:12px;padding:6px 10px;border-radius:7px;margin-top:4px;max-width:420px;line-height:1.5}
  .ib-preview.comment{background:#f5f3ef;color:var(--text);border-left:3px solid var(--purple);font-style:italic}
  .ib-preview.proof{background:var(--purple-light);color:var(--purple)}
  .ib-preview.notify{background:var(--green-bg);color:var(--green)}
  .ib-preview.declined{background:var(--red-bg);color:var(--red)}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .ib-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}
`;

function getIcon(action: string, is_final: boolean) {
  switch(action) {
    case "org_invite_received":      return { icon:"🏢", bg:"#dbeafe",   color:"#2563eb" };
    case "partnership_invite_received":
    case "partnership_accepted":     return { icon:"🤝", bg:"#ccfbf1",   color:"#0d9488" };
    case "proof_issued":             return { icon:"🏆", bg:"#ede9fe",   color:"#7c3aed" };
    case "document_comment":         return { icon:"💬", bg:"#ede9fe",   color:"#7c3aed" };
    case "document_approved":        return { icon:"✅", bg:"#dcfce7",   color:"#16a34a" };
    case "document_signed":          return { icon:"✍️", bg:"#dcfce7",   color:"#16a34a" };
    case "document_declined":        return { icon:"❌", bg:"#fee2e2",   color:"#dc2626" };
    default: return is_final
      ? { icon:"✅", bg:"#dcfce7", color:"#16a34a" }
      : { icon:"📄", bg:"#ede9fe", color:"#7c3aed" };
  }
}

function getTitle(row: any) {
  switch(row.action) {
    case "org_invite_received":
      return `Invited to ${row.metadata?.organization_name || "an organization"}`;
    case "partnership_invite_received":
      return `Partnership request from ${row.metadata?.requester_org_name || "an organization"}`;
    case "partnership_accepted":
      return `${row.metadata?.partner_org_name || "An organization"} accepted your partnership`;
    case "document_comment":
      return `💬 New message on "${row.metadata?.document_title || "a document"}" from ${row.metadata?.sender_email?.split("@")[0] || "someone"}`;
    case "proof_issued":
      return `🏆 Proof certificate — "${row.metadata?.document_title || "a document"}"`;
    case "document_approved":
      return `✅ "${row.metadata?.document_title || "A document"}" approved by ${row.metadata?.approved_by?.split("@")[0] || "a recipient"}`;
    case "document_signed":
      return `✍️ "${row.metadata?.document_title || "A document"}" signed by ${row.metadata?.signed_by?.split("@")[0] || "a recipient"}`;
    case "document_declined":
      return `❌ "${row.metadata?.document_title || "A document"}" was declined`;
    default:
      return row.metadata?.document_title || "Untitled Document";
  }
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), dy = Math.floor(diff/86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (dy < 7) return `${dy}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

export default function InboxPage() {
  const [items, setItems]         = useState<InboxItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"pending"|"all">("pending");
  const [actioning, setActioning] = useState<string|null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const id = "ib-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    loadInbox();
  }, []);

  const markRead = async (item: InboxItem) => {
    if (item.read_at) return;
    await supabase.from("activity_logs")
      .update({ read_at: new Date().toISOString() })
      .eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i));
  };


  async function loadInbox() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("activity_logs")
      .select("id, action, metadata, created_at, read_at")
      .eq("user_id", user.id)
      .in("action", [
        "document_received","org_invite_received","partnership_invite_received",
        "partnership_accepted","document_comment","proof_issued",
        "document_approved","document_signed","document_declined",
      ])
      .order("created_at", { ascending: false });

    setItems((data || []).map((row: any) => ({
      id:             row.id,
      action:         row.action,
      document_id:    row.document_id,
      document_title: getTitle(row),
      metadata:       row.metadata || {},
      created_at:     row.created_at,
      status:         row.metadata?.status === "actioned" ? "actioned" : "pending",
      is_final:       row.metadata?.is_final || false,
      step_order:     row.metadata?.step_order || 1,
      total_steps:    row.metadata?.total_steps || 1,
      read_at:        row.read_at || null,
    })));
    setLoading(false);
  }

  async function actionItem(item: InboxItem, actionType: "forward"|"save") {
    setActioning(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("activity_logs").update({
      metadata: { ...item.metadata, status: "actioned", actioned_at: new Date().toISOString(), action_type: actionType },
    }).eq("id", item.id);

    await supabase.from("document_routes").update({
      status: "completed", actioned_at: new Date().toISOString(),
    }).eq("document_id", item.document_id).eq("recipient_id", user.id);

    if (actionType === "forward") {
      await supabase.from("document_routes").update({ status: "pending" })
        .eq("document_id", item.document_id).eq("route_order", item.step_order + 1);
    }
    if (item.is_final || actionType === "save") {
      await supabase.from("documents").update({ status: "signed" }).eq("id", item.document_id);
    }

    setActioning(null);
    loadInbox();
  }

  async function acceptInvite(item: InboxItem) {
    setActioning(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActioning(null); return; }
    const orgId = item.metadata?.organization_id;
    if (!orgId) { setActioning(null); return; }

    const { error } = await supabase.from("profiles")
      .update({ organization_id: orgId, role: "organization_member" }).eq("id", user.id);
    if (error) { alert("Failed: " + error.message); setActioning(null); return; }

    await supabase.from("organization_invites")
      .update({ status: "accepted" }).eq("organization_id", orgId).eq("email", user.email);
    await supabase.from("activity_logs").update({
      metadata: { ...item.metadata, status: "actioned", actioned_at: new Date().toISOString(), action_type: "accepted" },
    }).eq("id", item.id);

    localStorage.setItem("nkoaha_role", "organization_member");
    localStorage.setItem("nkoaha_name", user.email?.split("@")[0] || "Member");
    localStorage.setItem("nkoaha_org_id", orgId);
    setActioning(null);
    window.location.href = "/dashboard/organizationmembersdashboard";
  }

  async function rejectInvite(item: InboxItem) {
    setActioning(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActioning(null); return; }
    const orgId = item.metadata?.organization_id;
    if (orgId) {
      await supabase.from("organization_invites")
        .update({ status: "declined" }).eq("organization_id", orgId).eq("email", user.email);
    }
    await supabase.from("profiles").update({ organization_id: null, role: "individual" }).eq("id", user.id);
    await supabase.from("activity_logs").update({
      metadata: { ...item.metadata, status: "actioned", actioned_at: new Date().toISOString(), action_type: "declined" },
    }).eq("id", item.id);
    setActioning(null);
    loadInbox();
  }

  // openDoc: navigate to document page and mark item as read
  async function openDoc(item: InboxItem) {
    await markRead(item);
    if (item.document_id) {
      navigate("/dashboard/individual", { state: { openDocId: item.document_id } });
    } else {
      loadInbox();
    }
  }

  // Open proof certificate in new tab
  function viewCertificate(item: InboxItem) {
    const html = item.metadata?.proof_html;
    if (!html) { alert("Certificate not available."); return; }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    // Mark as read
    supabase.from("activity_logs").update({
      metadata: { ...item.metadata, status: "actioned", actioned_at: new Date().toISOString() },
    }).eq("id", item.id);
  }

  const pendingItems = items.filter(i => i.status === "pending");
  const displayItems = tab === "pending" ? pendingItems : items;

  return (
    <DashboardLayout>
      <div className="ib-root">
        <div className="ib-header">
          <div className="ib-title">
            Inbox
            {items.filter((i:any)=>!i.read_at).length > 0 && (
              <span className="ib-count">{items.filter((i:any)=>!i.read_at).length} unread</span>
            )}
          </div>
          <div className="ib-tabs">
            <button className={`ib-tab${tab==="pending"?" active":""}`} onClick={()=>setTab("pending")}>
              Needs Action {pendingItems.length > 0 && `(${pendingItems.length})`}
            </button>
            <button className={`ib-tab${tab==="all"?" active":""}`} onClick={()=>setTab("all")}>All</button>
          </div>
        </div>

        {loading && (
          <div className="ib-list">
            {Array.from({length:3}).map((_,i)=>(
              <div key={i} className="ib-item">
                <div className="ib-skel" style={{width:38,height:38,borderRadius:10,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div className="ib-skel" style={{width:"60%",height:14,marginBottom:8}}/>
                  <div className="ib-skel" style={{width:"40%",height:11,marginBottom:10}}/>
                  <div className="ib-skel" style={{width:120,height:28,borderRadius:7}}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && displayItems.length === 0 && (
          <div className="ib-empty">
            <div className="ib-empty-icon">📭</div>
            <p>{tab==="pending" ? "No pending actions" : "Your inbox is empty"}</p>
            <span style={{fontSize:12}}>
              {tab==="pending" ? "All caught up!" : "Documents, messages and certificates will appear here"}
            </span>
          </div>
        )}

        {!loading && (
          <div className="ib-list">
            {displayItems.map(item => {
              const { icon, bg, color } = getIcon(item.action, item.is_final);
              const isNotifOnly = ["document_comment","proof_issued","document_approved","document_signed","document_declined"].includes(item.action);

              return (
                <div key={item.id} className={`ib-item ${item.status}`} onClick={()=>markRead(item)} style={{borderLeft:!item.read_at?`3px solid #7c3aed`:`3px solid transparent`}}>
                  <div className="ib-icon" style={{ background: bg, color }}>{icon}</div>

                  <div className="ib-body">
                    <div className="ib-doc-title">{item.document_title}</div>

                    {/* Preview cards for new action types */}
                    {item.action === "document_comment" && item.metadata?.message && (
                      <div className="ib-preview comment">
                        "{item.metadata.message.length > 100
                          ? item.metadata.message.slice(0,100)+"…"
                          : item.metadata.message}"
                      </div>
                    )}
                    {item.action === "proof_issued" && item.metadata?.proof_summary && (
                      <div className="ib-preview proof">🏆 {item.metadata.proof_summary}</div>
                    )}
                    {item.action === "document_approved" && (
                      <div className="ib-preview notify">
                        Step {item.metadata?.step} of {item.metadata?.total} approved
                      </div>
                    )}
                    {item.action === "document_signed" && (
                      <div className="ib-preview notify">Document fully signed and complete</div>
                    )}
                    {item.action === "document_declined" && (
                      <div className="ib-preview declined">Document was declined — routing stopped</div>
                    )}

                    <div className="ib-meta">
                      {item.action === "org_invite_received"
                        ? <>Organisation invite · {timeAgo(item.created_at)}</>
                        : item.action === "partnership_invite_received"
                        ? <>Partnership request · {timeAgo(item.created_at)}</>
                        : item.action === "partnership_accepted"
                        ? <>Partnership confirmed · {timeAgo(item.created_at)}</>
                        : isNotifOnly
                        ? <>{timeAgo(item.created_at)}</>
                        : <>Step {item.step_order} of {item.total_steps} · {item.is_final ? "You are the final approver" : "Forward to next after review"} · {timeAgo(item.created_at)}</>
                      }
                    </div>

                    {/* Step chain — only for document_received */}
                    {item.action === "document_received" && item.total_steps > 0 && (
                      <div className="ib-step-chain">
                        {Array.from({length: item.total_steps}).map((_,i) => (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                            <div className={`ib-step ${i < item.step_order-1 ? "done" : i === item.step_order-1 ? "current" : "waiting"}`}>
                              {i < item.step_order-1 ? "✓" : i+1}
                            </div>
                            {i < item.total_steps-1 && <span className="ib-step-arrow">→</span>}
                          </div>
                        ))}
                        {item.is_final && (
                          <span style={{fontSize:10,background:"#dcfce7",color:"#16a34a",padding:"2px 6px",borderRadius:3,fontWeight:600,marginLeft:4}}>FINAL</span>
                        )}
                      </div>
                    )}

                    {/* ── Action buttons ── */}

                    {/* Notification-only: View button marks as read */}
                    {item.status === "pending" && isNotifOnly && (
                      <div className="ib-actions">
                        {item.action === "proof_issued" && item.metadata?.proof_html ? (
                          <button className="ib-btn final" onClick={()=>viewCertificate(item)}>
                            🏆 View Certificate
                          </button>
                        ) : (
                          <button className="ib-btn ghost" onClick={()=>openDoc(item)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            {item.action === "document_comment" ? "View & Reply" : "View Document"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Partnership invite */}
                    {item.status === "pending" && item.action === "partnership_invite_received" && (
                      <div className="ib-actions">
                        <button className="ib-btn final" onClick={()=>navigate("/dashboard/partnerships")}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          View in Partnerships
                        </button>
                      </div>
                    )}

                    {/* Org invite */}
                    {item.status === "pending" && item.action === "org_invite_received" && (
                      <div className="ib-actions">
                        <button className="ib-btn final" disabled={actioning===item.id} onClick={()=>acceptInvite(item)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          {actioning===item.id ? "Accepting…" : "Accept & Join"}
                        </button>
                        <button className="ib-btn ghost" disabled={actioning===item.id} onClick={()=>rejectInvite(item)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Document routing — forward or final save */}
                    {item.status === "pending" && item.action === "document_received" && (
                      <div className="ib-actions">
                        {item.is_final ? (
                          <>
                            <button className="ib-btn final" disabled={actioning===item.id}
                              onClick={()=>actionItem(item,"save")}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                              {actioning===item.id ? "Saving…" : "Approve & Save"}
                            </button>
                            <button className="ib-btn ghost"
                              onClick={()=>navigate("/dashboard/individual",{state:{openDocId:item.document_id}})}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              View Document
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="ib-btn forward" disabled={actioning===item.id}
                              onClick={()=>actionItem(item,"forward")}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                              {actioning===item.id ? "Forwarding…" : "Forward to Next"}
                            </button>
                            <button className="ib-btn ghost"
                              onClick={()=>navigate("/dashboard/individual",{state:{openDocId:item.document_id}})}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              View Document
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {item.status === "actioned" && (
                      <div style={{fontSize:12,color:"#16a34a",display:"flex",alignItems:"center",gap:4}}>
                        <span>✓</span>
                        <span>
                          {item.action === "org_invite_received"
                            ? item.metadata?.action_type==="accepted" ? "Joined organisation" : "Invitation declined"
                            : item.action === "document_comment" ? "Viewed"
                            : item.action === "proof_issued" ? "Certificate opened"
                            : item.metadata?.action_type === "save" ? "Approved & Saved"
                            : item.metadata?.action_type === "forward" ? "Forwarded"
                            : "Done"
                          } · {timeAgo(item.metadata?.actioned_at || item.created_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="ib-time">{timeAgo(item.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}