import  { useState, useEffect, useRef } from "react";
import logo from "../../assets/nkoaha-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface TopbarProps {
  onLogout: () => void;
  role: "individual" | "organization" | "organization_member";
  displayName?: string;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --tb-height:56px;--tb-bg:#ffffff;--tb-border:#e7e4df;
    --tb-purple:#7c3aed;--tb-purple-l:#ede9fe;
    --tb-text:#1c1917;--tb-muted:#78716c;
    --tb-font:'DM Sans',sans-serif;--tb-mono:'DM Mono',monospace;
  }
  .tb-root{height:var(--tb-height);background:var(--tb-bg);border-bottom:1px solid var(--tb-border);display:flex;align-items:center;justify-content:space-between;padding:0 20px 0 24px;flex-shrink:0;font-family:var(--tb-font);box-shadow:0 1px 3px rgba(0,0,0,0.04);width:100%}
  .tb-left{display:flex;align-items:center;gap:12px}
  .tb-logo{height:28px;width:auto;display:block;object-fit:contain}
  .tb-divider{width:1px;height:20px;background:var(--tb-border)}
  .tb-page-title{font-size:14px;font-weight:500;color:var(--tb-muted);letter-spacing:-0.01em}
  .tb-right{display:flex;align-items:center;gap:8px}
  .tb-role-badge{font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;padding:3px 9px;border-radius:20px;font-family:var(--tb-mono)}
  .tb-role-badge.individual{background:#ede9fe;color:#7c3aed}
  .tb-role-badge.organization{background:#dbeafe;color:#2563eb}
  .tb-role-badge.member{background:#dcfce7;color:#16a34a}
  .tb-icon-btn{width:34px;height:34px;border-radius:8px;border:none;background:transparent;color:var(--tb-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s,color .14s;position:relative;flex-shrink:0}
  .tb-icon-btn:hover{background:#f5f3ef;color:var(--tb-text)}
  .tb-notif-dot{position:absolute;top:6px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--tb-purple);border:2px solid #fff}
  .tb-profile-btn{display:flex;align-items:center;gap:8px;padding:4px 8px 4px 4px;border-radius:10px;border:1px solid var(--tb-border);background:transparent;cursor:pointer;transition:background .14s,border-color .14s;font-family:var(--tb-font)}
  .tb-profile-btn:hover{background:#faf9f8;border-color:#d6d3ce}
  .tb-display-name{font-size:13px;font-weight:500;color:var(--tb-text);max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tb-chevron{color:var(--tb-muted);transition:transform .18s;flex-shrink:0}
  .tb-profile-btn[aria-expanded="true"] .tb-chevron{transform:rotate(180deg)}
  .tb-dropdown{position:absolute;top:calc(var(--tb-height) + 4px);right:20px;background:#fff;border:1px solid var(--tb-border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1),0 2px 8px rgba(0,0,0,0.06);width:220px;z-index:100;overflow:hidden;animation:tb-drop-in .16s ease}
  @keyframes tb-drop-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .tb-dropdown-header{padding:14px 16px 10px;border-bottom:1px solid var(--tb-border)}
  .tb-dropdown-name{font-size:13.5px;font-weight:600;color:var(--tb-text);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tb-dropdown-role{font-size:11.5px;color:var(--tb-muted);text-transform:capitalize}
  .tb-dropdown-body{padding:6px}
  .tb-dropdown-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:none;background:transparent;border-radius:7px;font-family:var(--tb-font);font-size:13px;color:var(--tb-text);cursor:pointer;text-align:left;transition:background .12s}
  .tb-dropdown-item:hover{background:#f5f3ef}
  .tb-dropdown-item.danger{color:#dc2626}
  .tb-dropdown-item.danger:hover{background:#fee2e2}
  .tb-dropdown-sep{height:1px;background:var(--tb-border);margin:4px 0}
  /* Notification bell dropdown */
  .tb-notif-count{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#dc2626;color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-family:var(--tb-mono)}
  .tb-notif-panel{position:absolute;top:calc(var(--tb-height) + 4px);right:20px;background:#fff;border:1px solid var(--tb-border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1),0 2px 8px rgba(0,0,0,0.06);width:340px;max-width:92vw;z-index:100;overflow:hidden;animation:tb-drop-in .16s ease}
  .tb-notif-head{padding:13px 16px;border-bottom:1px solid var(--tb-border);display:flex;align-items:center;justify-content:space-between}
  .tb-notif-head-title{font-size:13.5px;font-weight:700;color:var(--tb-text)}
  .tb-notif-markall{font-size:11.5px;color:var(--tb-purple);background:none;border:none;cursor:pointer;font-family:var(--tb-font);font-weight:600;padding:0}
  .tb-notif-markall:hover{text-decoration:underline}
  .tb-notif-list{max-height:380px;overflow-y:auto}
  .tb-notif-item{display:flex;gap:11px;padding:12px 16px;border-bottom:1px solid #faf9f8;cursor:pointer;transition:background .12s}
  .tb-notif-item:hover{background:#faf8ff}
  .tb-notif-item.unread{background:#f7f5ff}
  .tb-notif-item.unread:hover{background:#f0ecff}
  .tb-notif-dot2{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
  .tb-notif-dot2.info{background:#2563eb}.tb-notif-dot2.warning{background:#b45309}.tb-notif-dot2.promo{background:#7c3aed}
  .tb-notif-dot2.read{background:#d6d3d1}
  .tb-notif-item-title{font-size:13px;font-weight:600;color:var(--tb-text);margin-bottom:2px;line-height:1.3}
  .tb-notif-item-body{font-size:12px;color:var(--tb-muted);line-height:1.45}
  .tb-notif-item-time{font-size:10.5px;color:#a8a29e;margin-top:4px;font-family:var(--tb-mono)}
  .tb-notif-item-link{display:inline-block;margin-top:6px;font-size:11.5px;font-weight:600;color:var(--tb-purple)}
  .tb-notif-empty{padding:36px 16px;text-align:center;color:#a8a29e;font-size:12.5px}`;

const ROLE_LABELS: Record<string, string> = {
  individual:          "Individual",
  organization:        "Organization",
  organization_member: "Member",
};

const PAGE_TITLES: Record<string, string> = {
  individualdashboard:           "Dashboard",
  organizationdashboard:         "Dashboard",
  organizationmembersdashboard:  "Dashboard",
  individual:                    "Documents",
  organization:                  "Documents",
  member:                        "Documents",
  send:                          "Send",
  inboxpage:                     "Inbox",
  inbox:                         "Inbox",
  billing:                       "Billing",
  settings:                      "Settings",
  members:                       "Members",
  audit:                         "Audit Logs",
  partnerships:                  "Partnerships",
  overview:                      "Dashboard",
};

export default function Topbar({ onLogout, role, displayName }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState("Dashboard");
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Notifications ──
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  async function loadNotifs() {
    // RLS returns only notifications targeted to this user. Newest first.
    const { data: list } = await supabase.from("notifications")
      .select("id,title,body,type,link,link_label,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: reads } = await supabase.from("notification_reads")
      .select("notification_id").eq("user_id", user?.id ?? "");
    setNotifs(list || []);
    setReadIds(new Set((reads || []).map((r: any) => r.notification_id)));
  }

  async function markRead(id: string) {
    if (readIds.has(id)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setReadIds(prev => new Set(prev).add(id)); // optimistic
    await supabase.from("notification_reads")
      .upsert({ notification_id: id, user_id: user.id }, { onConflict: "notification_id,user_id" });
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const unread = notifs.filter(n => !readIds.has(n.id));
    if (!unread.length) return;
    setReadIds(prev => { const s = new Set(prev); unread.forEach(n => s.add(n.id)); return s; });
    await supabase.from("notification_reads").upsert(
      unread.map(n => ({ notification_id: n.id, user_id: user.id })),
      { onConflict: "notification_id,user_id" }
    );
  }

  function openNotif(n: any) {
    markRead(n.id);
    if (n.link) { setNotifOpen(false); navigate(n.link); }
  }

  function fmtTime(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
  }

  useEffect(() => {
    loadNotifs();
    // Real-time: a new notification for this user pops in live.
    const ch = supabase.channel("user-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },
        () => loadNotifs()) // RLS filters; just reload the visible set
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // role and displayName come directly from DashboardLayout — always correct.
  // No localStorage reads here — that's DashboardLayout's job.
  const badgeClass = role === "organization_member" ? "member" : role;
  const roleLabel  = ROLE_LABELS[role] || "User";
  const name       = displayName || "";
  const initials   = name
    ? name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : role === "organization" ? "ORG" : "U";

  useEffect(() => {
    const id = "tb-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    const last = window.location.pathname.split("/").filter(Boolean).pop()?.toLowerCase() || "";
    const isUUID = /^[0-9a-f-]{8,}$/i.test(last);
    setPageTitle(
      PAGE_TITLES[last] ||
      (isUUID ? "Dashboard" : last.charAt(0).toUpperCase() + last.slice(1))
    );
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="tb-root">
      {/* LEFT */}
      <div className="tb-left">
        <img src={logo} alt="Nkoaha" className="tb-logo" />
        <div className="tb-divider" />
        <span className="tb-page-title">{pageTitle}</span>
      </div>

      {/* RIGHT */}
      <div className="tb-right" ref={menuRef}>
        <span className={`tb-role-badge ${badgeClass}`}>{roleLabel}</span>

        <div ref={notifRef} style={{ position: "static" }}>
          <button className="tb-icon-btn" title="Notifications"
            onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifs(); }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && <span className="tb-notif-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>

          {notifOpen && (
            <div className="tb-notif-panel">
              <div className="tb-notif-head">
                <span className="tb-notif-head-title">Notifications</span>
                {unreadCount > 0 && (
                  <button className="tb-notif-markall" onClick={markAllRead}>Mark all read</button>
                )}
              </div>
              <div className="tb-notif-list">
                {notifs.length === 0 ? (
                  <div className="tb-notif-empty">No notifications yet.</div>
                ) : notifs.map(n => {
                  const isUnread = !readIds.has(n.id);
                  return (
                    <div key={n.id} className={`tb-notif-item${isUnread ? " unread" : ""}`} onClick={() => openNotif(n)}>
                      <span className={`tb-notif-dot2 ${isUnread ? n.type : "read"}`}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tb-notif-item-title">{n.title}</div>
                        <div className="tb-notif-item-body">{n.body}</div>
                        {n.link && <span className="tb-notif-item-link">{n.link_label || "Open"} →</span>}
                        <div className="tb-notif-item-time">{fmtTime(n.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button className="tb-profile-btn" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>
          <div style={{
            width:26, height:26, borderRadius:7,
            background:"var(--tb-purple-l)", color:"var(--tb-purple)",
            fontSize:11, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0, letterSpacing:"0.04em",
          }}>
            {initials}
          </div>
          <span className="tb-display-name">{name || "Account"}</span>
          <svg className="tb-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {menuOpen && (
          <div className="tb-dropdown">
            <div className="tb-dropdown-header">
              <div className="tb-dropdown-name">{name || "User"}</div>
              <div className="tb-dropdown-role">{roleLabel}</div>
            </div>
            <div className="tb-dropdown-body">
              <button className="tb-dropdown-item" onClick={() => { navigate("/dashboard/settings"); setMenuOpen(false); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </button>
              <button className="tb-dropdown-item" onClick={() => { navigate("/dashboard/billing"); setMenuOpen(false); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Billing
              </button>
              <div className="tb-dropdown-sep" />
              <button className="tb-dropdown-item danger" onClick={() => { onLogout(); setMenuOpen(false); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}