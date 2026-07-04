// ============================================================
// RestoPanel · POST /api/restaurant/import-web
// ============================================================
// Uses the professional web-import service (src/lib/web-import.ts)
// which handles: sitemap parsing, robots.txt, crawling,
// JSON-LD + microdata + OpenGraph, deduplication, diff,
// caching, job tracking, and audit logging.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { runImportJob, getImportHistory } from "@/lib/web-import";

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

// ─── POST: run an import job ──────────────────────────────────
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

  try {
    const { jobId, preview } = await runImportJob({
      url,
      organizationId: user.organizationId,
      userId: user.id,
      userEmail: user.email,
      applyNew: body?.applyNew === true,
    });
    return NextResponse.json({ ok: true, jobId, preview });
  } catch (error: any) {
    return NextResponse.json(
      { error: "import_failed", message: error.message || "No pudimos importar la web." },
      { status: 502 }
    );
  }
}

// ─── GET: list import history ─────────────────────────────────
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const history = await getImportHistory(user.organizationId, 10);
  return NextResponse.json({ jobs: history });
}
