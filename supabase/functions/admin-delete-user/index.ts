// @ts-nocheck
// Supabase Edge Function: admin-delete-user
//
// Deleting a user must happen server-side: only the service-role key can remove
// an auth.users entry, and that must NEVER be exposed to the browser. Deleting
// the auth user cascades to profiles and related rows via the FKs already made
// safe in fix_user_delete_fks.sql (SET NULL for attribution, CASCADE where a
// child cannot exist without the user).
//
// Security: the CALLER must be an admin. We resolve the caller from their JWT
// and check profiles.role = 'admin' before doing anything. A non-admin (or a
// forged request) gets rejected.
//
// Required secrets (already present for other functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//
// Deploy:
//   supabase functions deploy admin-delete-user --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SB_URL     = Deno.env.get("SUPABASE_URL");
    const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SB_ANON    = Deno.env.get("SUPABASE_ANON_KEY");

    // ── 1. Who is calling? Resolve from JWT; never trust a body-supplied id. ──
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not signed in." }, 401);

    const asCaller = createClient(SB_URL, SB_ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: caller }, error: callerErr } = await asCaller.auth.getUser();
    if (callerErr || !caller) return json({ error: "Session invalid." }, 401);

    // ── 2. Is the caller an admin? ──
    const admin = createClient(SB_URL, SB_SERVICE);
    const { data: callerProfile } = await admin
      .from("profiles").select("role, is_super_admin").eq("id", caller.id).maybeSingle();
    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Not authorized. Admins only." }, 403);
    }

    // ── 3. Which user to delete? ──
    const body = await req.json();
    const targetId = String(body.user_id || "");
    if (!targetId) return json({ error: "Missing user_id." }, 400);

    // Guard rails:
    //  • Can't delete yourself (avoid an admin nuking their own account by accident).
    //  • Can't delete another admin unless YOU are the super admin.
    if (targetId === caller.id) {
      return json({ error: "You can't delete your own account here." }, 400);
    }
    const { data: targetProfile } = await admin
      .from("profiles").select("role, is_super_admin, email").eq("id", targetId).maybeSingle();
    if (!targetProfile) return json({ error: "User not found." }, 404);
    if (targetProfile.role === "admin" && !callerProfile.is_super_admin) {
      return json({ error: "Only the super admin can delete another admin." }, 403);
    }
    if (targetProfile.is_super_admin) {
      return json({ error: "The super admin account cannot be deleted." }, 403);
    }

    // ── 4. Delete the auth user (cascades to profiles + safe-FK children). ──
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) {
      return json({ error: "Delete failed: " + delErr.message }, 500);
    }

    return json({ ok: true, deleted: targetId, email: targetProfile.email });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}