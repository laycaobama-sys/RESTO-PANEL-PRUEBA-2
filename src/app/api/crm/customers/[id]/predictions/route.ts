import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCustomerProfile, getCustomerPredictions, calculatePredictions } from "@/lib/crm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // Intentar cargar predicciones cacheadas
  const cached = await getCustomerPredictions(user.organizationId, id);
  if (cached) return NextResponse.json(cached);

  // Si no hay, calcular al vuelo
  const customer = await getCustomerProfile(user.organizationId, id);
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const predictions = calculatePredictions(customer);

  // Guardar en BD (upsert)
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  await supabaseAdmin.from("customer_predictions").upsert({
    customer_id: id,
    organization_id: user.organizationId,
    ...predictions,
    computed_at: new Date().toISOString(),
  }, { onConflict: "customer_id" });

  return NextResponse.json(predictions);
}
