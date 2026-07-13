// ============================================================
// RestoPanel · Admin Reviews Moderation API
// ============================================================
// All endpoints require SUPER_ADMIN (gated by middleware).
//
// GET    /api/admin/reviews            → list reviews (filterable)
// PATCH  /api/admin/reviews            → update review status / response
// DELETE /api/admin/reviews?id=UUID    → hard delete a review
//
// Query params for GET:
//   status=PENDING|APPROVED|REJECTED   (default: all)
//   limit=12                            (max 100)
//   offset=0
//   org=UUID                            (optional filter by org)
// ============================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/session";

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

// ─── GET: list reviews ───────────────────────────────────────
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | APPROVED | REJECTED | null
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
  const orgId = searchParams.get("org");

  try {
    let query = supabaseAdmin
      .from("public_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      query = query.eq("status", status);
    }
    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "PGRST205" || /Could not find the table/.test(error.message)) {
        return NextResponse.json({ reviews: [], tableMissing: true });
      }
      console.error("[admin/reviews GET]", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    // Get aggregate counts by status for the moderation dashboard.
    // Previously this fetched EVERY review row and counted in JS —
    // O(N) network + memory for a number that's just 4 counts.
    // We now run 3 count-only queries (head: true), each O(1) on the
    // index. Total cost: 3 tiny round-trips vs 1 fat one.
    const [pending, approved, rejected] = await Promise.all([
      supabaseAdmin
        .from("public_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabaseAdmin
        .from("public_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "APPROVED"),
      supabaseAdmin
        .from("public_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "REJECTED"),
    ]);

    const byStatus = {
      PENDING: pending.count || 0,
      APPROVED: approved.count || 0,
      REJECTED: rejected.count || 0,
      TOTAL: (pending.count || 0) + (approved.count || 0) + (rejected.count || 0),
    };

    return NextResponse.json({
      reviews: data || [],
      counts: byStatus,
      tableMissing: false,
    });
  } catch (err) {
    console.error("[admin/reviews GET] exception", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ─── PATCH: update status or response ────────────────────────
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = clean(body?.id, 100);
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (body?.status && ["PENDING", "APPROVED", "REJECTED"].includes(body.status)) {
    updates.status = body.status;
  }
  if (typeof body?.response_text === "string") {
    updates.response_text = clean(body.response_text, 2000) || null;
    updates.response_at = new Date().toISOString();
    updates.responded_by = user.id || null;
  }
  if (typeof body?.verified_metric === "string") {
    updates.verified_metric = clean(body.verified_metric, 80) || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("public_reviews")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST205") {
        return NextResponse.json(
          { error: "table_missing", message: "Ejecuta la migración 0009_google_reviews.sql en Supabase." },
          { status: 503 }
        );
      }
      console.error("[admin/reviews PATCH]", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ review: data });
  } catch (err) {
    console.error("[admin/reviews PATCH] exception", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ─── DELETE: hard delete ─────────────────────────────────────
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get("id"), 100);
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("public_reviews").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST205") {
        return NextResponse.json(
          { error: "table_missing", message: "Ejecuta la migración 0009_google_reviews.sql en Supabase." },
          { status: 503 }
        );
      }
      console.error("[admin/reviews DELETE]", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/reviews DELETE] exception", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
