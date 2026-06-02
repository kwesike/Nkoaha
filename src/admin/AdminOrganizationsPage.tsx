import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "./AdminLayout";

const STYLES = `
  .aorg-root{padding:28px;max-width:1200px}
  .aorg-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .aorg-search{flex:1;min-width:200px;padding:9px 14px;border:1.5px solid #e7e4df;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#1c1917;outline:none;background:#fff}
  .aorg-search:focus{border-color:#7c3aed}
  .aorg-count{font-size:12px;color:#78716c;margin-left:auto}
  .aorg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
  .aorg-card{background:#fff;border:1px solid #e7e4df;border-radius:12px;overflow:hidden;transition:box-shadow .15s}
  .aorg-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .aorg-card-head{padding:16px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #f0ede8}
  .aorg-logo{width:40px;height:40px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid #e7e4df}
  .aorg-logo-fallback{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0}
  .aorg-card-name{font-size:14px;font-weight:700;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aorg-card-owner{font-size:11px;color:#78716c;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aorg-card-body{padding:14px 18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .aorg-stat{display:flex;flex-direction:column;gap:2px}
  .aorg-stat-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#a78bfa}
  .aorg-stat-val{font-size:16px;font-weight:800;color:#1c1917;font-family:'DM Mono',monospace}
  .aorg-card-foot{padding:10px 18px;background:#faf9f8;border-top:1px solid #f0ede8;display:flex;align-items:center;justify-content:space-between}
  .aorg-plan-badge{font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;background:#ede9fe;color:#7c3aed}
  .aorg-plan-badge.starter{background:#dbeafe;color:#2563eb}
  .aorg-plan-badge.growth{background:#dcfce7;color:#16a34a}
  .aorg-plan-badge.enterprise{background:#fef3c7;color:#b45309}
  .aorg-plan-badge.free{background:#f5f3ef;color:#78716c}
  .aorg-date{font-size:11px;color:#a8a29e;font-family:'DM Mono',monospace}
  .aorg-expand-btn{font-size:11px;color:#7c3aed;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;padding:0}
  .aorg-members{padding:0 18px 14px;border-top:1px solid #f0ede8;margin-top:-1px}
  .aorg-member-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #faf9f8;font-size:12px}
  .aorg-member-row:last-child{border-bottom:none}
  .aorg-member-email{flex:1;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aorg-member-role{font-size:10px;padding:1px 7px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:600}
  .aorg-empty{padding:48px;text-align:center;color:#a8a29e;font-size:13px}
`;

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs]       = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [plans, setPlans]     = useState<Record<string, string>>({});
  const [search, setSearch]   = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = "aorg-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id,name,logo,owner_id,created_at")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,role,organization_id");

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id,plan_id")
      .eq("status", "active");

    const { data: docs } = await supabase
      .from("documents")
      .select("id,owner_id")
      .neq("status", "deleted");

    // Map owner email
    const profileMap: Record<string, any> = {};
    for (const p of (profiles || [])) profileMap[p.id] = p;

    // Member grouping by org
    const memberMap: Record<string, any[]> = {};
    for (const p of (profiles || [])) {
      if (p.organization_id) {
        if (!memberMap[p.organization_id]) memberMap[p.organization_id] = [];
        memberMap[p.organization_id].push(p);
      }
    }

    // Doc counts per owner
    const docMap: Record<string, number> = {};
    for (const d of (docs || [])) {
      docMap[d.owner_id] = (docMap[d.owner_id] || 0) + 1;
    }

    // Subscription plan per owner
    const subMap: Record<string, string> = {};
    for (const s of (subs || [])) subMap[s.user_id] = s.plan_id || "";

    // Attach owner profile to each org
    const enriched = (orgData || []).map(o => ({
      ...o,
      ownerEmail: profileMap[o.owner_id]?.email || "—",
    }));

    setOrgs(enriched);
    setMembers(memberMap);
    setDocCounts(docMap);
    setPlans(subMap);
    setLoading(false);
  }

  function planLabel(ownerId: string) {
    const plan = plans[ownerId] || "";
    if (plan.includes("starter"))    return { label: "Starter",    cls: "starter" };
    if (plan.includes("growth"))     return { label: "Growth",     cls: "growth" };
    if (plan.includes("enterprise")) return { label: "Enterprise", cls: "enterprise" };
    return { label: "Free", cls: "free" };
  }

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.ownerEmail?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Organizations">
      <div className="aorg-root">
        <div className="aorg-bar">
          <input
            className="aorg-search"
            placeholder="Search by name or owner email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="aorg-count">{filtered.length} org{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#78716c" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="aorg-empty">No organizations found</div>
        ) : (
          <div className="aorg-grid">
            {filtered.map(org => {
              const orgMembers = members[org.id] || [];
              const { label: planLbl, cls: planCls } = planLabel(org.owner_id);
              const isExpanded = expanded.has(org.id);

              return (
                <div key={org.id} className="aorg-card">
                  <div className="aorg-card-head">
                    {org.logo
                      ? <img src={org.logo} alt="" className="aorg-logo" />
                      : <div className="aorg-logo-fallback">{org.name?.[0]?.toUpperCase() || "?"}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="aorg-card-name">{org.name}</div>
                      <div className="aorg-card-owner">Owner: {org.ownerEmail}</div>
                    </div>
                  </div>

                  <div className="aorg-card-body">
                    <div className="aorg-stat">
                      <div className="aorg-stat-label">Members</div>
                      <div className="aorg-stat-val">{orgMembers.length}</div>
                    </div>
                    <div className="aorg-stat">
                      <div className="aorg-stat-label">Documents</div>
                      <div className="aorg-stat-val">{docCounts[org.owner_id] || 0}</div>
                    </div>
                    <div className="aorg-stat">
                      <div className="aorg-stat-label">Created</div>
                      <div className="aorg-stat-val" style={{ fontSize: 12, paddingTop: 3 }}>{timeAgo(org.created_at)}</div>
                    </div>
                  </div>

                  {isExpanded && orgMembers.length > 0 && (
                    <div className="aorg-members">
                      {orgMembers.map(m => (
                        <div key={m.id} className="aorg-member-row">
                          <div className="aorg-member-email">{m.email}</div>
                          <span className="aorg-member-role">{m.role?.replace("organization_", "") || "member"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="aorg-card-foot">
                    <span className={`aorg-plan-badge ${planCls}`}>{planLbl}</span>
                    {orgMembers.length > 0 && (
                      <button className="aorg-expand-btn" onClick={() => toggleExpand(org.id)}>
                        {isExpanded ? "Hide members ↑" : `View ${orgMembers.length} member${orgMembers.length !== 1 ? "s" : ""} ↓`}
                      </button>
                    )}
                    <span className="aorg-date">{org.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}