// Vercel Edge Middleware — blocks requests from IP addresses on the admin
// blocklist before the app is served.
//
// Place this file at the PROJECT ROOT (next to package.json), not in src/.
// It runs on Vercel's edge for every matched request. It asks Supabase
// "is this IP blocked?" via the is_ip_blocked() function (which only returns
// true/false, never the list), caches the answer briefly, and returns a 403
// page for blocked IPs. Everyone else passes straight through.
//
// Env vars (already set for your Vite build; middleware reads them at runtime):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//
// Fails OPEN: if the check can't run (Supabase hiccup), the request is allowed,
// so a backend blip never takes the whole site down.

export const config = {
  // Run on page requests; skip static assets and the favicon for speed.
  matcher: ["/((?!assets/|favicon|robots.txt|sitemap.xml|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|map)$).*)"],
};

const SUPABASE_URL  = (globalThis as any).process?.env?.VITE_SUPABASE_URL  || "";
const SUPABASE_ANON = (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY || "";

// Tiny per-instance cache so we don't call Supabase on every single request.
const CACHE = new Map<string, { blocked: boolean; exp: number }>();
const TTL_MS = 60_000; // 60s

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "";
}

async function isBlocked(ip: string): Promise<boolean> {
  if (!ip || !SUPABASE_URL || !SUPABASE_ANON) return false;
  const hit = CACHE.get(ip);
  const now = Date.now();
  if (hit && hit.exp > now) return hit.blocked;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_ip_blocked`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ip: ip }),
    });
    if (!r.ok) return false; // fail open
    const blocked = (await r.json()) === true;
    CACHE.set(ip, { blocked, exp: now + TTL_MS });
    return blocked;
  } catch {
    return false; // fail open
  }
}

export default async function middleware(req: Request): Promise<Response | undefined> {
  const ip = clientIp(req);
  if (await isBlocked(ip)) {
    return new Response(BLOCK_PAGE, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return undefined; // continue to the app
}

const BLOCK_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access blocked</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f3ef;color:#1c1917}
  .card{max-width:420px;text-align:center;background:#fff;border:1px solid #e7e4df;border-radius:16px;
    padding:36px 30px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
  .mark{width:52px;height:52px;border-radius:14px;background:#fee2e2;display:flex;align-items:center;
    justify-content:center;margin:0 auto 16px}
  h1{font-size:19px;margin:0 0 8px}
  p{font-size:13.5px;color:#78716c;line-height:1.6;margin:0}
</style></head>
<body><div class="card">
  <div class="mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg></div>
  <h1>Access blocked</h1>
  <p>Your network has been blocked from accessing NkoAha. If you believe this is a mistake, contact support@nkoaha.space.</p>
</div></body></html>`;