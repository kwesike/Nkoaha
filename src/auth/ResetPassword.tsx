import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import logo from "../assets/nkoaha-logo.png";

/* Self-contained, brand-styled reset-password page. It brings its own styles
   (scoped under .rp-*) so it renders correctly regardless of global auth.css,
   and robustly handles both Supabase recovery link formats:
     • PKCE links  → ?code=...            (exchangeCodeForSession)
     • legacy hash → #access_token&type=recovery (auto-detected by supabase-js) */

const STYLES = `
  .rp-page{min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#e8e6e1;padding:24px 16px;font-family:'DM Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
  .rp-card{width:100%;max-width:400px;background:#fff;border:1px solid #e7e4df;border-radius:18px;
    padding:34px 30px;box-shadow:0 1px 4px rgba(0,0,0,.06),0 10px 40px rgba(0,0,0,.08);box-sizing:border-box}
  .rp-logo{display:flex;justify-content:center;margin-bottom:18px}
  .rp-logo img{height:40px;width:auto;object-fit:contain}
  .rp-h2{font-size:20px;font-weight:700;color:#1c1917;text-align:center;margin:0 0 6px}
  .rp-sub{font-size:13px;color:#78716c;text-align:center;margin:0 0 22px;line-height:1.5}
  .rp-group{margin-bottom:15px}
  .rp-group label{display:block;font-size:12.5px;font-weight:600;color:#44403c;margin-bottom:6px}
  .rp-input{width:100%;padding:11px 13px;border:1.5px solid #e7e4df;border-radius:10px;font-size:14px;
    font-family:inherit;color:#1c1917;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;background:#fff}
  .rp-input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12)}
  .rp-input::placeholder{color:#a8a29e}
  .rp-btn{width:100%;padding:12px;border:none;border-radius:10px;background:#7c3aed;color:#fff;
    font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s;margin-top:4px}
  .rp-btn:hover:not(:disabled){background:#6d28d9}
  .rp-btn:disabled{opacity:.55;cursor:not-allowed}
  .rp-verify{text-align:center;font-size:13px;color:#b45309;background:#fef9c3;border-radius:10px;
    padding:12px;display:flex;align-items:center;justify-content:center;gap:9px}
  .rp-spin{width:15px;height:15px;border:2px solid rgba(180,83,9,.25);border-top-color:#b45309;border-radius:50%;animation:rp-rot .7s linear infinite}
  @keyframes rp-rot{to{transform:rotate(360deg)}}
  .rp-msg{font-size:13px;padding:11px 14px;border-radius:10px;margin-top:14px;line-height:1.5;text-align:center}
  .rp-msg.ok{color:#166534;background:#dcfce7}
  .rp-msg.err{color:#991b1b;background:#fee2e2}
  .rp-foot{margin-top:18px;text-align:center;font-size:12.5px;color:#78716c}
  .rp-foot a{color:#7c3aed;text-decoration:none;font-weight:600}
  .rp-foot a:hover{text-decoration:underline}
`;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const [isError, setIsError]   = useState(false);
  const [ready, setReady]       = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false); // account has authenticator enabled
  const [mfaCode, setMfaCode]   = useState("");

  useEffect(() => {
    const id = "rp-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }

    let done = false;
    const markReady = () => { if (!done) { done = true; setReady(true); } };

    // Recovery / sign-in events fire once supabase processes the link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) markReady();
    });

    (async () => {
      // 1) PKCE-style link: ?code=... must be exchanged for a session.
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          // Clean the code out of the address bar.
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + url.hash);
        }
      } catch { /* fall through to session checks */ }

      // 2) Session may already be set (hash link auto-detected, or exchange above).
      const { data } = await supabase.auth.getSession();
      if (data.session) { markReady(); return; }

      // 3) Give hash-based auth a moment, then re-check.
      setTimeout(async () => {
        const { data: d2 } = await supabase.auth.getSession();
        if (d2.session) markReady();
        else if (!done) {
          setIsError(true);
          setMessage("Invalid or expired reset link. Please request a new one.");
        }
      }, 1800);
    })();

    return () => subscription.unsubscribe();
  }, []);

  // Once we have a recovery session, check whether the account has MFA enabled.
  // If so, Supabase needs an AAL2 (MFA-verified) session before it will change
  // the password — so we ask for the authenticator code on this page.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
          setMfaRequired(true);
        }
      } catch { /* no MFA / not available — proceed without a code */ }
    })();
  }, [ready]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsError(false);
    if (password.length < 8) { setIsError(true); return setMessage("Password must be at least 8 characters."); }
    if (password !== confirm) { setIsError(true); return setMessage("Passwords do not match."); }
    if (mfaRequired && !/^\d{6}$/.test(mfaCode.trim())) {
      setIsError(true); return setMessage("Enter the 6-digit code from your authenticator app.");
    }
    setLoading(true);
    setMessage("");

    // If MFA is on, verify the authenticator code first to elevate to AAL2.
    if (mfaRequired) {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
            factorId: totp.id, code: mfaCode.trim(),
          });
          if (vErr) {
            setLoading(false); setIsError(true);
            setMessage("Incorrect authenticator code. Please try again.");
            return;
          }
        }
      } catch (e: any) {
        setLoading(false); setIsError(true);
        setMessage(e?.message || "Could not verify your authenticator code.");
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
    } else {
      setIsError(false);
      setMessage("Password updated successfully! Redirecting to sign in…");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/"), 2000);
    }
  };

  const success = message.includes("successfully");

  return (
    <div className="rp-page">
      <form className="rp-card" onSubmit={handleReset}>
        <div className="rp-logo"><img src={logo} alt="NkoAha" /></div>

        <h2 className="rp-h2">Create new password</h2>
        <p className="rp-sub">Enter a new password for your account</p>

        {!ready && !message && (
          <div className="rp-verify"><span className="rp-spin" /> Verifying reset link…</div>
        )}

        {ready && !success && (
          <>
            <div className="rp-group">
              <label>New password</label>
              <input className="rp-input" type="password" required minLength={8}
                placeholder="Min 8 characters" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="rp-group">
              <label>Confirm password</label>
              <input className="rp-input" type="password" required
                placeholder="Repeat new password" value={confirm}
                onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            {mfaRequired && (
              <div className="rp-group">
                <label>Authenticator code</label>
                <input className="rp-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="6-digit code" value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: 16 }} />
                <div style={{ fontSize: 11.5, color: "#78716c", marginTop: 6, lineHeight: 1.5 }}>
                  Your account has two-factor authentication. Enter the current code from your authenticator app to confirm.
                </div>
              </div>
            )}
            <button className="rp-btn" type="submit"
              disabled={loading || !password || !confirm || (mfaRequired && mfaCode.length !== 6)}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </>
        )}

        {message && (
          <p className={`rp-msg ${isError ? "err" : "ok"}`}>{message}</p>
        )}

        <div className="rp-foot">
          <a href="/">← Back to sign in</a>
        </div>
      </form>
    </div>
  );
}