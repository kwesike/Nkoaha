import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface SidebarProps {
  role: "individual" | "organization" | "organization_member";
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

/* ─────────────────────────────────────────────
   ICONS  (inline SVG — no dependency needed)
───────────────────────────────────────────── */
const Icons = {
  Overview: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Documents: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  Members: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Audit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="13" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Partnerships: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Billing: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --sb-w-collapsed: 60px;
    --sb-w-expanded:  220px;
    --sb-bg:          #18181b;
    --sb-border:      rgba(255,255,255,0.06);
    --sb-purple:      #7c3aed;
    --sb-purple-glow: rgba(124,58,237,0.18);
    --sb-text:        rgba(255,255,255,0.55);
    --sb-text-active: #ffffff;
    --sb-font:        'DM Sans', sans-serif;
    --sb-transition:  0.22s cubic-bezier(0.4,0,0.2,1);
  }

  .sb-root {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: var(--sb-w-collapsed);
    background: var(--sb-bg);
    border-right: 1px solid var(--sb-border);
    transition: width var(--sb-transition);
    overflow: hidden;
    flex-shrink: 0;
    z-index: 50;
    font-family: var(--sb-font);
  }
  .sb-root.expanded { width: var(--sb-w-expanded); }

  /* ── LOGO ── */
  .sb-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 0 20px 18px;
    border-bottom: 1px solid var(--sb-border);
    overflow: hidden;
    min-height: 64px;
    flex-shrink: 0;
  }
  .sb-logo-mark {
    width: 28px; height: 28px;
    border-radius: 8px;
    background: var(--sb-purple);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 0 0 var(--sb-purple-glow);
    transition: box-shadow 0.3s;
  }
  .sb-root.expanded .sb-logo-mark {
    box-shadow: 0 0 0 4px var(--sb-purple-glow);
  }
  .sb-logo-mark svg { display: block; }
  .sb-logo-name {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    opacity: 0;
    transform: translateX(-6px);
    transition: opacity var(--sb-transition), transform var(--sb-transition);
    letter-spacing: -0.01em;
  }
  .sb-root.expanded .sb-logo-name {
    opacity: 1;
    transform: translateX(0);
  }

  /* ── NAV ── */
  .sb-nav {
    flex: 1;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .sb-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 10px;
    border-radius: 9px;
    cursor: pointer;
    color: var(--sb-text);
    transition: background 0.14s, color 0.14s;
    overflow: hidden;
    white-space: nowrap;
    min-height: 42px;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
  }
  .sb-item:hover {
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.85);
  }
  .sb-item.active {
    background: var(--sb-purple-glow);
    color: var(--sb-text-active);
  }
  .sb-item.active::before {
    content: '';
    position: absolute;
    left: 0; top: 20%; bottom: 20%;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--sb-purple);
  }

  .sb-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    flex-shrink: 0;
    transition: color 0.14s;
  }
  .sb-item.active .sb-item-icon { color: #a78bfa; }

  .sb-item-label {
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity var(--sb-transition), transform var(--sb-transition);
    pointer-events: none;
  }
  .sb-root.expanded .sb-item-label {
    opacity: 1;
    transform: translateX(0);
  }

  /* Active indicator dot when collapsed */
  .sb-item.active .sb-active-dot {
    display: block;
  }
  .sb-active-dot {
    display: none;
    position: absolute;
    right: 8px; top: 50%;
    transform: translateY(-50%);
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--sb-purple);
  }
  .sb-root.expanded .sb-active-dot { display: none !important; }

  /* ── TOOLTIP (collapsed state) ── */
  .sb-item::after {
    content: attr(data-label);
    position: absolute;
    left: calc(100% + 10px);
    top: 50%; transform: translateY(-50%);
    background: #27272a;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 7px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 100;
  }
  .sb-root:not(.expanded) .sb-item:hover::after { opacity: 1; }

  /* ── SECTION DIVIDER ── */
  .sb-divider {
    height: 1px;
    background: var(--sb-border);
    margin: 6px 0;
  }

  /* ── BOTTOM ── */
  .sb-bottom {
    padding: 8px 8px 16px;
    border-top: 1px solid var(--sb-border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  /* User badge */
  .sb-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 9px;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .sb-avatar {
    width: 28px; height: 28px;
    border-radius: 8px;
    background: var(--sb-purple);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    letter-spacing: 0.03em;
  }
  .sb-user-info {
    overflow: hidden;
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity var(--sb-transition), transform var(--sb-transition);
  }
  .sb-root.expanded .sb-user-info { opacity: 1; transform: translateX(0); }
  .sb-user-name {
    font-size: 12.5px; font-weight: 600;
    color: rgba(255,255,255,0.88);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 130px;
  }
  .sb-user-role {
    font-size: 10.5px;
    color: rgba(255,255,255,0.35);
    text-transform: capitalize;
  }

  /* Role badge chip */
  .sb-role-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px 3px 6px;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    opacity: 0;
    max-width: 0;
    transition: opacity var(--sb-transition), max-width var(--sb-transition);
    margin-left: 2px;
    flex-shrink: 0;
  }
  .sb-root.expanded .sb-role-badge { opacity: 1; max-width: 160px; }
  .sb-role-badge.individual   { background: rgba(124,58,237,0.18); color: #a78bfa; }
  .sb-role-badge.organization { background: rgba(37,99,235,0.18);  color: #93c5fd; }
  .sb-role-badge.member       { background: rgba(22,163,74,0.18);  color: #86efac; }
`;

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function Sidebar({ role }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [userName, setUserName]         = useState("");
  const [userInitials, setUserInitials]   = useState("U");
  const [inboxCount, setInboxCount]       = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  /* ── Inject styles ── */
  useEffect(() => {
    const id = "sb-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  /* ── Load user name + inbox count + real-time badge ── */
  useEffect(() => {
    let channel: any = null;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("email").eq("id", user.id).single();
      const name = data?.email?.split("@")[0] || user.email?.split("@")[0] || "User";
      setUserName(name);
      setUserInitials(
        name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
      );

      const fetchCount = async () => {
        const { data: inbox } = await supabase
          .from("activity_logs")
          .select("id, metadata, action")
          .eq("user_id", user.id)
          .in("action", ["document_received", "org_invite_received", "partnership_invite_received"]);
        const pending = (inbox || []).filter(
          (row: any) => row.metadata?.status === "pending"
        ).length;
        setInboxCount(pending);
      };

      await fetchCount();

      // Real-time subscription — badge updates instantly when new notification arrives
      channel = supabase
        .channel("inbox-badge")
        .on("postgres_changes", {
          event:  "INSERT",
          schema: "public",
          table:  "activity_logs",
          filter: `user_id=eq.${user.id}`,
        }, () => fetchCount())
        .on("postgres_changes", {
          event:  "UPDATE",
          schema: "public",
          table:  "activity_logs",
          filter: `user_id=eq.${user.id}`,
        }, () => fetchCount())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  /* ── Menu items ── */
  const menuItems: MenuItem[] = (() => {
    if (role === "individual") return [
      { label: "Overview",  icon: <Icons.Overview />,  path: "/dashboard/individualdashboard" },
      { label: "Documents", icon: <Icons.Documents />, path: "/dashboard/individual" },
      { label: "Send",      icon: <Icons.Send />,      path: "/dashboard/send" },
      { label: "Inbox",     icon: <Icons.Inbox />,     path: "/dashboard/inbox/inboxpage" },
      { label: "Billing",   icon: <Icons.Billing />,   path: "/dashboard/billing" },
      { label: "Settings",  icon: <Icons.Settings />,  path: "/dashboard/settings" },
    ];
    if (role === "organization") return [
      { label: "Overview",     icon: <Icons.Overview />,      path: "/dashboard/organizationdashboard" },
      { label: "Documents",    icon: <Icons.Documents />,     path: "/dashboard/organization" },
      { label: "Inbox",        icon: <Icons.Inbox />,         path: "/dashboard/inbox/inboxpage" },
      { label: "Members",      icon: <Icons.Members />,       path: "/dashboard/org/members" },
      { label: "Audit Logs",   icon: <Icons.Audit />,         path: "/dashboard/org/audit" },
      { label: "Partnerships", icon: <Icons.Partnerships />,  path: "/dashboard/partnerships" },
      { label: "Billing",      icon: <Icons.Billing />,       path: "/dashboard/billing" },
      { label: "Settings",     icon: <Icons.Settings />,      path: "/dashboard/settings" },
    ];
    return [
      { label: "Overview",  icon: <Icons.Overview />,  path: "/dashboard/organizationmembersdashboard" },
      { label: "Documents", icon: <Icons.Documents />, path: "/dashboard/member" },
      { label: "Send",      icon: <Icons.Send />,      path: "/dashboard/send" },
      { label: "Inbox",     icon: <Icons.Inbox />,     path: "/dashboard/inbox/inboxpage" },
      { label: "Settings",  icon: <Icons.Settings />,  path: "/dashboard/settings" },
    ];
  })();

  const isActive = (path: string) => location.pathname.toLowerCase() === path.toLowerCase();

  const roleLabelMap: Record<string, string> = {
    individual:          "Individual",
    organization:        "Organization",
    organization_member: "Member",
  };
  const roleBadgeClass: Record<string, string> = {
    individual:          "individual",
    organization:        "organization",
    organization_member: "member",
  };

  const handleLogout = async () => {
    localStorage.removeItem("nkoaha_role");
    localStorage.removeItem("nkoaha_name");
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside
      className={`sb-root ${expanded ? "expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <span className="sb-logo-name">NkoAha</span>
      </div>

      {/* Nav */}
      <nav className="sb-nav">
        {menuItems.map(item => (
          <button
            key={item.label}
            className={`sb-item ${isActive(item.path) ? "active" : ""}`}
            onClick={() => navigate(item.path)}
            data-label={item.label}
          >
            <span className="sb-item-icon">{item.icon}</span>
            <span className="sb-item-label">{item.label}</span>
            {item.label === "Inbox" && inboxCount > 0 && (
              <span style={{
                marginLeft:"auto",minWidth:18,height:18,borderRadius:9,
                background:"#dc2626",color:"#fff",
                fontSize:10,fontWeight:700,display:"flex",
                alignItems:"center",justifyContent:"center",padding:"0 4px",
                fontFamily:"monospace",flexShrink:0,
              }}>{inboxCount > 99 ? "99+" : inboxCount}</span>
            )}
            <span className="sb-active-dot" />
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="sb-bottom">
        {/* User */}
        <div className="sb-user">
          <div className="sb-avatar">{userInitials}</div>
          <div className="sb-user-info">
            <div className="sb-user-name">{userName}</div>
            <div className="sb-user-role">{roleLabelMap[role] || role}</div>
          </div>
          <span className={`sb-role-badge ${roleBadgeClass[role] || "individual"}`}>
            {roleLabelMap[role]}
          </span>
        </div>

        <div className="sb-divider" />

        {/* Logout */}
        <button
          className="sb-item"
          onClick={handleLogout}
          data-label="Log out"
          style={{ color: "rgba(248,113,113,0.7)" }}
        >
          <span className="sb-item-icon"><Icons.Logout /></span>
          <span className="sb-item-label">Log out</span>
        </button>
      </div>
    </aside>
  );
}