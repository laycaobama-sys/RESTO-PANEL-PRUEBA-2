import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || "https://your-domain.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/landing",
        disallow: ["/api/", "/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
