import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────
// Public certificate verification (no login required).
// Reached from the seal printed on certified PDFs: nkoaha.space/verify/<certId>.
// Looks the cert up via the verify_certificate() RPC and, if the viewer drops
// the PDF in, re-hashes it in-browser to confirm it hasn't been altered.
// ─────────────────────────────────────────────────────────────

interface CertRecord {
  cert_id: string;
  fingerprint: string;
  signer_name: string | null;
  certified_at: string;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function VerifyCertificatePage() {
  const { certId: certIdParam } = useParams();
  const [certId, setCertId]   = useState(certIdParam || "");
  const [checking, setChecking] = useState(false);
  const [done, setDone]       = useState(false);
  const [record, setRecord]   = useState<CertRecord | null>(null);
  const [fileState, setFileState] = useState<null | "checking" | "match" | "mismatch">(null);
  const [fileName, setFileName]   = useState("");

  const verify = useCallback(async (id: string) => {
    const code = id.trim().toUpperCase();
    if (!code) return;
    setChecking(true); setDone(false); setRecord(null); setFileState(null); setFileName("");
    try {
      const { data, error } = await supabase.rpc("verify_certificate", { p_cert_id: code });
      const row = Array.isArray(data) ? data[0] : data;
      setRecord(error || !row ? null : (row as CertRecord));
    } catch { setRecord(null); }
    finally { setChecking(false); setDone(true); }
  }, []);

  useEffect(() => { if (certIdParam) verify(certIdParam); }, [certIdParam, verify]);

  const onFile = async (file: File | undefined) => {
    if (!file || !record) return;
    setFileName(file.name); setFileState("checking");
    try {
      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf);
      setFileState(hash === record.fingerprint ? "match" : "mismatch");
    } catch { setFileState("mismatch"); }
  };

  const fmtDate = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(160deg,#faf7ff 0%,#f5f3ef 100%)",
      fontFamily: "'DM Sans',-apple-system,system-ui,sans-serif", color: "#1c1917",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>N</div>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>NkoAha</span>
        <span style={{ fontSize: 13, color: "#a8a29e", marginLeft: 4 }}>Document verification</span>
      </div>

      <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,.08)", overflow: "hidden" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#7c3aed,#a855f7,#2563eb)" }} />
        <div style={{ padding: "26px 26px 28px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700 }}>Verify a certified document</h1>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#78716c", lineHeight: 1.55 }}>
            Enter the certificate ID printed on the document's seal (e.g. <code style={{ background: "#f5f3ef", padding: "1px 6px", borderRadius: 5 }}>NK-1A2B-3C4D</code>) to confirm it was issued by NkoAha.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={certId}
              onChange={e => setCertId(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") verify(certId); }}
              placeholder="NK-XXXX-XXXX"
              style={{ flex: 1, padding: "11px 13px", border: "1px solid #d6d3d1", borderRadius: 10, fontSize: 14, fontFamily: "inherit", textTransform: "uppercase" }}
            />
            <button onClick={() => verify(certId)} disabled={checking || !certId.trim()} style={{
              padding: "11px 20px", borderRadius: 10, border: "none", background: "#7c3aed", color: "#fff",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: checking ? "default" : "pointer", opacity: checking || !certId.trim() ? .6 : 1,
            }}>{checking ? "Checking…" : "Verify"}</button>
          </div>

          {/* Result */}
          {done && !record && (
            <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#b91c1c", marginBottom: 4 }}>✕ Not found</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
                No certificate matches that ID. Check the code on the seal, or treat the document as unverified.
              </div>
            </div>
          )}

          {record && (
            <div style={{ marginTop: 16 }}>
              <div style={{ padding: "16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>✓ Genuine NkoAha certificate</div>
                <Row label="Certificate ID" value={record.cert_id} mono />
                {record.signer_name && <Row label="Issued for" value={record.signer_name} />}
                <Row label="Certified on" value={fmtDate(record.certified_at)} />
                <Row label="Document fingerprint (SHA-256)" value={record.fingerprint} mono small />
              </div>

              {/* Tamper check by re-hashing the actual file */}
              <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px dashed #d6ccf7", background: "#faf7ff" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Confirm the file hasn't been altered</div>
                <div style={{ fontSize: 12.5, color: "#78716c", marginBottom: 10, lineHeight: 1.5 }}>
                  Upload the PDF you received — it's hashed here in your browser (never uploaded) and compared to the fingerprint above.
                </div>
                <label style={{ display: "inline-block", padding: "9px 14px", borderRadius: 9, background: "#7c3aed", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Choose PDF…
                  <input type="file" accept="application/pdf" hidden onChange={e => onFile(e.target.files?.[0])} />
                </label>
                {fileName && <span style={{ fontSize: 12.5, color: "#57534e", marginLeft: 10 }}>{fileName}</span>}

                {fileState === "checking" && <div style={{ marginTop: 10, fontSize: 13, color: "#78716c" }}>Hashing…</div>}
                {fileState === "match" && (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, color: "#15803d", fontWeight: 600 }}>
                    ✓ This file matches the certificate exactly — it has not been altered.
                  </div>
                )}
                {fileState === "mismatch" && (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
                    ✕ This file does NOT match the certificate. It may have been edited after certification, or it's a different file.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: 22, fontSize: 12, color: "#a8a29e", textAlign: "center", maxWidth: 480, lineHeight: 1.5 }}>
        A matching fingerprint means the document is byte-for-byte identical to what NkoAha certified. Any edit in any PDF editor changes the fingerprint and also breaks the embedded digital signature.
      </p>
    </div>
  );
}

function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "3px 0", alignItems: "baseline" }}>
      <span style={{ fontSize: 11.5, color: "#57534e", minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: small ? 11 : 13, fontFamily: mono ? "'DM Mono',ui-monospace,monospace" : "inherit", wordBreak: "break-all", color: "#1c1917" }}>{value}</span>
    </div>
  );
}