// ============================================================
// RestoPanel · Rate limiting middleware helper
// ============================================================
// Simple in-memory rate limiter for API routes.
// For production with multiple instances, use Redis instead.
//
// Usage:
//   import { checkRateLimit } from "@/lib/rate-limit";
//   const limited = checkRateLimit(req, { window: 60000, max: 10 });
//   if (limited) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
// ============================================================

interface RateLimitConfig {
  window: number; // ms
  max: number; // max requests per window
  keyPrefix?: string;
}

interface RateLimitEntry {
  count: number;
  firstAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.firstAt > 600000) {
      store.delete(key);
    }
  }
}, 300000).unref?.();

export function checkRateLimit(
  req: Request,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetAt: number } {
  const ip = getIp(req);
  const key = `${config.keyPrefix || "default"}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now - entry.firstAt > config.window) {
    store.set(key, { count: 1, firstAt: now });
    return { limited: false, remaining: config.max - 1, resetAt: now + config.window };
  }

  entry.count += 1;
  if (entry.count > config.max) {
    return { limited: true, remaining: 0, resetAt: entry.firstAt + config.window };
  }

  return {
    limited: false,
    remaining: config.max - entry.count,
    resetAt: entry.firstAt + config.window,
  };
}

export function getIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// ─── Pre-configured rate limits ───────────────────────────────
export const RATE_LIMITS = {
  // Auth endpoints
  auth: { window: 15 * 60 * 1000, max: 10, keyPrefix: "auth" },
  login: { window: 15 * 60 * 1000, max: 10, keyPrefix: "login" },
  register: { window: 60 * 60 * 1000, max: 3, keyPrefix: "register" },
  forgotPassword: { window: 10 * 60 * 1000, max: 3, keyPrefix: "forgot" },

  // Public endpoints
  reviews: { window: 10 * 60 * 1000, max: 3, keyPrefix: "reviews" },

  // API endpoints (per-tenant, identified by user id)
  api: { window: 60 * 1000, max: 60, keyPrefix: "api" },

  // Web import
  webImport: { window: 10 * 60 * 1000, max: 5, keyPrefix: "webimport" },
} as const;
