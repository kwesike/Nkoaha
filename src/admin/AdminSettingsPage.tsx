import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .asec-root{padding:28px}
  .asec-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .asec-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .asec-search:focus{border-color:#7c3aed}
  .asec-filter{padding:8px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;background:#fff;cursor:pointer;outline:none}
  .asec-stats{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .asec-stat{background:#fff;border:1px solid #e7e4df;border-radius:12px;padding:14px 18px;min-width:120px}
  .asec-stat-n{font-size:22px;font-weight:700;color:#1c1917;font-family:'DM Mono',monospace}
  .asec-stat-l{font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
  .asec-table{width:100%;background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;border-collapse:collapse}
  .asec-table th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa;background:#faf9f8;border-bottom:1px solid #e7e4df}
  .asec-table td{padding:11px 16px;font-size:12.5px;color:#1c1917;border-bottom:1px solid #faf9f8;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .asec-table tr:last-child td{border-bottom:none}
  .asec-table tr:hover td{background:#faf8ff}
  .asec-ev{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;white-space:nowrap}
  .asec-ev.login{background:#dbeafe;color:#2563eb}
  .asec-ev.payment{background:#dcfce7;color:#16a34a}
  .asec-ev.document_signed{background:#ede9fe;color:#7c3aed}
  .asec-ev.document_sent{background:#fef3c7;color:#b45309}
  .asec-ev.document_deleted{background:#fee2e2;color:#dc2626}
  .asec-ip{font-family:'DM Mono',monospace;font-size:11.5px;color:#44403c}
  .asec-device{font-size:11.5px;color:#78716c}
  .asec-load-more{width:100%;padding:12px;background:#faf9f8;border:none;border-top:1px solid #e7e4df;font-size:13px;font-weight:600;color:#7c3aed;cursor:pointer;font-family:'DM Sans',sans-serif}
  .asec-load-more:hover{background:#ede9fe}
  .asec-empty{padding:40px;text-align:center;color:#a8a29e;font-size:13px}
  .asec-block-card{background:#fff;border:1px solid #e7e4df;border-radius:14px;padding:18px 20px;margin-bottom:20px}
  .asec-block-title{font-size:14px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .asec-block-desc{font-size:12px;color:#78716c;margin-bottom:14px;line-height:1.5}
  .asec-block-form{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .asec-block-form input{padding:8px 11px;border:1.5px solid #e7e4df;border-radius:8px;font-size:12.5px;font-family:'DM Sans',sans-serif;outline:none;color:#1c1917}
  .asec-block-form input:focus{border-color:#7c3aed}
  .asec-block-btn{padding:8px 14px;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;background:#dc2626;color:#fff}
  .asec-block-btn:hover{background:#b91c1c}
  .asec-chip{display:inline-flex;align-items:center;gap:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#991b1b;font-family:'DM Mono',monospace;margin:0 6px 6px 0}
  .asec-chip button{border:none;background:#fca5a5;color:#7f1d1d;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center}
  .asec-chip button:hover{background:#f87171;color:#fff}
  .asec-row-block{border:1px solid #e7e4df;background:#fff;color:#dc2626;border-radius:6px;font-size:10.5px;font-weight:700;padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif}
  .asec-row-block:hover{background:#fef2f2;border-color:#fca5a5}
  .asec-row-blocked{font-size:10px;color:#dc2626;font-weight:700}
  .asec-block-msg{font-size:12px;color:#166534;background:#dcfce7;border-radius:8px;padding:7px 11px;margin-bottom:10px}
`;

const EVENT_LABELS: Record<string, string> = {
  login: "Login",
  payment: "Payment",
  document_signed: "Signed",
  document_sent: "Sent",
  document_deleted: "Deleted",
};

// Turn a raw user-agent into a short "Browser · OS" label.
function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  let br = "Browser";
  if (/edg\//i.test(ua)) br = "Edge";
  else if (/opr\/|opera/i.test(ua)) br = "Opera";
  else if (/chrome\//i.test(ua)) br = "Chrome";
  else if (/firefox\//i.test(ua)) br = "Firefox";
  else if (/safari\//i.test(ua)) br = "Safari";
  return `${br} · ${os}`;
}

function timeAgo(iso: string): string {
  const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  // ── IP blocklist ──
  const [blocked, setBlocked] = useState<any[]>([]);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = "asec-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load(0, filter);
    loadBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBlocked() {
    const { data } = await supabase.from("blocked_ips")
      .select("ip,reason,created_at").order("created_at", { ascending: false });
    setBlocked(data || []);
  }

  async function blockIp(ip: string, reason?: string) {
    const clean = (ip || "").trim();
    if (!clean) { setBlockMsg("Enter an IP address."); return; }
    if (clean === "unknown") { setBlockMsg("Can't block an unknown IP."); return; }
    setBlockMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("blocked_ips")
      .upsert({ ip: clean, reason: reason || null, created_by: user?.id ?? null }, { onConflict: "ip" });
    if (error) { setBlockMsg("Could not block: " + error.message); return; }
    setNewIp(""); setNewReason("");
    setBlockMsg(`Blocked ${clean}. New visits from this IP are refused (within ~1 min).`);
    loadBlocked();
  }

  async function unblockIp(ip: string) {
    const { error } = await supabase.from("blocked_ips").delete().eq("ip", ip);
    if (error) { setBlockMsg("Could not unblock: " + error.message); return; }
    setBlockMsg(`Unblocked ${ip}.`);
    loadBlocked();
  }

  const blockedSet = new Set(blocked.map(b => b.ip));

  async function load(pageNum: number, evFilter: string) {
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    let q = supabase
      .from("security_events")
      .select("id,user_id,email,event_type,ip_address,user_agent,metadata,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (evFilter !== "all") q = q.eq("event_type", evFilter);
    const { data } = await q;
    const rows = data || [];
    setEvents(prev => (pageNum === 0 ? rows : [...prev, ...rows]));
    setHasMore(rows.length === PAGE_SIZE);
    setPage(pageNum);
    setLoading(false);
  }

  function onFilter(v: string) {
    setFilter(v);
    load(0, v);
  }

  const shown = events.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (e.email || "").toLowerCase().includes(s) || (e.ip_address || "").toLowerCase().includes(s);
  });

  const counts = events.reduce((a: Record<string, number>, e) => {
    a[e.event_type] = (a[e.event_type] || 0) + 1; return a;
  }, {});

  return (
    <AdminLayout title="Security">
      <div className="asec-root">
        <div className="asec-stats">
          {(["login", "payment", "document_signed", "document_sent", "document_deleted"] as const).map(k => (
            <div className="asec-stat" key={k}>
              <div className="asec-stat-n">{counts[k] || 0}</div>
              <div className="asec-stat-l">{EVENT_LABELS[k]}</div>
            </div>
          ))}
        </div>

        {/* ── IP blocklist ── */}
        <div className="asec-block-card">
          <div className="asec-block-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>
            Blocked IP addresses
          </div>
          <div className="asec-block-desc">
            Blocked IPs are refused at the site edge (a "403 Access blocked" page) and on sensitive actions.
            Takes effect within about a minute. You can also block an IP straight from any row in the log below.
          </div>
          {blockMsg && <div className="asec-block-msg">{blockMsg}</div>}
          <div className="asec-block-form">
            <input placeholder="IP address, e.g. 102.89.x.x" value={newIp} onChange={e => setNewIp(e.target.value)} style={{ minWidth: 200 }} />
            <input placeholder="Reason (optional)" value={newReason} onChange={e => setNewReason(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
            <button className="asec-block-btn" onClick={() => blockIp(newIp, newReason)}>Block IP</button>
          </div>
          <div>
            {blocked.length === 0
              ? <span style={{ fontSize: 12, color: "#a8a29e" }}>No IPs blocked.</span>
              : blocked.map(b => (
                <span className="asec-chip" key={b.ip} title={b.reason || ""}>
                  {b.ip}
                  <button onClick={() => unblockIp(b.ip)} title="Unblock">×</button>
                </span>
              ))}
          </div>
        </div>

        <div className="asec-bar">
          <input className="asec-search" placeholder="Search by email or IP address…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="asec-filter" value={filter} onChange={e => onFilter(e.target.value)}>
            <option value="all">All events</option>
            <option value="login">Logins</option>
            <option value="payment">Payments</option>
            <option value="document_signed">Signatures</option>
            <option value="document_sent">Sends</option>
            <option value="document_deleted">Deletes</option>
          </select>
        </div>

        <table className="asec-table">
          <thead>
            <tr>
              <th>Event</th><th>User</th><th>IP address</th><th>Device</th><th>When</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(e => {
              const ip = e.ip_address || "";
              const canBlock = ip && ip !== "unknown";
              const isBlocked = blockedSet.has(ip);
              return (
              <tr key={e.id}>
                <td><span className={`asec-ev ${e.event_type}`}>{EVENT_LABELS[e.event_type] || e.event_type}</span></td>
                <td title={e.email || ""}>{e.email || "—"}</td>
                <td className="asec-ip">{ip || "—"}</td>
                <td className="asec-device" title={e.user_agent || ""}>{deviceLabel(e.user_agent)}</td>
                <td title={new Date(e.created_at).toLocaleString()}>{timeAgo(e.created_at)}</td>
                <td style={{ textAlign: "right" }}>
                  {!canBlock ? null
                    : isBlocked
                      ? <span className="asec-row-blocked">blocked</span>
                      : <button className="asec-row-block" onClick={() => blockIp(ip, `From security log · ${EVENT_LABELS[e.event_type] || e.event_type}`)}>Block</button>}
                </td>
              </tr>
            );})}
          </tbody>
        </table>

        {!loading && shown.length === 0 && (
          <div className="asec-empty">No security events{filter !== "all" ? " for this filter" : ""} yet.</div>
        )}
        {hasMore && (
          <button className="asec-load-more" onClick={() => load(page + 1, filter)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </AdminLayout>
  );
}