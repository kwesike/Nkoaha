import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

/* Website analytics for nkoaha.space — page views, visitors, clicks, traffic
   sources and recent activity, for monitoring + security. Reads website_events
   (admin-only RLS) and aggregates client-side. */

const STYLES = `
  .aw-root{padding:28px;font-family:'DM Sans',sans-serif;color:#1c1917}
  .aw-bar{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
  .aw-title{font-size:18px;font-weight:700}
  .aw-sub{font-size:12px;color:#78716c}
  .aw-spacer{flex:1}
  .aw-range{display:inline-flex;border:1.5px solid #e7e4df;border-radius:9px;overflow:hidden;background:#fff}
  .aw-range button{padding:7px 13px;border:none;background:#fff;font-family:inherit;font-size:12.5px;color:#57534e;cursor:pointer}
  .aw-range button.on{background:#7c3aed;color:#fff;font-weight:600}
  .aw-refresh{padding:7px 13px;border:1.5px solid #e7e4df;border-radius:9px;background:#fff;font-size:12.5px;color:#7c3aed;cursor:pointer;font-family:inherit;font-weight:600}
  .aw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  @media(max-width:760px){.aw-kpis{grid-template-columns:repeat(2,1fr)}}
  .aw-kpi{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:16px 18px}
  .aw-kpi-n{font-size:26px;font-weight:700;font-family:'DM Mono',monospace;color:#1c1917}
  .aw-kpi-l{font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
  .aw-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px}
  @media(max-width:900px){.aw-grid{grid-template-columns:1fr}}
  .aw-card{background:#fff;border:1px solid #e7e4df;border-radius:14px;padding:18px 20px}
  .aw-card h3{font-size:13px;font-weight:700;margin:0 0 14px;color:#1c1917}
  .aw-chart{display:flex;align-items:flex-end;gap:4px;height:160px}
  .aw-barcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
  .aw-cbar{width:100%;max-width:26px;background:linear-gradient(180deg,#a78bfa,#7c3aed);border-radius:4px 4px 0 0;transition:height .3s}
  .aw-bar-lbl{font-size:9px;color:#a8a29e;white-space:nowrap;font-family:'DM Mono',monospace}
  .aw-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #faf6f0;font-size:12.5px}
  .aw-row:last-child{border-bottom:none}
  .aw-row .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#44403c}
  .aw-row .ct{font-family:'DM Mono',monospace;color:#7c3aed;font-weight:600}
  .aw-rowbar{height:5px;border-radius:5px;background:#ede9fe;margin-top:4px;overflow:hidden}
  .aw-rowbar > i{display:block;height:100%;background:#7c3aed}
  .aw-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  @media(max-width:900px){.aw-two{grid-template-columns:1fr}}
  .aw-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .aw-table th{padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .aw-table td{padding:10px 14px;font-size:12px;color:#1c1917;border-bottom:1px solid #faf9f8;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aw-table tr:last-child td{border-bottom:none}
  .aw-ip{font-family:'DM Mono',monospace;font-size:11px;color:#57534e}
  .aw-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:700}
  .aw-empty{padding:48px;text-align:center;color:#a8a29e;font-size:13px}
  .aw-note{font-size:11.5px;color:#a8a29e;margin-top:14px}
`;

type Ev = {
  created_at: string; type: string; path: string | null; referrer: string | null;
  source: string | null; label: string | null; href: string | null;
  visitor_id: string | null; session_id: string | null; device: string | null;
  ip: string | null; country: string | null;
};

const RANGES = [{ k: "24h", d: 1 }, { k: "7d", d: 7 }, { k: "30d", d: 30 }];

function topCounts(items: string[], n: number) {
  const m = new Map<string, number>();
  for (const it of items) { const k = it || "—"; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function AdminWebsitePage() {
  const [days, setDays]     = useState(7);
  const [rows, setRows]     = useState<Ev[]>([]);
  const [loading, setLoad]  = useState(true);

  const load = useCallback(async () => {
    setLoad(true);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("website_events")
      .select("created_at,type,path,referrer,source,label,href,visitor_id,session_id,device,ip,country")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    setRows((data || []) as Ev[]);
    setLoad(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const agg = useMemo(() => {
    const pv = rows.filter(r => r.type === "pageview");
    const cl = rows.filter(r => r.type === "click");
    const visitors = new Set(pv.map(r => r.visitor_id).filter(Boolean)).size;
    const sessions = new Set(pv.map(r => r.session_id).filter(Boolean)).size;

    // Daily series (page views per day, oldest→newest)
    const byDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of pv) {
      const k = (r.created_at || "").slice(0, 10);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    const series = [...byDay.entries()];
    const maxDay = Math.max(1, ...series.map(s => s[1]));

    return {
      pageviews: pv.length, visitors, sessions, clicks: cl.length,
      topPages:   topCounts(pv.map(r => r.path || "/"), 8),
      topSources: topCounts(pv.map(r => r.source || "direct"), 8),
      devices:    topCounts(pv.map(r => r.device || "desktop"), 4),
      topClicks:  topCounts(cl.map(r => r.label || r.href || "—"), 8),
      series, maxDay,
      recent: pv.slice(0, 40),
    };
  }, [rows, days]);

  const maxPage   = Math.max(1, ...agg.topPages.map(p => p[1]));
  const maxSource = Math.max(1, ...agg.topSources.map(p => p[1]));
  const maxClick  = Math.max(1, ...agg.topClicks.map(p => p[1]));
  const fmtTime = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

  return (
    <AdminLayout title="Website">
      <style>{STYLES}</style>
      <div className="aw-root">
        <div className="aw-bar">
          <div>
            <div className="aw-title">Website analytics</div>
            <div className="aw-sub">Visitors, traffic &amp; clicks on nkoaha.space</div>
          </div>
          <div className="aw-spacer" />
          <div className="aw-range">
            {RANGES.map(r => (
              <button key={r.k} className={days === r.d ? "on" : ""} onClick={() => setDays(r.d)}>{r.k}</button>
            ))}
          </div>
          <button className="aw-refresh" onClick={load}>↻ Refresh</button>
        </div>

        {loading ? (
          <div className="aw-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="aw-empty">
            No traffic recorded yet in this window.<br />
            Once the tracking script is live on nkoaha.space and someone visits, data appears here.
          </div>
        ) : (
          <>
            <div className="aw-kpis">
              <div className="aw-kpi"><div className="aw-kpi-n">{agg.pageviews.toLocaleString()}</div><div className="aw-kpi-l">Page views</div></div>
              <div className="aw-kpi"><div className="aw-kpi-n">{agg.visitors.toLocaleString()}</div><div className="aw-kpi-l">Unique visitors</div></div>
              <div className="aw-kpi"><div className="aw-kpi-n">{agg.sessions.toLocaleString()}</div><div className="aw-kpi-l">Sessions</div></div>
              <div className="aw-kpi"><div className="aw-kpi-n">{agg.clicks.toLocaleString()}</div><div className="aw-kpi-l">Clicks</div></div>
            </div>

            <div className="aw-grid">
              <div className="aw-card">
                <h3>Page views per day</h3>
                <div className="aw-chart">
                  {agg.series.map(([day, n]) => (
                    <div className="aw-barcol" key={day} title={`${day}: ${n}`}>
                      <div className="aw-cbar" style={{ height: `${Math.round((n / agg.maxDay) * 130)}px` }} />
                      <span className="aw-bar-lbl">{day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="aw-card">
                <h3>Traffic sources</h3>
                {agg.topSources.map(([s, n]) => (
                  <div key={s} style={{ marginBottom: 8 }}>
                    <div className="aw-row" style={{ border: "none", padding: "2px 0" }}>
                      <span className="nm">{s}</span><span className="ct">{n}</span>
                    </div>
                    <div className="aw-rowbar"><i style={{ width: `${(n / maxSource) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="aw-two">
              <div className="aw-card">
                <h3>Top pages</h3>
                {agg.topPages.map(([p, n]) => (
                  <div key={p} style={{ marginBottom: 8 }}>
                    <div className="aw-row" style={{ border: "none", padding: "2px 0" }}>
                      <span className="nm">{p}</span><span className="ct">{n}</span>
                    </div>
                    <div className="aw-rowbar"><i style={{ width: `${(n / maxPage) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="aw-card">
                <h3>Most clicked</h3>
                {agg.topClicks.length === 0 ? <div className="aw-sub">No clicks recorded yet.</div> :
                  agg.topClicks.map(([c, n]) => (
                    <div key={c} style={{ marginBottom: 8 }}>
                      <div className="aw-row" style={{ border: "none", padding: "2px 0" }}>
                        <span className="nm">{c}</span><span className="ct">{n}</span>
                      </div>
                      <div className="aw-rowbar"><i style={{ width: `${(n / maxClick) * 100}%` }} /></div>
                    </div>
                  ))}
                <div style={{ marginTop: 14 }}>
                  <h3 style={{ marginBottom: 8 }}>Devices</h3>
                  {agg.devices.map(([d, n]) => (
                    <div className="aw-row" key={d}><span className="nm">{d}</span><span className="ct">{n}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="aw-card">
              <h3>Recent visits</h3>
              <table className="aw-table">
                <thead><tr><th>Time</th><th>Page</th><th>Source</th><th>Device</th><th>Country</th><th>IP</th></tr></thead>
                <tbody>
                  {agg.recent.map((r, i) => (
                    <tr key={i}>
                      <td>{fmtTime(r.created_at)}</td>
                      <td>{r.path || "/"}</td>
                      <td><span className="aw-pill">{r.source || "direct"}</span></td>
                      <td>{r.device || "—"}</td>
                      <td>{r.country || "—"}</td>
                      <td className="aw-ip">{r.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="aw-note">
                IP addresses are shown for security monitoring and are visible to admins only. Data is anonymous (no sign-in required to visit the site).
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}