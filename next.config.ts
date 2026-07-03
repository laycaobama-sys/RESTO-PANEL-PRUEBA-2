import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // Allow images from any remote source (restaurant logos, menu item
    // images imported from their websites, customer photos, etc.)
    // Next.js Image optimizer will proxy and optimize them.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Modern formats
    formats: ["image/avif", "image/webp"],
    // Allow placeholder data URLs for avatars
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
