import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import "../dashboard.css";
import SupportChat from "../SupportChat";
import { subscribeToPush, isPushSubscribed, showLocalNotification } from "../../hooks/usePushNotifications";

type Role = "individual" | "organization" | "organization_member";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [role, setRole]               = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [ready, setReady]             = useState(false);
  const [hasPremium, setHasPremium]   = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      if (!error && profile?.role) {
        const dbRole = profile.role as Role;
        let dbName   = profile.email?.split("@")[0] || "";

        if (dbRole === "organization") {
          const { data: org } = await supabase
            .from("organizations").select("name").eq("owner_id", user.id).single();
          if (org?.name) dbName = org.name;
        }

        localStorage.setItem("nkoaha_role", dbRole);
        localStorage.setItem("nkoaha_name", dbName || user.email?.split("@")[0] || "");

        setRole(dbRole);
        setDisplayName(dbName || user.email?.split("@")[0] || "User");
        setReady(true);

        // ── Check premium plan + auto-expire if past expiry ──
        const { data: sub } = await supabase.from("subscriptions")
          .select("plan_id, expires_at").eq("user_id", user.id).eq("status", "active")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (sub?.expires_at && new Date(sub.expires_at) < new Date()) {
          // Subscription has expired — mark it in DB and drop to free tier
          await supabase.from("subscriptions")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("user_id", user.id).eq("status", "active");
          setHasPremium(false);
        } else {
          const premiumPlans = ["org_growth", "org_enterprise", "ind_monthly", "ind_yearly"];
          setHasPremium(sub ? premiumPlans.includes(sub.plan_id) : false);
        }
        return;
      }

      // ── DB blocked (RLS) — fall back to localStorage ──
      console.warn("DashboardLayout: profile blocked —", error?.message);

      const cachedRole = localStorage.getItem("nkoaha_role") as Role | null;
      const cachedName = localStorage.getItem("nkoaha_name") || "";

      if (cachedRole) {
        setRole(cachedRole);
        setDisplayName(cachedName || user.email?.split("@")[0] || "User");
        setReady(true);
        return;
      }

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

  // ── Push notification setup — ask permission 3s after first login ──
  useEffect(() => {
    if (!ready) return;
    isPushSubscribed().then(already => {
      if (!already && Notification.permission === "default") {
        setTimeout(() => subscribeToPush(), 3000);
      } else if (!already && Notification.permission === "granted") {
        subscribeToPush();
      }
    });
  }, [ready]);

  // ── Realtime inbox listener — show local notification on new activity ──
  useEffect(() => {
    if (!ready) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel(`inbox-notify-${user.id}`)
        .on("postgres_changes", {
          event:  "INSERT",
          schema: "public",
          table:  "activity_logs",
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          const meta   = payload.new.metadata || {};
          const action = payload.new.action   || "";
          const title  = meta.document_title || meta.organization_name || "NkoAha";

          const msgMap: Record<string, { t: string; b: string }> = {
            document_received:           { t: "📄 Document Received",    b: `"${title}" needs your review` },
            document_approved:           { t: "✅ Document Approved",     b: `"${title}" was approved` },
            document_signed:             { t: "✍️ Document Signed",       b: `"${title}" has been signed` },
            document_declined:           { t: "❌ Document Declined",     b: `"${title}" was declined` },
            document_comment:            { t: "💬 New Message",           b: meta.message ? `"${String(meta.message).slice(0, 60)}"` : `Comment on "${title}"` },
            proof_issued:                { t: "🏆 Certificate Issued",    b: meta.proof_summary || `Certificate for "${title}"` },
            org_invite_received:         { t: "👥 Organisation Invite",   b: `You've been invited to join ${title}` },
            member_joined:               { t: "🎉 New Member",            b: `${meta.member_email || "Someone"} joined your organisation` },
            partnership_invite_received: { t: "🤝 Partnership Request",   b: `${meta.requester_org_name || "An org"} wants to partner` },
            partnership_accepted:        { t: "🤝 Partnership Accepted",  b: `Your partnership request was accepted` },
            partnership_ended:           { t: "🔗 Partnership Ended",     b: `Partnership with ${meta.partner_org_name || "an org"} ended` },
          };

          const msg = msgMap[action];
          if (msg) showLocalNotification(msg.t, msg.b, "/dashboard");
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [ready]);

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
      <SupportChat hasPremium={hasPremium} />
    </div>
  );
}