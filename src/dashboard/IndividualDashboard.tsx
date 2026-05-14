import { useEffect, useState } from "react";
import DashboardLayout from "./layout/DashboardLayout";
import { supabase } from "../lib/supabase";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --purple:#7c3aed; --purple-light:#ede9fe; --purple-mid:#a78bfa; --purple-dark:#5b21b6;
    --bg:#f5f3ef; --surface:#ffffff; --border:#e7e4df; --text:#1c1917; --muted:#78716c;
    --font:'DM Sans',sans-serif; --mono:'DM Mono',monospace;
    --green:#16a34a; --green-bg:#dcfce7; --amber:#b45309; --amber-bg:#fef9c3;
    --red:#dc2626; --red-bg:#fee2e2; --blue:#2563eb; --blue-bg:#dbeafe;
  }
  .ov-root { font-family:var(--font); color:var(--text); max-width:1100px; margin:0 auto; padding:32px 28px 64px; }
  .ov-header { margin-bottom:32px; }
  .ov-greeting { font-size:22px; font-weight:700; color:var(--text); margin-bottom:3px; letter-spacing:-0.02em; }
  .ov-greeting span { color:var(--purple); }
  .ov-sub { font-size:13px; color:var(--muted); font-weight:400; }

  .ov-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; margin-bottom:36px; }
  .ov-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:20px 20px 18px; position:relative; overflow:hidden; transition:box-shadow .18s,transform .18s; animation:ov-fade-up .4s both; }
  .ov-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.07); transform:translateY(-2px); }
  .ov-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:14px 14px 0 0; }
  .ov-card.purple::before { background:var(--purple); }
  .ov-card.green::before  { background:var(--green); }
  .ov-card.amber::before  { background:#d97706; }
  .ov-card.red::before    { background:var(--red); }
  .ov-card.blue::before   { background:var(--blue); }
  .ov-card-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; margin-bottom:14px; }
  .ov-card.purple .ov-card-icon { background:var(--purple-light); }
  .ov-card.green  .ov-card-icon { background:var(--green-bg); }
  .ov-card.amber  .ov-card-icon { background:#fef3c7; }
  .ov-card.red    .ov-card-icon { background:var(--red-bg); }
  .ov-card.blue   .ov-card-icon { background:var(--blue-bg); }
  .ov-card-label { font-size:11.5px; font-weight:500; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
  .ov-card-value { font-size:32px; font-weight:700; letter-spacing:-.03em; line-height:1; color:var(--text); }
  .ov-card.purple .ov-card-value { color:var(--purple); }
  .ov-card-bar-track { margin-top:10px; height:5px; background:var(--border); border-radius:99px; overflow:hidden; }
  .ov-card-bar-fill { height:100%; border-radius:99px; background:var(--purple); transition:width .8s cubic-bezier(.16,1,.3,1); }

  .ov-bottom { display:grid; grid-template-columns:1fr 320px; gap:20px; align-items:start; }
  @media(max-width:760px) { .ov-bottom { grid-template-columns:1fr; } }

  .ov-section { background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
  .ov-section-head { padding:18px 22px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
  .ov-section-title { font-size:14px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:8px; }
  .ov-section-title-dot { width:8px; height:8px; border-radius:50%; background:var(--purple); }
  .ov-section-count { font-size:11px; font-family:var(--mono); background:var(--purple-light); color:var(--purple); padding:2px 8px; border-radius:20px; }
  .ov-activity-list { padding:8px 0; }
  .ov-activity-item { display:flex; align-items:flex-start; gap:12px; padding:12px 22px; border-bottom:1px solid #faf9f8; transition:background .12s; animation:ov-fade-up .35s both; }
  .ov-activity-item:last-child { border-bottom:none; }
  .ov-activity-item:hover { background:#faf9f8; }
  .ov-activity-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; margin-top:1px; }
  .ov-activity-body { flex:1; min-width:0; }
  .ov-activity-action { font-size:13px; font-weight:500; color:var(--text); margin-bottom:2px; }
  .ov-activity-doc { font-size:12px; color:var(--purple); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px; }
  .ov-activity-time { font-size:11px; font-family:var(--mono); color:var(--muted); }
  .ov-activity-status { font-size:10.5px; font-weight:600; padding:2px 7px; border-radius:20px; white-space:nowrap; flex-shrink:0; margin-top:3px; align-self:flex-start; }

  .ov-empty { padding:36px 22px; text-align:center; color:var(--muted); font-size:13px; }
  .ov-empty-icon { font-size:28px; margin-bottom:8px; opacity:.4; }

  .ov-quick { display:flex; flex-direction:column; gap:14px; }
  .ov-quick-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px 20px; animation:ov-fade-up .4s both; }
  .ov-quick-title { font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.07em; margin-bottom:14px; }
  .ov-breakdown-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:12.5px; }
  .ov-breakdown-label { color:var(--text); display:flex; align-items:center; gap:6px; }
  .ov-breakdown-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .ov-breakdown-val { font-family:var(--mono); font-size:12px; font-weight:500; color:var(--muted); }
  .ov-breakdown-track { height:4px; background:var(--border); border-radius:99px; margin-top:10px; overflow:hidden; }
  .ov-breakdown-fill { height:100%; border-radius:99px; transition:width .9s cubic-bezier(.16,1,.3,1); }

  @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  .ov-skel { background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%); background-size:600px 100%; animation:shimmer 1.5s infinite; border-radius:6px; }

  @keyframes ov-fade-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .ov-card:nth-child(1){animation-delay:.05s} .ov-card:nth-child(2){animation-delay:.10s}
  .ov-card:nth-child(3){animation-delay:.15s} .ov-card:nth-child(4){animation-delay:.20s}
  .ov-card:nth-child(5){animation-delay:.25s}
  .ov-activity-item:nth-child(1){animation-delay:.05s} .ov-activity-item:nth-child(2){animation-delay:.10s}
  .ov-activity-item:nth-child(3){animation-delay:.15s} .ov-activity-item:nth-child(4){animation-delay:.20s}
  .ov-activity-item:nth-child(5){animation-delay:.25s}
`;

/* ─── ACTION META ─── */
const ACTION_META: Record<string, { label: string; icon: string; bg: string; color: string; statusLabel: string; statusBg: string; statusColor: string }> = {
  document_uploaded: { label: "Document Uploaded",   icon: "📤", bg: "#ede9fe", color: "#7c3aed", statusLabel: "Uploaded", statusBg: "#ede9fe", statusColor: "#7c3aed" },
  document_deleted:  { label: "Document Deleted",    icon: "🗑️", bg: "#fee2e2", color: "#dc2626", statusLabel: "Deleted",  statusBg: "#fee2e2", statusColor: "#dc2626" },
  document_sent:     { label: "Sent for Review",     icon: "📨", bg: "#dbeafe", color: "#2563eb", statusLabel: "Sent",     statusBg: "#dbeafe", statusColor: "#2563eb" },
  document_signed:   { label: "Document Signed",     icon: "✍️", bg: "#dcfce7", color: "#16a34a", statusLabel: "Signed",   statusBg: "#dcfce7", statusColor: "#16a34a" },
  document_pending:  { label: "Awaiting Signature",  icon: "⏳", bg: "#fef9c3", color: "#b45309", statusLabel: "Pending",  statusBg: "#fef9c3", statusColor: "#b45309" },
  document_viewed:   { label: "Document Viewed",     icon: "👁",  bg: "#fef9c3", color: "#b45309", statusLabel: "Viewed",   statusBg: "#fef9c3", statusColor: "#b45309" },
  document_created:  { label: "Document Created",    icon: "📝", bg: "#ede9fe", color: "#7c3aed", statusLabel: "Created",  statusBg: "#ede9fe", statusColor: "#7c3aed" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? {
    label: action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    icon: "📄", bg: "#f0ede8", color: "#78716c",
    statusLabel: "Activity", statusBg: "#f0ede8", statusColor: "#78716c",
  };
}

function statusToAction(status: string): string {
  const map: Record<string, string> = {
    signed: "document_signed", pending: "document_pending",
    deleted: "document_deleted", draft: "document_uploaded", sent: "document_sent",
  };
  return map[status] ?? "document_uploaded";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/* ─── COMPONENT ─── */
export default function IndividualDashboard() {
  const [userName, setUserName]     = useState("");
  const [avatarUrl, setAvatarUrl]   = useState("");
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState({ uploaded: 0, signed: 0, pending: 0, deleted: 0, completionRate: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [breakdown, setBreakdown]   = useState({ editor: 0, upload: 0 });

  useEffect(() => {
    const id = "ov-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchActivities(), fetchUserName()]);
      setLoading(false);
    })();
  }, []);

  async function fetchUserName() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // Fetch profile name
    let firstName = user.email?.split("@")[0] || "User";
    const { data: pd } = await supabase
      .from("profiles").select("email").eq("id", user.id).single();
    if (pd?.email) firstName = pd.email.split("@")[0] || firstName;
    setUserName(firstName);

    // Avatar: file is at avatars bucket → avatars/{user_id}.png
    // Use signed URL so it works whether bucket is public or private
    const exts = ["png", "jpg", "jpeg", "webp"];
    for (const ext of exts) {
      const path = `avatars/${user.id}.${ext}`;
      const { data: signed } = await supabase.storage
        .from("avatars").createSignedUrl(path, 3600);
      if (signed?.signedUrl) {
        setAvatarUrl(signed.signedUrl);
        return;
      }
    }
  }

  async function fetchStats() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data: allDocs } = await supabase
      .from("documents")
      .select("status, document_kind")
      .eq("owner_id", user.id);

    if (!allDocs) return;

    const uploaded    = allDocs.filter(d => d.status !== "deleted").length;
    const signed      = allDocs.filter(d => d.status === "signed").length;
    const pending     = allDocs.filter(d => d.status === "pending" || d.status === "draft").length;
    const deleted     = allDocs.filter(d => d.status === "deleted").length;
    const editorCount = allDocs.filter(d => d.document_kind === "editor" && d.status !== "deleted").length;
    const uploadCount = allDocs.filter(d => d.document_kind === "upload" && d.status !== "deleted").length;
    const completionRate = uploaded > 0 ? Math.round((signed / uploaded) * 100) : 0;

    setBreakdown({ editor: editorCount, upload: uploadCount });
    setStats({ uploaded, signed, pending, deleted, completionRate });
  }

  async function fetchActivities() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    /* ── Primary: activity_logs table ── */
    const { data: logs, error: logsError } = await supabase
      .from("activity_logs")
      .select("id, action, document_id, document_title, metadata, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (!logsError && logs && logs.length > 0) {
      // Batch-resolve any missing titles in a single query
      const missingIds = logs
        .filter((l: any) => !l.document_title && !l.metadata?.document_title && l.document_id)
        .map((l: any) => l.document_id)
        .filter(Boolean);

      let titleMap: Record<string, string> = {};
      if (missingIds.length > 0) {
        const { data: docs } = await supabase
          .from("documents").select("id, title").in("id", missingIds);
        (docs || []).forEach((d: any) => { titleMap[d.id] = d.title; });
      }

      setActivities(logs.map((act: any) => ({
        ...act,
        resolvedTitle:
          act.document_title ||
          act.metadata?.document_title ||
          (act.document_id ? titleMap[act.document_id] : null) ||
          null,
      })));
      return;
    }

    /* ── Fallback: synthesise directly from documents table ──
         Works even if activity_logs is empty or missing columns  */
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, status, document_kind, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(15);

    setActivities((docs || []).map((doc: any) => ({
      id: doc.id,
      action: statusToAction(doc.status),
      resolvedTitle: doc.title,
      created_at: doc.updated_at || doc.created_at,
    })));
  }

  const cards = [
    { label: "Uploaded",        value: stats.uploaded,             icon: "📄", color: "purple" },
    { label: "Signed",          value: stats.signed,               icon: "✍️", color: "green"  },
    { label: "Pending",         value: stats.pending,              icon: "⏳", color: "amber"  },
    { label: "Deleted",         value: stats.deleted,              icon: "🗑️", color: "red"    },
    { label: "Completion Rate", value: `${stats.completionRate}%`, icon: "📊", color: "blue"   },
  ];

  const totalKind = breakdown.editor + breakdown.upload || 1;

  return (
    <DashboardLayout>
      <div className="ov-root">

        <div className="ov-header">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:4 }}>

            {/* Avatar circle */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{
                  width:56, height:56, borderRadius:"50%",
                  objectFit:"cover", flexShrink:0,
                  border:"3px solid #ede9fe",
                  boxShadow:"0 2px 10px rgba(124,58,237,0.18)",
                }}
                onError={e => {
                  // Image failed — hide it, show initials fallback
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                  setAvatarUrl(""); // triggers re-render to show initials
                }}
              />
            ) : (
              <div style={{
                width:56, height:56, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, fontWeight:700, color:"#fff",
                border:"3px solid #ede9fe",
                boxShadow:"0 2px 10px rgba(124,58,237,0.18)",
                userSelect:"none" as const,
              }}>
                {userName ? userName[0].toUpperCase() : "U"}
              </div>
            )}

            <div>
              <div className="ov-greeting">
                Good {getTimeOfDay()}, <span>{userName || "…"}</span> 👋
              </div>
              <div className="ov-sub">Here's what's happening with your documents today.</div>
            </div>
          </div>
        </div>

        <div className="ov-cards">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="ov-card" style={{ minHeight: 120 }}>
                  <div className="ov-skel" style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 14 }} />
                  <div className="ov-skel" style={{ width: 80, height: 10, marginBottom: 8 }} />
                  <div className="ov-skel" style={{ width: 48, height: 32 }} />
                </div>
              ))
            : cards.map(card => (
                <div key={card.label} className={`ov-card ${card.color}`}>
                  <div className="ov-card-icon">{card.icon}</div>
                  <div className="ov-card-label">{card.label}</div>
                  <div className="ov-card-value">{card.value}</div>
                  {card.label === "Completion Rate" && (
                    <div className="ov-card-bar-track">
                      <div className="ov-card-bar-fill" style={{ width: `${stats.completionRate}%` }} />
                    </div>
                  )}
                </div>
              ))
          }
        </div>

        <div className="ov-bottom">

          {/* Activity Feed */}
          <div className="ov-section">
            <div className="ov-section-head">
              <div className="ov-section-title">
                <div className="ov-section-title-dot" />
                Recent Activity
              </div>
              {activities.length > 0 && <span className="ov-section-count">{activities.length}</span>}
            </div>

            <div className="ov-activity-list">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="ov-activity-item">
                  <div className="ov-skel" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="ov-skel" style={{ width: "60%", height: 12, marginBottom: 6 }} />
                    <div className="ov-skel" style={{ width: "40%", height: 10 }} />
                  </div>
                </div>
              ))}

              {!loading && activities.length === 0 && (
                <div className="ov-empty">
                  <div className="ov-empty-icon">📭</div>
                  <div>No activity yet</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "#a8a29e" }}>
                    Upload or send a document to see it here
                  </div>
                </div>
              )}

              {!loading && activities.map((act, i) => {
                const meta = getActionMeta(act.action);
                return (
                  <div key={act.id ?? i} className="ov-activity-item">
                    <div className="ov-activity-icon" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="ov-activity-body">
                      <div className="ov-activity-action">{meta.label}</div>
                      {act.resolvedTitle && (
                        <div className="ov-activity-doc" title={act.resolvedTitle}>
                          📄 {act.resolvedTitle}
                        </div>
                      )}
                      <div className="ov-activity-time">{timeAgo(act.created_at)}</div>
                    </div>
                    <span className="ov-activity-status"
                      style={{ background: meta.statusBg, color: meta.statusColor }}>
                      {meta.statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="ov-quick">
            <div className="ov-quick-card">
              <div className="ov-quick-title">Document Types</div>
              {[
                { label: "Created in Editor", value: breakdown.editor, color: "#7c3aed" },
                { label: "Uploaded Files",    value: breakdown.upload, color: "#2563eb" },
              ].map(row => (
                <div key={row.label}>
                  <div className="ov-breakdown-row">
                    <span className="ov-breakdown-label">
                      <span className="ov-breakdown-dot" style={{ background: row.color }} />
                      {row.label}
                    </span>
                    <span className="ov-breakdown-val">{row.value}</span>
                  </div>
                  <div className="ov-breakdown-track">
                    <div className="ov-breakdown-fill" style={{
                      width: `${Math.round((row.value / totalKind) * 100)}%`,
                      background: row.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="ov-quick-card">
              <div className="ov-quick-title">Status Summary</div>
              {[
                { label: "Signed",  value: stats.signed,  color: "#16a34a" },
                { label: "Pending", value: stats.pending, color: "#d97706" },
                { label: "Deleted", value: stats.deleted, color: "#dc2626" },
              ].map(row => (
                <div key={row.label} className="ov-breakdown-row" style={{ marginBottom: 10 }}>
                  <span className="ov-breakdown-label">
                    <span className="ov-breakdown-dot" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="ov-breakdown-val" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}