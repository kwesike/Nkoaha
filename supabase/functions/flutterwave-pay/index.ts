import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY");

serve(async (req) => {
  const url = new URL(req.url);

  // =====================================================
  // 1️⃣ FLUTTERWAVE REDIRECT CALLBACK (VERIFY PAYMENT)
  // =====================================================
  if (url.searchParams.get("transaction_id")) {
    const transactionId = url.searchParams.get("transaction_id");
    const regId = url.searchParams.get("regId");

    // VERIFY PAYMENT
    const verify = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET}`,
        },
      }
    );

    const verifyResult = await verify.json();

    // If payment was successful
    if (verifyResult.status === "success") {
      // Update Supabase database
      await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/registrations?id=eq.${regId}`, {
        method: "PATCH",
        headers: {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payment_status: "paid" }),
      });

      // Redirect user back to your success page
      return Response.redirect(
        `https://your-site.com/success/${regId}`, // CHANGE THIS
        302
      );
    }

    // ❌ Payment Failed
    return Response.redirect(
      `https://your-site.com/payment-failed`, // CHANGE THIS
      302
    );
  }

  // =====================================================
  // 2️⃣ INITIALIZE PAYMENT
  // =====================================================
  try {
    const { full_name, email, amount, regId } = await req.json();

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: `REG-${regId}-${Date.now()}`,
        amount,
        currency: "NGN",
        redirect_url: `https://toqkuvrbywyyqyicjehc.functions.supabase.co/flutterwave-pay?regId=${regId}`,
        customer: { email, name: full_name },
        meta: { regId },
      }),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
