import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "./AdminLayout";

/* Admin → Notifications. Compose a notification and send it to everyone or a
   target segment. Writes one row to `notifications`; RLS + can_see_notification
   decide who receives it. Users see it in their notification bell (real-time)
   and, if permitted, as a browser push. The same row serves the mobile app. */

const STYLES = `
  .an-root{padding:28px 28px 64px;max-width:900px;font-family:var(--font);color:#1c1917}
  .an-title{font-size:18px;font-weight:700;margin-bottom:4px}
  .an-sub{font-size:13px;color:#78716c;margin-bottom:24px}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
  @media(max-width:800px){.an-grid{grid-template-columns:1fr}}
  .an-card{background:#fff;border:1px solid #e7e4df;border-radius:14px;padding:22px 24px}
  .an-card h3{font-size:14px;font-weight:700;margin-bottom:16px}
  .an-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
  .an-label{font-size:12.5px;font-weight:600;color:#44403c}
  .an-input,.an-select,.an-textarea{font-family:var(--font);font-size:13.5px;color:#1c1917;background:#faf9f8;border:1.5px solid #e7e4df;border-radius:9px;padding:10px 13px;outline:none;width:100%;box-sizing:border-box}
  .an-input:focus,.an-select:focus,.an-textarea:focus{border-color:#7c3aed}
  .an-textarea{resize:vertical;min-height:90px}
  .an-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .an-btn{padding:11px 22px;border-radius:9px;border:none;font-family:var(--font);font-size:13.5px;font-weight:600;cursor:pointer}
  .an-btn.primary{background:#7c3aed;color:#fff}.an-btn.primary:hover{background:#5b21b6}
  .an-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .an-msg{font-size:12.5px;padding:9px 12px;border-radius:8px;margin-top:14px}
  .an-msg.ok{background:#dcfce7;color:#166534}.an-msg.err{background:#fee2e2;color:#991b1b}
  /* Live preview */
  .an-prev{border:1px dashed #d6d3d1;border-radius:12px;padding:16px;background:#faf9f8}
  .an-prev-card{background:#fff;border:1px solid #e7e4df;border-radius:10px;padding:14px 16px;display:flex;gap:12px}
  .an-prev-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:5px}
  .an-prev-dot.info{background:#2563eb}.an-prev-dot.warning{background:#b45309}.an-prev-dot.promo{background:#7c3aed}
  .an-prev-title{font-size:13.5px;font-weight:700;color:#1c1917;margin-bottom:3px}
  .an-prev-body{font-size:12.5px;color:#57534e;line-height:1.5}
  .an-prev-link{display:inline-block;margin-top:9px;font-size:12px;font-weight:600;color:#7c3aed}
  .an-recent{margin-top:28px}
  .an-recent h3{font-size:14px;font-weight:700;margin-bottom:12px}
  .an-recent-item{background:#fff;border:1px solid #e7e4df;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px}
  .an-recent-meta{font-size:11px;color:#a8a29e;margin-left:auto;font-family:var(--mono);white-space:nowrap}
  .an-badge{font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}
  .an-badge.info{background:#dbeafe;color:#2563eb}.an-badge.warning{background:#fef9c3;color:#b45309}.an-badge.promo{background:#ede9fe;color:#7c3aed}
`;

type Audience = "all" | "role" | "plan" | "user";
type NType = "info" | "warning" | "promo";

export default function AdminNotificationsPage() {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [type, setType]         = useState<NType>("info");
  const [link, setLink]         = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [targetRole, setTargetRole] = useState("individual");
  const [targetPlan, setTargetPlan] = useState("ind_monthly");
  const [targetEmail, setTargetEmail] = useState("");
  const [sending, setSending]   = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent]     = useState<any[]>([]);

  useEffect(() => {
    const id = "an-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    loadRecent();
  }, []);

  async function loadRecent() {
    const { data } = await supabase.from("notifications")
      .select("id,title,type,audience,created_at")
      .order("created_at", { ascending: false }).limit(10);
    setRecent(data || []);
  }

  async function send() {
    if (!title.trim() || !body.trim()) {
      setMsg({ ok: false, text: "Title and message are required." });
      return;
    }
    setSending(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();

    // Resolve a target user by email if audience='user'.
    let targetUserId: string | null = null;
    if (audience === "user") {
      if (!targetEmail.trim()) { setSending(false); setMsg({ ok: false, text: "Enter the user's email." }); return; }
      const { data: prof } = await supabase.from("profiles")
        .select("id").eq("email", targetEmail.trim()).maybeSingle();
      if (!prof) { setSending(false); setMsg({ ok: false, text: `No user found with email ${targetEmail}.` }); return; }
      targetUserId = prof.id;
    }

    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      body: body.trim(),
      type,
      link: link.trim() || null,
      link_label: linkLabel.trim() || null,
      audience,
      target_role: audience === "role" ? targetRole : null,
      target_plan: audience === "plan" ? targetPlan : null,
      target_user_id: targetUserId,
      created_by: user?.id ?? null,
    });

    setSending(false);
    if (error) { setMsg({ ok: false, text: "Could not send: " + error.message }); return; }
    setMsg({ ok: true, text: "Notification sent." });
    setTitle(""); setBody(""); setLink(""); setLinkLabel("");
    loadRecent();
  }

  const audienceSummary =
    audience === "all"  ? "Everyone" :
    audience === "role" ? `All ${targetRole.replace("_"," ")}s` :
    audience === "plan" ? `Users on ${targetPlan}` :
    `One user (${targetEmail || "…"})`;

  return (
    <AdminLayout title="Notifications">
      <div className="an-root">
        <div className="an-title">Send a Notification</div>
        <div className="an-sub">Push a message to users' in-app notification bell (and browser push). Reaches the mobile app too, once it's live.</div>

        <div className="an-grid">
          {/* Compose */}
          <div className="an-card">
            <h3>Compose</h3>
            <div className="an-field">
              <label className="an-label">Title</label>
              <input className="an-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. New feature: bulk signing" maxLength={120}/>
            </div>
            <div className="an-field">
              <label className="an-label">Message</label>
              <textarea className="an-textarea" value={body} onChange={e=>setBody(e.target.value)} placeholder="What do you want users to know?" maxLength={600}/>
            </div>
            <div className="an-row">
              <div className="an-field">
                <label className="an-label">Type</label>
                <select className="an-select" value={type} onChange={e=>setType(e.target.value as NType)}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="promo">Promo</option>
                </select>
              </div>
              <div className="an-field">
                <label className="an-label">Audience</label>
                <select className="an-select" value={audience} onChange={e=>setAudience(e.target.value as Audience)}>
                  <option value="all">Everyone</option>
                  <option value="role">By account type</option>
                  <option value="plan">By plan</option>
                  <option value="user">A single user</option>
                </select>
              </div>
            </div>

            {audience === "role" && (
              <div className="an-field">
                <label className="an-label">Account type</label>
                <select className="an-select" value={targetRole} onChange={e=>setTargetRole(e.target.value)}>
                  <option value="individual">Individuals</option>
                  <option value="organization">Organizations (owners)</option>
                  <option value="organization_member">Organization members</option>
                </select>
              </div>
            )}
            {audience === "plan" && (
              <div className="an-field">
                <label className="an-label">Plan</label>
                <select className="an-select" value={targetPlan} onChange={e=>setTargetPlan(e.target.value)}>
                  <option value="ind_monthly">Individual Monthly</option>
                  <option value="ind_yearly">Individual Yearly</option>
                  <option value="org_starter">Org Starter</option>
                  <option value="org_growth">Org Growth</option>
                  <option value="org_enterprise">Org Enterprise</option>
                </select>
              </div>
            )}
            {audience === "user" && (
              <div className="an-field">
                <label className="an-label">User email</label>
                <input className="an-input" value={targetEmail} onChange={e=>setTargetEmail(e.target.value)} placeholder="user@example.com"/>
              </div>
            )}

            <div className="an-row">
              <div className="an-field">
                <label className="an-label">Link (optional)</label>
                <input className="an-input" value={link} onChange={e=>setLink(e.target.value)} placeholder="/dashboard/billing"/>
              </div>
              <div className="an-field">
                <label className="an-label">Button label (optional)</label>
                <input className="an-input" value={linkLabel} onChange={e=>setLinkLabel(e.target.value)} placeholder="View"/>
              </div>
            </div>

            <button className="an-btn primary" onClick={send} disabled={sending}>
              {sending ? "Sending…" : `Send to ${audienceSummary}`}
            </button>
            {msg && <div className={`an-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
          </div>

          {/* Preview + audience */}
          <div>
            <div className="an-card">
              <h3>Preview</h3>
              <div className="an-prev">
                <div className="an-prev-card">
                  <span className={`an-prev-dot ${type}`}/>
                  <div>
                    <div className="an-prev-title">{title || "Notification title"}</div>
                    <div className="an-prev-body">{body || "Your message will appear here."}</div>
                    {link && <span className="an-prev-link">{linkLabel || "Open"} →</span>}
                  </div>
                </div>
                <div style={{fontSize:11.5,color:"#78716c",marginTop:12}}>
                  Sending to: <strong>{audienceSummary}</strong>
                </div>
              </div>
            </div>

            <div className="an-recent">
              <h3>Recently sent</h3>
              {recent.length === 0 && <div style={{fontSize:12.5,color:"#a8a29e"}}>Nothing sent yet.</div>}
              {recent.map(n => (
                <div key={n.id} className="an-recent-item">
                  <span className={`an-badge ${n.type}`}>{n.type}</span>
                  <span style={{fontSize:13,fontWeight:500}}>{n.title}</span>
                  <span className="an-recent-meta">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}