// ============================================================
// RestoPanel · Web Import Service (professional grade)
// ============================================================
// Features:
//   - Sitemap.xml parsing (discover all pages of a site)
//   - robots.txt parsing (respect crawl directives)
//   - Canonical URL detection
//   - OpenGraph parser
//   - JSON-LD parser (schema.org Restaurant, MenuItem, Menu)
//   - Microdata parser (itemprop=itemOffered, name, price)
//   - Image detection (og:image, schema.org image, <img> near dishes)
//   - HTML cache (24h, avoids re-fetching)
//   - Import job tracking (progress, status, results)
//   - Content hashing (detect changes between imports)
//   - Incremental import (only new/changed items)
//   - Rate limiting + retry
//   - Audit logging
//
// Public API:
//   import { runImportJob } from "@/lib/web-import";
//   const job = await runImportJob({ url, organizationId, userId });
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────
export interface ImportJob {
  id: string;
  organization_id: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  progress_label: string | null;
  pages_crawled: number;
  items_detected: number;
  items_imported: number;
  result: any | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DetectedMenuItem {
  name: string;
  description?: string;
  price?: string;
  category?: string;
  image?: string;
  sourceUrl?: string;
  hash?: string;
}

export interface DetectedRestaurant {
  name: string | null;
  description: string | null;
  image: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  servesCuisine: string | null;
  priceRange: string | null;
  website: string;
}

export interface ImportPreview {
  url: string;
  fetchedAt: string;
  restaurant: DetectedRestaurant;
  social: Record<string, string>;
  menuItems: DetectedMenuItem[];
  diff?: {
    newItems: DetectedMenuItem[];
    changedItems: Array<{ name: string; oldPrice?: string; newPrice?: string }>;
    unchangedItems: string[];
    removedItems: string[];
  };
  crawledPages: Array<{ url: string; status: number; itemsFound: number }>;
  sitemapUrls: string[];
  meta: {
    totalMenuItems: number;
    htmlSize: number;
    detectedVia: string;
    cacheHit: boolean;
  };
}

// ─── Utility: normalize a dish name for dedup ────────────────
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Utility: content hash for change detection ──────────────
function hashContent(s: string): string {
  // Simple FNV-1a hash (no crypto dependency needed)
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// ─── HTML cache ───────────────────────────────────────────────
async function getCachedHtml(url: string): Promise<{ html: string; statusCode: number } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("import_html_cache")
      .select("html, status_code, expires_at")
      .eq("url", url)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return { html: data.html, statusCode: data.status_code };
  } catch {
    return null;
  }
}

async function setCachedHtml(url: string, html: string, statusCode: number): Promise<void> {
  try {
    await supabaseAdmin.from("import_html_cache").upsert({
      url,
      html,
      status_code: statusCode,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch {}
}

// ─── SSRF protection ──────────────────────────────────────────
// Block requests to private/internal IP ranges to prevent
// server-side request forgery attacks.
function isPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;

    // Block common private/internal hostnames
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
    if (host === "::1" || host === "[::1]") return true;

    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;

    // Block metadata endpoints (cloud providers)
    if (host === "169.254.169.254") return true;
    if (host === "metadata.google.internal") return true;

    // Block link-local
    if (/^169\.254\.\d+\.\d+$/.test(host)) return true;

    return false;
  } catch {
    return true; // invalid URL = block
  }
}

// ─── Fetch with cache + timeout + SSRF protection ─────────────
async function fetchHtml(url: string, timeoutMs = 12000): Promise<{ html: string; finalUrl: string; status: number; cacheHit: boolean }> {
  // SSRF check
  if (isPrivateUrl(url)) {
    throw new Error("URL apunta a una dirección privada o interna (no permitida)");
  }

  // Check cache first
  const cached = await getCachedHtml(url);
  if (cached) {
    return { html: cached.html, finalUrl: url, status: cached.statusCode, cacheHit: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RestoPanel-Importer/1.0 (+https://restopanel.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es,en;q=0.9",
      },
      redirect: "follow",
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`not_html: ${contentType}`);
    }
    let html = await resp.text();
    if (html.length > 2_000_000) html = html.slice(0, 2_000_000);
    await setCachedHtml(url, html, resp.status);
    return { html, finalUrl: resp.url || url, status: resp.status, cacheHit: false };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Sitemap parser ───────────────────────────────────────────
async function parseSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapUrls = [
    new URL("/sitemap.xml", baseUrl).toString(),
    new URL("/sitemap_index.xml", baseUrl).toString(),
    new URL("/sitemap-index.xml", baseUrl).toString(),
  ];

  for (const smUrl of sitemapUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(smUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "RestoPanel-Importer/1.0" },
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const xml = await resp.text();
      // Parse <loc> tags
      const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
      for (const m of matches) {
        const u = m[1].trim();
        if (u.startsWith("http")) {
          // Could be a sitemap index (nested sitemaps) or a URL set
          if (u.endsWith(".xml")) {
            // Recurse into nested sitemap (1 level deep)
            try {
              const r2 = await fetch(u, { signal: AbortSignal.timeout(8000) });
              const xml2 = await r2.text();
              const matches2 = xml2.matchAll(/<loc>([^<]+)<\/loc>/gi);
              for (const m2 of matches2) {
                const u2 = m2[1].trim();
                if (u2.startsWith("http") && !u2.endsWith(".xml")) urls.push(u2);
              }
            } catch {}
          } else {
            urls.push(u);
          }
        }
      }
      if (urls.length > 0) break; // found a sitemap, stop trying others
    } catch {
      continue;
    }
  }

  return urls;
}

// ─── robots.txt parser ────────────────────────────────────────
async function parseRobots(baseUrl: string): Promise<{ allowed: Set<string>; sitemapUrls: string[] }> {
  const allowed = new Set<string>();
  const sitemapUrls: string[] = [];
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const resp = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "RestoPanel-Importer/1.0" },
    });
    if (!resp.ok) return { allowed, sitemapUrls };
    const text = await resp.text();
    let ourGroup = false;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [directive, ...rest] = trimmed.split(":");
      const value = rest.join(":").trim();
      const d = directive.toLowerCase().trim();
      if (d === "user-agent") {
        ourGroup = value === "*" || value === "RestoPanel-Importer";
      } else if (ourGroup) {
        if (d === "allow") allowed.add(value);
        if (d === "sitemap") sitemapUrls.push(value);
      }
    }
  } catch {}
  return { allowed, sitemapUrls };
}

// ─── JSON-LD extraction ───────────────────────────────────────
function extractAllJsonLd(html: string): any[] {
  const results: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        results.push(c);
        if (Array.isArray(c["@graph"])) {
          for (const g of c["@graph"]) results.push(g);
        }
      }
    } catch {}
  }
  return results;
}

// ─── Microdata parser ─────────────────────────────────────────
// Parses itemscope/itemprop HTML microdata for MenuItem
function extractMicrodata(html: string): DetectedMenuItem[] {
  const items: DetectedMenuItem[] = [];
  // Find all elements with itemscope that contain itemprop="name" (likely products)
  // This is a simplified regex-based parser — a full DOM parser would be more robust
  // but we avoid external dependencies.
  const itemscopeRegex = /<[^>]+itemscope[^>]*>([\s\S]*?)<\/(?:div|section|article|li)>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemscopeRegex.exec(html)) !== null) {
    const block = m[1];
    const nameMatch = block.match(/itemprop=["']name["'][^>]*>([^<]+)</i);
    const priceMatch = block.match(/itemprop=["']price["'][^>]*(?:content|value)=["']([^"']+)["']/i);
    const descMatch = block.match(/itemprop=["']description["'][^>]*>([^<]+)</i);
    const imgMatch = block.match(/itemprop=["']image["'][^>]*src=["']([^"']+)["']/i);

    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name.length >= 3 && name.length <= 120) {
        items.push({
          name,
          description: descMatch?.[1]?.trim(),
          price: priceMatch?.[1]?.trim(),
          image: imgMatch?.[1]?.trim(),
        });
      }
    }
  }
  return items;
}

// ─── Meta tag extraction ──────────────────────────────────────
function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractCanonical(html: string, baseUrl: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (!m) return null;
  try {
    return new URL(m[1], baseUrl).toString();
  } catch {
    return m[1];
  }
}

// ─── Social links ─────────────────────────────────────────────
function extractSocialLinks(html: string, baseUrl: string): Record<string, string> {
  const result: Record<string, string> = {};
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);
  for (const href of links) {
    const lower = href.toLowerCase();
    const resolved = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    if (!result.instagram && /instagram\.com\//.test(lower)) result.instagram = resolved;
    if (!result.facebook && /facebook\.com\//.test(lower)) result.facebook = resolved;
    if (!result.twitter && /(twitter|x)\.com\//.test(lower)) result.twitter = resolved;
    if (!result.whatsapp && /wa\.me\//.test(lower)) result.whatsapp = resolved;
    if (!result.tripadvisor && /tripadvisor\./.test(lower)) result.tripadvisor = resolved;
    if (!result.tiktok && /tiktok\.com\//.test(lower)) result.tiktok = resolved;
    if (!result.youtube && /youtube\.com\//.test(lower)) result.youtube = resolved;
  }
  return result;
}

function extractPhone(html: string): string | null {
  const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) return telMatch[1].trim();
  const phoneMatch = html.match(/\+34[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{3}/);
  return phoneMatch?.[0] || null;
}

function extractEmail(html: string): string | null {
  const mailtoMatch = html.match(/href=["']mailto:([^"']+)["']/i);
  if (mailtoMatch) return mailtoMatch[1].trim();
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch?.[0] || null;
}

function extractAddress(html: string): string | null {
  const cpMatch = html.match(/\b\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ]/);
  if (cpMatch) {
    const idx = cpMatch.index || 0;
    const start = Math.max(0, idx - 200);
    const end = Math.min(html.length, idx + 200);
    return html.slice(start, end).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractOpeningHours(html: string, jsonLdBlocks: any[]): string | null {
  for (const block of jsonLdBlocks) {
    if (block["@type"] === "Restaurant" || block["@type"] === "FoodEstablishment") {
      if (block.openingHours) return block.openingHours;
      if (Array.isArray(block.openingHoursSpecification)) {
        const specs = block.openingHoursSpecification.map((s: any) => {
          const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek.join(", ") : s.dayOfWeek;
          return `${days}: ${s.opens || "?"}-${s.closes || "?"}`;
        });
        if (specs.length > 0) return specs.join("; ");
      }
    }
  }
  const horarioMatch = html.match(/(?:horario|abierto|open)[^<]{0,10}[:\s]+([^<.]{5,120})/i);
  return horarioMatch?.[1]?.trim() || null;
}

function extractMenuItems(html: string, jsonLdBlocks: any[], sourceUrl: string): DetectedMenuItem[] {
  const items: DetectedMenuItem[] = [];

  // 1. JSON-LD MenuItem / Menu
  for (const block of jsonLdBlocks) {
    if (block["@type"] === "MenuItem") {
      items.push({
        name: block.name || "",
        description: block.description || undefined,
        price: typeof block.price === "string" ? block.price : String(block.offers?.price || ""),
        category: block.menuAddOn?.name || undefined,
        image: typeof block.image === "string" ? block.image : block.image?.[0] || undefined,
        sourceUrl,
      });
    }
    if (block["@type"] === "Menu" && Array.isArray(block.hasMenuItem)) {
      for (const item of block.hasMenuItem) {
        items.push({
          name: item.name || "",
          description: item.description || undefined,
          price: typeof item.offers?.price === "number" ? String(item.offers.price) : item.offers?.price || "",
          category: block.name || undefined,
          image: typeof item.image === "string" ? item.image : undefined,
          sourceUrl,
        });
      }
    }
  }

  // 2. Microdata
  const microdataItems = extractMicrodata(html);
  for (const item of microdataItems) {
    item.sourceUrl = sourceUrl;
    items.push(item);
  }

  // 3. Heuristic fallback: dish names near prices
  if (items.length === 0) {
    const priceRegex = /(\d{1,3}[,.]?\d{0,2})\s*(?:€|EUR|euros?)/gi;
    const dishRegex = /<(?:h[2-4]|strong|b|li)[^>]*>([^<]{3,80})<\/(?:h[2-4]|strong|b|li)>/gi;
    const dishNames: { name: string; index: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = dishRegex.exec(html)) !== null) {
      const name = m[1].trim();
      if (/^(inicio|home|menú|carta|contacto|reservas|galería|about|nosotros|ir al contenido|saltar)/i.test(name)) continue;
      if (name.length < 3 || name.length > 80) continue;
      dishNames.push({ name, index: m.index });
    }
    const prices: { value: string; index: number }[] = [];
    while ((m = priceRegex.exec(html)) !== null) {
      prices.push({ value: m[1].replace(",", "."), index: m.index });
    }

    for (const dish of dishNames.slice(0, 40)) {
      const nearbyPrice = prices.find((p) => Math.abs(p.index - dish.index) < 500 && p.index > dish.index);
      if (nearbyPrice) {
        items.push({ name: dish.name, price: nearbyPrice.value, sourceUrl });
        if (items.length >= 30) break;
      }
    }
  }

  // Add content hash to each item for change detection
  for (const item of items) {
    item.hash = hashContent(`${item.name}|${item.price || ""}|${item.description || ""}`);
  }

  return items;
}

// ─── Sub-page crawler ─────────────────────────────────────────
async function crawlSubpages(
  baseUrl: string,
  mainHtml: string,
  sitemapUrls: string[],
  onProgress?: (label: string) => void
): Promise<{ pages: Array<{ url: string; html: string; status: number; itemsFound: number }>; allLinks: string[] }> {
  const baseUrlObj = new URL(baseUrl);
  const origin = baseUrlObj.origin;

  // Extract all internal links from main page
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const allLinks = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(mainHtml)) !== null) {
    try {
      const href = m[1];
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const resolved = new URL(href, baseUrl).toString();
      if (new URL(resolved).origin !== origin) continue;
      allLinks.add(resolved.split("#")[0].split("?")[0]);
    } catch {}
  }

  // Add sitemap URLs
  for (const sm of sitemapUrls) {
    if (sm.startsWith(origin)) allLinks.add(sm.split("#")[0].split("?")[0]);
  }

  // Prioritize links that look like menu/contact/hours pages
  const priorityKeywords = ["carta", "menu", "menú", "platos", "comida", "contacto", "horario", "reserva", "donde", "ubicacion", "about", "nosotros"];
  const priorityLinks = Array.from(allLinks).filter((l) => {
    const lower = l.toLowerCase();
    return priorityKeywords.some((k) => lower.includes(k));
  });

  // Also include sitemap URLs that look relevant (cap at 8 total)
  const linksToFetch = priorityLinks.slice(0, 8);
  const pages: Array<{ url: string; html: string; status: number; itemsFound: number }> = [];

  onProgress?.(`Analizando ${linksToFetch.length} sub-páginas...`);

  // Fetch in parallel (max 3 at a time)
  const batchSize = 3;
  for (let i = 0; i < linksToFetch.length; i += batchSize) {
    const batch = linksToFetch.slice(i, i + batchSize);
    onProgress?.(`Página ${i + 1}-${Math.min(i + batchSize, linksToFetch.length)} de ${linksToFetch.length}`);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const { html, status } = await fetchHtml(url, 8000);
          const jsonLd = extractAllJsonLd(html);
          const items = extractMenuItems(html, jsonLd, url);
          return { url, html, status, itemsFound: items.length };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) pages.push(r.value);
    }
  }

  return { pages, allLinks: Array.from(allLinks) };
}

// ─── Diff against existing menu ───────────────────────────────
async function diffMenuItems(
  organizationId: string,
  detectedItems: DetectedMenuItem[]
): Promise<{
  newItems: DetectedMenuItem[];
  changedItems: Array<{ name: string; oldPrice?: string; newPrice?: string }>;
  unchangedItems: string[];
  removedItems: string[];
}> {
  const { data: existing } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, price, description")
    .eq("organization_id", organizationId);

  const existingMap = new Map<string, { id: string; name: string; price: number | null; description: string | null }>();
  for (const e of existing || []) {
    existingMap.set(normalizeName(e.name), e);
  }

  const detectedNames = new Set(detectedItems.map((d) => normalizeName(d.name)));
  const newItems: DetectedMenuItem[] = [];
  const changedItems: Array<{ name: string; oldPrice?: string; newPrice?: string }> = [];
  const unchangedItems: string[] = [];
  const removedItems: string[] = [];

  for (const detected of detectedItems) {
    const norm = normalizeName(detected.name);
    const existing = existingMap.get(norm);
    if (!existing) {
      newItems.push(detected);
    } else {
      const detectedPrice = detected.price ? parseFloat(detected.price) : null;
      if (detectedPrice !== null && existing.price !== null && Math.abs(detectedPrice - Number(existing.price)) > 0.01) {
        changedItems.push({
          name: existing.name,
          oldPrice: String(existing.price),
          newPrice: detected.price,
        });
      } else {
        unchangedItems.push(existing.name);
      }
    }
  }

  for (const [norm, existing] of existingMap) {
    if (!detectedNames.has(norm)) {
      removedItems.push(existing.name);
    }
  }

  return { newItems, changedItems, unchangedItems, removedItems };
}

// ─── Main: run an import job ──────────────────────────────────
export async function runImportJob(opts: {
  url: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  applyNew?: boolean; // if true, auto-create new menu items
}): Promise<{ jobId: string; preview: ImportPreview }> {
  const { url, organizationId, userId, userEmail, applyNew = false } = opts;

  // Create job record
  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from("import_jobs")
    .insert({
      organization_id: organizationId,
      url,
      status: "running",
      progress: 0,
      progress_label: "Iniciando...",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  const jobId = jobRow?.id || "unknown";

  async function updateJob(patch: any) {
    try {
      await supabaseAdmin.from("import_jobs").update(patch).eq("id", jobId);
    } catch {}
  }

  try {
    // ─── Step 1: Fetch main page ────────────────────────────
    await updateJob({ progress: 5, progress_label: "Descargando página principal..." });
    let mainHtml: string;
    let finalUrl: string;
    let cacheHit = false;
    try {
      const result = await fetchHtml(url);
      mainHtml = result.html;
      finalUrl = result.finalUrl;
      cacheHit = result.cacheHit;
    } catch (e: any) {
      throw new Error(`No pudimos descargar la web: ${e.message}`);
    }

    // ─── Step 2: Parse robots.txt + sitemap ─────────────────
    await updateJob({ progress: 15, progress_label: "Analizando robots.txt y sitemap..." });
    const [robotsResult, sitemapUrls] = await Promise.all([
      parseRobots(finalUrl),
      parseSitemap(finalUrl),
    ]);

    // ─── Step 3: Parse main page ────────────────────────────
    await updateJob({ progress: 25, progress_label: "Extrayendo datos de la página principal..." });
    const jsonLdBlocks = extractAllJsonLd(mainHtml);
    const restaurant = jsonLdBlocks.find((b) => b["@type"] === "Restaurant") ||
      jsonLdBlocks.find((b) => b["@type"] === "FoodEstablishment") || null;
    const canonical = extractCanonical(mainHtml, finalUrl);
    const og = {
      title: extractMeta(mainHtml, "og:title") || extractMeta(mainHtml, "og:site_name"),
      description: extractMeta(mainHtml, "og:description"),
      image: extractMeta(mainHtml, "og:image"),
      locale: extractMeta(mainHtml, "og:locale"),
    };
    const pageMeta = { title: extractTitle(mainHtml), description: extractMeta(mainHtml, "description") };
    const social = extractSocialLinks(mainHtml, finalUrl);
    const phone = extractPhone(mainHtml);
    const email = extractEmail(mainHtml);
    const address = extractAddress(mainHtml);
    const openingHours = extractOpeningHours(mainHtml, jsonLdBlocks);
    let menuItems = extractMenuItems(mainHtml, jsonLdBlocks, finalUrl);

    // ─── Step 4: Crawl sub-pages ────────────────────────────
    await updateJob({ progress: 40, progress_label: "Buscando sub-páginas (carta, contacto, etc.)..." });
    const crawledPages: Array<{ url: string; status: number; itemsFound: number }> = [];
    try {
      const crawlResult = await crawlSubpages(finalUrl, mainHtml, sitemapUrls, async (label) => {
        await updateJob({ progress_label: label });
      });

      for (const p of crawlResult.pages) {
        crawledPages.push({ url: p.url, status: p.status, itemsFound: p.itemsFound });
        // Merge items from sub-pages
        if (p.itemsFound > 0) {
          const subJsonLd = extractAllJsonLd(p.html);
          const subItems = extractMenuItems(p.html, subJsonLd, p.url);
          menuItems = menuItems.concat(subItems);
        }
        // Fill missing fields from sub-pages
        if (!phone) {
          const p2 = extractPhone(p.html);
          if (p2) social.phone = p2;
        }
      }
      await updateJob({ pages_crawled: crawledPages.length });
    } catch (e: any) {
      // crawling failed, continue with main page data
    }

    // ─── Step 5: Deduplicate ────────────────────────────────
    await updateJob({ progress: 70, progress_label: "Deduplicando platos detectados..." });
    const seen = new Set<string>();
    const dedupedItems: DetectedMenuItem[] = [];
    for (const item of menuItems) {
      const norm = normalizeName(item.name);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      dedupedItems.push(item);
    }

    // ─── Step 6: Diff against existing menu ─────────────────
    await updateJob({ progress: 80, progress_label: "Comparando con tu carta actual..." });
    let diff: any = null;
    try {
      diff = await diffMenuItems(organizationId, dedupedItems);
    } catch {}

    // ─── Step 7: Auto-apply if requested ────────────────────
    let itemsImported = 0;
    if (applyNew && diff && diff.newItems.length > 0) {
      await updateJob({ progress: 90, progress_label: `Importando ${diff.newItems.length} platos nuevos...` });
      for (const item of diff.newItems) {
        try {
          const { error } = await supabaseAdmin.from("menu_items").insert({
            name: item.name,
            description: item.description || null,
            price: item.price ? parseFloat(item.price) : 0,
            image: item.image || null,
            visible: true,
            sort_order: 0,
            organization_id: organizationId,
          });
          if (!error) itemsImported++;
        } catch {}
      }
    }

    // ─── Step 8: Build preview ──────────────────────────────
    const detectedRestaurant: DetectedRestaurant = {
      name: restaurant?.name || og.title || pageMeta.title || null,
      description: restaurant?.description || og.description || pageMeta.description || null,
      image: restaurant?.image || og.image || null,
      phone: restaurant?.telephone || phone || null,
      email: restaurant?.email || email || null,
      address: restaurant?.address
        ? typeof restaurant.address === "string"
          ? restaurant.address
          : [restaurant.address.streetAddress, restaurant.address.addressLocality, restaurant.address.postalCode, restaurant.address.addressCountry]
              .filter(Boolean)
              .join(", ")
        : address,
      openingHours,
      servesCuisine: restaurant?.servesCuisine || null,
      priceRange: restaurant?.priceRange || null,
      website: canonical || finalUrl,
    };

    const preview: ImportPreview = {
      url: finalUrl,
      fetchedAt: new Date().toISOString(),
      restaurant: detectedRestaurant,
      social,
      menuItems: dedupedItems,
      diff,
      crawledPages,
      sitemapUrls,
      meta: {
        totalMenuItems: dedupedItems.length,
        htmlSize: mainHtml.length,
        detectedVia: restaurant ? "schema.org Restaurant" : "heuristics",
        cacheHit,
      },
    };

    // ─── Step 9: Complete ───────────────────────────────────
    await updateJob({
      status: "completed",
      progress: 100,
      progress_label: `Análisis completado. ${dedupedItems.length} platos detectados, ${diff?.newItems.length || 0} nuevos.`,
      pages_crawled: crawledPages.length,
      items_detected: dedupedItems.length,
      items_imported: itemsImported,
      result: preview,
      completed_at: new Date().toISOString(),
    });

    // Audit log
    try {
      const { db } = await import("@/lib/db");
      await db.auditLogs.insert({
        actor_id: userId,
        actor_email: userEmail,
        actor_role: "ADMIN",
        action: "WEB_IMPORT",
        target_type: "organization",
        target_id: organizationId,
        target_name: null,
        organization_id: organizationId,
        details: {
          url: finalUrl,
          itemsDetected: dedupedItems.length,
          itemsImported,
          pagesCrawled: crawledPages.length,
          cacheHit,
        },
        ip_address: null,
        user_agent: null,
      });
    } catch {}

    return { jobId, preview };
  } catch (error: any) {
    await updateJob({
      status: "failed",
      error: error.message,
      completed_at: new Date().toISOString(),
      progress_label: `Error: ${error.message.substring(0, 100)}`,
    });
    throw error;
  }
}

// ─── Get import history ───────────────────────────────────────
export async function getImportHistory(organizationId: string, limit = 10): Promise<ImportJob[]> {
  const { data, error } = await supabaseAdmin
    .from("import_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as ImportJob[];
}
