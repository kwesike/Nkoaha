// @ts-nocheck
// Supabase Edge Function: log-security-event
// ─────────────────────────────────────────────────────────────
// Records a high-value security event (login, document_signed,
// document_sent, payment, document_deleted) with the caller's IP address and
// device captured SERVER-SIDE — the browser cannot spoof these, unlike a value
// it would send itself.
//
// The caller's identity is taken from the JWT (Authorization: Bearer <token>),
// NOT from a client-supplied user id, so a user can only log an event as
// themselves. The row is written with the service role, so RLS stays locked
// (only admins can read security_events; nobody can insert from the client).
//
// Request body: { event_type: string, metadata?: object }
// Deploy: supabase functions deploy log-security-event --no-verify-jwt
//   (--no-verify-jwt so the CORS preflight reaches the function; we still
//    require and verify the Bearer token ourselves below.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Only these event types are accepted — keeps the log focused and prevents it
// being used as a generic write sink.
const ALLOWED = new Set([
  "login",
  "document_signed",
  "document_sent",
  "payment",
  "document_deleted",
]);

function clientIp(req: Request): string {
  // Supabase/edge puts the real client IP in x-forwarded-for (first entry).
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { event_type, metadata } = await req.json().catch(() => ({}));
    if (!event_type || !ALLOWED.has(event_type)) {
      return json({ error: "Invalid or missing event_type." }, 400);
    }

    // ── Identify the caller from their JWT (not from the body) ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization bearer token." }, 401);

    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await authed.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session." }, 401);

    // ── Write with the service role (bypasses RLS) ──
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Denormalise email for fast admin display.
    const { data: profile } = await admin
      .from("profiles").select("email").eq("id", user.id).maybeSingle();

    const { error: insErr } = await admin.from("security_events").insert({
      user_id:    user.id,
      email:      profile?.email || user.email || null,
      event_type,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent") || null,
      metadata:   (metadata && typeof metadata === "object") ? metadata : {},
    });
    if (insErr) return json({ error: "Could not record event.", detail: insErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}