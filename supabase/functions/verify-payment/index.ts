import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: "Missing transaction ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const flw_secret = Deno.env.get("FLW_SECRET_KEY");
    if (!flw_secret) {
      return new Response(JSON.stringify({ error: "Missing FLW secret key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Flutterwave verify API (THIS WORKS because it's server-side)
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flw_secret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const flwData = await flwRes.json();

    return new Response(JSON.stringify(flwData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
