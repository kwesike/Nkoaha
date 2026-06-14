import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

// ── Update this when the mobile app ships ──
// For now it's a placeholder. Later, point it at your Play Store URL
// or a hosted .apk download link. The button uses a normal download/link.
const APP_DOWNLOAD_URL = "#"; // e.g. "https://nkoaha.space/downloads/nkoaha.apk"

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Always clear stale role cache before a new login
    // so the previous user's role never bleeds into this session
    localStorage.removeItem("nkoaha_role");
    localStorage.removeItem("nkoaha_name");

    const form = e.currentTarget;
    const email    = (form.email    as HTMLInputElement).value;
    const password = (form.password as HTMLInputElement).value;

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // ── Branch on the user's chosen verification method ──
    // authenticator → existing TOTP verify page; email_otp → email-code page
    let method = "authenticator";
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles").select("auth_method").eq("id", signInData.user.id).maybeSingle();
      method = profile?.auth_method || "authenticator";
    }
    navigate(method === "email_otp" ? "/email-otp-verify" : "/mfa-verify");
  };

  const handleDownload = (e: React.MouseEvent) => {
    if (APP_DOWNLOAD_URL === "#") {
      e.preventDefault();
      alert("The NkoAha mobile app is coming soon! We'll let you know the moment it's ready to download.");
    }
    // When APP_DOWNLOAD_URL is a real link, the anchor handles the download/redirect.
  };

  return (
    <>
      {loading && <LoadingScreen message="Signing you in..." />}
      <div className="page-center">
        {/* Row wrapper: form + download card side by side on wide screens,
            stacked on mobile. Inline styles keep auth.css untouched. */}
        <div style={{
          display: "flex", gap: 24, alignItems: "stretch",
          flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 880,
        }}>
          <form className="auth-container" onSubmit={handleLogin} style={{ flex: "1 1 360px", margin: 0 }}>
            <div className="auth-logo">
              <img src={logo} alt="Nkoaha Logo" />
            </div>
            <h2>Welcome back</h2>
            <p className="auth-subtitle">Sign in to continue to Nkoaha</p>
            <div className="input-group">
              <label>Email</label>
              <input name="email" type="email" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input name="password" type="password" required />
            </div>
            <div className="auth-actions">
              <span onClick={() => navigate("/forgot-password")}>Forgot password?</span>
            </div>
            <button type="submit" disabled={loading}>Continue</button>
            {error && <p className="auth-error">{error}</p>}
            <p className="auth-footer">
              Don't have an account?{" "}
              <span onClick={() => navigate("/signup")}>Sign up</span>
            </p>
          </form>

          {/* ── Download mobile app card ── */}
          <div style={{
            flex: "1 1 300px", maxWidth: 360, minWidth: 280,
            background: "linear-gradient(160deg,#18181b,#27272a)",
            borderRadius: 16, padding: 28, color: "#fff",
            display: "flex", flexDirection: "column", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14, background: "#7c3aed",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 18, boxShadow: "0 0 0 4px rgba(124,58,237,.25)",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/>
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
              Get the NkoAha mobile app
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,255,255,.7)" }}>
              Sign, route, and track your documents on the go. Same NkoAha, now in your pocket — for iPhone and Android.
            </p>
            <a
              href={APP_DOWNLOAD_URL}
              onClick={handleDownload}
              download
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "#7c3aed", color: "#fff", textDecoration: "none",
                fontSize: 14, fontWeight: 600, padding: "12px 20px", borderRadius: 10,
                cursor: "pointer", transition: "background .15s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "#6d28d9")}
              onMouseOut={e => (e.currentTarget.style.background = "#7c3aed")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download the app
            </a>
            <p style={{ margin: "14px 0 0", fontSize: 11, color: "rgba(255,255,255,.4)", textAlign: "center" }}>
              Free download · Works on iPhone & Android
            </p>
          </div>
        </div>
      </div>
    </>
  );
}