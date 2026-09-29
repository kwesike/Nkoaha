// @ts-nocheck
// Supabase Edge Function: flutterwave-webhook
//
// Bank transfers (and any payment where the user closed the tab) are confirmed
// by Flutterwave AFTER the browser is gone, so the client callback never runs.
// This endpoint is Flutterwave calling YOU. It is the safety net that ensures a
// completed payment always becomes an active subscription.
//
// Setup:
//   1. supabase secrets set FLW_SECRET_HASH=<a long random string you invent>
//      supabase secrets set FLW_SECRET_KEY=FLWSECK-...
//   2. supabase functions deploy flutterwave-webhook --no-verify-jwt
//   3. Flutterwave dashboard -> Settings -> Webhooks:
//        URL:         https://<project>.supabase.co/functions/v1/flutterwave-webhook
//        Secret hash: the same string as FLW_SECRET_HASH
//
// The tx_ref created in BillingPage encodes the buyer and plan:
//   nkoaha-<userId>-<planId>-<period>-<currency>-<random>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  // Flutterwave sends the shared secret in this header. Reject anything else.
  const sent     = req.headers.get("verif-hash");
  const expected = Deno.env.get("FLW_SECRET_HASH");
  if (!expected || sent !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const event = await req.json();
    const data  = event?.data ?? event;
    const status = String(data?.status || "").toLowerCase();

    // Only act on completed charges. Always 200 so Flutterwave stops retrying.
    if (status !== "successful" && status !== "completed") {
      return new Response("ignored", { status: 200 });
    }

    const txRef = String(data?.tx_ref || "");
    const txId  = String(data?.id || data?.transaction_id || "");
    if (!txRef.startsWith("nkoaha-") || !txId) {
      return new Response("not ours", { status: 200 });
    }

    // nkoaha-<userId>-<planId>-<period>-<currency>-<random>
    // userId is a UUID (contains dashes), so parse from the END.
    const parts = txRef.split("-");
    if (parts.length < 6) return new Response("bad ref", { status: 200 });
    const currency = parts[parts.length - 2];
    const period   = parts[parts.length - 3] === "yearly" ? "yearly" : "monthly";
    const planId   = parts[parts.length - 4];
    const userId   = parts.slice(1, parts.length - 4).join("-");

    const plan = PLANS[planId];
    if (!plan || !userId) return new Response("unknown plan", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Idempotent: the browser callback may have already recorded this.
    const { data: existing } = await admin.from("subscriptions")
      .select("id").eq("flw_tx_id", txId).maybeSingle();
    if (existing) return new Response("already recorded", { status: 200 });

    let orgId: string | null = null;
    if (plan.type === "organization") {
      const { data: org } = await admin.from("organizations")
        .select("id").eq("owner_id", userId).maybeSingle();
      orgId = org?.id ?? null;
    }

    const now = new Date();
    const expiresAt = new Date(now);
    if (period === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else                     expiresAt.setMonth(expiresAt.getMonth() + 1);

    await admin.from("subscriptions")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("user_id", userId).eq("status", "active");

    const { error } = await admin.from("subscriptions").insert({
      user_id:       userId,
      org_id:        orgId,
      plan_id:       planId,
      plan_type:     plan.type,
      status:        "active",
      member_limit:  plan.member_limit,
      doc_quota:     plan.doc_quota,
      partner_limit: plan.partner_limit,
      org_doc_limit: plan.org_doc_limit,
      period,
      amount_ngn:    period === "yearly" ? plan.yearly : plan.monthly,
      currency,
      flw_tx_ref:    txRef,
      flw_tx_id:     txId,
      expires_at:    expiresAt.toISOString(),
    });
    if (error) console.error("[flutterwave-webhook] insert failed", error, { userId, txId });

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[flutterwave-webhook] error", e);
    // Still 200 — a 500 makes Flutterwave retry the same event forever.
    return new Response("error logged", { status: 200 });
  }
});