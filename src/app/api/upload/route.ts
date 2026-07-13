// ============================================================
// RestoPanel · Upload API
// ============================================================
// POST /api/upload
//   Accepts a single file (multipart/form-data, field name "file"),
//   validates its MIME type and size, stores it, and returns a
//   publicly-accessible URL.
//
// Storage strategy:
//   1. Try Supabase Storage bucket "restaurant-assets" (org-scoped
//      path). This is the production path.
//   2. If Supabase Storage is unavailable (dev / not configured),
//      fall back to returning a base64 data URL so the upload UX
//      still works in local development. Data URLs > 2 MB are
//      rejected to avoid bloating the DB.
//
// Security:
//   - Auth required (any logged-in user).
//   - Strict MIME-type allowlist (images + PDF only).
//   - Hard size cap (5 MB).
//   - The object key is org-scoped to prevent cross-tenant
//     collisions and make future RLS policies trivial.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Validation constants ────────────────────────────────────
// Allow only image types + PDF (for menu files / invoices).
export const ALLOWED_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "application/pdf",
]);

export const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const BUCKET_NAME = "restaurant-assets";
const DATA_URL_FALLBACK_MAX = 2 * 1024 * 1024; // 2 MB cap for data URL fallback

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Campo 'file' no encontrado" },
      { status: 400 }
    );
  }

  // ─── Type check (strict allowlist) ────────────────────────
  // CRITICAL FIX: never trust the client-supplied Content-Type
  // blindly — but File.type is what the browser provides. We
  // accept it iff it's in the allowlist. Reject everything else.
  if (!file.type || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Tipo de archivo no permitido: ${file.type || "desconocido"}`,
        allowed: Array.from(ALLOWED_TYPES),
      },
      { status: 415 }
    );
  }

  // ─── Size check ───────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `El archivo supera el tamaño máximo de ${MAX_SIZE_BYTES} bytes (${Math.round(MAX_SIZE_BYTES / 1024 / 1024)} MB)`,
        size: file.size,
        max: MAX_SIZE_BYTES,
      },
      { status: 413 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "El archivo está vacío" },
      { status: 400 }
    );
  }

  // ─── Store the file ───────────────────────────────────────
  // Build an org-scoped key: <orgId>/<uuid>.<ext>
  // The UUID prevents filename collisions and information leakage
  // (users can't enumerate other tenants' files by guessing names).
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().slice(0, 8)
    : extFromType(file.type);
  const objectKey = `${user.organizationId}/${randomUUID()}.${ext}`;

  // Read the file bytes once — we'll reuse for both storage paths.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // ─── Path 1: Supabase Storage (production) ────────────────
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .upload(objectKey, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (!error && data) {
      const { data: pub } = supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(objectKey);

      if (pub?.publicUrl) {
        logger.info(
          `Upload stored in Supabase Storage: ${objectKey}`,
          "upload",
          { orgId: user.organizationId, size: file.size, type: file.type }
        );
        return NextResponse.json({ url: pub.publicUrl, key: objectKey });
      }
    }
    // Fall through to data URL fallback
    logger.warn(
      `Supabase Storage upload failed — falling back to data URL. Error: ${error?.message || "unknown"}`,
      "upload"
    );
  } catch (e) {
    logger.warn(
      `Supabase Storage not available — using data URL fallback. Reason: ${(e as Error).message}`,
      "upload"
    );
  }

  // ─── Path 2: data URL fallback (dev / no storage configured) ───
  // Only allow small files via this path to avoid DB bloat.
  if (file.size > DATA_URL_FALLBACK_MAX) {
    return NextResponse.json(
      {
        error:
          "No se pudo subir el archivo (almacenamiento no configurado) y el archivo es demasiado grande para el fallback embebido.",
      },
      { status: 503 }
    );
  }

  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  logger.info(
    `Upload stored as data URL (fallback, ${file.size} bytes)`,
    "upload",
    { orgId: user.organizationId, type: file.type }
  );

  return NextResponse.json({ url: dataUrl, key: null });
}

function extFromType(type: string): string {
  switch (type) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    case "image/avif": return "avif";
    case "image/svg+xml": return "svg";
    case "application/pdf": return "pdf";
    default: return "bin";
  }
}
