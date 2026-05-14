import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function MFASetup() {
  const navigate = useNavigate();

  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔐 Enroll + create challenge
  useEffect(() => {
    const setupMFA = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      // 🔹 Enroll TOTP
      const { data: enrollData, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
        });

      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      // 🔹 Create challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollData.id,
        });

      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      setQr(enrollData.totp.qr_code);
      setFactorId(enrollData.id);
      setChallengeId(challengeData.id);
    };

    setupMFA();
  }, [navigate]);

  // 🔑 Verify MFA code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!factorId || !challengeId) {
      setError("MFA setup incomplete. Refresh page.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (verifyError) {
      setLoading(false);
      setError("Invalid code. Try again.");
      return;
    }

    // 🔁 Redirect based on role + onboarding
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return navigate("/");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    setLoading(false);

    if (profileError || !profile) {
      return navigate("/");
    }

    if (!profile.onboarding_completed) {
      if (profile.role === "individual") {
        return navigate("/individual");
      }
      if (profile.role === "organization") {
        return navigate("/organization");
      }
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

        <button type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>

        {error && <p className="auth-message">{error}</p>}
      </form>
    </div>
  );
}
