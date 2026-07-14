import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAIResponse } from "@/lib/reviews-ai";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  // Cargar la reseña
  const { data: review } = await supabaseAdmin
    .from("google_reviews")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (!review) return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });

  let response: string;
  if (body.edit) {
    response = body.response;
  } else {
    response = generateAIResponse({
      author_name: review.author_name,
      rating: review.rating,
      text: review.text,
      sentiment: review.sentiment,
    });
  }

  await supabaseAdmin
    .from("google_reviews")
    .update({
      ai_response: response,
      ai_response_edited: Boolean(body.edit),
    })
    .eq("id", id);

  return NextResponse.json({ response });
}
