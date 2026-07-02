import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || "https://restopanel.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/landing", "/llms.txt", "/llms-full.txt"],
        disallow: ["/api/", "/"],
      },
      // Allow AI crawlers explicitly
      {
        userAgent: ["GPTBot", "ChatGPT-User", "Google-Extended", "PerplexityBot", "Claude-Web", "anthropic-ai"],
        allow: ["/landing", "/llms.txt", "/llms-full.txt"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
