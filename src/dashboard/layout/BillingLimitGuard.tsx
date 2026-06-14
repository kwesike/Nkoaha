import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";

/*
 * BillingLimitGuard
 * ─────────────────
 * App-wide watcher that checks whether the current user has hit their
 * free/plan limit with no active subscription. If so, it shows a
 * DISMISSIBLE popup that:
 *   • appears on every app entry (mount),
 *   • reappears every 30 minutes while still over-limit,
 *   • lets the user keep navigating (non-blocking),
 *   • sends them to Billing on click.
 *
 * Drop it once inside DashboardLayout (see one-line snippet).
 * It renders nothing unless the user is over-limit.
 */

const REMIND_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INDIVIDUAL_FREE_PER_DAY = 2;
const ORG_FREE_TOTAL          = 5;

export default function BillingLimitGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow]       = useState(false);
  const [overLimit, setOverLimit] = useState(false);
  const [planType, setPlanType]   = useState<"individual" | "organization">("individual");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Determine whether the user is currently over their limit ──
  const checkLimit = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Active, non-expired subscription = never over limit (hide popup)
    const { data: sub } = await supabase.from("subscriptions")
      .select("status,expires_at,plan_type")
      .eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (sub && (!sub.expires_at || new Date(sub.expires_at) > new Date())) {
      return false;
    }

    // No active sub → check free-tier usage (mirrors DocumentsPage logic)
    const { data: profile } = await supabase.from("profiles")
      .select("role,organization_id").eq("id", user.id).maybeSingle();
    const role = profile?.role;
    let orgId = profile?.organization_id || null;
    if (!orgId && role === "organization") {
      const { data: org } = await supabase.from("organizations")
        .select("id").eq("owner_id", user.id).maybeSingle();
      orgId = org?.id || null;
    }
    const isOrg = role === "organization" || role === "organization_member" || !!orgId;
    setPlanType(isOrg ? "organization" : "individual");

    if (isOrg && orgId) {
      const { data: members } = await supabase.from("profiles")
        .select("id").eq("organization_id", orgId);
      const { data: orgRow } = await supabase.from("organizations")
        .select("owner_id").eq("id", orgId).maybeSingle();
      const ids = new Set<string>();
      for (const m of (members || [])) ids.add(m.id);
      if (orgRow?.owner_id) ids.add(orgRow.owner_id);
      const idList = [...ids];
      if (idList.length === 0) idList.push(user.id);
      const { count } = await supabase.from("documents")
        .select("id", { count: "exact", head: true })
        .in("owner_id", idList).neq("status", "deleted");
      return (count || 0) >= ORG_FREE_TOTAL;
    }

    // Individual: per-day
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const { count } = await supabase.from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id).neq("status", "deleted")
      .gte("created_at", dayStart.toISOString());
    return (count || 0) >= INDIVIDUAL_FREE_PER_DAY;
  }, []);

  // Run a check and show the popup if over limit
  const runCheck = useCallback(async () => {
    const over = await checkLimit();
    setOverLimit(over);
    if (over) setShow(true);
  }, [checkLimit]);

  // ── On mount (every app entry) + every 30 minutes ──
  useEffect(() => {
    runCheck();
    timerRef.current = setInterval(runCheck, REMIND_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [runCheck]);

  // ── Re-check on route change (covers "anytime they enter the app") ──
  // Don't pop while they're already on the billing page.
  useEffect(() => {
    if (location.pathname.includes("/billing")) { setShow(false); return; }
    if (overLimit) setShow(true);
  }, [location.pathname, overLimit]);

  if (!show) return null;
  if (location.pathname.includes("/billing")) return null;

  const isOrg = planType === "organization";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={() => setShow(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 18, width: 440, maxWidth: "96vw",
        boxShadow: "0 24px 64px rgba(0,0,0,.22)", overflow: "hidden",
        fontFamily: "'DM Sans',-apple-system,system-ui,sans-serif",
        animation: "blg-in .18s ease",
      }}>
        <style>{`@keyframes blg-in{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <div style={{ height: 6, background: "linear-gradient(90deg,#7c3aed,#a855f7,#2563eb)" }} />
        <div style={{ padding: "28px 28px 24px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13, background: "#ede9fe",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, marginBottom: 16,
          }}>🔒</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1c1917" }}>
            You've reached your free limit
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "#57534e" }}>
            {isOrg
              ? `Your organisation has used all ${ORG_FREE_TOTAL} free trial document actions. Subscribe to an organisation plan to keep creating, routing, and signing documents.`
              : `You've used your ${INDIVIDUAL_FREE_PER_DAY} free document actions for today. Subscribe to a plan to continue without waiting for the daily reset.`}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShow(false)} style={{
              flex: "0 0 auto", padding: "12px 18px", borderRadius: 10,
              border: "1.5px solid #e7e4df", background: "#faf9f8", color: "#78716c",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            }}>
              Not now
            </button>
            <button onClick={() => {
              setShow(false);
              navigate(isOrg ? "/dashboard/billing" : "/dashboard/billing");
            }} style={{
              flex: 1, padding: "12px 18px", borderRadius: 10, border: "none",
              background: "#7c3aed", color: "#fff",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            }}>
              View plans & subscribe
            </button>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "#a8a29e", textAlign: "center" }}>
            You can keep using the app — we'll remind you again later.
          </p>
        </div>
      </div>
    </div>
  );
}