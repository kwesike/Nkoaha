import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

// ─────────────────────────────────────────────────────────────
// Admin → Monitoring: usage of certificate verification, automations,
// and external (guest) signers, plus a suspicious-activity feed.
// Suspicious attempts come from the shared security_events table, so
// the mitigation (IP blocking) on the Security page already applies.
// ─────────────────────────────────────────────────────────────

const SUSPICIOUS_TYPES = ["guest_otp_failed", "guest_otp_locked", "guest_invalid_token"];

const timeAgo = (s: string) => {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const CSS = `
  .mon-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
  .mon-stat{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:14px 16px}
  .mon-stat .n{font-size:26px;font-weight:800;color:#1c1917;line-height:1}
  .mon-stat .l{font-size:12px;color:#78716c;margin-top:5px}
  .mon-stat.warn{border-color:#fca5a5;background:#fef2f2}
  .mon-stat.warn .n{color:#b91c1c}
  .mon-sec{margin-bottom:28px}
  .mon-h{font-size:15px;font-weight:800;margin:0 0 10px;display:flex;align-items:center;gap:8px}
  .mon-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .mon-table th{padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .mon-table td{padding:10px 14px;font-size:12.5px;color:#1c1917;border-bottom:1px solid #faf9f8;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mon-table tr:last-child td{border-bottom:none}
  .mon-pill{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px}
  .mon-ok{background:#dcfce7;color:#15803d}.mon-bad{background:#fee2e2;color:#b91c1c}.mon-neu{background:#ede9fe;color:#7c3aed}.mon-amb{background:#fef3c7;color:#b45309}
  .mon-banner{background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c;border-radius:10px;padding:12px 16px;font-size:13px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
  .mon-empty{padding:20px;text-align:center;color:#a8a29e;font-size:13px}
`;

export default function AdminMonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState({ total: 0, mismatch: 0, recent: [] as any[] });
  const [autos, setAutos] = useState({ total: 0, enabled: 0, errors: 0, recent: [] as any[] });
  const [guests, setGuests] = useState({ invites: 0, pending: 0, completed: 0 });
  const [susp, setSusp] = useState({ count: 0, recent: [] as any[] });

  useEffect(() => { (async () => {
    const count = (q: any) => q.then((r: any) => r.count || 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      certTotal, certMismatch, certRecent,
      autoTotal, autoEnabled, autoErrors, autoRecent,
      gInvites, gPending, gCompleted,
      suspCount, suspRecent,
    ] = await Promise.all([
      count(supabase.from("certificate_verifications").select("id", { count: "exact", head: true })),
      count(supabase.from("certificate_verifications").select("id", { count: "exact", head: true }).eq("outcome", "file_mismatch")),
      supabase.from("certificate_verifications").select("cert_id,outcome,created_at").order("created_at", { ascending: false }).limit(10),
      count(supabase.from("automations").select("id", { count: "exact", head: true })),
      count(supabase.from("automations").select("id", { count: "exact", head: true }).eq("enabled", true)),
      count(supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("status", "error")),
      supabase.from("automation_runs").select("status,detail,ran_at").order("ran_at", { ascending: false }).limit(10),
      count(supabase.from("document_routes").select("id", { count: "exact", head: true }).eq("is_external", true)),
      count(supabase.from("document_routes").select("id", { count: "exact", head: true }).eq("is_external", true).eq("status", "pending")),
      count(supabase.from("document_routes").select("id", { count: "exact", head: true }).eq("is_external", true).eq("status", "completed")),
      count(supabase.from("security_events").select("id", { count: "exact", head: true }).in("event_type", SUSPICIOUS_TYPES).gte("created_at", weekAgo)),
      supabase.from("security_events").select("event_type,email,ip_address,metadata,created_at").in("event_type", SUSPICIOUS_TYPES).order("created_at", { ascending: false }).limit(12),
    ]);

    setCerts({ total: certTotal, mismatch: certMismatch, recent: certRecent.data || [] });
    setAutos({ total: autoTotal, enabled: autoEnabled, errors: autoErrors, recent: autoRecent.data || [] });
    setGuests({ invites: gInvites, pending: gPending, completed: gCompleted });
    setSusp({ count: suspCount, recent: suspRecent.data || [] });
    setLoading(false);
  })(); }, []);

  const outcomePill = (o: string) => {
    if (o === "found" || o === "file_match") return <span className="mon-pill mon-ok">{o.replace("_", " ")}</span>;
    if (o === "file_mismatch") return <span className="mon-pill mon-bad">tamper — mismatch</span>;
    return <span className="mon-pill mon-amb">{o.replace("_", " ")}</span>;
  };
  const runPill = (s: string) => <span className={`mon-pill ${s === "success" ? "mon-ok" : s === "error" ? "mon-bad" : "mon-neu"}`}>{s}</span>;
  const suspLabel: Record<string, string> = {
    guest_otp_failed: "Wrong OTP", guest_otp_locked: "Locked (too many tries)", guest_invalid_token: "Invalid link used",
  };

  return (
    <AdminLayout title="Monitoring">
      <style>{CSS}</style>
      {loading ? <div className="mon-empty">Loading…</div> : (
        <>
          {(certs.mismatch > 0 || susp.count > 0) && (
            <div className="mon-banner">
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <strong>Attention.</strong>{" "}
                {certs.mismatch > 0 && <>{certs.mismatch} document(s) failed a tamper check. </>}
                {susp.count > 0 && <>{susp.count} suspicious signing attempt(s) in the last 7 days. </>}
                Review below — you can block offending IPs on the <a href="/dashboard/admin/security" style={{ color: "#7c3aed", fontWeight: 600 }}>Security</a> page.
              </div>
            </div>
          )}

          {/* ── Certificate verifications ── */}
          <div className="mon-sec">
            <h2 className="mon-h">🔎 Certificate verifications</h2>
            <div className="mon-grid">
              <div className="mon-stat"><div className="n">{certs.total}</div><div className="l">Total checks</div></div>
              <div className={`mon-stat ${certs.mismatch > 0 ? "warn" : ""}`}><div className="n">{certs.mismatch}</div><div className="l">Tamper mismatches</div></div>
            </div>
            <table className="mon-table">
              <thead><tr><th>Certificate</th><th>Outcome</th><th>When</th></tr></thead>
              <tbody>
                {certs.recent.length === 0 ? <tr><td colSpan={3} className="mon-empty">No verifications yet</td></tr>
                  : certs.recent.map((c, i) => <tr key={i}><td>{c.cert_id || "—"}</td><td>{outcomePill(c.outcome)}</td><td>{timeAgo(c.created_at)}</td></tr>)}
              </tbody>
            </table>
          </div>

          {/* ── Automations ── */}
          <div className="mon-sec">
            <h2 className="mon-h">⚡ Automations</h2>
            <div className="mon-grid">
              <div className="mon-stat"><div className="n">{autos.total}</div><div className="l">Total automations</div></div>
              <div className="mon-stat"><div className="n">{autos.enabled}</div><div className="l">Enabled</div></div>
              <div className={`mon-stat ${autos.errors > 0 ? "warn" : ""}`}><div className="n">{autos.errors}</div><div className="l">Run errors</div></div>
            </div>
            <table className="mon-table">
              <thead><tr><th>Status</th><th>Detail</th><th>When</th></tr></thead>
              <tbody>
                {autos.recent.length === 0 ? <tr><td colSpan={3} className="mon-empty">No automation runs yet</td></tr>
                  : autos.recent.map((r, i) => <tr key={i}><td>{runPill(r.status)}</td><td title={r.detail || ""}>{r.detail || "—"}</td><td>{timeAgo(r.ran_at)}</td></tr>)}
              </tbody>
            </table>
          </div>

          {/* ── Guest signers ── */}
          <div className="mon-sec">
            <h2 className="mon-h">✍️ External (guest) signers</h2>
            <div className="mon-grid">
              <div className="mon-stat"><div className="n">{guests.invites}</div><div className="l">Total invited</div></div>
              <div className="mon-stat"><div className="n">{guests.pending}</div><div className="l">Awaiting signature</div></div>
              <div className="mon-stat"><div className="n">{guests.completed}</div><div className="l">Signed</div></div>
            </div>
          </div>

          {/* ── Suspicious attempts ── */}
          <div className="mon-sec">
            <h2 className="mon-h">🛡️ Suspicious signing attempts <span style={{ fontSize: 11, fontWeight: 500, color: "#a8a29e" }}>(last 7 days)</span></h2>
            <table className="mon-table">
              <thead><tr><th>Type</th><th>Email</th><th>IP</th><th>Detail</th><th>When</th></tr></thead>
              <tbody>
                {susp.recent.length === 0 ? <tr><td colSpan={5} className="mon-empty">No suspicious attempts — all clear</td></tr>
                  : susp.recent.map((e, i) => (
                    <tr key={i}>
                      <td><span className="mon-pill mon-bad">{suspLabel[e.event_type] || e.event_type}</span></td>
                      <td title={e.email || ""}>{e.email || "—"}</td>
                      <td>{e.ip_address || "—"}</td>
                      <td title={JSON.stringify(e.metadata || {})}>{e.metadata?.attempts ? `attempt ${e.metadata.attempts}` : "—"}</td>
                      <td>{timeAgo(e.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11.5, color: "#a8a29e", marginTop: 8 }}>
              Mitigation: links lock automatically after 5 wrong codes, codes expire in 10 minutes, and each link is single-signer and time-limited. To block an IP outright, use the Security page.
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}