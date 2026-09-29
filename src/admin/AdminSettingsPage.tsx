import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
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

export default function AdminSettingsPage() {
  const [current, setCurrent]   = useState<Provider | null>(null); // saved value
  const [selected, setSelected] = useState<Provider>("flutterwave"); // pending choice
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

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
      .select("value").eq("key", "active_payment_provider").maybeSingle();
    const p = data?.value === "paystack" ? "paystack" : "flutterwave";
    setCurrent(p);
    setSelected(p);
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
      </div>
    </AdminLayout>
  );
}