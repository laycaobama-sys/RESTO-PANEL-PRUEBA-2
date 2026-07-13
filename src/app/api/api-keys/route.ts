import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createHash, randomBytes } from "crypto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();

  // Generar API key: rp_live_<32 chars>
  const rawKey = `rp_live_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      organization_id: user.organizationId,
      name: body.name || "API Key",
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: body.scopes || ["read"],
      is_active: true,
      created_by: user.id,
      expires_at: body.expires_at || null,
    })
    .select("id, name, key_prefix, scopes, is_active, expires_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Devolver la key raw UNA sola vez (no se puede volver a obtener)
  return NextResponse.json({ ...data, key: rawKey }, { status: 201 });
}
