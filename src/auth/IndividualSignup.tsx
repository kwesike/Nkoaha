import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

type AuthMethod = "authenticator" | "email_otp";

export default function IndividualSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("authenticator");

  // ✅ Load invite if exists
  useEffect(() => {
    const invite = localStorage.getItem("org_invite");
    if (invite) {
      const parsed = JSON.parse(invite);
      setInviteEmail(parsed.email);
      setOrganizationId(parsed.organization_id);
    }
  }, []);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = inviteEmail ?? (formData.get("email") as string);
    const password = formData.get("password") as string;

    setLoading(true);

    if (inviteEmail && inviteEmail !== email) {
      alert("This invite was sent to a different email address.");
      setLoading(false);
      return;
    }

    // ✅ CREATE AUTH USER
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      alert(error?.message);
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    // ✅ CREATE PROFILE — store chosen verification method
    await supabase
      .from("profiles")
      .update({
        full_name: name,
        role: organizationId ? "organization_member" : "individual",
        auth_method: authMethod,
      })
      .eq("id", userId);

    setLoading(false);

    // ── Route by chosen verification method ──
    // Both paths must pass through onboarding (/individual) so signature +
    // profile picture are always collected. Onboarding self-gates on the
    // onboarding_completed flag, so it shows the form only if not yet done.
    if (authMethod === "authenticator") {
      // Set up the authenticator app first; MFASetup continues to onboarding.
      navigate("/mfa");
    } else {
      // Email OTP: no app to set up — go straight to onboarding.
      navigate("/individual");
    }
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleSignup}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>{inviteEmail ? "Join Organization" : "Individual Signup"}</h2>

        <div className="input-group">
          <label>Full name</label>
          <input name="name" required />
        </div>

        <div className="input-group">
          <label>Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={inviteEmail ?? ""}
            disabled={!!inviteEmail}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input name="password" type="password" required />
        </div>

        {/* ── Verification method choice ── */}
        <div className="input-group">
          <label>How would you like to verify your identity?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setAuthMethod("authenticator")}
              style={methodCardStyle(authMethod === "authenticator")}
            >
              <span style={{ fontSize: 20 }}>🔐</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: "#1c1917" }}>
                  Authenticator app
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#78716c" }}>
                  Most secure · Google Authenticator, Authy, etc.
                </span>
              </span>
              {authMethod === "authenticator" && <span style={{ color: "#7c3aed", fontWeight: 700 }}>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod("email_otp")}
              style={methodCardStyle(authMethod === "email_otp")}
            >
              <span style={{ fontSize: 20 }}>✉️</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: "#1c1917" }}>
                  Email code
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#78716c" }}>
                  A 6-digit code sent to your email each time
                </span>
              </span>
              {authMethod === "email_otp" && <span style={{ color: "#7c3aed", fontWeight: 700 }}>✓</span>}
            </button>
          </div>
          {authMethod === "email_otp" && (
            <p style={{ fontSize: 11, color: "#b45309", background: "#fef9c3", padding: "7px 10px", borderRadius: 7, marginTop: 8, lineHeight: 1.5 }}>
              Email codes are convenient but less secure than an authenticator app —
              anyone with access to your email could approve documents. You can change
              this later in Settings.
            </p>
          )}
        </div>

        <button disabled={loading}>
          {loading ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

function methodCardStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 13px",
    borderRadius: 10,
    border: `1.5px solid ${active ? "#7c3aed" : "#e7e4df"}`,
    background: active ? "#ede9fe" : "#fff",
    cursor: "pointer",
    width: "100%",
    transition: "all .15s",
  };
}