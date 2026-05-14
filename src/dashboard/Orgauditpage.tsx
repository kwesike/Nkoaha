import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

/* ─── TYPES ─── */
interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  document_id: string | null;
  metadata: any;
  created_at: string;
  actor_email?: string;
  category: Category;
}

type Category = "documents" | "routing" | "members" | "account" | "all";

/* ─── CATEGORY CONFIG ─── */
const CATEGORIES: { key: Category; label: string; icon: string; color: string; bg: string }[] = [
  { key: "all",       label: "All Activity", icon: "📋", color: "#78716c", bg: "#f5f3ef" },
  { key: "documents", label: "Documents",    icon: "📄", color: "#7c3aed", bg: "#ede9fe" },
  { key: "routing",   label: "Routing",      icon: "📨", color: "#2563eb", bg: "#dbeafe" },
  { key: "members",   label: "Members",      icon: "👥", color: "#0d9488", bg: "#ccfbf1" },
  { key: "account",   label: "Account",      icon: "⚙️", color: "#b45309", bg: "#fef9c3" },
];

const ACTION_CATEGORY: Record<string, Category> = {
  document_created:      "documents",
  document_uploaded:     "documents",
  document_deleted:      "documents",
  document_viewed:       "documents",
  document_signed:       "documents",
  document_sent:         "routing",
  document_received:     "routing",
  document_forwarded:    "routing",
  document_approved:     "routing",
  org_invite_received:   "members",
  org_invite_accepted:   "members",
  org_invite_declined:   "members",
  member_removed:        "members",
  member_joined:         "members",
  partnership_invite_received: "members",
  partnership_accepted:        "members",
  partnership_declined:        "members",
  partnership_ended:           "members",
  login:                 "account",
  logout:                "account",
  profile_updated:       "account",
  password_changed:      "account",
};

const ACTION_META: Record<string, { label: string; icon: string }> = {
  document_created:    { label: "Document Created",    icon: "📝" },
  document_uploaded:   { label: "Document Uploaded",   icon: "📤" },
  document_deleted:    { label: "Document Deleted",    icon: "🗑️" },
  document_viewed:     { label: "Document Viewed",     icon: "👁️" },
  document_signed:     { label: "Document Signed",     icon: "✍️" },
  document_sent:       { label: "Document Sent",       icon: "📨" },
  document_received:   { label: "Document Received",   icon: "📥" },
  document_forwarded:  { label: "Document Forwarded",  icon: "➡️" },
  document_approved:   { label: "Document Approved",   icon: "✅" },
  org_invite_received:          { label: "Org Invite Sent",          icon: "✉️" },
  org_invite_accepted:          { label: "Org Invite Accepted",      icon: "🤝" },
  org_invite_declined:          { label: "Org Invite Declined",      icon: "❌" },
  member_removed:               { label: "Member Removed",           icon: "👤" },
  member_joined:                { label: "Member Joined",            icon: "👋" },
  partnership_invite_received:  { label: "Partnership Request Sent", icon: "🤝" },
  partnership_accepted:         { label: "Partnership Accepted",     icon: "✅" },
  partnership_declined:         { label: "Partnership Declined",     icon: "❌" },
  partnership_ended:            { label: "Partnership Ended",        icon: "🔗" },
  login:               { label: "Logged In",           icon: "🔐" },
  profile_updated:     { label: "Profile Updated",     icon: "✏️" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? {
    label: action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    icon: "📋",
  };
}

function getCategory(action: string): Category {
  return ACTION_CATEGORY[action] ?? "account";
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), dy = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (dy < 7) return `${dy}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root{
    --purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;
    --green:#16a34a;--green-bg:#dcfce7;--blue:#2563eb;--blue-bg:#dbeafe;
    --amber:#b45309;--amber-bg:#fef9c3;--red:#dc2626;--red-bg:#fee2e2;
    --teal:#0d9488;--teal-bg:#ccfbf1;
    --surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
  }

  .al-root{font-family:var(--font);color:var(--text);padding:32px 28px 64px;max-width:1000px}

  /* Header */
  .al-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px}
  .al-title{font-size:20px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px}
  .al-total{background:var(--purple-light);color:var(--purple);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;font-family:var(--mono)}
  .al-export{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s}
  .al-export:hover{background:var(--bg);color:var(--text)}

  /* Category tabs */
  .al-cats{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
  .al-cat{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;border:1.5px solid var(--border);background:var(--surface);font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s;white-space:nowrap}
  .al-cat:hover{border-color:#c4b5fd;color:var(--purple)}
  .al-cat.active{border-color:var(--purple);background:var(--purple-light);color:var(--purple)}
  .al-cat-count{font-size:10px;font-family:var(--mono);background:rgba(0,0,0,.07);padding:1px 6px;border-radius:10px}

  /* Toolbar */
  .al-toolbar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
  .al-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid var(--border);border-radius:9px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;transition:border-color .15s}
  .al-search:focus{border-color:var(--purple)}
  .al-select{padding:9px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:var(--font);font-size:13px;color:var(--text);background:var(--surface);outline:none;cursor:pointer}
  .al-select:focus{border-color:var(--purple)}

  /* Stats strip */
  .al-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px}
  .al-stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
  .al-stat-label{font-size:10.5px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .al-stat-value{font-size:22px;font-weight:700;color:var(--text);letter-spacing:-.02em}

  /* Log list */
  .al-list{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
  .al-day-group{border-bottom:1px solid var(--border)}
  .al-day-group:last-child{border-bottom:none}
  .al-day-header{padding:8px 18px;background:var(--bg);font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border)}
  .al-item{display:flex;align-items:flex-start;gap:12px;padding:13px 18px;border-bottom:1px solid #faf9f8;transition:background .12s;animation:al-fade .3s both}
  .al-item:last-child{border-bottom:none}
  .al-item:hover{background:#faf9f8}
  @keyframes al-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  .al-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;margin-top:1px}
  .al-body{flex:1;min-width:0}
  .al-action{font-size:13px;font-weight:500;color:var(--text);margin-bottom:2px}
  .al-doc{font-size:12px;color:var(--purple);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .al-actor{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px}
  .al-actor-chip{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-family:var(--mono);font-size:10px}
  .al-time{font-size:11px;font-family:var(--mono);color:var(--muted);flex-shrink:0;white-space:nowrap;margin-top:2px}
  .al-cat-pill{font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap;margin-left:6px;text-transform:uppercase;letter-spacing:.05em}

  .al-empty{text-align:center;padding:52px 0;color:var(--muted)}
  .al-empty-icon{font-size:40px;opacity:.3;margin-bottom:12px}
  .al-load-more{width:100%;padding:12px;border:none;background:var(--bg);font-family:var(--font);font-size:13px;color:var(--muted);cursor:pointer;transition:background .15s;border-top:1px solid var(--border)}
  .al-load-more:hover{background:var(--border);color:var(--text)}

  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .al-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}
`;

const PAGE_SIZE = 30;

export default function OrgAuditPage() {
  const [logs, setLogs]           = useState<AuditLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [offset, setOffset]       = useState(0);
  const [category, setCategory]   = useState<Category>("all");
  const [search, setSearch]       = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [stats, setStats]         = useState({ total:0, docs:0, routing:0, members:0 });

  useEffect(() => {
    const id = "al-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data: org } = await supabase.from("organizations").select("id").eq("owner_id", user.id).single();
    if (!org) return;
    // Get all member IDs under this org + the owner
    const { data: mems } = await supabase.from("profiles").select("id").eq("organization_id", org.id);
    const ids = [user.id, ...(mems||[]).map((m:any) => m.id)];
    setMemberIds(ids);

    await loadLogs(ids, 0, "all", "", "all");
  }

  const loadLogs = useCallback(async (
    ids: string[], off: number, cat: Category, q: string, date: string, append = false
  ) => {
    if (!append) setLoading(true); else setLoadingMore(true);

    // Query without filtering by ids — RLS policy handles org owner seeing member logs
    // Also query with ids as fallback in case RLS returns empty
    let query = supabase.from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(off, off + PAGE_SIZE - 1);

    // Date filter
    if (date !== "all") {
      const now = new Date();
      if (date === "today") {
        const start = new Date(now); start.setHours(0,0,0,0);
        query = query.gte("created_at", start.toISOString());
      } else if (date === "week") {
        const start = new Date(now); start.setDate(now.getDate() - 7);
        query = query.gte("created_at", start.toISOString());
      } else if (date === "month") {
        const start = new Date(now); start.setDate(now.getDate() - 30);
        query = query.gte("created_at", start.toISOString());
      }
    }

    const { data, error } = await query;
    if (error) { setLoading(false); setLoadingMore(false); return; }

    // Enrich with actor email
    const uniqueUserIds = [...new Set((data||[]).map((l:any) => l.user_id))];
    let emailMap: Record<string,string> = {};
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles")
        .select("id,email").in("id", uniqueUserIds);
      (profiles||[]).forEach((p:any) => { emailMap[p.id] = p.email; });
    }

    const enriched: AuditLog[] = (data||[]).map((row:any) => ({
      ...row,
      actor_email: emailMap[row.user_id] || "Unknown",
      category: getCategory(row.action),
    }));

    // Filter by category + search client-side (after enrichment)
    const filtered = enriched.filter(log => {
      const matchMember = ids.length === 0 || ids.includes(log.user_id);
      const matchCat = cat === "all" || log.category === cat;
      const matchQ = !q || log.actor_email?.toLowerCase().includes(q.toLowerCase()) ||
        getActionMeta(log.action).label.toLowerCase().includes(q.toLowerCase()) ||
        (log.metadata?.document_title || "").toLowerCase().includes(q.toLowerCase()) ||
        (log.metadata?.title || "").toLowerCase().includes(q.toLowerCase());
      return matchMember && matchCat && matchQ;
    });

    // Stats (only on first load)
    if (off === 0 && !append) {
      setStats({
        total:   enriched.length,
        docs:    enriched.filter(l => l.category === "documents").length,
        routing: enriched.filter(l => l.category === "routing").length,
        members: enriched.filter(l => l.category === "members").length,
      });
    }

    setHasMore((data||[]).length === PAGE_SIZE);
    if (append) {
      setLogs(prev => [...prev, ...filtered]);
    } else {
      setLogs(filtered);
    }
    setOffset(off + PAGE_SIZE);
    setLoading(false); setLoadingMore(false);
  }, []);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data: org } = await supabase.from("organizations").select("id").eq("owner_id", user.id).single();
    if (!org) return;
    const { data: mems } = await supabase.from("profiles").select("id").eq("organization_id", org.id);
    const ids = [user.id, ...(mems||[]).map((m:any) => m.id)];
    setMemberIds(ids);
    setOffset(0);
    await loadLogs(ids, 0, category, search, dateFilter);
  }

  // Re-fetch when filters change
  useEffect(() => {
    if (!memberIds.length) return;
    setOffset(0);
    loadLogs(memberIds, 0, category, search, dateFilter);
  }, [category, dateFilter, memberIds]);

  // Debounced search
  useEffect(() => {
    if (!memberIds.length) return;
    const t = setTimeout(() => { loadLogs(memberIds, 0, category, search, dateFilter); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Group by day
  const grouped = logs.reduce((acc: Record<string, AuditLog[]>, log) => {
    const day = new Date(log.created_at).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
    if (!acc[day]) acc[day] = [];
    acc[day].push(log);
    return acc;
  }, {});

  const catCounts = logs.reduce((acc: Record<string, number>, log) => {
    acc[log.category] = (acc[log.category] || 0) + 1;
    return acc;
  }, {});

  function exportCSV() {
    const rows = [
      ["Time", "Actor", "Action", "Category", "Document", "Details"],
      ...logs.map(l => [
        new Date(l.created_at).toLocaleString(),
        l.actor_email || "",
        getActionMeta(l.action).label,
        l.category,
        l.metadata?.document_title || "",
        JSON.stringify(l.metadata || {}),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  return (
    <DashboardLayout>
      <div className="al-root">

        {/* Header */}
        <div className="al-header">
          <div className="al-title">
            Audit Log
            {logs.length > 0 && <span className="al-total">{logs.length} events</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="al-export" onClick={refresh}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
            <button className="al-export" onClick={exportCSV}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="al-stats">
          {[
            { label:"Total Events",  value: stats.total,   color:"var(--purple)" },
            { label:"Document",      value: stats.docs,    color:"var(--purple)" },
            { label:"Routing",       value: stats.routing, color:"var(--blue)"   },
            { label:"Member",        value: stats.members, color:"var(--teal)"   },
          ].map(s => (
            <div key={s.label} className="al-stat">
              <div className="al-stat-label">{s.label}</div>
              <div className="al-stat-value" style={{color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="al-cats">
          {CATEGORIES.map(cat => (
            <button key={cat.key} className={`al-cat${category===cat.key?" active":""}`}
              onClick={() => setCategory(cat.key)}>
              <span>{cat.icon}</span>
              {cat.label}
              {cat.key !== "all" && catCounts[cat.key] > 0 && (
                <span className="al-cat-count">{catCounts[cat.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="al-toolbar">
          <input className="al-search" placeholder="Search by user, action, document…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="al-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
        </div>

        {/* Log list */}
        <div className="al-list">
          {loading && Array.from({length:6}).map((_,i) => (
            <div key={i} className="al-item">
              <div className="al-skel" style={{width:34,height:34,borderRadius:9,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div className="al-skel" style={{width:"55%",height:12,marginBottom:6}}/>
                <div className="al-skel" style={{width:"35%",height:10,marginBottom:4}}/>
                <div className="al-skel" style={{width:"25%",height:9}}/>
              </div>
              <div className="al-skel" style={{width:60,height:10}}/>
            </div>
          ))}

          {!loading && logs.length === 0 && (
            <div className="al-empty">
              <div className="al-empty-icon">📋</div>
              <p style={{fontWeight:500,color:"#44403c",marginBottom:4,fontSize:14}}>No activity found</p>
              <span style={{fontSize:12}}>
                {search || category !== "all" ? "Try adjusting your filters" : "Activity will appear here as your team uses the platform"}
              </span>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([day, dayLogs]) => (
            <div key={day} className="al-day-group">
              <div className="al-day-header">{day}</div>
              {dayLogs.map((log, idx) => {
                const meta = getActionMeta(log.action);
                const cat  = CATEGORIES.find(c => c.key === log.category) || CATEGORIES[0];
                return (
                  <div key={log.id ?? idx} className="al-item">
                    <div className="al-icon" style={{background: cat.bg, color: cat.color}}>
                      {meta.icon}
                    </div>
                    <div className="al-body">
                      <div className="al-action">
                        {meta.label}
                        <span className="al-cat-pill" style={{background: cat.bg, color: cat.color}}>
                          {cat.label}
                        </span>
                      </div>
                      {(log.metadata?.document_title || log.metadata?.title) && (
                        <div className="al-doc">
                          📄 {log.metadata?.document_title || log.metadata?.title}
                        </div>
                      )}
                      {log.metadata?.organization_name && (
                        <div className="al-doc">🏢 {log.metadata.organization_name}</div>
                      )}
                      <div className="al-actor">
                        By <span className="al-actor-chip">{log.actor_email}</span>
                      </div>
                    </div>
                    <div className="al-time">{timeAgo(log.created_at)}</div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && !loading && (
            <button className="al-load-more" disabled={loadingMore}
              onClick={() => loadLogs(memberIds, offset, category, search, dateFilter, true)}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}