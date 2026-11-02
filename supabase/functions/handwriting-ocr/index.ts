// @ts-nocheck
// Supabase Edge Function: handwriting-ocr
// ─────────────────────────────────────────────────────────────
// Transcribes photographed/scanned HANDWRITTEN pages into clean editable HTML
// using a vision-capable AI model. Reuses the admin AI-provider setting
// (app_settings.active_ai_provider / active_ai_model); if that provider can't
// see images (e.g. DeepSeek), it falls back to the first configured
// vision provider (Anthropic → OpenAI → Gemini).
//
// Vision providers (admin-switchable, no redeploy):
//   anthropic → Claude  (ANTHROPIC_API_KEY)   models: claude-sonnet-5-5 …
//   openai    → GPT      (OPENAI_API_KEY)      models: gpt-4o, gpt-4o-mini
//   gemini    → Gemini   (GEMINI_API_KEY)      models: gemini-1.5-flash/pro
//
// Security: caller identified from JWT; blocked-IP check; paid-feature gate
// (free users get N/day, shared setting ai_free_daily_limit, counted separately
// under event_type 'handwriting_ocr'). Keys live only in Supabase secrets.
//
// Request body: { images: [{ mime: string, data: base64 }], hint?: string }
//   (also accepts a single { image, mime } for convenience)
// Response:     { html, provider, model, freeRemaining }
//
// Deploy: supabase functions deploy handwriting-ocr
//   with  [functions.handwriting-ocr]  verify_jwt = false  in config.toml

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

const SYSTEM_PROMPT = `You are a precise transcription assistant for NkoAha, a document platform used mainly by Nigerian and other African SMEs.

You are given one or more images of HANDWRITTEN (or mixed handwritten/printed) pages. Transcribe them faithfully into clean, editable HTML.

Rules:
- Output ONLY the transcribed content as clean, semantic HTML. No commentary, no explanations, no markdown, no code fences.
- Use only these tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <br>. Never use <table>.
- Preserve the document's structure: headings, paragraphs, bullet/numbered lists, and line breaks as written.
- Transcribe the actual words — do NOT summarise, rewrite, correct grammar, or add anything that isn't on the page. Keep the author's wording and spelling.
- If several images are given, treat them as consecutive pages of ONE document, in order.
- If a word or section is genuinely illegible, insert [illegible] rather than guessing.
- Keep Nigerian conventions as written (e.g. the ₦ symbol, local names and dates).
- Do not include any note about being an AI. Just produce the transcription.`;

// ── Vision provider registry ────────────────────────────────────────────────
type Img = { mime: string; data: string };
const VISION: Record<string, {
  keyEnv: string; defaultModel: string;
  call: (key: string, model: string, system: string, instruction: string, images: Img[]) => Promise<string>;
}> = {
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5",
    async call(key, model, system, instruction, images) {
      const content = [
        ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.data } })),
        { type: "text", text: instruction },
      ];
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: "user", content }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
    },
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    async call(key, model, system, instruction, images) {
      const content = [
        { type: "text", text: instruction },
        ...images.map(im => ({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.data}` } })),
      ];
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content }] }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const d = await r.json();
      return (d?.choices?.[0]?.message?.content || "").trim();
    },
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-1.5-flash",
    async call(key, model, system, instruction, images) {
      const parts = [
        ...images.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } })),
        { text: instruction },
      ];
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: { maxOutputTokens: 4000 } }) },
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
    // Normalise images: accept {images:[{mime,data}]} or a single {image,mime}.
    let images: Img[] = Array.isArray(body.images) ? body.images : [];
    if (!images.length && body.image) images = [{ mime: body.mime || "image/jpeg", data: body.image }];
    images = images
      .filter((im: any) => im && typeof im.data === "string" && im.data.length > 50)
      .map((im: any) => ({ mime: (im.mime || "image/jpeg"), data: im.data }))
      .slice(0, 10); // cap pages per request
    if (!images.length) return json({ error: "No image provided. Upload a photo or scan of the handwritten page(s)." }, 400);

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
        .eq("user_id", user.id).eq("event_type", "handwriting_ocr")
        .gte("created_at", dayStart.toISOString());
      const used = count || 0;
      if (used >= freeLimit) {
        return json({ error: `You've used your ${freeLimit} free handwriting conversions for today. Upgrade in Billing for unlimited use, or try again tomorrow.`, limitReached: true }, 402);
      }
      freeRemaining = Math.max(0, freeLimit - used - 1);
    }

    // ── Pick a vision-capable provider: active one if able, else fall back ──
    const activeId = (map["active_ai_provider"] || "anthropic").toLowerCase();
    const order = [activeId, "anthropic", "openai", "gemini"].filter((v, i, a) => a.indexOf(v) === i);
    let chosen: { id: string; p: typeof VISION[string]; key: string; model: string } | null = null;
    for (const id of order) {
      const p = VISION[id]; if (!p) continue;
      const key = Deno.env.get(p.keyEnv); if (!key) continue;
      const model = (id === activeId && (map["active_ai_model"] || "").trim()) ? map["active_ai_model"].trim() : p.defaultModel;
      chosen = { id, p, key, model }; break;
    }
    if (!chosen) return json({ error: "No vision-capable AI provider is configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in Supabase secrets." }, 500);

    const instruction = (typeof body.hint === "string" && body.hint.trim())
      ? `Transcribe the handwritten page(s). Context hint from the user: ${body.hint.trim().slice(0, 500)}`
      : `Transcribe the handwritten page(s) into clean HTML as instructed.`;

    // ── Transcribe ──
    let text = "";
    try {
      text = await chosen.p.call(chosen.key, chosen.model, SYSTEM_PROMPT, instruction, images);
    } catch (e) {
      return json({ error: `Handwriting transcription failed (${chosen.id}).`, detail: String((e as Error)?.message || e).slice(0, 800) }, 502);
    }
    if (!text) return json({ error: "Could not read any text from the image. Try a clearer, well-lit photo." }, 502);
    const html = stripFences(text);

    // ── Security event (uses a paid resource) ──
    try {
      const { data: prof } = await admin.from("profiles").select("email").eq("id", user.id).maybeSingle();
      await admin.from("security_events").insert({
        user_id: user.id, email: prof?.email || user.email || null,
        event_type: "handwriting_ocr", ip_address: callerIp || "unknown",
        user_agent: req.headers.get("user-agent") || null,
        metadata: { provider: chosen.id, model: chosen.model, pages: images.length },
      });
    } catch (_e) { /* logging must never fail the result */ }

    return json({ html, provider: chosen.id, model: chosen.model, freeRemaining });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function safeText(r: Response) { try { return await r.text(); } catch { return "(no body)"; } }