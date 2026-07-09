import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ─── Strict TypeScript ─────────────────────────────────────
  // Previously `ignoreBuildErrors: true` was hiding real type
  // errors. We now enforce strict TS — fix the errors at the source.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  images: {
    // Allow only specific known-good image hosts. The previous
    // `hostname: "**"` + `dangerouslyAllowSVG: true` config was an
    // open proxy / XSS surface (SVG can carry <script>).
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "cdn.restopanel.es" },
    ],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // ─── Security headers ──────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // CSP: only allow scripts from self and Next.js inline.
          // Stripe.js is loaded from js.stripe.com. Resend SDK
          // doesn't need client-side script.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.stripe.com https://*.supabase.co wss:",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // API routes get stricter headers
        source: "/api/(.*)",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  // ─── Compression ───────────────────────────────────────────
  compress: true,
  // ─── Powered-by header removal ─────────────────────────────
  poweredByHeader: false,
};

export default nextConfig;
