// @ts-nocheck
// Supabase Edge Function: verify-payment
//
// The browser must never be the source of truth for "did this payment happen".
// This function asks Flutterwave directly, then writes the subscription with
// the service-role key (bypassing RLS), so a successful payment ALWAYS results
// in an active plan.
//
// Flow:
//   1. Read the caller's JWT -> resolve the real user (never trust a body user_id)
//   2. GET https://api.flutterwave.com/v3/transactions/{id}/verify  (secret key)
//   3. Assert status=successful AND the amount/currency match the plan
//   4. Cancel any previous active subscription, insert the new one
//
// Required Supabase secrets:
//   FLW_SECRET_KEY              (FLWSECK-... from your Flutterwave dashboard)
//   SUPABASE_URL                (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   SUPABASE_ANON_KEY           (auto-provided)
//
// Deploy with:
//   supabase functions deploy verify-payment --no-verify-jwt
// (--no-verify-jwt is required so the CORS preflight reaches this code; the
//  function verifies the JWT itself below.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Server-side price table. The client cannot dictate what a plan costs.
const PLANS: Record<string, {
  type: "organization" | "individual";
  monthly: number; yearly: number;
  member_limit: number | null; doc_quota: number | null;
  partner_limit: number | null; org_doc_limit: number | null;
}> = {
  org_starter:    { type: "organization", monthly: 195000, yearly: 1638000, member_limit: 10,   doc_quota: null, partner_limit: 1,    org_doc_limit: 100  },
  org_growth:     { type: "organization", monthly: 395000, yearly: 3318000, member_limit: 50,   doc_quota: null, partner_limit: null, org_doc_limit: 500  },
  org_enterprise: { type: "organization", monthly: 595000, yearly: 4950000, member_limit: null, doc_quota: null, partner_limit: null, org_doc_limit: null },
  ind_monthly:    { type: "individual",   monthly: 18000,  yearly: 18000,   member_limit: null, doc_quota: 50,   partner_limit: null, org_doc_limit: null },
  ind_yearly:     { type: "individual",   monthly: 195000, yearly: 195000,  member_limit: null, doc_quota: null, partner_limit: null, org_doc_limit: null },
};

const NGN_TO_USD = 0.00073;
const NGN_TO_EUR = 0.00058;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const FLW_SECRET      = Deno.env.get("FLW_SECRET_KEY");
    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SB_URL     = Deno.env.get("SUPABASE_URL");
    const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SB_ANON    = Deno.env.get("SUPABASE_ANON_KEY");

    // ── 1. Who is calling? Resolve from the JWT, never from the body. ──
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not signed in." }, 401);

    const anon = createClient(SB_URL, SB_ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalid. Please sign in again." }, 401);

    // ── 2. Read the claim from the client ──
    const body = await req.json();
    const provider      = body.provider === "paystack" ? "paystack" : "flutterwave";
    const transactionId = String(body.transaction_id || ""); // FLW: tx id · PS: reference
    const txRef         = String(body.tx_ref || "");
    const planId        = String(body.plan_id || "");
    const period        = body.period === "yearly" ? "yearly" : "monthly";
    const currency      = ["NGN", "USD", "EUR"].includes(body.currency) ? body.currency : "NGN";

    if (!transactionId) return json({ error: "Missing transaction reference." }, 400);
    const plan = PLANS[planId];
    if (!plan) return json({ error: `Unknown plan: ${planId}` }, 400);

    const expectedNgn = period === "yearly" ? plan.yearly : plan.monthly;

    // ── 3+4. Verify with the RIGHT provider, and confirm the amount ──
    //   uniqueRef  = the id we store as flw_tx_id (idempotency key)
    let uniqueRef = transactionId;

    if (provider === "paystack") {
      if (!PAYSTACK_SECRET) return json({ error: "PAYSTACK_SECRET_KEY not configured on the server." }, 500);
      // Paystack verifies by reference. Amounts are in KOBO. NGN only.
      const ref = txRef || transactionId;
      uniqueRef = ref;
      const vRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
      );
      const vBody = await vRes.json().catch(() => ({}));
      if (!vRes.ok) return json({ error: "Could not verify the payment with Paystack.", detail: vBody }, 502);
      const tx = vBody?.data;
      if (!tx || tx.status !== "success") {
        return json({ error: "Payment not successful.", status: tx?.status ?? "unknown" }, 402);
      }
      const paidNgn = Number(tx.amount) / 100; // kobo -> naira
      if (paidNgn < expectedNgn * 0.99) {
        return json({
          error: "Payment amount does not match the selected plan.",
          detail: { paid: paidNgn, expected: expectedNgn },
        }, 402);
      }
    } else {
      if (!FLW_SECRET) return json({ error: "FLW_SECRET_KEY not configured on the server." }, 500);
      // Flutterwave verifies by transaction id. Supports NGN/USD/EUR.
      const vRes = await fetch(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
        { headers: { Authorization: `Bearer ${FLW_SECRET}` } },
      );
      const vBody = await vRes.json().catch(() => ({}));
      if (!vRes.ok) return json({ error: "Could not verify the payment with Flutterwave.", detail: vBody }, 502);
      const tx = vBody?.data;
      if (!tx || tx.status !== "successful") {
        return json({ error: "Payment not successful.", status: tx?.status ?? "unknown" }, 402);
      }
      const expected =
        currency === "NGN" ? expectedNgn
        : currency === "USD" ? +(expectedNgn * NGN_TO_USD).toFixed(2)
        : +(expectedNgn * NGN_TO_EUR).toFixed(2);
      if (tx.currency !== currency || Number(tx.amount) < expected * 0.99) {
        return json({
          error: "Payment amount does not match the selected plan.",
          detail: { paid: Number(tx.amount), currency: tx.currency, expected, expected_currency: currency },
        }, 402);
      }
    }

    // ── 5. Write the subscription with the service role (bypasses RLS) ──
    const admin = createClient(SB_URL, SB_SERVICE);

    // Idempotency: if this transaction was already recorded, return success
    // rather than creating a duplicate (callback + webhook can both fire).
    const { data: existing } = await admin.from("subscriptions")
      .select("id, plan_id, expires_at")
      .eq("flw_tx_id", String(uniqueRef))
      .maybeSingle();
    if (existing) {
      return json({ ok: true, already_recorded: true, subscription: existing });
    }

    let orgId: string | null = null;
    if (plan.type === "organization") {
      const { data: org } = await admin.from("organizations")
        .select("id").eq("owner_id", user.id).maybeSingle();
      orgId = org?.id ?? null;
    }

    const now = new Date();
    const expiresAt = new Date(now);
    if (period === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else                     expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Retire any previous active subscription of the same type.
    await admin.from("subscriptions")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    const { data: inserted, error: insErr } = await admin.from("subscriptions").insert({
      user_id:       user.id,
      org_id:        orgId,
      plan_id:       planId,
      plan_type:     plan.type,
      status:        "active",
      member_limit:  plan.member_limit,
      doc_quota:     plan.doc_quota,
      partner_limit: plan.partner_limit,
      org_doc_limit: plan.org_doc_limit,
      period,
      amount_ngn:    expectedNgn,
      currency,
      flw_tx_ref:    txRef || String(uniqueRef),
      flw_tx_id:     String(uniqueRef),
      expires_at:    expiresAt.toISOString(),
    }).select("id, plan_id, expires_at").single();

    if (insErr) {
      // The money is real and we could not record it — make this loud.
      console.error("[verify-payment] insert failed", insErr, { user: user.id, uniqueRef, provider });
      return json({ error: "Payment verified but the subscription could not be saved.", detail: insErr.message }, 500);
    }

    return json({ ok: true, subscription: inserted });
  } catch (e) {
    console.error("[verify-payment] unexpected", e);
    return json({ error: "Unexpected error", detail: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}