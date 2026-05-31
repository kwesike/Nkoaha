// @ts-nocheck
// supabase/functions/send-push/index.ts
// Deploy: supabase functions deploy send-push
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_MAILTO=mailto:support@nkoaha.space

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY     = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY    = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO         = Deno.env.get("VAPID_MAILTO") || "mailto:support@nkoaha.space";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { userId, title, body, url, tag } = await req.json();
    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: sub } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)
      .single();

    if (!sub?.endpoint) {
      return new Response(JSON.stringify({ ok: false, reason: "No subscription" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    const payload = JSON.stringify({
      title,
      body,
      icon:  "/nkoaha-icon-192.png",
      badge: "/nkoaha-icon-96.png",
      tag:   tag || "nkoaha",
      data:  { url: url || "/dashboard" },
    });

    await webpush.sendNotification(pushSub, payload);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});