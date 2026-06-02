import { type ReactNode, useEffect, useState } from "react";
import { supabase } from ".././lib/supabase";
import { useNavigate, useLocation, NavLink } from "react-router-dom";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{--admin-sidebar:#0f0f11;--admin-accent:#7c3aed;--admin-accent2:#a855f7;
    --admin-border:rgba(255,255,255,.07);--admin-text:#f5f3ef;--admin-muted:rgba(255,255,255,.4);
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .adm-root{display:flex;height:100vh;font-family:var(--font);background:#f5f3ef;overflow:hidden}
  .adm-sidebar{width:220px;background:var(--admin-sidebar);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid var(--admin-border)}
  .adm-brand{padding:20px 16px 16px;border-bottom:1px solid var(--admin-border)}
  .adm-brand-row{display:flex;align-items:center;gap:9px;margin-bottom:4px}
  .adm-brand-mark{width:28px;height:28px;background:linear-gradient(135deg,var(--admin-accent),var(--admin-accent2));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0}
  .adm-brand-name{font-size:13px;font-weight:700;color:var(--admin-text);letter-spacing:.02em}
  .adm-brand-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--admin-accent2);background:rgba(168,85,247,.15);padding:2px 7px;border-radius:20px;display:inline-block}
  .adm-nav{flex:1;overflow-y:auto;padding:10px 8px}
  .adm-nav-section{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--admin-muted);padding:12px 8px 5px}
  .adm-nav-link{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;font-size:12.5px;font-weight:500;color:var(--admin-muted);text-decoration:none;transition:all .12s;margin-bottom:1px;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:var(--font)}
  .adm-nav-link:hover{background:rgba(255,255,255,.06);color:var(--admin-text)}
  .adm-nav-link.active{background:rgba(124,58,237,.2);color:#c4b5fd}
  .adm-nav-link.active svg{stroke:#a78bfa}
  .adm-nav-badge{margin-left:auto;background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:20px;font-family:var(--mono)}
  .adm-footer{padding:12px 8px;border-top:1px solid var(--admin-border)}
  .adm-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .adm-topbar{height:52px;background:#fff;border-bottom:1px solid #e7e4df;display:flex;align-items:center;padding:0 24px;gap:12px;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .adm-topbar-title{font-size:15px;font-weight:600;color:#1c1917;flex:1}
  .adm-content{flex:1;overflow-y:auto}
`;

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const NavIcon = {
  Dashboard: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Users:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Support:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Orgs:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Billing:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  Docs:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Audit:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Logout:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [supportUnread, setSupportUnread] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = "adm-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    // Guard: only admin role
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate("/"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { navigate("/"); return; }
      setReady(true);
      loadUnread();
    });
  }, [navigate]);

  async function loadUnread() {
    // Count support messages that have no reply yet
    const { data } = await supabase
      .from("activity_logs")
      .select("user_id")
      .eq("action", "support_message");
    const { data: replies } = await supabase
      .from("activity_logs")
      .select("user_id")
      .eq("action", "support_reply");
    if (!data) return;
    const repliedUsers = new Set((replies||[]).map((r:any) => r.user_id));
    const unreplied = new Set(data.map((d:any) => d.user_id));
    // Users who messaged but never got a reply
    let count = 0;
    for (const uid of unreplied) { if (!repliedUsers.has(uid)) count++; }
    setSupportUnread(count);
  }

  // Realtime badge update
  useEffect(() => {
    if (!ready) return;
    const ch = supabase.channel("admin-support-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" },
        () => loadUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ready]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const pageTitles: Record<string, string> = {
    "/dashboard/admin":                "Overview",
    "/dashboard/admin/users":          "Users",
    "/dashboard/admin/support":        "Support Inbox",
    "/dashboard/admin/organizations":  "Organizations",
    "/dashboard/admin/subscriptions":  "Subscriptions",
    "/dashboard/admin/documents":      "Documents",
    "/dashboard/admin/audit":          "Audit Logs",
  };

  const currentTitle = title || pageTitles[location.pathname] || "Admin";

  if (!ready) return null;

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <div className="adm-brand-row">
            <div className="adm-brand-mark">N</div>
            <div className="adm-brand-name">NkoAha</div>
          </div>
          <span className="adm-brand-tag">Admin Panel</span>
        </div>

        <nav className="adm-nav">
          <div className="adm-nav-section">Main</div>

          <NavLink to="/dashboard/admin" end className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Dashboard/> Overview
          </NavLink>

          <NavLink to="/dashboard/admin/users" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Users/> Users
          </NavLink>

          <NavLink to="/dashboard/admin/organizations" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Orgs/> Organizations
          </NavLink>

          <NavLink to="/dashboard/admin/subscriptions" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Billing/> Subscriptions
          </NavLink>

          <div className="adm-nav-section">Operations</div>

          <NavLink to="/dashboard/admin/support" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Support/> Support Inbox
            {supportUnread > 0 && <span className="adm-nav-badge">{supportUnread}</span>}
          </NavLink>

          <NavLink to="/dashboard/admin/documents" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Docs/> Documents
          </NavLink>

          <NavLink to="/dashboard/admin/audit" className={({isActive}) => `adm-nav-link${isActive?" active":""}`}>
            <NavIcon.Audit/> Audit Logs
          </NavLink>
        </nav>

        <div className="adm-footer">
          <button className="adm-nav-link" onClick={logout}>
            <NavIcon.Logout/> Sign Out
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-topbar">
          <span className="adm-topbar-title">{currentTitle}</span>
          <span style={{fontSize:11,fontFamily:"var(--mono)",background:"#fef3c7",color:"#b45309",padding:"3px 10px",borderRadius:20,fontWeight:700}}>
            ADMIN
          </span>
        </div>
        <div className="adm-content">{children}</div>
      </main>
    </div>
  );
}