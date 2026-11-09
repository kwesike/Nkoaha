// @ts-nocheck
// Supabase Edge Function: summarize-document
// ─────────────────────────────────────────────────────────────
// Produces a concise, faithful summary of a document's text using the
// admin-selected AI provider (app_settings.active_ai_provider /
// active_ai_model) — same switcher as ai-draft. Returns clean HTML.
//
// Providers (admin-switchable, no redeploy):
//   anthropic → Claude   (ANTHROPIC_API_KEY)
//   openai    → GPT       (OPENAI_API_KEY)
//   deepseek  → DeepSeek  (DEEPSEEK_API_KEY)
//   gemini    → Gemini    (GEMINI_API_KEY)
//
// Security: caller identified from JWT; blocked-IP check; paid-feature gate
// (free users get N/day, shared setting ai_free_daily_limit, counted separately
// under event_type 'document_summary'). Keys live only in Supabase secrets.
//
// Request body: { text: string, title?: string }
// Response:     { summary (HTML), provider, model, freeRemaining }
//
// Deploy: supabase functions deploy summarize-document
//   with  [functions.summarize-document]  verify_jwt = false  in config.toml

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

const MAX_CHARS = 24000; // keep well within model context; truncate very long docs

const SYSTEM_PROMPT = `You are a precise summarisation assistant for NkoAha, a document and e-signature platform used mainly by Nigerian and other African SMEs.

You are given the text of ONE document. Produce a faithful, useful summary of it.

Rules:
- Output ONLY clean, semantic HTML. No commentary before or after, no markdown, no code fences.
- Use only these tags: <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>. Never use <table> or headings larger than <h3>.
- Structure the summary exactly as:
  1. <p><strong>Summary:</strong> one or two sentences capturing what the document is and its purpose.</p>
  2. <h3>Key points</h3> then a <ul> of the most important points (aim for 3–8 concise bullets).
  3. If and only if the document contains them, add <h3>Parties &amp; dates</h3> with a short <ul> of named parties, amounts, and key dates/deadlines (keep ₦ and local names/dates as written).
  4. If and only if the document asks the reader to do something, add <h3>Action items</h3> with a short <ul>.
- Summarise only what is actually in the text. Do NOT invent facts, parties, figures, or obligations. If something is unclear or missing, leave it out rather than guessing.
- Be concise and neutral. Do not give legal or financial advice or opinions.
- Do not mention being an AI. Just produce the summary.`;

const PROVIDERS: Record<string, {
  keyEnv: string; defaultModel: string;
  call: (key: string, model: string, system: string, user: string) => Promise<string>;
}> = {
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5",
    async call(key, model, system, user) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
    },
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    async call(key, model, system, user) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.choices?.[0]?.message?.content || "").trim();
    },
  },
  deepseek: {
    keyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    async call(key, model, system, user) {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.choices?.[0]?.message?.content || "").trim();
    },
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-1.5-flash",
    async call(key, model, system, user) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 2000 } }) },
      );
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return ((d?.candidates?.[0]?.content?.parts) || []).map((p: any) => p.text || "").join("\n").trim();
    },
  },
};

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    let text = typeof body.text === "string" ? body.text : "";
    text = text.replace(/\u0000/g, "").trim();
    const title = (typeof body.title === "string" ? body.title : "").trim().slice(0, 200);
    if (text.length < 20) return json({ error: "There isn't enough readable text in this document to summarise." }, 400);
    let truncated = false;
    if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); truncated = true; }

    // ── Identify the caller ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization bearer token." }, 401);
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await authed.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Blocked IP ──
    const xff = req.headers.get("x-forwarded-for");
    const callerIp = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || "");
    if (callerIp) {
      const { data: blocked } = await admin.rpc("is_ip_blocked", { p_ip: callerIp });
      if (blocked === true) return json({ error: "Access blocked." }, 403);
    }

    // ── Settings ──
    const { data: settings } = await admin.from("app_settings")
      .select("key, value").in("key", ["active_ai_provider", "active_ai_model", "ai_free_daily_limit"]);
    const map: Record<string, string> = {};
    for (const s of (settings || [])) map[s.key] = s.value;

    // ── Paid gate: subscribers unlimited; free users N/day (shared limit) ──
    const { data: sub } = await admin.from("subscriptions")
      .select("status, expires_at").eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const active = !!sub && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    let freeLimit = parseInt(map["ai_free_daily_limit"] || "2", 10);
    if (!Number.isFinite(freeLimit) || freeLimit < 0) freeLimit = 2;
    let freeRemaining: number | null = null;
    if (!active) {
      const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
      const { count } = await admin.from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("event_type", "document_summary")
        .gte("created_at", dayStart.toISOString());
      const used = count || 0;
      if (used >= freeLimit) {
        return json({ error: `You've used your ${freeLimit} free document summaries for today. Upgrade in Billing for unlimited use, or try again tomorrow.`, limitReached: true }, 402);
      }
      freeRemaining = Math.max(0, freeLimit - used - 1);
    }

    // ── Pick the active text provider (ai-draft parity) ──
    const providerId = (map["active_ai_provider"] || "anthropic").toLowerCase();
    const provider = PROVIDERS[providerId] || PROVIDERS.anthropic;
    const model = (map["active_ai_model"] || "").trim() || provider.defaultModel;
    const key = Deno.env.get(provider.keyEnv) || "";
    if (!key) return json({ error: `The ${providerId} API key isn't configured. Set the ${provider.keyEnv} secret, or switch provider in Admin → Settings.` }, 500);

    const userMsg = `${title ? `Document title: ${title}\n\n` : ""}Summarise the following document text${truncated ? " (note: it was long and has been truncated — summarise what is present)" : ""}:\n\n"""\n${text}\n"""`;

    let out = "";
    try {
      out = await provider.call(key, model, SYSTEM_PROMPT, userMsg);
    } catch (e) {
      return json({ error: `Summary failed (${providerId}).`, detail: String((e as Error)?.message || e).slice(0, 800) }, 502);
    }
    if (!out) return json({ error: "The summariser returned nothing. Please try again." }, 502);
    let summary = stripFences(out);
    if (truncated) summary += `<p><em>Note: this document was long, so the summary is based on the first part of it.</em></p>`;

    // ── Security event (uses a paid resource) ──
    try {
      const { data: prof } = await admin.from("profiles").select("email").eq("id", user.id).maybeSingle();
      await admin.from("security_events").insert({
        user_id: user.id, email: prof?.email || user.email || null,
        event_type: "document_summary", ip_address: callerIp || "unknown",
        user_agent: req.headers.get("user-agent") || null,
        metadata: { provider: providerId, model, chars: text.length, truncated },
      });
    } catch (_e) { /* logging must never fail the result */ }

    return json({ summary, provider: providerId, model, freeRemaining });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function safeText(r: Response) { try { return await r.text(); } catch { return "(no body)"; } }