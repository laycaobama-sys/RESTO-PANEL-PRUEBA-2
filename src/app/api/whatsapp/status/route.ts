import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getWhatsAppQueueStatus } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const queueStatus = getWhatsAppQueueStatus();

  // Fetch recent messages from DB
  const { data: recentMessages } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    configured: queueStatus.isConfigured,
    queue: queueStatus,
    recentMessages: recentMessages || [],
    config: {
      hasToken: !!process.env.WHATSAPP_TOKEN,
      hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    },
  });
}
