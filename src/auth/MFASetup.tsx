import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function MFASetup() {
  const navigate = useNavigate();

  const [qr, setQr]             = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // 🔐 Enroll TOTP on mount — do NOT create a challenge here.
  // Challenges expire in ~5 min. If created at mount and the user
  // takes time scanning the QR, the challenge is stale and verify
  // returns "invalid code" even with the right digits.
  // A fresh challenge is created in handleVerify instead.
  useEffect(() => {
    const setupMFA = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      // Unenroll any leftover unverified factors to avoid "already exists" errors
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of (existing?.totp || [])) {
        if (factor.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
        }
      }

      // issuer + friendlyName fix the QR showing "localhost" in authenticator apps.
      // Also set Site URL to https://nkoaha.space in Supabase → Auth → URL Config.
      const { data: enrollData, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType:   "totp",
          issuer:       "NkoAha",
          friendlyName: user.email || "NkoAha User",
        });

      if (enrollError) { setError(enrollError.message); return; }

      setQr(enrollData.totp.qr_code);
      setFactorId(enrollData.id);
    };

    setupMFA();
  }, [navigate]);

  // 🔑 Verify MFA code — creates a FRESH challenge right before verifying
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) { setError("MFA setup incomplete. Refresh page."); return; }

    setLoading(true);
    setError("");

    // ── Fresh challenge every time — never expires before the user submits ──
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      setLoading(false);
      setError("Could not start verification. Please refresh and try again.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setLoading(false);
      setError("Invalid code. Try again.");
      return;
    }

    // 🔁 Redirect based on role + onboarding
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return navigate("/"); }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    setLoading(false);
    if (profileError || !profile) { return navigate("/"); }

    if (!profile.onboarding_completed) {
      if (profile.role === "individual")   return navigate("/individual");
      if (profile.role === "organization") return navigate("/organization");
    }

    navigate("/dashboard");
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleVerify}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Secure your account</h2>
        <p className="auth-subtitle">
          Scan the QR code with your authenticator app
        </p>

        {qr && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <img src={qr} alt="MFA QR Code" />
          </div>
        )}

        <div className="input-group">
          <label>6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>

        {/* Disabled until QR has loaded AND exactly 6 digits entered */}
        <button type="submit" disabled={loading || !qr || code.length !== 6}>
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>

        {error && <p className="auth-message">{error}</p>}
      </form>
    </div>
  );
}