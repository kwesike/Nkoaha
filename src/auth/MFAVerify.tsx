import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

function dashboardForRole(role?: string | null): string {
  switch (role) {
    case "organization":        return "/dashboard/organizationdashboard";
    case "organization_member":
    case "org_member":          return "/dashboard/organizationmembersdashboard";
    default:                    return "/dashboard/individualdashboard";
  }
}

export default function MFAVerify() {
  const navigate = useNavigate();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  /* ── Protect page — must have an active session ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/");
    });
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!factors?.totp?.length) throw new Error("No authenticator factor found.");

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factors.totp[0].id,
        code,
      });
      if (verifyError) throw verifyError;

      /* ── Fetch profile, cache role + name, then redirect ── */
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      // DEBUG — open browser console to see what comes back
      console.log("[MFAVerify] user.id:", user.id);
      console.log("[MFAVerify] profile:", profile);
      console.log("[MFAVerify] profile error:", profileError);

      if (profileError) {
        console.error("[MFAVerify] Profile fetch failed:", profileError.message);
        // RLS is blocking — try to determine role from organizations table
        const { data: org } = await supabase
          .from("organizations").select("id,name").eq("owner_id", user.id).single();
        if (org) {
          // Has an organization → must be organization role
          localStorage.setItem("nkoaha_role", "organization");
          localStorage.setItem("nkoaha_name", org.name);
          console.log("[MFAVerify] Fallback: found org →", org.name);
          navigate("/dashboard/organizationdashboard");
          return;
        }
        // Check document_routes — if they have assigned routes they're a member
        const { data: routes } = await supabase
          .from("document_routes").select("id").eq("recipient_id", user.id).limit(1);
        if (routes?.length) {
          localStorage.setItem("nkoaha_role", "organization_member");
          localStorage.setItem("nkoaha_name", user.email?.split("@")[0] || "Member");
          console.log("[MFAVerify] Fallback: found routes → org_member");
          navigate("/dashboard/organizationmembersdashboard");
          return;
        }
        // Default to individual
        localStorage.setItem("nkoaha_role", "individual");
        localStorage.setItem("nkoaha_name", user.email?.split("@")[0] || "User");
        navigate("/dashboard/individualdashboard");
        return;
      }

      const role = profile?.role || "individual";
      console.log("[MFAVerify] role resolved to:", role);

      // Cache role — DashboardLayout reads this on every page navigation
      localStorage.setItem("nkoaha_role", role);

      // Cache display name — org users get org name, others get email prefix
      if (role === "organization") {
        const { data: org } = await supabase
          .from("organizations").select("name").eq("owner_id", user.id).single();
        localStorage.setItem("nkoaha_name", org?.name || profile?.email || "");
      } else {
        localStorage.setItem("nkoaha_name", profile?.email || "");
      }

      navigate(dashboardForRole(role));
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <LoadingScreen message="Verifying your identity..." />}

      <div className="page-center">
        <form className="auth-container" onSubmit={handleVerify}>
          <div className="auth-logo">
            <img src={logo} alt="Nkoaha Logo" />
          </div>

          <h2>Two-factor authentication</h2>
          <p className="auth-subtitle">
            Enter the 6-digit code from your authenticator app
          </p>

          <div className="input-group">
            <label>Authentication code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
            />
          </div>

          <button disabled={loading || code.length !== 6}>Verify</button>

          {error && <p className="auth-error">{error}</p>}
        </form>
      </div>
    </>
  );
}