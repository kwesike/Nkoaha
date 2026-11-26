import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────
// Public guest-signing page (no login).  nkoaha.space/sign/<token>
// Flow: open link → email OTP → view document → sign (draw / type /
// upload, background auto-removed) → submit. All backed by the
// token-guarded guest-sign edge function.
// ─────────────────────────────────────────────────────────────

type Step = "loading" | "otp" | "sign" | "done" | "error";

async function call(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("guest-sign", { body: { action, ...payload } });
  if (error) {
    // supabase wraps non-2xx as error; try to surface the function's JSON
    try { return await (error as any).context?.json?.() ?? { error: "failed" }; } catch { return { error: "failed" }; }
  }
  return data;
}

const ERR: Record<string, string> = {
  invalid_link: "This signing link is invalid.",
  already_signed: "This document has already been signed.",
  not_your_turn: "It's not your turn to sign yet — you'll be notified when it is.",
  expired: "This signing link has expired. Ask the sender to resend it.",
  code_expired: "That code expired. Request a new one.",
  wrong_code: "Wrong code — check and try again.",
  too_many_attempts: "Too many attempts. Request a new code.",
  verify_expired: "Your session timed out. Please verify again.",
  send_failed: "Couldn't send the code. Please try again shortly.",
  no_channel: "No email is attached to this invite. Contact the sender.",
};

export default function SignDocumentPage() {
  const { token = "" } = useParams();
  const [step, setStep] = useState<Step>("loading");
  const [err, setErr]   = useState("");
  const [meta, setMeta] = useState<{ signerName?: string; docTitle?: string; channel?: string }>({});
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [final, setFinal] = useState(false);

  // ── open the link → send OTP ──
  useEffect(() => {
    (async () => {
      if (!token) { setStep("error"); setErr(ERR.invalid_link); return; }
      const r = await call("start", { token });
      if (r?.ok) { setMeta(r); setStep("otp"); }
      else { setStep("error"); setErr(ERR[r?.error] || "This link can't be opened."); }
    })();
  }, [token]);

  const resend = async () => {
    setBusy(true);
    const r = await call("start", { token });
    setBusy(false);
    if (r?.ok) { setMeta(r); setErr(""); } else setErr(ERR[r?.error] || "Couldn't resend.");
  };

  const verify = async () => {
    if (code.length < 6) return;
    setBusy(true); setErr("");
    const r = await call("verify", { token, code });
    setBusy(false);
    if (r?.ok) { setFileUrl(r.fileUrl || ""); setStep("sign"); }
    else setErr(ERR[r?.error] || "Couldn't verify that code.");
  };

  const onSubmit = async (signature: string, typedName: string) => {
    setBusy(true); setErr("");
    const r = await call("submit", { token, signature, typedName });
    setBusy(false);
    if (r?.ok) { setFinal(!!r.final); setStep("done"); }
    else setErr(ERR[r?.error] || "Couldn't submit your signature.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#faf7ff,#f5f3ef)", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#1c1917", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>N</div>
        <span style={{ fontSize: 19, fontWeight: 800 }}>NkoAha</span>
        <span style={{ fontSize: 12.5, color: "#a8a29e" }}>Secure signing</span>
      </div>

      <div style={{ width: "100%", maxWidth: step === "sign" ? 820 : 500, background: "#fff", borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,.08)", overflow: "hidden" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#7c3aed,#a855f7,#2563eb)" }} />
        <div style={{ padding: "24px 24px 26px" }}>

          {step === "loading" && <Center>Opening your document…</Center>}

          {step === "error" && (
            <div style={{ textAlign: "center", padding: "22px 6px" }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Can't open this link</div>
              <div style={{ color: "#78716c", fontSize: 13.5 }}>{err}</div>
            </div>
          )}

          {step === "otp" && (
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700 }}>Verify it's you</h1>
              <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#78716c", lineHeight: 1.55 }}>
                {meta.signerName ? <>Hi {meta.signerName}. </> : null}
                You've been asked to sign <strong>“{meta.docTitle}”</strong>. We sent a 6-digit code to <strong>{meta.channel}</strong>.
              </p>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && verify()} inputMode="numeric" placeholder="______" style={{ width: "100%", boxSizing: "border-box", padding: "13px", border: "1px solid #d6d3d1", borderRadius: 10, fontSize: 26, letterSpacing: 10, textAlign: "center", fontFamily: "monospace" }} />
              {err && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{err}</div>}
              <button onClick={verify} disabled={busy || code.length < 6} style={btn(busy || code.length < 6)}>{busy ? "Checking…" : "Verify & open document"}</button>
              <button onClick={resend} disabled={busy} style={{ background: "none", border: "none", color: "#7c3aed", fontSize: 13, marginTop: 12, cursor: "pointer", width: "100%" }}>Didn't get it? Resend code</button>
            </div>
          )}

          {step === "sign" && (
            <SignPanel fileUrl={fileUrl} defaultName={meta.signerName || ""} busy={busy} err={err} onSubmit={onSubmit} />
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", padding: "22px 6px" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#15803d", marginBottom: 6 }}>Signed successfully</div>
              <div style={{ color: "#57534e", fontSize: 13.5, lineHeight: 1.55 }}>
                {final
                  ? "This was the final signature — the document is now complete and a certified copy has been issued to the sender."
                  : "Your signature has been recorded and the document has moved to the next signer."}
              </div>
            </div>
          )}
        </div>
      </div>
      <p style={{ marginTop: 18, fontSize: 11.5, color: "#a8a29e", textAlign: "center", maxWidth: 460, lineHeight: 1.5 }}>
        Protected by a single-use secure link and email verification. Your signature is timestamped and recorded in a tamper-evident audit trail.
      </p>
    </div>
  );
}

// ── Signing panel: view doc + capture signature (draw/type/upload) ──
function SignPanel({ fileUrl, defaultName, busy, err, onSubmit }: {
  fileUrl: string; defaultName: string; busy: boolean; err: string; onSubmit: (sig: string, name: string) => void;
}) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [typed, setTyped] = useState(defaultName);
  const [sig, setSig] = useState("");         // PNG data URL
  const [agree, setAgree] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // draw pad
  const pos = (e: React.PointerEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const down = (e: React.PointerEvent) => { const c = canvasRef.current!; drawing.current = true; const ctx = c.getContext("2d")!; const p = pos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const c = canvasRef.current!; const ctx = c.getContext("2d")!; const p = pos(e, c); ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#111"; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const up = () => { drawing.current = false; const c = canvasRef.current; if (c) setSig(c.toDataURL("image/png")); };
  const clearPad = () => { const c = canvasRef.current; if (c) { c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setSig(""); } };

  // typed → render in a cursive font
  const renderTyped = useCallback((text: string) => {
    if (!text.trim()) { setSig(""); return; }
    const c = document.createElement("canvas"); c.width = 600; c.height = 160;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#111"; ctx.font = "64px 'Brush Script MT','Segoe Script',cursive"; ctx.textBaseline = "middle";
    ctx.fillText(text, 20, 85); setSig(c.toDataURL("image/png"));
  }, []);

  // upload → strip near-white background
  const onUpload = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (lum > 180) d[i + 3] = 0;                    // near-white → transparent
          else if (lum > 120) d[i + 3] = Math.round(255 * (180 - lum) / 60); // soft edge
        }
        ctx.putImageData(data, 0, 0);
      } catch { /* cross-origin can't happen for local file */ }
      setSig(c.toDataURL("image/png"));
    };
    img.src = URL.createObjectURL(file);
  };

  const ready = !!sig && agree && !busy;

  return (
    <div>
      <h1 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>Review & sign</h1>
      {fileUrl
        ? <iframe title="document" src={fileUrl} style={{ width: "100%", height: 420, border: "1px solid #e7e4df", borderRadius: 10, background: "#fff" }} />
        : <div style={{ padding: 30, textAlign: "center", color: "#a8a29e", border: "1px dashed #e7e4df", borderRadius: 10 }}>Preview unavailable — you can still sign below.</div>}

      <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Your signature</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["draw", "type", "upload"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSig(""); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid " + (tab === t ? "#7c3aed" : "#e7e4df"), background: tab === t ? "#faf7ff" : "#fff", color: tab === t ? "#7c3aed" : "#78716c", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      {tab === "draw" && (
        <div>
          <canvas ref={canvasRef} width={560} height={170} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} style={{ width: "100%", height: 170, border: "1px solid #d6d3d1", borderRadius: 10, touchAction: "none", background: "#fff", cursor: "crosshair" }} />
          <button onClick={clearPad} style={{ background: "none", border: "none", color: "#7c3aed", fontSize: 12.5, marginTop: 6, cursor: "pointer" }}>Clear</button>
        </div>
      )}
      {tab === "type" && (
        <div>
          <input value={typed} onChange={e => { setTyped(e.target.value); renderTyped(e.target.value); }} placeholder="Type your full name" style={{ width: "100%", boxSizing: "border-box", padding: "11px", border: "1px solid #d6d3d1", borderRadius: 10, fontSize: 15 }} />
          {sig && <img src={sig} alt="signature" style={{ height: 70, marginTop: 10, display: "block" }} />}
        </div>
      )}
      {tab === "upload" && (
        <div>
          <label style={{ display: "inline-block", padding: "10px 14px", borderRadius: 9, background: "#7c3aed", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Choose image…<input type="file" accept="image/*" hidden onChange={e => onUpload(e.target.files?.[0])} />
          </label>
          <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 6 }}>Background is removed automatically.</div>
          {sig && <img src={sig} alt="signature" style={{ height: 80, marginTop: 10, display: "block", background: "repeating-conic-gradient(#f0f0f0 0% 25%,#fff 0% 50%) 50%/16px 16px" }} />}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, fontSize: 12.5, color: "#57534e", lineHeight: 1.5 }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I agree to sign this document electronically, and that my electronic signature is legally binding.</span>
      </label>

      {err && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button onClick={() => onSubmit(sig, typed)} disabled={!ready} style={btn(!ready)}>{busy ? "Submitting…" : "Sign document"}</button>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "30px 6px", color: "#78716c", fontSize: 14 }}>{children}</div>;
}
const btn = (disabled: boolean): React.CSSProperties => ({
  width: "100%", marginTop: 16, padding: "13px", borderRadius: 10, border: "none",
  background: "#7c3aed", color: "#fff", fontSize: 15, fontWeight: 700,
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
});