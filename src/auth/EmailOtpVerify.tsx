import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen";
import { logSecurityEvent } from "../lib/securityLog";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

function dashboardForRole(role?: string | null): string {
  switch (role) {
    case "admin":               return "/dashboard/admin";
    case "organization":        return "/dashboard/organizationdashboard";
    case "organization_member":
    case "org_member":          return "/dashboard/organizationmembersdashboard";
    default:                    return "/dashboard/individualdashboard";
  }
}

export default function EmailOtpVerify() {
  const navigate = useNavigate();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");
  const [resendIn, setResendIn] = useState(0);
  const sentOnce = useRef(false);

  // Must have a session (set by Login's signInWithPassword).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/"); return; }
      if (!sentOnce.current) { sentOnce.current = true; sendCode(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendCode() {
    setSending(true); setError(""); setInfo("");
    try {
      const { data, error } = await supabase.functions.invoke("auth-email-otp", {
        body: { action: "send", purpose: "login" },
      });
      if (error || (data as any)?.error) {
        setError((data as any)?.error || "Could not send the code. Try resending.");
      } else {
        setInfo(`We sent a 6-digit code to ${(data as any)?.sentTo || "your email"}.`);
        setResendIn(30);
      }
    } catch (e: any) {
      setError(e?.message || "Could not send the code.");
    }
    setSending(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("auth-email-otp", {
        body: { action: "verify", code, purpose: "login" },
      });
      if (error || (data as any)?.error || !(data as any)?.verified) {
        setError((data as any)?.error || "Incorrect code. Try again.");
        setLoading(false);
        return;
      }

      // Record a successful login (IP + device captured server-side).
      logSecurityEvent("login", { method: "email_otp" });

      // Verified — resolve role and route to the right dashboard.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role, email").eq("id", user.id).maybeSingle();
      const role = profile?.role || "individual";
      localStorage.setItem("nkoaha_role", role);
      if (role === "organization") {
        const { data: org } = await supabase
          .from("organizations").select("name").eq("owner_id", user.id).maybeSingle();
        localStorage.setItem("nkoaha_name", org?.name || profile?.email || "");
      } else {
        localStorage.setItem("nkoaha_name", profile?.email || user.email?.split("@")[0] || "");
      }
      navigate(dashboardForRole(role));
    } catch (e: any) {
      setError(e?.message || "Verification failed.");
      setLoading(false);
    }
  }

  return (
    <>
      {loading && <LoadingScreen message="Verifying your identity..." />}
      <div className="page-center">
        <form className="auth-container" onSubmit={verify}>
          <div className="auth-logo">
            <img src={logo} alt="Nkoaha Logo" />
          </div>

          <h2>Check your email</h2>
          <p className="auth-subtitle">
            {sending ? "Sending your code…" : info || "Enter the 6-digit code we emailed you."}
          </p>

          <div className="input-group">
            <label>Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              required
            />
          </div>

          <button disabled={loading || sending || code.length !== 6}>Verify</button>

          {error && <p className="auth-error">{error}</p>}

          <p className="auth-footer">
            Didn't get it?{" "}
            <span
              style={{ cursor: resendIn > 0 ? "default" : "pointer", opacity: resendIn > 0 ? 0.5 : 1 }}
              onClick={() => { if (resendIn === 0 && !sending) sendCode(); }}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </span>
          </p>
        </form>
      </div>
    </>
  );
}