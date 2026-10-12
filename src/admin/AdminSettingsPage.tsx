import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";
import AdminLayout from "./AdminLayout";

/* Admin → Settings. First control: which payment processor is live.
   Flipping it writes app_settings.active_payment_provider; the billing page
   reads that value and routes new payments accordingly — no redeploy needed. */

const STYLES = `
  .set-root{padding:28px 28px 64px;max-width:760px;font-family:var(--font);color:#1c1917}
  .set-title{font-size:18px;font-weight:700;margin-bottom:4px}
  .set-sub{font-size:13px;color:#78716c;margin-bottom:28px}
  .set-card{background:#fff;border:1px solid #e7e4df;border-radius:14px;padding:22px 24px;margin-bottom:16px}
  .set-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}
  .set-card-title{font-size:14px;font-weight:700;color:#1c1917}
  .set-card-desc{font-size:12.5px;color:#78716c;line-height:1.55;margin-bottom:18px}
  .set-providers{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .set-prov{border:2px solid #e7e4df;border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;text-align:left;background:#fff;font-family:var(--font)}
  .set-prov:hover{border-color:#c4b5fd}
  .set-prov.active{border-color:#7c3aed;background:#f5f3ff}
  .set-prov-name{font-size:14px;font-weight:700;color:#1c1917;display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .set-prov-meta{font-size:11.5px;color:#78716c;line-height:1.5}
  .set-prov-badge{margin-left:auto;font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.04em}
  .set-badge-live{background:#dcfce7;color:#166534}
  .set-badge-idle{background:#f5f3ef;color:#a8a29e}
  .set-foot{display:flex;align-items:center;gap:12px;margin-top:18px}
  .set-btn{padding:10px 20px;border-radius:9px;border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
  .set-btn.primary{background:#7c3aed;color:#fff}.set-btn.primary:hover{background:#5b21b6}
  .set-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .set-msg{font-size:12.5px;padding:8px 12px;border-radius:8px}
  .set-msg.ok{background:#dcfce7;color:#166534}
  .set-msg.err{background:#fee2e2;color:#991b1b}
  .set-note{font-size:11.5px;color:#b45309;background:#fef9c3;border-radius:8px;padding:10px 12px;margin-top:14px;line-height:1.5}
`;

type Provider = "flutterwave" | "paystack";

// AI providers the admin can switch between. `models` are suggestions shown in
// the dropdown; the admin can also type any model id their account supports.
const AI_PROVIDERS: { id: string; name: string; meta: string; keyEnv: string; models: string[] }[] = [
  { id: "anthropic", name: "Anthropic (Claude)", meta: "High-quality drafting · needs ANTHROPIC_API_KEY", keyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"] },
  { id: "openai",    name: "OpenAI (GPT)",        meta: "Widely used · needs OPENAI_API_KEY",    keyEnv: "OPENAI_API_KEY",
    models: ["gpt-4o-mini", "gpt-4o"] },
  { id: "gemini",    name: "Google Gemini",       meta: "Fast + cheap · needs GEMINI_API_KEY",   keyEnv: "GEMINI_API_KEY",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"] },
  { id: "deepseek",  name: "DeepSeek",            meta: "Low cost · needs DEEPSEEK_API_KEY",     keyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-reasoner"] },
];
function defaultModelFor(id: string): string {
  return AI_PROVIDERS.find(p => p.id === id)?.models[0] || "";
}

export default function AdminSettingsPage() {
  const [current, setCurrent]   = useState<Provider | null>(null); // saved value
  const [selected, setSelected] = useState<Provider>("flutterwave"); // pending choice
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  // ── AI provider (admin-switchable, same app_settings pattern) ──
  const [aiCurrent, setAiCurrent]   = useState<string>("anthropic"); // saved provider
  const [aiSelected, setAiSelected] = useState<string>("anthropic"); // pending provider
  const [aiModel, setAiModel]       = useState<string>("");          // pending model
  const [aiModelSaved, setAiModelSaved] = useState<string>("");      // saved model
  const [aiSaving, setAiSaving]     = useState(false);
  const [aiMsg, setAiMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const id = "set-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("app_settings")
      .select("key,value").in("key", ["active_payment_provider", "active_ai_provider", "active_ai_model"]);
    const m: Record<string, string> = {};
    for (const r of (data || [])) m[r.key] = r.value;

    const p = m["active_payment_provider"] === "paystack" ? "paystack" : "flutterwave";
    setCurrent(p);
    setSelected(p);

    const ap = (m["active_ai_provider"] || "anthropic").toLowerCase();
    const prov = AI_PROVIDERS.find(x => x.id === ap) ? ap : "anthropic";
    const model = m["active_ai_model"] || defaultModelFor(prov);
    setAiCurrent(prov); setAiSelected(prov);
    setAiModel(model);  setAiModelSaved(model);
  }

  function pickProvider(id: string) {
    setAiSelected(id);
    // Reset the model to that provider's default when switching provider.
    if (id !== aiCurrent) setAiModel(defaultModelFor(id));
    else setAiModel(aiModelSaved || defaultModelFor(id));
  }

  async function saveAi() {
    const noChange = aiSelected === aiCurrent && aiModel.trim() === aiModelSaved;
    if (noChange) return;
    setAiSaving(true); setAiMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const model = aiModel.trim() || defaultModelFor(aiSelected);
    const up = async (key: string, value: string) =>
      supabase.from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: "key" });
    const r1 = await up("active_ai_provider", aiSelected);
    const r2 = await up("active_ai_model", model);
    setAiSaving(false);
    if (r1.error || r2.error) {
      setAiMsg({ ok: false, text: "Could not save: " + (r1.error?.message || r2.error?.message) });
      return;
    }
    setAiCurrent(aiSelected); setAiModelSaved(model); setAiModel(model);
    const name = AI_PROVIDERS.find(x => x.id === aiSelected)?.name || aiSelected;
    setAiMsg({ ok: true, text: `AI drafting now uses ${name} (${model}). Takes effect on the next draft.` });
  }

  async function save() {
    if (selected === current) return;
    setSaving(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings")
      .update({ value: selected, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("key", "active_payment_provider");
    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: "Could not save: " + error.message });
      return;
    }
    setCurrent(selected);
    setMsg({ ok: true, text: `Payments now route through ${selected === "paystack" ? "Paystack" : "Flutterwave"}. New payments use it immediately.` });
  }

  const providers: { id: Provider; name: string; meta: string }[] = [
    { id: "flutterwave", name: "Flutterwave", meta: "Cards + bank transfer · NGN, USD, EUR" },
    { id: "paystack",    name: "Paystack",    meta: "Cards + bank transfer · NGN only" },
  ];

  return (
    <AdminLayout title="Settings">
      <div className="set-root">
        <div className="set-title">Settings</div>
        <div className="set-sub">Platform configuration.</div>

        <div className="set-card">
          <div className="set-card-head">
            <div className="set-card-title">Payment Provider</div>
          </div>
          <div className="set-card-desc">
            Choose which processor handles new payments. Switching takes effect immediately
            for the next payment — no deploy needed. Existing active subscriptions are unaffected.
          </div>

          <div className="set-providers">
            {providers.map(p => (
              <button key={p.id}
                className={`set-prov${selected === p.id ? " active" : ""}`}
                onClick={() => setSelected(p.id)}>
                <div className="set-prov-name">
                  {p.name}
                  <span className={`set-prov-badge ${current === p.id ? "set-badge-live" : "set-badge-idle"}`}>
                    {current === p.id ? "LIVE" : "IDLE"}
                  </span>
                </div>
                <div className="set-prov-meta">{p.meta}</div>
              </button>
            ))}
          </div>

          {selected === "paystack" && (
            <div className="set-note">
              Paystack here is configured for <strong>NGN only</strong>. When Paystack is live, the
              billing page hides the USD/EUR options and charges in Naira.
            </div>
          )}

          <div className="set-foot">
            <button className="set-btn primary" onClick={save} disabled={saving || selected === current}>
              {saving ? "Saving…" : selected === current ? "No changes" : `Switch to ${selected === "paystack" ? "Paystack" : "Flutterwave"}`}
            </button>
            {msg && <span className={`set-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</span>}
          </div>
        </div>

        {/* ── AI Provider (for "Draft with Uburu AI") ── */}
        <div className="set-card">
          <div className="set-card-head">
            <div className="set-card-title">AI Provider — Uburu AI drafting</div>
          </div>
          <div className="set-card-desc">
            Choose which AI powers "Draft with Uburu AI". Switching takes effect on the next draft —
            no deploy needed. Only the selected provider's API key needs to be set in Supabase secrets.
          </div>

          <div className="set-providers">
            {AI_PROVIDERS.map(p => (
              <button key={p.id}
                className={`set-prov${aiSelected === p.id ? " active" : ""}`}
                onClick={() => pickProvider(p.id)}>
                <div className="set-prov-name">
                  {p.name}
                  <span className={`set-prov-badge ${aiCurrent === p.id ? "set-badge-live" : "set-badge-idle"}`}>
                    {aiCurrent === p.id ? "LIVE" : "IDLE"}
                  </span>
                </div>
                <div className="set-prov-meta">{p.meta}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Model</label>
            <input list="ai-model-options" value={aiModel} onChange={e => setAiModel(e.target.value)}
              placeholder={defaultModelFor(aiSelected)}
              style={{ width: "100%", maxWidth: 360, padding: "9px 12px", border: "1.5px solid #e7e4df", borderRadius: 9, fontSize: 13, fontFamily: "var(--font)", color: "#1c1917", outline: "none" }} />
            <datalist id="ai-model-options">
              {(AI_PROVIDERS.find(p => p.id === aiSelected)?.models || []).map(m => <option key={m} value={m} />)}
            </datalist>
            <div style={{ fontSize: 11.5, color: "#78716c", marginTop: 6, lineHeight: 1.5 }}>
              Pick a suggested model or type any model id your {AI_PROVIDERS.find(p => p.id === aiSelected)?.name} account supports.
              Leave it on the default if unsure.
            </div>
          </div>

          <div className="set-note">
            Make sure the key for the selected provider is set:&nbsp;
            <strong>{AI_PROVIDERS.find(p => p.id === aiSelected)?.keyEnv}</strong> in Supabase → Edge Functions → Secrets.
            If it's missing, drafting will show a "key isn't configured" message.
          </div>

          <div className="set-foot">
            <button className="set-btn primary" onClick={saveAi}
              disabled={aiSaving || (aiSelected === aiCurrent && aiModel.trim() === aiModelSaved)}>
              {aiSaving ? "Saving…"
                : (aiSelected === aiCurrent && aiModel.trim() === aiModelSaved) ? "No changes"
                : "Save AI provider"}
            </button>
            {aiMsg && <span className={`set-msg ${aiMsg.ok ? "ok" : "err"}`}>{aiMsg.text}</span>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}