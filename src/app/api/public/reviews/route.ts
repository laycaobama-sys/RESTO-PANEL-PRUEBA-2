// ============================================================
// RestoPanel · Public Google Reviews API
// ============================================================
// GET  /api/public/reviews         → list APPROVED reviews (newest first)
// POST /api/public/reviews         → submit a new PENDING review
//
// This endpoint is PUBLIC (no auth required) so the landing page
// can display real reviews and accept new ones from clients or
// restaurant companies without a session.
//
// Rate limiting: in-memory per-IP throttle (max 3 submissions per
// 10 minutes per IP) to prevent review spam. For production you'd
// want a Redis-backed limiter, but this is enough for launch.
//
// If the `public_reviews` table doesn't exist yet (migration 0009
// not applied), GET returns an empty array and POST returns a
// 503 with a clear message — the landing page handles both cases.
// ============================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── In-memory rate limiter (per IP, per 10-min window) ──────
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMITS_PER_WINDOW = 3;
const submits = new Map<string, { count: number; firstAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = submits.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    submits.set(ip, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SUBMITS_PER_WINDOW;
}

function getIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}

// ─── Sanitisation helpers ────────────────────────────────────
function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

// ─── GET: list approved reviews ──────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10) || 12, 50);
  const orgId = searchParams.get("org"); // optional filter by organization_id

  try {
    let query = supabaseAdmin
      .from("public_reviews")
      .select("id, author_name, author_role, author_company, author_avatar, rating, title, body, tags, verified_metric, response_text, response_at, created_at, organization_id")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error } = await query;

    if (error) {
      // PGRST205 = schema cache miss → table doesn't exist
      if (error.code === "PGRST205" || /Could not find the table/.test(error.message)) {
        return NextResponse.json({ reviews: [], aggregate: null, tableMissing: true });
      }
      console.error("[reviews/GET]", error);
      return NextResponse.json({ reviews: [], aggregate: null, error: "db_error" }, { status: 500 });
    }

    // Compute aggregate rating from the approved reviews
    const reviews = data || [];
    const aggregate = reviews.length > 0
      ? {
          count: reviews.length,
          average: Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)),
          distribution: [5, 4, 3, 2, 1].map((star) => ({
            star,
            count: reviews.filter((r) => r.rating === star).length,
          })),
        }
      : null;

    return NextResponse.json({ reviews, aggregate, tableMissing: false });
  } catch (err) {
    console.error("[reviews/GET] exception", err);
    return NextResponse.json({ reviews: [], aggregate: null, error: "server_error" }, { status: 500 });
  }
}

// ─── POST: submit a new pending review ───────────────────────
export async function POST(req: Request) {
  const ip = getIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Has enviado demasiadas reseñas en poco tiempo. Inténtalo de nuevo más tarde." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const author_name = clean(body?.author_name, 120);
  const author_role = body?.author_role === "COMPANY" ? "COMPANY" : "CLIENT";
  const author_company = clean(body?.author_company, 120);
  const author_email = clean(body?.author_email, 200);
  const author_avatar = clean(body?.author_avatar, 500);
  const title = clean(body?.title, 160);
  const body_text = clean(body?.body, 2000);
  const rating = Math.max(1, Math.min(5, parseInt(body?.rating, 10) || 5));
  const tags = Array.isArray(body?.tags)
    ? body.tags.slice(0, 6).map((t: any) => clean(t, 40)).filter(Boolean)
    : [];
  const organization_id = body?.organization_id && typeof body.organization_id === "string" ? body.organization_id : null;

  if (author_name.length < 2) {
    return NextResponse.json({ error: "invalid_name", message: "Tu nombre debe tener al menos 2 caracteres." }, { status: 400 });
  }
  if (body_text.length < 10) {
    return NextResponse.json({ error: "invalid_body", message: "Tu reseña debe tener al menos 10 caracteres." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("public_reviews")
      .insert({
        author_name,
        author_role,
        author_company: author_company || null,
        author_email: author_email || null,
        author_avatar: author_avatar || null,
        title: title || null,
        body: body_text,
        rating,
        tags,
        organization_id: organization_id || null,
        source: "LANDING",
        status: "PENDING",
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (error.code === "PGRST205" || /Could not find the table/.test(error.message)) {
        return NextResponse.json(
          {
            error: "table_missing",
            message:
              "La tabla de reseñas no existe todavía en la base de datos. Ejecuta la migración supabase/migrations/0009_google_reviews.sql en el SQL Editor de Supabase para activar las reseñas reales.",
          },
          { status: 503 }
        );
      }
      console.error("[reviews/POST]", error);
      return NextResponse.json({ error: "db_error", message: "No pudimos guardar tu reseña. Inténtalo de nuevo." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      status: "PENDING",
      message: "Gracias por tu reseña. Nuestro equipo la revisará y se publicará en breve.",
    });
  } catch (err) {
    console.error("[reviews/POST] exception", err);
    return NextResponse.json({ error: "server_error", message: "Error del servidor." }, { status: 500 });
  }
}
