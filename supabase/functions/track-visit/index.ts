// @ts-nocheck
// supabase/functions/track-visit/index.ts
// Public endpoint for the marketing site's analytics beacon. Anonymous — must
// be deployed with verify_jwt = false:
//   supabase functions deploy track-visit --no-verify-jwt
//
// Receives {type, path, referrer, utm_*, label, href, visitor_id, session_id}
// and records it in website_events with the IP/country/device derived
// server-side. Fire-and-forget: always returns 200 quickly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function deviceFromUA(ua: string): string {
  const s = (ua || "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return "mobile";
  return "desktop";
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")   return new Response("ok", { headers: cors });

  try {
    const b = await req.json().catch(() => ({}));

    const type = b.type === "click" ? "click" : "pageview";
    const path = (b.path || "").toString().slice(0, 300);
    const referrer = (b.referrer || "").toString().slice(0, 500);
    const utm_source   = (b.utm_source   || "").toString().slice(0, 100) || null;
    const utm_medium   = (b.utm_medium   || "").toString().slice(0, 100) || null;
    const utm_campaign = (b.utm_campaign || "").toString().slice(0, 100) || null;

    // Traffic source: utm_source wins, else referrer host, else 'direct'.
    const refHost = hostOf(referrer);
    const selfHosts = ["nkoaha.space", "app.nkoaha.space"];
    let source = utm_source || (refHost && !selfHosts.includes(refHost) ? refHost : "direct");
    source = source.toString().slice(0, 100);

    const ua = req.headers.get("user-agent") || "";
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") || "";
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-country") || null;

    const row = {
      type,
      path,
      referrer: referrer || null,
      source,
      utm_source, utm_medium, utm_campaign,
      label: type === "click" ? (b.label || "").toString().slice(0, 200) : null,
      href:  type === "click" ? (b.href  || "").toString().slice(0, 500) : null,
      visitor_id: (b.visitor_id || "").toString().slice(0, 64) || null,
      session_id: (b.session_id || "").toString().slice(0, 64) || null,
      user_agent: ua.slice(0, 400),
      device: deviceFromUA(ua),
      ip: ip || null,
      country,
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase.from("website_events").insert(row);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (_e) {
    // Never fail loudly for a tracking beacon.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});