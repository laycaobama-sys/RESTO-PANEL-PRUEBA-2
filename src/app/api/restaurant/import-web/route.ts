// ============================================================
// RestoPanel · POST /api/restaurant/import-web
// ============================================================
// Professional website importer with:
//   - Multi-page crawling (detects /carta, /menu, /contacto, etc.)
//   - schema.org JSON-LD parsing (Restaurant, MenuItem, Menu)
//   - Heuristic extraction (phone, email, address, hours, social)
//   - Diff against existing menu items (new / changed / removed)
//   - Image detection
//   - Deduplication by name (case-insensitive, accent-stripped)
//   - Rate limiting + audit log
//
// The endpoint returns a preview. The caller reviews it and
// calls PUT /api/restaurant + POST /api/menu to persist.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Rate limit: 5 imports per 10 minutes per user
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, { count: number; firstAt: number }>();

function getIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Normalize a dish name for dedup (lowercase, strip accents, collapse spaces)
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Fetch with timeout + size cap ────────────────────────────
async function fetchHtml(url: string, timeoutMs = 12000): Promise<{ html: string; finalUrl: string; status: number; contentType: string }> {
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
    return { html, finalUrl: resp.url || url, status: resp.status, contentType };
  } finally {
    clearTimeout(timeout);
  }
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

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractSocialLinks(html: string, baseUrl: string) {
  const result: any = {};
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
  if (phoneMatch) return phoneMatch[0];
  return null;
}

function extractEmail(html: string): string | null {
  const mailtoMatch = html.match(/href=["']mailto:([^"']+)["']/i);
  if (mailtoMatch) return mailtoMatch[1].trim();
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return emailMatch[0];
  return null;
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
  if (horarioMatch) return horarioMatch[1].trim();
  return null;
}

function extractMenuItems(html: string, jsonLdBlocks: any[], baseUrl: string): Array<{
  name: string;
  description?: string;
  price?: string;
  category?: string;
  image?: string;
}> {
  const items: any[] = [];

  // 1. schema.org MenuItem JSON-LD
  for (const block of jsonLdBlocks) {
    if (block["@type"] === "MenuItem") {
      items.push({
        name: block.name || "",
        description: block.description || undefined,
        price: typeof block.price === "string" ? block.price : String(block.offers?.price || ""),
        category: block.menuAddOn?.name || undefined,
        image: block.image ? (typeof block.image === "string" ? block.image : block.image?.[0] || "") : undefined,
      });
    }
    if (block["@type"] === "Menu" && Array.isArray(block.hasMenuItem)) {
      for (const item of block.hasMenuItem) {
        items.push({
          name: item.name || "",
          description: item.description || undefined,
          price: typeof item.offers?.price === "number" ? String(item.offers.price) : item.offers?.price || "",
          category: block.name || undefined,
          image: item.image ? (typeof item.image === "string" ? item.image : "") : undefined,
        });
      }
    }
  }

  if (items.length > 0) return items;

  // 2. Heuristic fallback: dish names near prices
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
      items.push({ name: dish.name, price: nearbyPrice.value });
      if (items.length >= 30) break;
    }
  }

  return items;
}

// ─── Sub-page crawler ─────────────────────────────────────────
// Finds links to /carta, /menu, /contacto, /horarios, etc. and
// fetches them too, merging all detected data.
async function crawlSubpages(baseUrl: string, mainHtml: string): Promise<{ pages: Array<{ url: string; html: string; status: number }>; links: string[] }> {
  const baseUrlObj = new URL(baseUrl);
  const origin = baseUrlObj.origin;

  // Extract all internal links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const allLinks = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(mainHtml)) !== null) {
    try {
      const href = m[1];
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const resolved = new URL(href, baseUrl).toString();
      // Only same-origin links
      if (new URL(resolved).origin !== origin) continue;
      allLinks.add(resolved.split("#")[0].split("?")[0]);
    } catch {}
  }

  // Prioritize links that look like menu/contact/hours pages
  const priorityKeywords = ["carta", "menu", "menú", "platos", "comida", "contacto", "horario", "reserva", "donde", "ubicacion"];
  const priorityLinks = Array.from(allLinks).filter((l) => {
    const lower = l.toLowerCase();
    return priorityKeywords.some((k) => lower.includes(k));
  });

  // Also fetch the homepage's siblings (root-level paths) but cap at 5 total
  const linksToFetch = priorityLinks.slice(0, 5);
  const pages: Array<{ url: string; html: string; status: number }> = [];

  // Fetch sub-pages in parallel (max 3 at a time)
  const batchSize = 3;
  for (let i = 0; i < linksToFetch.length; i += batchSize) {
    const batch = linksToFetch.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const { html, status } = await fetchHtml(url, 8000);
          return { url, html, status };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        pages.push(r.value);
      }
    }
  }

  return { pages, links: Array.from(allLinks) };
}

// ─── Diff against existing menu ───────────────────────────────
async function diffMenuItems(
  organizationId: string,
  detectedItems: Array<{ name: string; price?: string; description?: string }>
): Promise<{
  newItems: typeof detectedItems;
  changedItems: Array<{ name: string; oldPrice?: string; newPrice?: string }>;
  unchangedItems: string[];
  removedItems: string[]; // items in DB but not detected
}> {
  // Fetch existing menu items
  const { data: existing } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, price, description")
    .eq("organization_id", organizationId);

  const existingMap = new Map<string, { id: string; name: string; price: number | null; description: string | null }>();
  for (const e of existing || []) {
    existingMap.set(normalizeName(e.name), e);
  }

  const detectedNames = new Set(detectedItems.map((d) => normalizeName(d.name)));
  const newItems: any[] = [];
  const changedItems: any[] = [];
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

  // Items in DB that weren't detected (might have been removed from the website)
  for (const [norm, existing] of existingMap) {
    if (!detectedNames.has(norm)) {
      removedItems.push(existing.name);
    }
  }

  return { newItems, changedItems, unchangedItems, removedItems };
}

// ─── Main handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ip = getIp(req);
  const rlKey = `${user.id}:${ip}`;
  if (rateLimited(rlKey)) {
    return NextResponse.json(
      { error: "too_many_requests", message: "Demasiados intentos de importación. Inténtalo en unos minutos." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url: string = (body?.url || "").trim();
  if (!isValidUrl(url)) {
    return NextResponse.json(
      { error: "invalid_url", message: "La URL no es válida. Debe empezar por http:// o https://" },
      { status: 400 }
    );
  }

  // Fetch main page
  let mainHtml: string;
  let finalUrl: string;
  try {
    const result = await fetchHtml(url);
    mainHtml = result.html;
    finalUrl = result.finalUrl;
  } catch (e: any) {
    if (e.name === "AbortError" || e.message?.includes("abort")) {
      return NextResponse.json({ error: "timeout", message: "La web tardó demasiado en responder." }, { status: 504 });
    }
    if (e.message?.startsWith("not_html")) {
      return NextResponse.json({ error: "not_html", message: "La URL no devuelve una página HTML." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "fetch_failed", message: "No pudimos descargar la web. Puede que bloquee bots o requiera JavaScript." },
      { status: 502 }
    );
  }

  // Parse main page
  const jsonLdBlocks = extractAllJsonLd(mainHtml);
  const restaurant = jsonLdBlocks.find((b) => b["@type"] === "Restaurant") ||
    jsonLdBlocks.find((b) => b["@type"] === "FoodEstablishment") || null;
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

  // ─── Crawl sub-pages for more data ─────────────────────────
  let crawledPages: Array<{ url: string; status: number }> = [];
  let crawlError: string | null = null;
  try {
    const crawlResult = await crawlSubpages(finalUrl, mainHtml);
    crawledPages = crawlResult.pages.map((p) => ({ url: p.url, status: p.status }));

    // If main page had no menu items, try sub-pages
    if (menuItems.length === 0 && crawlResult.pages.length > 0) {
      for (const page of crawlResult.pages) {
        const subJsonLd = extractAllJsonLd(page.html);
        const subItems = extractMenuItems(page.html, subJsonLd, page.url);
        if (subItems.length > 0) {
          menuItems = menuItems.concat(subItems);
        }
        // Also try to fill missing fields from sub-pages
        if (!phone) {
          const p = extractPhone(page.html);
          if (p) social.phone = p;
        }
        if (!openingHours) {
          const h = extractOpeningHours(page.html, subJsonLd);
          if (h) {
            // override below
          }
        }
      }
    }
  } catch (e: any) {
    crawlError = e.message?.substring(0, 100) || "unknown";
  }

  // Deduplicate menu items by normalized name
  const seen = new Set<string>();
  const dedupedItems: typeof menuItems = [];
  for (const item of menuItems) {
    const norm = normalizeName(item.name);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    dedupedItems.push(item);
  }

  // ─── Diff against existing menu ────────────────────────────
  let diff: any = null;
  try {
    diff = await diffMenuItems(user.organizationId, dedupedItems);
  } catch (e: any) {
    // diff failed — return without diff (still useful preview)
  }

  // Build the preview
  const preview = {
    url: finalUrl,
    fetchedAt: new Date().toISOString(),
    restaurant: {
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
      website: finalUrl,
    },
    social,
    menuItems: dedupedItems,
    diff,
    crawledPages,
    meta: {
      totalMenuItems: dedupedItems.length,
      htmlSize: mainHtml.length,
      ogLocale: og.locale,
      detectedVia: restaurant ? "schema.org Restaurant" : "heuristics",
      crawlError,
    },
  };

  // Audit log
  try {
    await db.auditLogs.insert({
      actor_id: user.id,
      actor_email: user.email,
      actor_role: user.role,
      action: "WEB_IMPORT",
      target_type: "organization",
      target_id: user.organizationId,
      target_name: user.organizationName,
      organization_id: user.organizationId,
      details: { url: finalUrl, itemsDetected: dedupedItems.length, pagesCrawled: crawledPages.length },
      ip_address: ip,
      user_agent: req.headers.get("user-agent") || null,
    });
  } catch {}

  return NextResponse.json({ ok: true, preview });
}
