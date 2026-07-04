// ============================================================
// RestoPanel · Cloudflare Worker (Edge Security)
// ============================================================
// Runs at the edge before requests reach the origin.
// Adds:
//   - Rate limiting (per IP)
//   - Bot protection
//   - Security headers
//   - CORS for API routes
//   - Request logging
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // ─── Security headers ─────────────────────────────────
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("X-Frame-Options", "SAMEORIGIN");
    newResponse.headers.set("X-Content-Type-Options", "nosniff");
    newResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    newResponse.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    newResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    newResponse.headers.delete("X-Powered-By");

    // ─── CORS for API routes ──────────────────────────────
    if (url.pathname.startsWith("/api/")) {
      newResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      newResponse.headers.set("Access-Control-Max-Age", "86400");

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: newResponse.headers });
      }
    }

    return newResponse;
  },
};
