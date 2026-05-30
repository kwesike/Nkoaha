import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, useLocation } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

const STYLES = `
  .mfa-setup-container{max-width:420px;width:100%;margin:0 auto}
  .mfa-steps{display:flex;align-items:center;margin-bottom:28px}
  .mfa-step{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#a8a29e}
  .mfa-step.active{color:#7c3aed}
  .mfa-step.done{color:#16a34a}
  .mfa-step-num{width:24px;height:24px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
  .mfa-step-line{flex:1;height:2px;background:#e7e4df;margin:0 8px}
  .mfa-step.done .mfa-step-line{background:#16a34a}
  .mfa-qr-wrap{background:#f5f3ef;border:1px solid #e7e4df;border-radius:12px;padding:20px;text-align:center;margin:16px 0}
  .mfa-qr-img{width:180px;height:180px;border-radius:8px;display:block;margin:0 auto}
  .mfa-secret-box{background:#fff;border:1px solid #e7e4df;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:13px;color:#7c3aed;text-align:center;letter-spacing:0.1em;word-break:break-all;margin-top:10px;cursor:pointer;transition:background .15s}
  .mfa-secret-box:hover{background:#ede9fe}
  .mfa-apps{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0}
  .mfa-app-chip{padding:5px 12px;border-radius:20px;background:#f5f3ef;border:1px solid #e7e4df;font-size:11.5px;font-weight:600;color:#44403c}
  .mfa-code-input{width:100%;padding:14px;border:1.5px solid #e7e4df;border-radius:10px;font-size:22px;text-align:center;letter-spacing:0.4em;font-family:monospace;color:#1c1917;outline:none;transition:border-color .15s;margin:8px 0}
  .mfa-code-input:focus{border-color:#7c3aed}
  .mfa-pw-input{width:100%;padding:11px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:14px;font-family:inherit;color:#1c1917;outline:none;transition:border-color .15s;margin-bottom:10px;box-sizing:border-box}
  .mfa-pw-input:focus{border-color:#7c3aed}
  .mfa-skip{background:none;border:none;color:#a8a29e;font-size:12px;cursor:pointer;text-decoration:underline;margin-top:8px;display:block;width:100%;text-align:center}
  .mfa-skip:hover{color:#78716c}
  .mfa-success-icon{font-size:56px;text-align:center;margin-bottom:12px}
`;

type Step = "password" | "mfa-intro" | "qr" | "verify" | "done";

export default function MFASetupInvite() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [step, setStep]         = useState<Step>("password");
  const [qrUrl, setQrUrl]       = useState("");
  const [secret, setSecret]     = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode]         = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [copied, setCopied]     = useState(false);

  const [password, setPassword]   = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError]     = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const destination = (location.state as any)?.destination
    || "/dashboard/organizationmembersdashboard";

  useEffect(() => {
    const id = "mfa-setup-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  // ── Step 1: Set Password ──
  async function setPasswordAndContinue() {
    if (password.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (password !== pwConfirm) { setPwError("Passwords do not match."); return; }
    setPwLoading(true); setPwError("");
    const { error } = await supabase.auth.updateUser({ password });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setStep("mfa-intro");
  }

  // ── Step 2: Start MFA enroll ──
  async function startMFA() {
    setMfaLoading(true); setMfaError("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp", issuer: "NkoAha",
      });
      if (error) throw error;
      setQrUrl(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep("qr");
    } catch (err: any) {
      setMfaError(err.message || "Could not start MFA setup.");
    }
    setMfaLoading(false);
  }

  // ── Step 3: Verify MFA ──
  async function verifyMFA() {
    if (code.length !== 6) { setMfaError("Enter the 6-digit code."); return; }
    setMfaLoading(true); setMfaError("");
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      const { error } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge!.id, code,
      });
      if (error) throw error;
      setStep("done");
      setTimeout(() => navigate(destination, { replace: true }), 2000);
    } catch {
      setMfaError("Incorrect code. Check your authenticator app and try again.");
    }
    setMfaLoading(false);
  }

  async function skipMFA() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    setStep("done");
    setTimeout(() => navigate(destination, { replace: true }), 2000);
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Step indicator
  const s = step as string;
  const stepDefs = [
    { key: "password",  label: "Password" },
    { key: "mfa-intro", label: "2FA"      },
    { key: "done",      label: "Done"     },
  ];
  const stepIndex = (k: string) =>
    k === "password" ? 0 : k === "mfa-intro" || k === "qr" || k === "verify" ? 1 : 2;
  const currentIdx = stepIndex(s);

  return (
    <div className="page-center">
      <div className="auth-container mfa-setup-container">
        <div className="auth-logo">
          <img src={logo} alt="NkoAha" />
        </div>

        {/* Step indicator */}
        {step !== "done" && (
          <div className="mfa-steps">
            {stepDefs.map((def, i) => {
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={def.key} style={{display:"flex",alignItems:"center",flex:i<stepDefs.length-1?1:"none"}}>
                  <div className={`mfa-step ${isActive?"active":isDone?"done":""}`}>
                    <div className="mfa-step-num">{isDone ? "✓" : i + 1}</div>
                    <span>{def.label}</span>
                  </div>
                  {i < stepDefs.length - 1 && (
                    <div className="mfa-step-line" style={{background:isDone?"#16a34a":"#e7e4df"}}/>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step 1: Create Password ── */}
        {step === "password" && (<>
          <div style={{fontSize:32,textAlign:"center",marginBottom:12}}>🔑</div>
          <h2>Create your password</h2>
          <p className="auth-subtitle">
            You joined via an invite link. Set a password so you can log in normally next time.
          </p>
          <input
            className="mfa-pw-input"
            type="password"
            placeholder="New password (min 8 characters)"
            autoFocus
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(""); }}
          />
          <input
            className="mfa-pw-input"
            type="password"
            placeholder="Confirm password"
            value={pwConfirm}
            onChange={e => { setPwConfirm(e.target.value); setPwError(""); }}
            onKeyDown={e => e.key === "Enter" && setPasswordAndContinue()}
          />
          {pwError && (
            <p style={{color:"#dc2626",fontSize:12,margin:"0 0 10px",background:"#fee2e2",padding:"8px 12px",borderRadius:7}}>
              {pwError}
            </p>
          )}
          <button
            onClick={setPasswordAndContinue}
            disabled={pwLoading || !password || !pwConfirm}
            style={{width:"100%"}}
          >
            {pwLoading ? "Saving…" : "Set Password & Continue"}
          </button>
        </>)}

        {/* ── Step 2a: MFA Intro ── */}
        {step === "mfa-intro" && (<>
          <h2>Set up two-factor authentication</h2>
          <p className="auth-subtitle">
            NkoAha uses 2FA to verify your identity when approving documents.
            Download an authenticator app on your phone first.
          </p>
          <div style={{background:"#faf9f8",border:"1px solid #e7e4df",borderRadius:10,padding:"14px 16px",margin:"16px 0"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#7c3aed",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>
              Recommended apps
            </div>
            <div className="mfa-apps">
              <span className="mfa-app-chip">📱 Google Authenticator</span>
              <span className="mfa-app-chip">🔐 Authy</span>
              <span className="mfa-app-chip">🛡️ Microsoft Authenticator</span>
            </div>
          </div>
          {mfaError && <p style={{color:"#dc2626",fontSize:12,margin:"8px 0"}}>{mfaError}</p>}
          <button onClick={startMFA} disabled={mfaLoading} style={{width:"100%"}}>
            {mfaLoading ? "Setting up…" : "I have an app — Continue"}
          </button>
          <button className="mfa-skip" onClick={skipMFA}>
            Skip 2FA for now (set up later in Settings)
          </button>
        </>)}

        {/* ── Step 2b: QR Code ── */}
        {step === "qr" && (<>
          <h2>Scan QR code</h2>
          <p className="auth-subtitle">
            Open your authenticator app and scan the QR code below.
          </p>
          <div className="mfa-qr-wrap">
            {qrUrl && <img src={qrUrl} alt="MFA QR code" className="mfa-qr-img"/>}
            <div style={{fontSize:11.5,color:"#78716c",marginTop:12}}>
              Can't scan? Copy the secret key instead:
            </div>
            <div className="mfa-secret-box" onClick={copySecret} title="Click to copy">
              {copied ? "✓ Copied!" : secret}
            </div>
            <div style={{fontSize:10.5,color:"#a8a29e",marginTop:6}}>
              In your app: tap "+" → "Enter a setup key" → paste the key above
            </div>
          </div>
          <button onClick={() => { setStep("verify"); setMfaError(""); }} style={{width:"100%"}}>
            I've scanned it — Continue
          </button>
          <button className="mfa-skip" onClick={skipMFA}>Skip 2FA for now</button>
        </>)}

        {/* ── Step 2c: Verify ── */}
        {step === "verify" && (<>
          <h2>Enter the code</h2>
          <p className="auth-subtitle">
            Enter the 6-digit code from your authenticator app.
          </p>
          <input
            className="mfa-code-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            autoFocus
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g,"")); setMfaError(""); }}
            onKeyDown={e => e.key === "Enter" && verifyMFA()}
          />
          {mfaError && <p style={{color:"#dc2626",fontSize:12,margin:"4px 0 8px"}}>{mfaError}</p>}
          <button onClick={verifyMFA} disabled={mfaLoading || code.length !== 6} style={{width:"100%"}}>
            {mfaLoading ? "Verifying…" : "Confirm & Finish"}
          </button>
          <button className="mfa-skip" onClick={() => { setStep("qr"); setCode(""); setMfaError(""); }}>
            ← Back to QR code
          </button>
        </>)}

        {/* ── Done ── */}
        {step === "done" && (<>
          <div className="mfa-success-icon">🎉</div>
          <h2 style={{textAlign:"center",color:"#16a34a"}}>You're all set!</h2>
          <p className="auth-subtitle" style={{textAlign:"center"}}>
            Your account is fully set up. Redirecting to your dashboard…
          </p>
        </>)}
      </div>
    </div>
  );
}