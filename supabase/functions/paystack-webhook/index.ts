// @ts-nocheck
// Supabase Edge Function: paystack-webhook
//
// Paystack calls this after a successful charge (the reliable path — fires even
// if the browser closed). Paystack signs the request with an HMAC SHA512 of the
// RAW body using your secret key, sent in the x-paystack-signature header.
//
// The charge metadata carries who/what is being bought (we set it in
// BillingPage), so we can record the exact subscription.
//
// Setup:
//   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
//   supabase functions deploy paystack-webhook --no-verify-jwt
//   Paystack dashboard -> Settings -> API Keys & Webhooks -> Webhook URL:
//     https://<project>.supabase.co/functions/v1/paystack-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

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
  try {
    const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!SECRET) return new Response("not configured", { status: 500 });

    // Verify the signature against the RAW body (must hash the exact bytes).
    const raw = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";
    const expected = createHmac("sha512", SECRET).update(raw).digest("hex");
    if (signature !== expected) {
      return new Response("invalid signature", { status: 401 });
    }

    const event = JSON.parse(raw);
    if (event?.event !== "charge.success") {
      return new Response("ignored", { status: 200 });
    }

    const data = event.data;
    const reference = String(data?.reference || "");
    // We put these in metadata when starting the charge in BillingPage.
    const meta = data?.metadata || {};
    const userId = String(meta.user_id || "");
    const planId = String(meta.plan_id || "");
    const period = meta.period === "yearly" ? "yearly" : "monthly";
    const currency = data?.currency || "NGN";

    if (!reference || !userId || !PLANS[planId]) {
      return new Response("missing metadata", { status: 200 });
    }
    const plan = PLANS[planId];

    // Confirm the amount actually paid (Paystack amounts are in KOBO).
    const expectedNgn = period === "yearly" ? plan.yearly : plan.monthly;
    const paidNgn = Number(data?.amount || 0) / 100;
    if (paidNgn < expectedNgn * 0.99) {
      return new Response("amount mismatch", { status: 200 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Idempotent — the browser verify path may have already recorded it.
    const { data: existing } = await admin.from("subscriptions")
      .select("id").eq("flw_tx_id", reference).maybeSingle();
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
      amount_ngn:    expectedNgn,
      currency,
      flw_tx_ref:    reference,   // reused columns; holds the Paystack ref
      flw_tx_id:     reference,   // Paystack's reference is the unique id
      expires_at:    expiresAt.toISOString(),
    });
    if (error) console.error("[paystack-webhook] insert failed", error, { userId, reference });

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[paystack-webhook] error", e);
    return new Response("error logged", { status: 200 });
  }
});