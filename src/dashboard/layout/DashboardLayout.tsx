import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import "../dashboard.css";

type Role = "individual" | "organization" | "organization_member";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [role, setRole]               = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [ready, setReady]             = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      // ── Always fetch fresh from DB first ──
      // localStorage is only used as an instant pre-render hint,
      // but DB is always the source of truth.
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      if (!error && profile?.role) {
        // DB succeeded — use real role
        const dbRole = profile.role as Role;
        let dbName   = profile.email?.split("@")[0] || "";

        if (dbRole === "organization") {
          const { data: org } = await supabase
            .from("organizations").select("name").eq("owner_id", user.id).single();
          if (org?.name) dbName = org.name;
        }

        // Update cache with correct values
        localStorage.setItem("nkoaha_role", dbRole);
        localStorage.setItem("nkoaha_name", dbName || user.email?.split("@")[0] || "");

        setRole(dbRole);
        setDisplayName(dbName || user.email?.split("@")[0] || "User");
        setReady(true);
        return;
      }

      // ── DB blocked (RLS) — fall back to localStorage then org table ──
      console.warn("DashboardLayout: profile blocked —", error?.message);

      const cachedRole = localStorage.getItem("nkoaha_role") as Role | null;
      const cachedName = localStorage.getItem("nkoaha_name") || "";

      if (cachedRole) {
        setRole(cachedRole);
        setDisplayName(cachedName || user.email?.split("@")[0] || "User");
        setReady(true);
        return;
      }

      // No cache — try organizations table to distinguish org from individual
      const { data: org } = await supabase
        .from("organizations").select("name").eq("owner_id", user.id).single();

      if (org?.name) {
        localStorage.setItem("nkoaha_role", "organization");
        localStorage.setItem("nkoaha_name", org.name);
        setRole("organization");
        setDisplayName(org.name);
      } else {
        setRole("individual");
        setDisplayName(user.email?.split("@")[0] || "User");
      }
      setReady(true);
    })();
  }, [navigate]);

  const logout = async () => {
    localStorage.removeItem("nkoaha_role");
    localStorage.removeItem("nkoaha_name");
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!ready || role === null) {
    return (
      <div className="dashboard-layout">
        <div style={{ height: 56, background: "#fff", borderBottom: "1px solid #e7e4df" }} />
        <div className="dashboard-body">
          <div style={{ width: 60, background: "#a21897", height: "100vh", flexShrink: 0 }} />
          <main className="dashboard-content" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Topbar onLogout={logout} role={role} displayName={displayName} />
      <div className="dashboard-body">
        <Sidebar role={role} />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}