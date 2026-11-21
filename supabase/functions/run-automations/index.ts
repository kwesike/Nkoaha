// ════════════════════════════════════════════════════════════════
// NkoAha — run-automations  (Automation execution engine, Stage 2)
// ----------------------------------------------------------------
// One scheduled function that the pg_cron job calls every ~15 min
// (see automations_scheduler.sql). It walks every ENABLED automation,
// decides whether its trigger fired, checks the conditions, and runs
// the actions — logging each outcome to automation_runs so nothing
// fires twice.
//
// It runs with the SERVICE ROLE key (bypasses RLS) because it acts on
// behalf of every user, so it is guarded by a shared CRON_SECRET header
// and must be deployed with:  supabase functions deploy run-automations --no-verify-jwt
//
// ─── SCHEMA ADAPTER ───────────────────────────────────────────────
// The engine reads your `documents` table through the map below. These
// are the ONLY assumptions about your schema — if any column is named
// differently in your DB, change it here and nothing else.
// ══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

// Logical field  →  actual column on `documents` (verified against the app).
// `documents` has NO recipient_email/sender_email/sent_at/completed_at — those
// are resolved from document_routes + profiles in enrichDoc() below.
const COL = {
  id:         "id",
  owner:      "owner_id",
  sender:     "sender_id",          // falls back to owner_id if null
  org:        "organization_id",
  title:      "title",
  format:     "format",
  status:     "status",
  amount:     "amount",             // optional; read defensively (="" if absent)
  created_at: "created_at",
  updated_at: "updated_at",
  file_url:   "file_url",
};
// Status values: fully signed / done, and still out for signing.
const DONE_STATUSES    = ["completed", "signed", "done"];
const PENDING_STATUSES = ["pending", "sent"];
// document_routes step statuses that mean "waiting on this person right now".
const ACTIVE_ROUTE_STATUSES = ["pending"];
// How far back to look for event triggers on each run (safety overlap).
const LOOKBACK_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
// ══════════════════════════════════════════════════════════════════

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET   = Deno.env.get("CRON_SECRET") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL    = Deno.env.get("AUTOMATION_FROM_EMAIL") || "NkoAha <noreply@nkoaha.space>";
const APP_URL       = Deno.env.get("APP_URL") || "https://app.nkoaha.space";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
};

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── helpers ───────────────────────────────────────────────────────
const lc = (v: unknown) => String(v ?? "").toLowerCase().trim();

function docField(doc: any, field: string): string {
  switch (field) {
    case "title":           return doc[COL.title] ?? "";
    case "format":          return doc[COL.format] ?? "";
    case "amount":          return doc[COL.amount] ?? "";
    case "sender_email":    return doc._sender_email ?? "";      // resolved in enrichDoc
    case "recipient_email": return doc._recipient_email ?? "";   // resolved in enrichDoc
    default:                return "";
  }
}

// Resolve the sender's email (document owner) and the recipient(s) currently
// awaiting signature, from document_routes → profiles. Attaches:
//   doc._sender_email      — owner/sender's email
//   doc._recipient_email   — first active recipient's email (for conditions)
//   doc._active_recipients — all emails currently waiting to sign (for reminders)
async function enrichDoc(doc: any): Promise<void> {
  const senderId = doc[COL.sender] || doc[COL.owner];
  if (senderId) {
    const { data: p } = await db.from("profiles").select("email").eq("id", senderId).maybeSingle();
    doc._sender_email = p?.email || "";
  } else doc._sender_email = "";

  const emails: string[] = [];
  try {
    const { data: routes } = await db
      .from("document_routes")
      .select("recipient_id,status,route_order")
      .eq("document_id", doc[COL.id])
      .in("status", ACTIVE_ROUTE_STATUSES)
      .order("route_order", { ascending: true });
    for (const r of routes || []) {
      if (!r.recipient_id) continue;
      const { data: p } = await db.from("profiles").select("email").eq("id", r.recipient_id).maybeSingle();
      if (p?.email) emails.push(p.email);
    }
  } catch { /* routes table shape differs — non-fatal */ }
  doc._active_recipients = emails;
  doc._recipient_email = emails[0] || "";
}

function matchesConditions(doc: any, conditions: any[]): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true; // no conditions = always
  return conditions.every((c) => {
    const actual = docField(doc, c.field);
    const want   = c.value ?? "";
    switch (c.op) {
      case "is":       return lc(actual) === lc(want);
      case "is_not":   return lc(actual) !== lc(want);
      case "contains": return lc(actual).includes(lc(want));
      case "gt":       return parseFloat(actual) > parseFloat(want);
      case "lt":       return parseFloat(actual) < parseFloat(want);
      default:         return false;
    }
  });
}

// Most recent successful run for this (automation, document) pair, or null.
async function lastSuccessAt(automationId: string, documentId: string): Promise<Date | null> {
  const { data } = await db
    .from("automation_runs")
    .select("ran_at")
    .eq("automation_id", automationId)
    .eq("document_id", documentId)
    .eq("status", "success")
    .order("ran_at", { ascending: false })
    .limit(1);
  return data && data.length ? new Date(data[0].ran_at) : null;
}

// Should we skip firing on this document? Normally "once per document", but a
// document_pending automation set to repeat re-fires every `repeat_days`.
async function shouldSkip(auto: any, documentId: string): Promise<boolean> {
  const last = await lastSuccessAt(auto.id, documentId);
  if (!last) return false; // never fired → run it
  const repeating = auto.trigger_type === "document_pending" && auto.trigger_config?.repeat === "interval";
  if (!repeating) return true; // already fired once → done
  const repeatDays = parseInt(auto.trigger_config?.repeat_days ?? auto.trigger_config?.days ?? "3") || 3;
  // re-fire only once the repeat interval has elapsed
  return (Date.now() - last.getTime()) < repeatDays * 86400000;
}

async function log(automationId: string, documentId: string | null, status: string, detail: string) {
  await db.from("automation_runs").insert({ automation_id: automationId, document_id: documentId, status, detail });
}

async function touch(automationId: string) {
  await db.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", automationId);
}

// ── email via Resend (best effort) ───────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  if (!RESEND_KEY) return "skipped: no RESEND_API_KEY";
  if (!to) return "skipped: no recipient";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    return r.ok ? "sent" : `resend ${r.status}`;
  } catch (e) { return `error: ${(e as Error).message}`; }
}

// ── in-app notification (best effort; silently no-ops if table absent) ──
async function notify(userId: string, title: string, body: string) {
  try {
    await db.from("notifications").insert({ user_id: userId, title, body, type: "automation", read: false });
  } catch { /* table may not exist / differ — non-fatal */ }
}

const docLink = (doc: any) => `${APP_URL}/dashboard/drive`;

// ── run a single action against a document ───────────────────────
async function runAction(action: any, doc: any, auto: any): Promise<string> {
  const cfg = action.config || {};
  const title = doc[COL.title] || "your document";
  switch (action.type) {
    case "notify": {
      await notify(auto.owner_id, `Automation: ${auto.name}`, `Triggered on “${title}”.`);
      return "notified owner";
    }
    case "send_reminder": {
      const recipients: string[] = doc._active_recipients || [];
      const msg = cfg.message || "This is a friendly reminder that a document is waiting for your signature.";
      if (recipients.length === 0) {
        await notify(auto.owner_id, `Reminder skipped`, `No one is currently awaiting signature on “${title}”.`);
        return "reminder: no active recipient";
      }
      const results: string[] = [];
      for (const to of recipients) {
        results.push(`${to}:${await sendEmail(
          to,
          `Reminder: “${title}” is waiting for your signature`,
          `<p>${msg}</p><p><a href="${docLink(doc)}">Open the document</a></p><p style="color:#888;font-size:12px">Sent automatically by NkoAha.</p>`
        )}`);
      }
      await notify(auto.owner_id, `Reminder sent`, `Reminder for “${title}” → ${recipients.join(", ")}.`);
      return `reminder → ${results.join("; ")}`;
    }
    case "email_copy": {
      const to = cfg.to || "";
      const res = await sendEmail(
        to,
        `Document: ${title}`,
        `<p>A copy of “${title}” from NkoAha.</p>` +
        (doc[COL.file_url] ? `<p><a href="${doc[COL.file_url]}">Download the document</a></p>` : `<p><a href="${docLink(doc)}">Open in NkoAha</a></p>`)
      );
      return `email_copy → ${to || "no address"}: ${res}`;
    }
    case "certify_file": {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/certify-pdf`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: doc[COL.id], folder: cfg.folder || "Certified" }),
        });
        return r.ok ? `certified (folder: ${cfg.folder || "Certified"})` : `certify-pdf ${r.status}`;
      } catch (e) { return `certify error: ${(e as Error).message}`; }
    }
    case "route_workflow": {
      const wfId = cfg.workflow_id;
      if (!wfId) return "route_workflow: no workflow selected";
      const { data: wf } = await db.from("workflows").select("name,steps").eq("id", wfId).maybeSingle();
      if (!wf) return "route_workflow: workflow not found";
      // Record the routing so the signing flow can advance through it.
      try {
        await db.from("workflow_instances").insert({
          workflow_id: wfId, document_id: doc[COL.id], owner_id: auto.owner_id,
          steps: wf.steps, current_step: 0, status: "active",
        });
      } catch { /* table optional */ }
      await notify(auto.owner_id, `Workflow started`, `“${wf.name}” routed on “${title}”.`);
      return `routed through “${wf.name}” (${(wf.steps || []).length} steps)`;
    }
    default:
      return `unknown action: ${action.type}`;
  }
}

// ── fetch candidate documents for a trigger ──────────────────────
async function candidates(auto: any): Promise<any[]> {
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const scope = (q: any) => auto.organization_id
    ? q.or(`${COL.owner}.eq.${auto.owner_id},${COL.org}.eq.${auto.organization_id}`)
    : q.eq(COL.owner, auto.owner_id);

  try {
    switch (auto.trigger_type) {
      case "document_created":
        return (await scope(db.from("documents").select("*").gte(COL.created_at, since)).limit(200)).data || [];
      case "document_completed":
        return ((await scope(db.from("documents").select("*").gte(COL.updated_at, since)).limit(200)).data || [])
          .filter((d: any) => DONE_STATUSES.includes(lc(d[COL.status])));
      case "form_submitted":
        // instance documents produced when someone fills & submits a form
        return (await scope(db.from("documents").select("*").gte(COL.created_at, since).eq("document_kind", "editor")).limit(200)).data || [];
      case "document_pending": {
        const days = parseInt(auto.trigger_config?.days ?? "3") || 3;
        const cutoff = new Date(Date.now() - days * 86400000).toISOString();
        // Awaiting signature (status pending/sent) and created before the cutoff.
        return ((await scope(db.from("documents").select("*").lt(COL.created_at, cutoff)).limit(300)).data || [])
          .filter((d: any) => PENDING_STATUSES.includes(lc(d[COL.status])) && !DONE_STATUSES.includes(lc(d[COL.status])));
      }
      default:
        return [];
    }
  } catch { return []; }
}

// ── scheduled trigger: is this automation due to fire now? ───────
function scheduleDue(auto: any): boolean {
  const freq = auto.trigger_config?.freq || "daily";
  const last = auto.last_run_at ? new Date(auto.last_run_at).getTime() : 0;
  const ago = Date.now() - last;
  if (freq === "daily")   return ago >= 86400000 - 60000;
  if (freq === "weekly")  return ago >= 7 * 86400000 - 60000;
  if (freq === "monthly") return ago >= 30 * 86400000 - 60000;
  return false;
}

// ── main ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // guard
  const got = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret") || "";
  if (CRON_SECRET && got !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const summary = { automations: 0, actionsRun: 0, errors: 0 };
  const { data: autos } = await db.from("automations").select("*").eq("enabled", true);

  for (const auto of autos || []) {
    summary.automations++;
    try {
      // ── time-based automations ──
      if (auto.trigger_type === "schedule") {
        if (!scheduleDue(auto)) continue;
        const pseudoDoc: any = { [COL.id]: null, [COL.title]: auto.name, [COL.owner]: auto.owner_id };
        for (const action of auto.actions || []) {
          const detail = await runAction(action, pseudoDoc, auto);
          await log(auto.id, null, "success", `[schedule] ${detail}`);
          summary.actionsRun++;
        }
        await touch(auto.id);
        continue;
      }

      // ── event / pending automations ──
      const docs = await candidates(auto);
      for (const doc of docs) {
        if (await shouldSkip(auto, doc[COL.id])) continue; // dedup / repeat-interval (cheap) first
        await enrichDoc(doc);                                  // resolve emails/recipients
        if (!matchesConditions(doc, auto.conditions || [])) continue;
        const details: string[] = [];
        for (const action of auto.actions || []) {
          details.push(await runAction(action, doc, auto));
          summary.actionsRun++;
        }
        await log(auto.id, doc[COL.id], "success", details.join(" · "));
      }
      await touch(auto.id);
    } catch (e) {
      summary.errors++;
      await log(auto.id, null, "error", (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary, at: new Date().toISOString() }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});