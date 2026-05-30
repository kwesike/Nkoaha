import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const [ready, setReady]       = useState(false);

  useEffect(() => {
    // Supabase sends the user back with a token in the URL hash (#access_token=...&type=recovery)
    // We need to let Supabase process the hash before checking the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Session is set — ready to update password
        setReady(true);
      } else if (event === "SIGNED_IN" && session) {
        setReady(true);
      }
    });

    // Also check if session already exists (user clicked link, already authenticated)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        // Give the hash-based auth a moment to process
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (d2.session) {
              setReady(true);
            } else {
              setMessage("Invalid or expired reset link. Please request a new one.");
            }
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully! Redirecting…");
      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut();
      setTimeout(() => navigate("/"), 2000);
    }
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleReset}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Create new password</h2>
        <p className="auth-subtitle">Enter a new password for your account</p>

        {!ready && !message && (
          <p className="auth-subtitle" style={{ color: "#b45309" }}>Verifying reset link…</p>
        )}

        {ready && (
          <>
            <div className="input-group">
              <label>New password</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Confirm password</label>
              <input
                type="password"
                required
                placeholder="Repeat new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading || !password || !confirm}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </>
        )}

        {message && (
          <p className="auth-message" style={{
            color: message.includes("successfully") ? "#16a34a" : "#dc2626",
            background: message.includes("successfully") ? "#dcfce7" : "#fee2e2",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginTop: 8,
          }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "#78716c" }}>
          <a href="/" style={{ color: "#7c3aed" }}>← Back to login</a>
        </p>
      </form>
    </div>
  );
}