import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

/* ─── Currency conversion (approximate rates) ─── */
const NGN_TO_USD = 0.00063; // 1 NGN ≈ 0.00063 USD
const NGN_TO_EUR = 0.00058;
type Currency = "NGN" | "USD" | "EUR";
type BillingPeriod = "monthly" | "yearly";

function fmt(ngn: number, currency: Currency): string {
  if (currency === "NGN") return `₦${ngn.toLocaleString()}`;
  if (currency === "USD") return `$${(ngn * NGN_TO_USD).toFixed(2)}`;
  return `€${(ngn * NGN_TO_EUR).toFixed(2)}`;
}

/* ─── Plans ─── */
const ORG_PLANS = [
  {
    id: "org_starter", name: "Starter", members: "Up to 20 members",
    monthly: 35000, yearly: 95000,
    features: ["Up to 20 team members","Unlimited document uploads","Full routing chains","Partnership linking","Audit log","Email support"],
    color: "#7c3aed", bg: "#ede9fe",
  },
  {
    id: "org_growth", name: "Growth", members: "Up to 100 members",
    monthly: 75000, yearly: 225000,
    features: ["Up to 100 team members","Everything in Starter","Priority support","Advanced audit logs","Multiple partnerships","API access"],
    color: "#2563eb", bg: "#dbeafe",
    popular: true,
  },
  {
    id: "org_enterprise", name: "Enterprise", members: "Unlimited members",
    monthly: 250000, yearly: 500000,
    features: ["Unlimited team members","Everything in Growth","Dedicated account manager","Custom onboarding","SLA guarantee","Custom integrations"],
    color: "#b45309", bg: "#fef9c3",
  },
];

const IND_PLANS = [
  { id: "ind_daily",   name: "Daily",   docs: "10 documents",  price: 3500,  period: "per day",   color: "#0d9488", bg: "#ccfbf1" },
  { id: "ind_weekly",  name: "Weekly",  docs: "30 documents",  price: 10000, period: "per week",  color: "#7c3aed", bg: "#ede9fe" },
  { id: "ind_monthly", name: "Monthly", docs: "50 documents",  price: 20000, period: "per month", color: "#2563eb", bg: "#dbeafe", popular: true },
  { id: "ind_yearly",  name: "Yearly",  docs: "Unlimited docs", price: 75000, period: "per year",  color: "#b45309", bg: "#fef9c3" },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{--purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;--green:#16a34a;--green-bg:#dcfce7;--amber:#b45309;--amber-bg:#fef9c3;--red:#dc2626;--red-bg:#fee2e2;--blue:#2563eb;--blue-bg:#dbeafe;--surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .bl-root{font-family:var(--font);color:var(--text);padding:32px 28px 80px;max-width:960px}
  .bl-header{margin-bottom:28px}
  .bl-title{font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px}
  .bl-sub{font-size:13px;color:var(--muted)}

  /* Free tier banner */
  .bl-free-banner{background:linear-gradient(135deg,#7c3aed,#2563eb);border-radius:14px;padding:20px 24px;margin-bottom:28px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .bl-free-icon{width:44px;height:44px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .bl-free-info{flex:1;min-width:0}
  .bl-free-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
  .bl-free-desc{font-size:12.5px;color:rgba(255,255,255,.75);line-height:1.5}
  .bl-free-badge{background:rgba(255,255,255,.2);color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0}

  /* Controls */
  .bl-controls{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
  .bl-currency{display:flex;gap:4px;background:var(--bg);border-radius:8px;padding:3px}
  .bl-currency-btn{padding:6px 14px;border-radius:6px;border:none;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);background:transparent;transition:all .15s}
  .bl-currency-btn.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .bl-period{display:flex;gap:4px;background:var(--bg);border-radius:8px;padding:3px}
  .bl-period-btn{padding:6px 16px;border-radius:6px;border:none;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);background:transparent;transition:all .15s;position:relative}
  .bl-period-btn.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .bl-save-chip{position:absolute;top:-8px;right:-4px;background:#16a34a;color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:8px;white-space:nowrap}

  /* Plan cards */
  .bl-plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-bottom:32px}
  .bl-plan{background:var(--surface);border:2px solid var(--border);border-radius:16px;padding:22px;position:relative;cursor:pointer;transition:all .2s}
  .bl-plan:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}
  .bl-plan.popular{border-color:var(--purple)}
  .bl-popular-chip{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:20px;white-space:nowrap}
  .bl-plan-name{font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px}
  .bl-plan-members{font-size:12px;color:var(--muted);margin-bottom:14px}
  .bl-plan-price{font-size:28px;font-weight:800;letter-spacing:-.03em;margin-bottom:4px}
  .bl-plan-period{font-size:12px;color:var(--muted);margin-bottom:16px}
  .bl-plan-features{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:7px}
  .bl-plan-features li{font-size:12.5px;color:var(--muted);display:flex;align-items:flex-start;gap:7px;line-height:1.4}
  .bl-plan-features li::before{content:"✓";font-weight:700;flex-shrink:0;margin-top:1px}
  .bl-plan-btn{width:100%;padding:10px;border-radius:9px;border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}

  /* Individual plan cards */
  .bl-ind-plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:32px}
  .bl-ind-plan{background:var(--surface);border:2px solid var(--border);border-radius:14px;padding:20px;position:relative;cursor:pointer;transition:all .2s;text-align:center}
  .bl-ind-plan:hover{box-shadow:0 6px 20px rgba(0,0,0,.09);transform:translateY(-2px)}
  .bl-ind-plan.popular{border-color:var(--blue)}
  .bl-ind-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 12px}
  .bl-ind-name{font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px}
  .bl-ind-docs{font-size:12px;font-weight:600;margin-bottom:12px}
  .bl-ind-price{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px}
  .bl-ind-period{font-size:11px;color:var(--muted);margin-bottom:16px}
  .bl-ind-btn{width:100%;padding:9px;border-radius:8px;border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}

  /* Stats */
  .bl-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:24px}
  .bl-stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
  .bl-stat-label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
  .bl-stat-value{font-size:22px;font-weight:700;color:var(--text);letter-spacing:-.02em}

  /* Payment modal */
  .bl-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)}
  .bl-modal{background:#fff;border-radius:18px;padding:28px;width:460px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,.2);animation:bl-in .18s ease}
  @keyframes bl-in{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
  .bl-modal-title{font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px}
  .bl-modal-sub{font-size:12.5px;color:var(--muted);margin-bottom:20px}
  .bl-plan-summary{background:var(--bg);border-radius:10px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
  .bl-plan-summary-name{font-size:14px;font-weight:600;color:var(--text)}
  .bl-plan-summary-price{font-size:16px;font-weight:800;color:var(--purple)}
  .bl-payment-methods{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
  .bl-pay-opt{display:flex;align-items:center;gap:12px;padding:13px 16px;border:2px solid var(--border);border-radius:10px;cursor:pointer;transition:all .15s}
  .bl-pay-opt:hover{border-color:#c4b5fd;background:var(--purple-light)}
  .bl-pay-opt.selected{border-color:var(--purple);background:var(--purple-light)}
  .bl-pay-opt-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .bl-pay-opt-info{flex:1}
  .bl-pay-opt-title{font-size:13.5px;font-weight:600;color:var(--text)}
  .bl-pay-opt-desc{font-size:11.5px;color:var(--muted)}
  .bl-pay-check{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s}
  .bl-pay-opt.selected .bl-pay-check{background:var(--purple);border-color:var(--purple);color:#fff}
  .bl-modal-footer{display:flex;gap:10px}
  .bl-modal-btn{flex:1;padding:12px;border-radius:10px;border:none;font-family:var(--font);font-size:13.5px;font-weight:600;cursor:pointer;transition:all .15s}
  .bl-modal-btn.primary{background:var(--purple);color:#fff}.bl-modal-btn.primary:hover{background:var(--purple-dark)}.bl-modal-btn.primary:disabled{opacity:.5;cursor:not-allowed}
  .bl-modal-btn.ghost{background:var(--bg);color:var(--muted);border:1.5px solid var(--border)}.bl-modal-btn.ghost:hover{background:var(--border)}
  .bl-flw-note{font-size:11px;color:var(--muted);text-align:center;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:5px}

  .bl-section-title{font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .bl-divider{height:1px;background:var(--border);margin:28px 0}
`;

const FLUTTERWAVE_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || "";

export default function BillingPage() {
  const [role, setRole]           = useState<"individual"|"organization">("individual");
  const [currency, setCurrency]   = useState<Currency>("NGN");
  const [period, setPeriod]       = useState<BillingPeriod>("monthly");
  const [memberCount, setMemberCount] = useState(0);
  const [docCount, setDocCount]   = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName]   = useState("");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [payMethod, setPayMethod] = useState<"card"|"transfer">("card");
  const [paying, setPaying]       = useState(false);
  const [activeSub, setActiveSub] = useState<any>(null);

  useEffect(() => {
    const id = "bl-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("email,role").eq("id", user.id).single();
    const r = profile?.role === "organization" ? "organization" : profile?.role === "organization_member" ? "organization" : "individual";
    setRole(r as any);
    setUserEmail(profile?.email || user.email || "");
    setUserName((profile?.email || user.email || "").split("@")[0]);

    const { count: dc } = await supabase.from("documents").select("id", { count:"exact", head:true }).eq("owner_id", user.id).neq("status","deleted");
    setDocCount(dc||0);

    if (r === "organization") {
      const { data: org } = await supabase.from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
      if (org?.id) {
        const { count: mc } = await supabase.from("profiles").select("id", { count:"exact", head:true }).eq("organization_id", org.id);
        setMemberCount(mc||0);
      }
    }

    // Fetch active subscription
    const { data: sub } = await supabase.from("subscriptions")
      .select("plan_id,status,expires_at,member_limit,doc_quota")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) setActiveSub(sub);
  }

  function getPrice(plan: any): number {
    if (plan.monthly !== undefined) return period === "monthly" ? plan.monthly : plan.yearly;
    return plan.price;
  }

  function initFlutterwave(plan: any) {
    const amount = getPrice(plan);
    const amountInCurrency = currency === "NGN" ? amount : currency === "USD" ? +(amount * NGN_TO_USD).toFixed(2) : +(amount * NGN_TO_EUR).toFixed(2);
    const curr = currency;

    if (!(window as any).FlutterwaveCheckout) {
      // Load Flutterwave script dynamically
      const s = document.createElement("script");
      s.src = "https://checkout.flutterwave.com/v3.js";
      s.onload = () => launchFlutterwave(plan, amountInCurrency, curr);
      document.head.appendChild(s);
    } else {
      launchFlutterwave(plan, amountInCurrency, curr);
    }
  }

  function launchFlutterwave(plan: any, amount: number, curr: Currency) {
    (window as any).FlutterwaveCheckout({
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref:     `nkoaha-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      amount,
      currency:   curr,
      payment_options: payMethod === "card" ? "card" : "banktransfer",
      customer: {
        email: userEmail,
        name:  userName,
      },
      customizations: {
        title:       "NkoAha",
        description: `${plan.name} Plan`,
        logo:        "https://nkoaha.com/nkoaha-logo.png",
      },
      callback: async (response: any) => {
        if (response.status === "successful" || response.status === "completed") {
          // Record subscription in database
          await recordSubscription(selectedPlan, response.transaction_id, response.tx_ref);
          alert(`Payment successful! Your ${selectedPlan.name} plan is now active.`);
          setSelectedPlan(null);
          setPaying(false);
          load(); // refresh stats
        } else {
          alert("Payment was not completed. Please try again.");
          setPaying(false);
        }
      },
      onclose: () => { setPaying(false); },
    });
  }

  async function recordSubscription(plan: any, txId: string, txRef: string) {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;

    // Calculate expiry based on period
    const now = new Date();
    let expiresAt: Date;
    const planPeriod = plan.period as string || (plan.monthly !== undefined ? period : 'monthly');
    if (planPeriod === 'daily')   { expiresAt = new Date(now.getTime() + 86400000); }
    else if (planPeriod === 'weekly')  { expiresAt = new Date(now.getTime() + 7*86400000); }
    else if (planPeriod === 'monthly') { expiresAt = new Date(now.setMonth(now.getMonth()+1)); }
    else                               { expiresAt = new Date(now.setFullYear(now.getFullYear()+1)); }

    // Member limit per plan
    const memberLimitMap: Record<string,number|null> = {
      org_starter: 20, org_growth: 100, org_enterprise: null,
    };
    const docQuotaMap: Record<string,number|null> = {
      ind_daily: 10, ind_weekly: 30, ind_monthly: 50, ind_yearly: null,
    };

    let orgId: string | null = null;
    if (role === 'organization') {
      const { data: org } = await supabase.from('organizations').select('id').eq('owner_id', user.id).maybeSingle();
      orgId = org?.id || null;
    }

    // Cancel old active subscriptions first, then insert new one
    await supabase.from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active');

    await supabase.from('subscriptions').insert({
      user_id:      user.id,
      org_id:       orgId,
      plan_id:      plan.id,
      plan_type:    role === 'organization' ? 'organization' : 'individual',
      status:       'active',
      member_limit: memberLimitMap[plan.id] ?? null,
      doc_quota:    docQuotaMap[plan.id] ?? null,
      period:       planPeriod,
      amount_ngn:   getPrice(plan),
      currency,
      flw_tx_ref:   txRef,
      flw_tx_id:    String(txId),
      expires_at:   expiresAt.toISOString(),
    });
  }

  function handlePay() {
    if (!selectedPlan) return;
    setPaying(true);
    initFlutterwave(selectedPlan);
  }

  const freeUsage = role === "individual"
    ? "2 free document uploads, routings and inbox receives per day"
    : "2 free trial document uploads, routings and inbox receives (one-time)";

  return (
    <DashboardLayout>
      <div className="bl-root">
        <div className="bl-header">
          <div className="bl-title">Billing & Plans</div>
          <div className="bl-sub">Choose a plan that works for your workflow. Powered by Flutterwave.</div>
        </div>

        {/* Stats */}
        <div className="bl-stats">
          <div className="bl-stat"><div className="bl-stat-label">Documents</div><div className="bl-stat-value">{docCount}</div></div>
          {role === "organization" && <div className="bl-stat"><div className="bl-stat-label">Members</div><div className="bl-stat-value">{memberCount}</div></div>}
          <div className="bl-stat">
            <div className="bl-stat-label">Current Plan</div>
            <div className="bl-stat-value" style={{fontSize:15,marginTop:4,color:activeSub?"#16a34a":"var(--muted)"}}>
              {activeSub ? activeSub.plan_id.replace('org_','').replace('ind_','').replace(/^\w/,(c:string)=>c.toUpperCase()) : "Free"}
            </div>
            {activeSub?.expires_at && <div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>Expires {new Date(activeSub.expires_at).toLocaleDateString()}</div>}
          </div>
          <div className="bl-stat"><div className="bl-stat-label">Account Type</div><div className="bl-stat-value" style={{fontSize:15,marginTop:4,textTransform:"capitalize"}}>{role}</div></div>
        </div>

        {/* Plan status banner */}
        <div className="bl-free-banner" style={{background:activeSub?"linear-gradient(135deg,#16a34a,#059669)":"linear-gradient(135deg,#7c3aed,#2563eb)"}}>
          <div className="bl-free-icon">{activeSub?"✅":"🎁"}</div>
          <div className="bl-free-info">
            {activeSub ? (<>
              <div className="bl-free-title">
                {activeSub.plan_id.replace('org_','').replace('ind_','').replace(/^\w/,(c:string)=>c.toUpperCase())} Plan Active
              </div>
              <div className="bl-free-desc">
                {activeSub.member_limit ? `Up to ${activeSub.member_limit} members` : activeSub.doc_quota ? `${activeSub.doc_quota} documents per period` : "Unlimited"} · Expires {new Date(activeSub.expires_at).toLocaleDateString()}
              </div>
            </>) : (<>
              <div className="bl-free-title">You are on the Free Plan</div>
              <div className="bl-free-desc">{freeUsage}.<br/>After your free allowance, further actions will prompt you to subscribe.</div>
            </>)}
          </div>
          <div className="bl-free-badge">{activeSub?"Active":"Free Tier"}</div>
        </div>

        {/* Currency + Period toggles (org only needs period) */}
        <div className="bl-controls">
          <div className="bl-currency">
            {(["NGN","USD","EUR"] as Currency[]).map(c=>(
              <button key={c} className={`bl-currency-btn${currency===c?" active":""}`} onClick={()=>setCurrency(c)}>{c}</button>
            ))}
          </div>
          {role === "organization" && (
            <div className="bl-period">
              <button className={`bl-period-btn${period==="monthly"?" active":""}`} onClick={()=>setPeriod("monthly")}>Monthly</button>
              <button className={`bl-period-btn${period==="yearly"?" active":""}`} onClick={()=>setPeriod("yearly")}>
                Yearly
                <span className="bl-save-chip">Save 67%</span>
              </button>
            </div>
          )}
        </div>

        {/* Organization plans */}
        {role === "organization" && (<>
          <div className="bl-section-title">
            <span>👥</span> Organization Plans
          </div>
          <div className="bl-plans">
            {ORG_PLANS.map(plan => {
              const price = period === "monthly" ? plan.monthly : plan.yearly;
              return (
                <div key={plan.id} className={`bl-plan${plan.popular?" popular":""}`}
                  onClick={()=>setSelectedPlan({...plan, period})}>
                  {plan.popular && <div className="bl-popular-chip">Most Popular</div>}
                  <div className="bl-plan-name">{plan.name}</div>
                  <div className="bl-plan-members" style={{color:plan.color,fontWeight:600}}>{plan.members}</div>
                  <div className="bl-plan-price" style={{color:plan.color}}>{fmt(price, currency)}</div>
                  <div className="bl-plan-period">per {period === "monthly" ? "month" : "year"}</div>
                  <ul className="bl-plan-features" style={{borderTop:`1px solid ${plan.bg}`,paddingTop:14}}>
                    {plan.features.map(f=>(
                      <li key={f} style={{"--check-color":plan.color} as any}>
                        <span style={{color:plan.color}}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button className="bl-plan-btn" style={{background:plan.color,color:"#fff"}}>
                    Choose {plan.name}
                  </button>
                </div>
              );
            })}
          </div>
        </>)}

        {/* Individual plans */}
        {role === "individual" && (<>
          <div className="bl-section-title">
            <span>👤</span> Individual Plans
          </div>
          <div className="bl-ind-plans">
            {IND_PLANS.map(plan => (
              <div key={plan.id} className={`bl-ind-plan${(plan as any).popular?" popular":""}`}
                onClick={()=>setSelectedPlan(plan)}>
                {(plan as any).popular && <div className="bl-popular-chip">Best Value</div>}
                <div className="bl-ind-icon" style={{background:plan.bg}}>
                  {plan.id==="ind_daily"?"📅":plan.id==="ind_weekly"?"📆":plan.id==="ind_monthly"?"🗓️":"♾️"}
                </div>
                <div className="bl-ind-name">{plan.name}</div>
                <div className="bl-ind-docs" style={{color:plan.color}}>{plan.docs}</div>
                <div className="bl-ind-price" style={{color:plan.color}}>{fmt(plan.price, currency)}</div>
                <div className="bl-ind-period">{plan.period}</div>
                <button className="bl-ind-btn" style={{background:plan.color,color:"#fff"}}>
                  Get {plan.name}
                </button>
              </div>
            ))}
          </div>
        </>)}

        <div className="bl-divider"/>

        {/* FAQ note */}
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:10}}>How billing works</div>
          {role==="individual"
            ? <ul style={{paddingLeft:18,margin:0,display:"flex",flexDirection:"column",gap:6,fontSize:12.5,color:"var(--muted)"}}>
                <li>You get <strong>2 free document actions per day</strong> — upload, route, or receive.</li>
                <li>Once your daily free allowance is used, you will be prompted to subscribe.</li>
                <li>Daily plans reset every 24 hours. Weekly, monthly and yearly plans activate immediately.</li>
                <li>All payments are processed securely through <strong>Flutterwave</strong>.</li>
              </ul>
            : <ul style={{paddingLeft:18,margin:0,display:"flex",flexDirection:"column",gap:6,fontSize:12.5,color:"var(--muted)"}}>
                <li>Your organisation gets a <strong>one-time free trial</strong> of 2 document actions.</li>
                <li>Plans are based on the number of members in your organisation.</li>
                <li>Yearly plans offer significant savings vs monthly billing.</li>
                <li>All payments are processed securely through <strong>Flutterwave</strong>.</li>
              </ul>
          }
        </div>

        {/* Payment modal */}
        {selectedPlan && (
          <div className="bl-backdrop" onClick={()=>{if(!paying)setSelectedPlan(null);}}>
            <div className="bl-modal" onClick={e=>e.stopPropagation()}>
              <div className="bl-modal-title">Complete Your Purchase</div>
              <div className="bl-modal-sub">Select a payment method to proceed via Flutterwave</div>

              {/* Plan summary */}
              <div className="bl-plan-summary">
                <div>
                  <div className="bl-plan-summary-name">{selectedPlan.name} Plan</div>
                  <div style={{fontSize:11.5,color:"var(--muted)",marginTop:2}}>
                    {selectedPlan.members || selectedPlan.docs}
                    {selectedPlan.period ? ` · ${selectedPlan.period}` : ` · per ${period}`}
                  </div>
                </div>
                <div className="bl-plan-summary-price">
                  {fmt(getPrice(selectedPlan), currency)}
                </div>
              </div>

              {/* Payment methods */}
              <div style={{fontSize:12,fontWeight:600,color:"var(--muted)",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>
                Payment Method
              </div>
              <div className="bl-payment-methods">
                <div className={`bl-pay-opt${payMethod==="card"?" selected":""}`} onClick={()=>setPayMethod("card")}>
                  <div className="bl-pay-opt-icon" style={{background:"#ede9fe"}}>💳</div>
                  <div className="bl-pay-opt-info">
                    <div className="bl-pay-opt-title">Debit / Credit Card</div>
                    <div className="bl-pay-opt-desc">Visa, Mastercard, Verve — instant activation</div>
                  </div>
                  <div className="bl-pay-check">
                    {payMethod==="card"&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
                <div className={`bl-pay-opt${payMethod==="transfer"?" selected":""}`} onClick={()=>setPayMethod("transfer")}>
                  <div className="bl-pay-opt-icon" style={{background:"#dcfce7"}}>🏦</div>
                  <div className="bl-pay-opt-info">
                    <div className="bl-pay-opt-title">Bank Transfer</div>
                    <div className="bl-pay-opt-desc">Transfer to a virtual account — activated on confirmation</div>
                  </div>
                  <div className="bl-pay-check">
                    {payMethod==="transfer"&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
              </div>

              <div className="bl-modal-footer">
                <button className="bl-modal-btn ghost" onClick={()=>setSelectedPlan(null)} disabled={paying}>Cancel</button>
                <button className="bl-modal-btn primary" onClick={handlePay} disabled={paying||!FLUTTERWAVE_PUBLIC_KEY}>
                  {paying?"Opening Checkout…":`Pay ${fmt(getPrice(selectedPlan),currency)}`}
                </button>
              </div>

              {!FLUTTERWAVE_PUBLIC_KEY && (
                <div style={{fontSize:11.5,color:"var(--amber)",background:"var(--amber-bg)",padding:"8px 12px",borderRadius:7,marginTop:12,textAlign:"center"}}>
                  ⚠️ Add <strong>VITE_FLUTTERWAVE_PUBLIC_KEY</strong> to your .env to enable payments
                </div>
              )}

              <div className="bl-flw-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Secured by <strong style={{color:"#f5a623"}}>Flutterwave</strong> · 256-bit SSL encryption
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}