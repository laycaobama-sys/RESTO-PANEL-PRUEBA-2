// ============================================================
// RestoPanel · POST /api/restaurant/import-web
// ============================================================
// Imports public information from a restaurant's existing website:
//   - restaurant name, phone, email, address (from schema.org / meta / text)
//   - opening hours (schema.org OpeningHoursSpecification or text)
//   - social media links (Instagram, Facebook, Twitter/X, WhatsApp)
//   - menu items (schema.org MenuItem or heuristics on common selectors)
//
// The endpoint fetches the URL server-side, parses the HTML with regex
// (no external dependency required), extracts structured data when
// available, and returns a preview object. The caller can then review
// the preview and choose what to save.
//
// We deliberately do NOT auto-save anything to the database on this
// call — the user reviews the preview first, then calls
// PUT /api/restaurant to persist the fields they want.
//
// If a field cannot be reliably extracted, we return null for that
// field and the caller UI shows "no detectado — introducir manualmente".
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

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

// Extract the first JSON-LD block of a given @type from HTML
function extractJsonLd(html: string, type: string): any | null {
  // Match all <script type="application/ld+json"> blocks
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      // Could be an object or an array; could be a @graph
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        if (c["@type"] === type) return c;
        // @graph array
        if (Array.isArray(c["@graph"])) {
          for (const g of c["@graph"]) {
            if (g["@type"] === type) return g;
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

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
    } catch {
      // ignore
    }
  }
  return results;
}

function extractMeta(html: string, property: string): string | null {
  // Try property= and name=
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractSocialLinks(html: string, baseUrl: string): {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsapp?: string;
  tripadvisor?: string;
} {
  const result: any = {};
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);
  for (const href of links) {
    const lower = href.toLowerCase();
    if (!result.instagram && /instagram\.com\//.test(lower)) {
      result.instagram = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    }
    if (!result.facebook && /facebook\.com\//.test(lower)) {
      result.facebook = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    }
    if (!result.twitter && /(twitter|x)\.com\//.test(lower)) {
      result.twitter = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    }
    if (!result.whatsapp && /wa\.me\//.test(lower)) {
      result.whatsapp = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    }
    if (!result.tripadvisor && /tripadvisor\./.test(lower)) {
      result.tripadvisor = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
    }
  }
  return result;
}

function extractPhone(html: string): string | null {
  // Try tel: links first (most reliable)
  const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) return telMatch[1].trim();
  // Fallback: Spanish phone pattern
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
  // Look for common address patterns in text
  // Spanish postal codes are 5 digits
  const cpMatch = html.match(/\b\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ]/);
  if (cpMatch) {
    // Get surrounding context (200 chars before and after)
    const idx = cpMatch.index || 0;
    const start = Math.max(0, idx - 200);
    const end = Math.min(html.length, idx + 200);
    const chunk = html.slice(start, end).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return chunk;
  }
  return null;
}

function extractMenuItems(html: string, baseUrl: string): Array<{
  name: string;
  description?: string;
  price?: string;
  category?: string;
  image?: string;
}> {
  const items: any[] = [];

  // 1. Try schema.org MenuItem JSON-LD (most reliable)
  const jsonLdBlocks = extractAllJsonLd(html);
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
    // Some sites wrap menu items in a Menu type
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

  // 2. Heuristic fallback: look for price patterns near dish names
  // Common pattern: <h3>Dish name</h3> ... <span>12,50€</span>
  // This is less reliable so we cap at 20 items
  const priceRegex = /(\d{1,3}[,.]?\d{0,2})\s*(?:€|EUR|euros?)/gi;
  const dishRegex = /<(?:h[2-4]|strong|b)[^>]*>([^<]{3,80})<\/(?:h[2-4]|strong|b)>/gi;
  const dishNames: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dishRegex.exec(html)) !== null) {
    const name = m[1].trim();
    // Filter out obvious non-dishes
    if (/^(inicio|home|menú|carta|contacto|reservas|galería|about|nosotros)/i.test(name)) continue;
    if (name.length < 3 || name.length > 80) continue;
    dishNames.push({ name, index: m.index });
  }
  const prices: { value: string; index: number }[] = [];
  while ((m = priceRegex.exec(html)) !== null) {
    prices.push({ value: m[1].replace(",", "."), index: m.index });
  }

  // Match each dish to the nearest price within 500 chars
  for (const dish of dishNames.slice(0, 30)) {
    const nearbyPrice = prices.find((p) => Math.abs(p.index - dish.index) < 500 && p.index > dish.index);
    if (nearbyPrice) {
      items.push({
        name: dish.name,
        price: nearbyPrice.value,
      });
      if (items.length >= 20) break;
    }
  }

  return items;
}

function extractOpeningHours(html: string): string | null {
  // schema.org OpeningHoursSpecification
  const jsonLdBlocks = extractAllJsonLd(html);
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
  // Heuristic: look for "Lunes-Viernes" or "Horario:" patterns
  const horarioMatch = html.match(
    /(?:horario|abierto|open)[^<]{0,10}[:\s]+([^<.]{5,120})/i
  );
  if (horarioMatch) return horarioMatch[1].trim();
  return null;
}

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

  // Fetch the page server-side
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RestoPanel-Importer/1.0 (+https://restopanel.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return NextResponse.json(
        { error: "fetch_failed", message: `No pudimos descargar la web (HTTP ${resp.status}).` },
        { status: 502 }
      );
    }
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return NextResponse.json(
        { error: "not_html", message: "La URL no devuelve una página HTML." },
        { status: 400 }
      );
    }
    html = await resp.text();
    // Cap size to 2MB to avoid memory issues
    if (html.length > 2_000_000) html = html.slice(0, 2_000_000);
  } catch (e: any) {
    if (e.name === "AbortError") {
      return NextResponse.json(
        { error: "timeout", message: "La web tardó demasiado en responder." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "fetch_error", message: "No pudimos acceder a la web. Verifica la URL." },
      { status: 502 }
    );
  }

  // ─── Extract structured data ───────────────────────────────
  const restaurant = extractJsonLd(html, "Restaurant") || extractJsonLd(html, "FoodEstablishment");
  const og = {
    title: extractMeta(html, "og:title") || extractMeta(html, "og:site_name"),
    description: extractMeta(html, "og:description"),
    image: extractMeta(html, "og:image"),
    locale: extractMeta(html, "og:locale"),
  };
  const pageMeta = {
    title: extractTitle(html),
    description: extractMeta(html, "description"),
  };

  const social = extractSocialLinks(html, url);
  const phone = extractPhone(html);
  const email = extractEmail(html);
  const address = extractAddress(html);
  const openingHours = extractOpeningHours(html);
  const menuItems = extractMenuItems(html, url);

  // Build the preview object. Every field can be null if not detected.
  const preview = {
    url,
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
      website: url,
    },
    social,
    menuItems,
    meta: {
      totalMenuItems: menuItems.length,
      htmlSize: html.length,
      ogLocale: og.locale,
      detectedVia: restaurant ? "schema.org Restaurant" : "heuristics",
    },
  };

  // ─── Audit log ─────────────────────────────────────────────
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
      details: { url, itemsDetected: menuItems.length },
      ip_address: null,
      user_agent: null,
    });
  } catch {
    // audit log is best-effort
  }

  return NextResponse.json({ ok: true, preview });
}
