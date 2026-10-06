// @ts-nocheck
// supabase/functions/send-notification-push/index.ts
//
// Fan-out web push for a notification. Given a notification id, this resolves
// every user the notification targets (all / role / plan / single user), looks
// up their push subscriptions, and sends a browser push to each — so the alert
// arrives even when their tab is closed. Reuses the same web-push + VAPID setup
// as send-push.
//
// Called by the admin compose page right after inserting the notification.
// Security: caller must be an admin (checked via their JWT).
//
// Deploy: supabase functions deploy send-notification-push --no-verify-jwt
// Secrets (already set for send-push): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC_KEY     = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY    = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO         = Deno.env.get("VAPID_MAILTO") || "mailto:support@nkoaha.space";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: caller must be an admin ──
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not signed in." }, 401);
    const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: caller } } = await asCaller.auth.getUser();
    if (!caller) return json({ error: "Session invalid." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("id", caller.id).maybeSingle();
    if (callerProfile?.role !== "admin") return json({ error: "Admins only." }, 403);

    // ── Load the notification ──
    const { notification_id } = await req.json();
    if (!notification_id) return json({ error: "Missing notification_id." }, 400);

    const { data: n } = await admin.from("notifications")
      .select("id,title,body,link,audience,target_role,target_plan,target_user_id")
      .eq("id", notification_id).maybeSingle();
    if (!n) return json({ error: "Notification not found." }, 404);

    // ── Resolve target user ids by audience ──
    let userIds: string[] = [];
    if (n.audience === "all") {
      const { data } = await admin.from("profiles").select("id");
      userIds = (data || []).map((r: any) => r.id);
    } else if (n.audience === "user" && n.target_user_id) {
      userIds = [n.target_user_id];
    } else if (n.audience === "role" && n.target_role) {
      const { data } = await admin.from("profiles").select("id").eq("role", n.target_role);
      userIds = (data || []).map((r: any) => r.id);
    } else if (n.audience === "plan" && n.target_plan) {
      const { data } = await admin.from("subscriptions")
        .select("user_id").eq("status", "active").eq("plan_id", n.target_plan);
      userIds = [...new Set((data || []).map((r: any) => r.user_id))];
    }

    if (!userIds.length) return json({ ok: true, sent: 0, note: "No target users." });

    // ── Gather their push subscriptions (chunk the IN query for large lists) ──
    webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({
      title: n.title,
      body:  n.body,
      icon:  "/nkoaha-icon-192.png",
      badge: "/nkoaha-icon-96.png",
      tag:   "nkoaha-notif-" + n.id,
      data:  { url: n.link || "/dashboard" },
    });

    let sent = 0, failed = 0;
    const deadEndpoints: string[] = [];

    // Collect all subscriptions first (chunk the IN query for large user lists).
    const allSubs: any[] = [];
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200);
      const { data: subs } = await admin.from("push_subscriptions")
        .select("endpoint, p256dh, auth").in("user_id", chunk);
      for (const s of (subs || [])) if (s.endpoint) allSubs.push(s);
    }

    // Send in PARALLEL batches — far higher throughput than one-at-a-time, so a
    // broadcast to many users finishes well within the function's time budget.
    const BATCH = 100;
    for (let i = 0; i < allSubs.length; i += BATCH) {
      const batch = allSubs.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      ));
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          sent++;
        } else {
          failed++;
          const code = (r.reason as any)?.statusCode;
          if (code === 404 || code === 410) deadEndpoints.push(batch[idx].endpoint);
        }
      });
    }

    // Clean up dead subscriptions so we don't keep retrying them.
    if (deadEndpoints.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    return json({ ok: true, targeted: userIds.length, sent, failed, cleaned: deadEndpoints.length });
  } catch (err) {
    console.error("fan-out error:", err);
    return json({ error: err?.message || "Unexpected error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}