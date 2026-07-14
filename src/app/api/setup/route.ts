import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

/**
 * Setup endpoint — creates the FIRST and ONLY super-admin.
 *
 * Security guarantees:
 *   1. Only works if NO super-admin exists yet (one-time use)
 *   2. After the first super-admin is created, this endpoint
 *      permanently returns 403 Forbidden
 *   3. Password must be at least 12 characters
 *   4. Email must be valid
 *   5. The super-admin has is_super_admin=true, role='SUPER_ADMIN',
 *      organization_id=null (global access)
 */

const schema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres"),
});

export async function POST(req: Request) {
  try {
    // ─── SECURITY CHECK: only allow if no super-admin exists ───
    const { count } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("is_super_admin", true);

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Ya existe un Super-Admin. Esta página ha sido deshabilitada permanentemente por seguridad. " +
            "Si necesitas acceso, contacta con el Super-Admin existente.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const emailLower = email.toLowerCase().trim();

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        email: emailLower,
        password_hash: passwordHash,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        is_super_admin: true,
        organization_id: null,
        email_verified: true,
        blocked: false,
      })
      .select("id, email, role, is_super_admin, created_at")
      .single();

    if (error) {
      logger.error("Setup: failed to create super-admin", "setup", { error: error.message });
      return NextResponse.json({ error: "Error al crear el super-admin: " + error.message }, { status: 500 });
    }

    logger.info("Super-Admin created via /setup", "setup", { email: emailLower, userId: data.id });

    return NextResponse.json({
      ok: true,
      message: "Super-Admin creado correctamente. Ahora puedes iniciar sesión.",
      user: { id: data.id, email: data.email, role: data.role },
    });
  } catch (e: any) {
    logger.error("Setup error", "setup", { error: e.message });
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { count } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("is_super_admin", true);

    return NextResponse.json({
      setup_available: (count || 0) === 0,
      super_admin_count: count || 0,
    });
  } catch {
    return NextResponse.json({ setup_available: false, error: "No se pudo verificar" }, { status: 500 });
  }
}
