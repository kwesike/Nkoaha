import { useEffect, useState, useCallback } from "react";
import { supabase } from "./../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

// ─────────────────────────────────────────────────────────────
// NkoAha Automations (Stage 1 — builder + storage)
// Create reusable Workflow Templates (approval chains) and no-code
// Automations: When (trigger) → If (conditions) → Then (actions).
// The execution engine (Stage 2) reads the `automations` / `workflows`
// tables; this page is where users design them.
// ─────────────────────────────────────────────────────────────

type Step   = { order: number; assignee_type: "role" | "email"; value: string; action: "sign" | "approve" | "review" };
type Cond   = { field: string; op: string; value: string };
type Action = { type: string; config: Record<string, string> };

interface Workflow   { id: string; name: string; description?: string; steps: Step[]; }
interface Automation { id: string; name: string; enabled: boolean; trigger_type: string; trigger_config: any; conditions: Cond[]; actions: Action[]; }

const TRIGGERS: { id: string; label: string; hint: string }[] = [
  { id: "document_completed", label: "A document is fully signed",      hint: "Runs when every party has signed." },
  { id: "document_pending",   label: "A document stays unsigned",       hint: "Runs when a sent document isn't signed after N days." },
  { id: "form_submitted",     label: "A form is submitted",             hint: "Runs when someone completes one of your forms." },
  { id: "document_created",   label: "A document is created",           hint: "Runs when a new document is added." },
  { id: "schedule",           label: "On a schedule",                   hint: "Runs a document/action on a recurring schedule." },
];

const FIELDS = [
  { id: "title",           label: "Document title" },
  { id: "format",          label: "Document type" },
  { id: "amount",          label: "Amount" },
  { id: "sender_email",    label: "Sender email" },
  { id: "recipient_email", label: "Recipient email" },
];
const OPS = [
  { id: "is", label: "is" }, { id: "is_not", label: "is not" },
  { id: "contains", label: "contains" }, { id: "gt", label: "greater than" }, { id: "lt", label: "less than" },
];
const ACTION_TYPES: { id: string; label: string; fields: { key: string; label: string; ph?: string }[] }[] = [
  { id: "send_reminder",  label: "Send a reminder",                 fields: [{ key: "message", label: "Message (optional)", ph: "A gentle nudge to sign…" }] },
  { id: "route_workflow", label: "Route through a workflow",        fields: [{ key: "workflow_id", label: "Workflow template" }] },
  { id: "certify_file",   label: "Certify & save to Drive folder",  fields: [{ key: "folder", label: "Folder name", ph: "Signed contracts" }] },
  { id: "email_copy",     label: "Email a copy",                    fields: [{ key: "to", label: "Send to (email)", ph: "finance@company.com" }] },
  { id: "notify",         label: "Notify me",                       fields: [] },
];

const emptyAuto = (): Automation => ({ id: "", name: "", enabled: true, trigger_type: "document_completed", trigger_config: {}, conditions: [], actions: [] });
const emptyWf   = (): Workflow => ({ id: "", name: "", description: "", steps: [{ order: 1, assignee_type: "email", value: "", action: "sign" }] });

const STYLES = `
  .au-wrap{max-width:900px;margin:0 auto;padding:24px 20px 60px;font-family:'DM Sans',sans-serif;color:#1c1917}
  .au-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:12px}
  .au-h1{font-size:24px;font-weight:800;display:flex;align-items:center;gap:10px}
  .au-sub{color:#78716c;font-size:14px;margin-bottom:18px}
  .au-tabs{display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid #e7e4df}
  .au-tab{padding:9px 14px;border:none;background:none;font-size:14px;font-weight:600;color:#a8a29e;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
  .au-tab.on{color:#7c3aed;border-bottom-color:#7c3aed}
  .au-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;border:1px solid transparent}
  .au-btn.primary{background:#7c3aed;color:#fff}.au-btn.primary:hover{background:#5b21b6}
  .au-btn.ghost{background:#fff;color:#57534e;border-color:#e7e4df}.au-btn.ghost:hover{background:#f5f3ef}
  .au-btn:disabled{opacity:.55;cursor:not-allowed}
  .au-card{background:#fff;border:1px solid #e7e4df;border-radius:13px;padding:16px;margin-bottom:12px}
  .au-row{display:flex;align-items:center;gap:12px}
  .au-name{font-size:15px;font-weight:700}
  .au-meta{font-size:12.5px;color:#78716c;margin-top:3px}
  .au-chip{font-size:11px;background:#ede9fe;color:#7c3aed;padding:2px 9px;border-radius:20px;font-weight:600}
  .au-switch{position:relative;width:40px;height:22px;border-radius:12px;background:#d6d3d1;cursor:pointer;transition:background .15s;flex-shrink:0}
  .au-switch.on{background:#7c3aed}
  .au-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
  .au-switch.on .au-knob{left:20px}
  .au-ic{width:30px;height:30px;border:none;background:transparent;border-radius:7px;cursor:pointer;color:#a8a29e;font-size:14px}
  .au-ic:hover{background:#f5f3ef;color:#1c1917}
  .au-in,.au-sel{width:100%;padding:9px 11px;border:1px solid #d6d3d1;border-radius:8px;font-size:13.5px;font-family:inherit;box-sizing:border-box;background:#fff}
  .au-lbl{display:block;font-size:12px;font-weight:600;color:#57534e;margin:0 0 5px}
  .au-section{border:1px solid #efece7;border-radius:11px;padding:14px;margin-bottom:14px;background:#fcfbfa}
  .au-section h4{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#a8a29e;display:flex;align-items:center;gap:7px}
  .au-add{font-size:12.5px;color:#7c3aed;background:none;border:1px dashed #d6ccf7;border-radius:8px;padding:7px 11px;cursor:pointer;font-weight:600}
  .au-add:hover{background:#faf7ff}
  .au-pill{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;flex-shrink:0}
  .au-empty{text-align:center;color:#a8a29e;padding:44px 20px;border:2px dashed #e7e4df;border-radius:14px;background:#fff}
  .au-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media (max-width:640px){ .au-grid{grid-template-columns:1fr} }
`;

export default function AutomationsPage() {
  const [tab, setTab] = useState<"automations" | "workflows">("automations");
  const [ctx, setCtx] = useState<{ userId: string; orgId: string | null } | null>(null);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [wfs, setWfs]     = useState<Workflow[]>([]);
  const [editAuto, setEditAuto] = useState<Automation | null>(null);
  const [editWf, setEditWf]     = useState<Workflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role,organization_id").eq("id", user.id).maybeSingle();
    let orgId = profile?.organization_id || null;
    if (!orgId && profile?.role !== "individual") {
      const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
      orgId = o?.id || null;
      if (!orgId) { const { data: m } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).maybeSingle(); orgId = m?.organization_id || null; }
    }
    setCtx({ userId: user.id, orgId });
    const [{ data: a }, { data: w }] = await Promise.all([
      supabase.from("automations").select("*").order("created_at", { ascending: false }),
      supabase.from("workflows").select("*").order("created_at", { ascending: false }),
    ]);
    setAutos((a as Automation[]) || []);
    setWfs((w as Workflow[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Save / toggle / delete ──
  const saveAuto = async () => {
    if (!editAuto || !ctx) return;
    if (!editAuto.name.trim()) { setMsg("Give the automation a name."); return; }
    setBusy(true);
    const payload = {
      owner_id: ctx.userId, organization_id: ctx.orgId, name: editAuto.name.trim(),
      enabled: editAuto.enabled, trigger_type: editAuto.trigger_type, trigger_config: editAuto.trigger_config,
      conditions: editAuto.conditions, actions: editAuto.actions, updated_at: new Date().toISOString(),
    };
    const res = editAuto.id
      ? await supabase.from("automations").update(payload).eq("id", editAuto.id)
      : await supabase.from("automations").insert(payload);
    setBusy(false);
    if (res.error) { setMsg(res.error.message); return; }
    setEditAuto(null); setMsg(null); load();
  };
  const toggleAuto = async (a: Automation) => {
    await supabase.from("automations").update({ enabled: !a.enabled }).eq("id", a.id);
    setAutos(prev => prev.map(x => x.id === a.id ? { ...x, enabled: !x.enabled } : x));
  };
  const delAuto = async (id: string) => { if (!confirm("Delete this automation?")) return; await supabase.from("automations").delete().eq("id", id); load(); };

  const saveWf = async () => {
    if (!editWf || !ctx) return;
    if (!editWf.name.trim()) { setMsg("Give the workflow a name."); return; }
    setBusy(true);
    const steps = editWf.steps.map((s, i) => ({ ...s, order: i + 1 }));
    const payload = { owner_id: ctx.userId, organization_id: ctx.orgId, name: editWf.name.trim(), description: editWf.description || "", steps, updated_at: new Date().toISOString() };
    const res = editWf.id
      ? await supabase.from("workflows").update(payload).eq("id", editWf.id)
      : await supabase.from("workflows").insert(payload);
    setBusy(false);
    if (res.error) { setMsg(res.error.message); return; }
    setEditWf(null); setMsg(null); load();
  };
  const delWf = async (id: string) => { if (!confirm("Delete this workflow template?")) return; await supabase.from("workflows").delete().eq("id", id); load(); };

  const triggerLabel = (t: string) => TRIGGERS.find(x => x.id === t)?.label || t;

  return (
    <DashboardLayout>
      <div className="au-wrap">
        <style>{STYLES}</style>
        <div className="au-head">
          <div className="au-h1">⚡ Automations</div>
          {!editAuto && !editWf && (
            tab === "automations"
              ? <button className="au-btn primary" onClick={() => { setMsg(null); setEditAuto(emptyAuto()); }}>+ New automation</button>
              : <button className="au-btn primary" onClick={() => { setMsg(null); setEditWf(emptyWf()); }}>+ New workflow</button>
          )}
        </div>
        <div className="au-sub">Put repetitive document work on autopilot — approval chains, reminders, and “when this happens, do that” rules.</div>

        {msg && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}

        {!editAuto && !editWf && (
          <div className="au-tabs">
            <button className={`au-tab ${tab === "automations" ? "on" : ""}`} onClick={() => setTab("automations")}>Automations</button>
            <button className={`au-tab ${tab === "workflows" ? "on" : ""}`} onClick={() => setTab("workflows")}>Workflow templates</button>
          </div>
        )}

        {/* ── Automations list ── */}
        {!editAuto && !editWf && tab === "automations" && (
          autos.length === 0
            ? <div className="au-empty">No automations yet.<br/>Create one to auto-route, remind, certify and file documents without lifting a finger.</div>
            : autos.map(a => (
              <div className="au-card" key={a.id}>
                <div className="au-row">
                  <div className={`au-switch ${a.enabled ? "on" : ""}`} onClick={() => toggleAuto(a)} title={a.enabled ? "Enabled" : "Disabled"}><div className="au-knob" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="au-name">{a.name}</div>
                    <div className="au-meta">When <strong>{triggerLabel(a.trigger_type).toLowerCase()}</strong> · {a.conditions?.length || 0} condition(s) · {a.actions?.length || 0} action(s)</div>
                  </div>
                  <button className="au-ic" title="Edit" onClick={() => { setMsg(null); setEditAuto({ ...a, conditions: a.conditions || [], actions: a.actions || [], trigger_config: a.trigger_config || {} }); }}>✏️</button>
                  <button className="au-ic" title="Delete" onClick={() => delAuto(a.id)}>🗑</button>
                </div>
              </div>
            ))
        )}

        {/* ── Workflow templates list ── */}
        {!editAuto && !editWf && tab === "workflows" && (
          wfs.length === 0
            ? <div className="au-empty">No workflow templates yet.<br/>Save an approval chain once (e.g. Member → Manager → Finance → CEO) and reuse it on any document.</div>
            : wfs.map(w => (
              <div className="au-card" key={w.id}>
                <div className="au-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="au-name">{w.name}</div>
                    <div className="au-meta">{(w.steps || []).map((s, i) => `${i + 1}. ${s.value || s.assignee_type}`).join("  →  ") || "No steps"}</div>
                  </div>
                  <button className="au-ic" title="Edit" onClick={() => setEditWf({ ...w, steps: w.steps?.length ? w.steps : emptyWf().steps })}>✏️</button>
                  <button className="au-ic" title="Delete" onClick={() => delWf(w.id)}>🗑</button>
                </div>
              </div>
            ))
        )}

        {/* ── Automation builder ── */}
        {editAuto && (
          <div>
            <div className="au-section">
              <label className="au-lbl">Automation name</label>
              <input className="au-in" value={editAuto.name} onChange={e => setEditAuto({ ...editAuto, name: e.target.value })} placeholder="e.g. Auto-remind unsigned contracts" />
            </div>

            {/* WHEN */}
            <div className="au-section">
              <h4><span className="au-pill">1</span> When — the trigger</h4>
              <select className="au-sel" value={editAuto.trigger_type} onChange={e => setEditAuto({ ...editAuto, trigger_type: e.target.value, trigger_config: {} })}>
                {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 6 }}>{TRIGGERS.find(t => t.id === editAuto.trigger_type)?.hint}</div>
              {editAuto.trigger_type === "document_pending" && (
                <div style={{ marginTop: 10 }}>
                  <label className="au-lbl">Days without a signature</label>
                  <input className="au-in" type="number" min={1} value={editAuto.trigger_config?.days || 3} onChange={e => setEditAuto({ ...editAuto, trigger_config: { ...editAuto.trigger_config, days: parseInt(e.target.value) || 3 } })} style={{ maxWidth: 140 }} />
                </div>
              )}
              {editAuto.trigger_type === "schedule" && (
                <div className="au-grid" style={{ marginTop: 10 }}>
                  <div><label className="au-lbl">Frequency</label>
                    <select className="au-sel" value={editAuto.trigger_config?.freq || "monthly"} onChange={e => setEditAuto({ ...editAuto, trigger_config: { ...editAuto.trigger_config, freq: e.target.value } })}>
                      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div><label className="au-lbl">Document ID to send (optional)</label><input className="au-in" value={editAuto.trigger_config?.document_id || ""} onChange={e => setEditAuto({ ...editAuto, trigger_config: { ...editAuto.trigger_config, document_id: e.target.value } })} placeholder="paste a document id" /></div>
                </div>
              )}
            </div>

            {/* IF */}
            <div className="au-section">
              <h4><span className="au-pill">2</span> If — conditions <span style={{ textTransform: "none", color: "#c4b5fd", fontWeight: 500 }}>(optional — all must match)</span></h4>
              {editAuto.conditions.map((c, i) => (
                <div key={i} className="au-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr auto", marginBottom: 8, alignItems: "end" }}>
                  <select className="au-sel" value={c.field} onChange={e => setEditAuto({ ...editAuto, conditions: editAuto.conditions.map((x, j) => j === i ? { ...x, field: e.target.value } : x) })}>{FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                  <select className="au-sel" value={c.op} onChange={e => setEditAuto({ ...editAuto, conditions: editAuto.conditions.map((x, j) => j === i ? { ...x, op: e.target.value } : x) })}>{OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                  <input className="au-in" value={c.value} onChange={e => setEditAuto({ ...editAuto, conditions: editAuto.conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder="value" />
                  <button className="au-ic" onClick={() => setEditAuto({ ...editAuto, conditions: editAuto.conditions.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <button className="au-add" onClick={() => setEditAuto({ ...editAuto, conditions: [...editAuto.conditions, { field: "title", op: "contains", value: "" }] })}>+ Add condition</button>
            </div>

            {/* THEN */}
            <div className="au-section">
              <h4><span className="au-pill">3</span> Then — do this</h4>
              {editAuto.actions.map((act, i) => {
                const def = ACTION_TYPES.find(t => t.id === act.type) || ACTION_TYPES[0];
                return (
                  <div key={i} className="au-card" style={{ background: "#fff", marginBottom: 8 }}>
                    <div className="au-row" style={{ marginBottom: def.fields.length ? 10 : 0 }}>
                      <select className="au-sel" value={act.type} onChange={e => setEditAuto({ ...editAuto, actions: editAuto.actions.map((x, j) => j === i ? { type: e.target.value, config: {} } : x) })} style={{ flex: 1 }}>
                        {ACTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <button className="au-ic" onClick={() => setEditAuto({ ...editAuto, actions: editAuto.actions.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    {def.fields.map(f => (
                      <div key={f.key} style={{ marginTop: 6 }}>
                        <label className="au-lbl">{f.label}</label>
                        {f.key === "workflow_id"
                          ? <select className="au-sel" value={act.config[f.key] || ""} onChange={e => setEditAuto({ ...editAuto, actions: editAuto.actions.map((x, j) => j === i ? { ...x, config: { ...x.config, [f.key]: e.target.value } } : x) })}>
                              <option value="">Select a workflow…</option>{wfs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          : <input className="au-in" value={act.config[f.key] || ""} onChange={e => setEditAuto({ ...editAuto, actions: editAuto.actions.map((x, j) => j === i ? { ...x, config: { ...x.config, [f.key]: e.target.value } } : x) })} placeholder={f.ph || ""} />}
                      </div>
                    ))}
                  </div>
                );
              })}
              <button className="au-add" onClick={() => setEditAuto({ ...editAuto, actions: [...editAuto.actions, { type: "send_reminder", config: {} }] })}>+ Add action</button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="au-btn ghost" onClick={() => { setEditAuto(null); setMsg(null); }}>Cancel</button>
              <button className="au-btn primary" onClick={saveAuto} disabled={busy}>{busy ? "Saving…" : "Save automation"}</button>
            </div>
          </div>
        )}

        {/* ── Workflow builder ── */}
        {editWf && (
          <div>
            <div className="au-section">
              <div className="au-grid">
                <div><label className="au-lbl">Workflow name</label><input className="au-in" value={editWf.name} onChange={e => setEditWf({ ...editWf, name: e.target.value })} placeholder="e.g. Invoice Approval" /></div>
                <div><label className="au-lbl">Description (optional)</label><input className="au-in" value={editWf.description || ""} onChange={e => setEditWf({ ...editWf, description: e.target.value })} /></div>
              </div>
            </div>
            <div className="au-section">
              <h4>Steps — in order</h4>
              {editWf.steps.map((s, i) => (
                <div key={i} className="au-row" style={{ marginBottom: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <span className="au-pill" style={{ marginBottom: 9 }}>{i + 1}</span>
                  <div style={{ width: 120 }}><label className="au-lbl">Assignee</label>
                    <select className="au-sel" value={s.assignee_type} onChange={e => setEditWf({ ...editWf, steps: editWf.steps.map((x, j) => j === i ? { ...x, assignee_type: e.target.value as any } : x) })}><option value="email">Email</option><option value="role">Role</option></select>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}><label className="au-lbl">{s.assignee_type === "email" ? "Email address" : "Role (e.g. Manager)"}</label>
                    <input className="au-in" value={s.value} onChange={e => setEditWf({ ...editWf, steps: editWf.steps.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder={s.assignee_type === "email" ? "person@company.com" : "Manager"} />
                  </div>
                  <div style={{ width: 120 }}><label className="au-lbl">Action</label>
                    <select className="au-sel" value={s.action} onChange={e => setEditWf({ ...editWf, steps: editWf.steps.map((x, j) => j === i ? { ...x, action: e.target.value as any } : x) })}><option value="sign">Sign</option><option value="approve">Approve</option><option value="review">Review</option></select>
                  </div>
                  <button className="au-ic" style={{ marginBottom: 2 }} onClick={() => setEditWf({ ...editWf, steps: editWf.steps.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <button className="au-add" onClick={() => setEditWf({ ...editWf, steps: [...editWf.steps, { order: editWf.steps.length + 1, assignee_type: "email", value: "", action: "sign" }] })}>+ Add step</button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="au-btn ghost" onClick={() => { setEditWf(null); setMsg(null); }}>Cancel</button>
              <button className="au-btn primary" onClick={saveWf} disabled={busy}>{busy ? "Saving…" : "Save workflow"}</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}