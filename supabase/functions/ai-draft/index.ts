// @ts-nocheck
// Supabase Edge Function: ai-draft
// ─────────────────────────────────────────────────────────────
// Drafts a document from a plain-language brief using whichever AI provider is
// selected in the Admin → Settings page (app_settings.active_ai_provider /
// active_ai_model). Returns clean HTML that drops straight into the editor.
//
// Supported providers (admin-switchable, no redeploy):
//   anthropic  → Claude        (secret ANTHROPIC_API_KEY)
//   openai     → GPT           (secret OPENAI_API_KEY)
//   gemini     → Google Gemini (secret GEMINI_API_KEY)
//   deepseek   → DeepSeek      (secret DEEPSEEK_API_KEY)
// Only the key for the provider you actually use needs to be set.
//
// Security:
//   • Caller identified from JWT (never a body user id).
//   • Paid-feature gate enforced server-side (free users can't burn API cost).
//   • Keys live only in Supabase secrets.
//
// Request body: { prompt: string, docType?: string, title?: string }
// Response:     { html: string, provider: string, model: string }
//
// Deploy: supabase functions deploy ai-draft
//   with  [functions.ai-draft]  verify_jwt = false  in supabase/config.toml

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

const SYSTEM_PROMPT = `You are a professional document drafting assistant for NkoAha, a document platform used mainly by Nigerian and other African SMEs.

Draft a complete, ready-to-use document from the user's brief.

Rules:
- Output ONLY the document body as clean, semantic HTML. No commentary, no explanations, no markdown, and no code fences.
- Use only these tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <br>.
- Do NOT use tables. The editor renders headings, paragraphs, lists and bold/italic/underline faithfully, but has no table grid. When you have tabular or itemised information (e.g. invoice lines, parties, schedules), present it as a list or as labelled lines like "<p><strong>Item:</strong> value</p>" or "<li><strong>Rent:</strong> ₦600,000 per annum</li>" — never a <table>.
- Start with a single <h1> for the document title.
- Use clear structure: headings, short paragraphs, and lists where they help.
- Where the brief leaves a detail unspecified that a real document needs (names, dates, amounts, addresses), insert a clearly marked placeholder in square brackets, e.g. [TENANT NAME], [DATE], [AMOUNT], so the user can fill it in.
- Use Nigerian conventions where relevant: the Naira symbol ₦ for money, Nigerian date format, and locally appropriate legal/business phrasing — unless the brief says otherwise.
- Keep legal/contractual language precise but plain. Do not invent statutes or cite laws you are unsure of; if a legal reference is needed, use a neutral placeholder like [applicable law].
- Never include a disclaimer about being an AI. Just produce the document.`;

// ── Provider registry ──────────────────────────────────────────────────────
// Each provider: which secret holds its key, a default model, and a call()
// that returns the generated plain text.
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
        body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: "user", content: user }] }),
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
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.choices?.[0]?.message?.content || "").trim();
    },
  },
  deepseek: {
    // DeepSeek is OpenAI-compatible.
    keyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    async call(key, model, system, user) {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens: 4000 },
          }),
        },
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
    const { prompt, docType, title } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return json({ error: "Please describe the document you want." }, 400);
    }
    if (prompt.length > 6000) return json({ error: "Brief is too long. Keep it under 6000 characters." }, 400);

    // ── Identify the caller ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization bearer token." }, 401);
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await authed.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Paid-feature gate ──
    const { data: sub } = await admin.from("subscriptions")
      .select("status, expires_at").eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const active = !!sub && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    if (!active) return json({ error: "AI drafting is available on paid plans. Upgrade in Billing to use it." }, 402);

    // ── Which provider/model is live (admin-selected) ──
    const { data: settings } = await admin.from("app_settings")
      .select("key, value").in("key", ["active_ai_provider", "active_ai_model"]);
    const map: Record<string, string> = {};
    for (const s of (settings || [])) map[s.key] = s.value;
    const providerId = (map["active_ai_provider"] || "anthropic").toLowerCase();
    const provider = PROVIDERS[providerId];
    if (!provider) return json({ error: `Unknown AI provider "${providerId}". Set a valid one in Admin → Settings.` }, 500);

    const model = (map["active_ai_model"] || "").trim() || provider.defaultModel;
    const key = Deno.env.get(provider.keyEnv) || "";
    if (!key) {
      return json({ error: `The ${providerId} API key isn't configured. Set the ${provider.keyEnv} secret, or switch provider in Admin → Settings.` }, 500);
    }

    // ── Build the user message ──
    const userMsg =
      (docType ? `Document type: ${docType}\n` : "") +
      (title ? `Suggested title: ${title}\n` : "") +
      `Brief:\n${prompt.trim()}`;

    // ── Generate ──
    let text = "";
    try {
      text = await provider.call(key, model, SYSTEM_PROMPT, userMsg);
    } catch (e) {
      return json({ error: `AI drafting failed (${providerId}).`, detail: String((e as Error)?.message || e).slice(0, 800) }, 502);
    }
    if (!text) return json({ error: "AI returned an empty draft. Try rephrasing your brief." }, 502);
    const html = stripFences(text);

    // ── Security event (drafting uses a paid resource) ──
    try {
      const { data: prof } = await admin.from("profiles").select("email").eq("id", user.id).maybeSingle();
      const xff = req.headers.get("x-forwarded-for");
      const ip  = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || "unknown");
      await admin.from("security_events").insert({
        user_id: user.id, email: prof?.email || user.email || null,
        event_type: "ai_draft", ip_address: ip,
        user_agent: req.headers.get("user-agent") || null,
        metadata: { provider: providerId, model, docType: docType || null, chars: prompt.length },
      });
    } catch (_e) { /* logging must never fail the draft */ }

    return json({ html, provider: providerId, model });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function safeText(r: Response) { try { return await r.text(); } catch { return "(no body)"; } }