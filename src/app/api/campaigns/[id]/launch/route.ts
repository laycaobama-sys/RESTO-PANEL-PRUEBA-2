import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // Cargar campaña
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (error || !campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  // Cargar destinatarios según segmento
  let customerQuery = supabaseAdmin
    .from("customers")
    .select("id, name, email, phone")
    .eq("organization_id", user.organizationId)
    .is("deleted_at", null)
    .eq("marketing_opt_in", true);

  if (campaign.segment !== "all") {
    if (campaign.segment === "vip") customerQuery = customerQuery.eq("vip_status", true);
    else if (campaign.segment === "birthday") {
      const today = new Date();
      customerQuery = customerQuery
        .eq("extract(month from birthday)::int", today.getMonth() + 1)
        .eq("extract(day from birthday)::int", today.getDate());
    } else {
      customerQuery = customerQuery.eq("segment", campaign.segment);
    }
  }

  const { data: customers } = await customerQuery.limit(1000);
  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: "No hay destinatarios para esta campaña" }, { status: 400 });
  }

  // Crear recipients
  const recipients = customers.map((c: any) => ({
    campaign_id: id,
    organization_id: user.organizationId,
    customer_id: c.id,
    channel: campaign.type === "multi" ? "email" : campaign.type,
    recipient: campaign.type === "whatsapp" ? c.phone : c.email,
    status: "pending",
  }));

  await supabaseAdmin.from("campaign_recipients").insert(recipients);

  // Marcar campaña como running
  await supabaseAdmin
    .from("campaigns")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      total_recipients: recipients.length,
    })
    .eq("id", id);

  // Enviar emails (si hay RESEND configurado)
  if (campaign.type === "email" || campaign.type === "multi") {
    try {
      const { sendEmailAndLog } = await import("@/lib/email");
      let sentCount = 0;
      for (const c of customers) {
        if (!c.email) continue;
        try {
          await sendEmailAndLog({
            to: c.email,
            subject: campaign.subject || "Mensaje de tu restaurante",
            template: { html: `<p>Hola ${c.name},</p><p>${campaign.message || ""}</p>`, text: campaign.message || "" },
            organizationId: user.organizationId,
          });
          sentCount++;
        } catch (e) {
          logger.warn("Campaign email failed", "campaigns", { error: (e as Error).message });
        }
      }
      // Actualizar contadores
      await supabaseAdmin
        .from("campaigns")
        .update({
          total_sent: sentCount,
          total_delivered: sentCount,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
    } catch (e: any) {
      logger.error("Campaign send failed", "campaigns", { error: e.message });
    }
  }

  return NextResponse.json({
    ok: true,
    launched: true,
    recipients: recipients.length,
    message: `Campaña enviada a ${recipients.length} destinatarios`,
  });
}
