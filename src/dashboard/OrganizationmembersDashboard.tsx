import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";


/* ─── STYLES ─── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;
    --green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;
    --red:#dc2626;--red-bg:#fee2e2;--blue:#2563eb;--blue-bg:#dbeafe;--teal:#0d9488;--teal-bg:#ccfbf1;
    --surface:#fff;--border:#e7e4df;--text:#1c1917;--muted:#78716c;
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
  }

  /* ── MEMBER HEADER ── */
  .mb-page-header {
    display:flex;align-items:center;justify-content:space-between;
    padding:24px 28px 0;margin-bottom:24px;flex-wrap:wrap;gap:12px;
  }
  .mb-identity { display:flex;align-items:center;gap:14px; }
  .mb-avatar-lg {
    width:48px;height:48px;border-radius:"50%";flex-shrink:0;
    background:linear-gradient(135deg,#2563eb,#7c3aed);
    color:#fff;font-size:18px;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    border:3px solid #dbeafe;border-radius:50%;
  }
  .mb-name { font-size:19px;font-weight:700;color:var(--text);letter-spacing:-.02em; }
  .mb-org-chip {
    display:inline-flex;align-items:center;gap:5px;
    background:var(--blue-bg);color:var(--blue);
    font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;
    margin-top:3px;font-family:var(--mono);letter-spacing:.04em;text-transform:uppercase;
  }

  /* ── STAT CARDS ── */
  .mb-stats {
    display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));
    gap:12px;padding:0 28px 24px;
  }
  .mb-stat-card {
    background:var(--surface);border:1px solid var(--border);border-radius:12px;
    padding:16px 18px;position:relative;overflow:hidden;
    transition:box-shadow .18s,transform .18s;
  }
  .mb-stat-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.07);transform:translateY(-1px)}
  .mb-stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0}
  .mb-stat-card.purple::before{background:var(--purple)}
  .mb-stat-card.green::before{background:var(--green)}
  .mb-stat-card.amber::before{background:#d97706}
  .mb-stat-card.blue::before{background:var(--blue)}
  .mb-stat-card.teal::before{background:var(--teal)}
  .mb-stat-icon{font-size:18px;margin-bottom:10px}
  .mb-stat-label{font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .mb-stat-value{font-size:28px;font-weight:700;letter-spacing:-.03em;color:var(--text)}
  .mb-stat-card.purple .mb-stat-value{color:var(--purple)}

  /* ── PENDING ACTIONS BANNER ── */
  .mb-action-banner {
    margin:0 28px 20px;
    background:linear-gradient(135deg,#fef9c3,#fef3c7);
    border:1px solid #fde68a;border-radius:12px;
    padding:14px 18px;display:flex;align-items:flex-start;gap:12px;
  }
  .mb-action-icon{font-size:20px;flex-shrink:0;margin-top:1px}
  .mb-action-title{font-size:13.5px;font-weight:600;color:#92400e;margin-bottom:4px}
  .mb-action-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px}
  .mb-action-list li{font-size:12.5px;color:#78350f;display:flex;align-items:center;gap:6px}
  .mb-action-list li::before{content:"→";font-weight:700;color:#d97706}

  /* ── SKELETON ── */
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  .mb-skel{background:linear-gradient(90deg,#e9e7e4 25%,#f0ede8 50%,#e9e7e4 75%);background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:6px}
`;

export default function OrganizationmemberDashboard() {
  const [loading, setLoading]     = useState(true);
  const [memberName, setMemberName] = useState("");
  const [memberInitial, setMemberInitial] = useState("M");
  const [orgName, setOrgName]     = useState("");
  const [stats, setStats]         = useState({ myDocs: 0, assigned: 0, signed: 0, pending: 0 });
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);

  /* ── Inject styles ── */
  useEffect(() => {
    const id = "mb-dash-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  /* ── Load member data ── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, organization_id")
        .eq("id", user.id).single();

      const name = profile?.email?.split("@")[0] || user.email?.split("@")[0] || "Member";
      setMemberName(name);
      setMemberInitial(name[0]?.toUpperCase() || "M");

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from("organizations").select("name").eq("id", profile.organization_id).single();
        setOrgName(org?.name || "");
      }

      // Load docs + assigned routes in parallel
      const [docsRes, routesRes] = await Promise.all([
        supabase.from("documents")
          .select("id,status").eq("owner_id", user.id).neq("status", "deleted"),
        supabase.from("document_routes")
          .select("id,status,documents(id,title)")
          .eq("recipient_id", user.id),
      ]);

      const docs   = docsRes.data   || [];
      const routes = routesRes.data || [];
      const pending = routes.filter((r: any) => r.status === "pending");

      setStats({
        myDocs:   docs.length,
        assigned: routes.length,
        signed:   docs.filter((d: any) => d.status === "signed").length,
        pending:  pending.length,
      });
      setPendingDocs(pending.slice(0, 5));
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "My Documents", value: stats.myDocs,   icon: "📄", color: "purple" },
    { label: "Assigned",     value: stats.assigned, icon: "📋", color: "blue"   },
    { label: "Signed",       value: stats.signed,   icon: "✍️",  color: "green"  },
    { label: "Action Needed",value: stats.pending,  icon: "⏳",  color: "amber"  },
  ];

  return (
    <DashboardLayout>
      <div className="dashboard-page">

        {/* ── HEADER ── */}
        <div className="mb-page-header">
          <div className="mb-identity">
            <div className="mb-avatar-lg">{memberInitial}</div>
            <div>
              <div className="mb-name">Welcome, {memberName} 👋</div>
              {orgName && <div className="mb-org-chip">🏢 {orgName}</div>}
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="mb-stats">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mb-stat-card" style={{ minHeight: 100 }}>
                  <div className="mb-skel" style={{ width: 24, height: 24, borderRadius: 6, marginBottom: 10 }}/>
                  <div className="mb-skel" style={{ width: 70, height: 9, marginBottom: 6 }}/>
                  <div className="mb-skel" style={{ width: 40, height: 28 }}/>
                </div>
              ))
            : cards.map(card => (
                <div key={card.label} className={`mb-stat-card ${card.color}`}>
                  <div className="mb-stat-icon">{card.icon}</div>
                  <div className="mb-stat-label">{card.label}</div>
                  <div className="mb-stat-value">{card.value}</div>
                </div>
              ))
          }
        </div>

        {/* ── PENDING ACTIONS BANNER ── */}
        {!loading && pendingDocs.length > 0 && (
          <div className="mb-action-banner">
            <div className="mb-action-icon">⚠️</div>
            <div>
              <div className="mb-action-title">
                {pendingDocs.length} document{pendingDocs.length > 1 ? "s" : ""} need{pendingDocs.length === 1 ? "s" : ""} your attention
              </div>
              <ul className="mb-action-list">
                {pendingDocs.map((r: any) => (
                  <li key={r.id}>{(r.documents as any)?.title || "Untitled Document"}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── WORKSPACE — your existing component ── */}
        <h2 style={{
          padding: "0 28px 12px",
          fontSize: 16, fontWeight: 600, color: "#1c1917",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Workspace
        </h2>
        

      </div>
    </DashboardLayout>
  );
}