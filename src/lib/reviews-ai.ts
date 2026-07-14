// ============================================================
// RestoPanel · Google Reviews IA — Análisis de sentimiento
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Palabras clave para análisis de sentimiento ─────────────
const POSITIVE_WORDS = [
  'excelente', 'genial', 'perfecto', 'delicioso', 'increíble', 'fantástico',
  'recomendable', 'volveré', 'repetiré', 'buenísimo', 'ricísimo', 'spectacular',
  'amable', 'atento', 'rápido', 'limpio', 'acogedor', 'elegante', 'excelente',
  'excelente', 'good', 'great', 'excellent', 'amazing', 'delicious', 'perfect',
  'fantastic', 'wonderful', 'lovely', 'best', 'recommend',
];

const NEGATIVE_WORDS = [
  'malo', 'mal', 'terrible', 'horrible', 'pésimo', 'lento', 'frío', 'caro',
  'sucio', 'desagradable', 'nunca', 'volver', 'decepcionado', 'decepción',
  'espera', 'tardó', 'fría', 'crudo', 'salado', 'soso', 'quemado',
  'bad', 'terrible', 'awful', 'slow', 'cold', 'expensive', 'dirty',
  'disappointing', 'never', 'rude', 'worst',
];

const TOPICS: Record<string, string[]> = {
  food: ['comida', 'plato', 'platos', 'carne', 'pescado', 'postre', 'ensalada', 'sabor', 'food', 'dish', 'meal', 'taste'],
  service: ['servicio', 'camarero', 'atención', 'mozo', 'service', 'waiter', 'staff', 'attention'],
  price: ['precio', 'caro', 'barato', 'cuenta', 'price', 'expensive', 'cheap', 'bill'],
  ambiance: ['ambiente', 'decoración', 'música', 'ruidoso', 'acogedor', 'ambiance', 'atmosphere', 'decor'],
  wait: ['espera', 'tardó', 'cola', 'wait', 'queue', 'slow', 'lento'],
};

export interface ReviewAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;  // -1 a 1
  topics: string[];
  keywords_positive: string[];
  keywords_negative: string[];
}

// ─── Analizar una reseña ─────────────────────────────────────
export function analyzeReview(text: string): ReviewAnalysis {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\W+/).filter(Boolean);

  let positiveCount = 0;
  let negativeCount = 0;
  const foundPositive: string[] = [];
  const foundNegative: string[] = [];

  for (const word of words) {
    if (POSITIVE_WORDS.includes(word)) {
      positiveCount++;
      if (!foundPositive.includes(word)) foundPositive.push(word);
    }
    if (NEGATIVE_WORDS.includes(word)) {
      negativeCount++;
      if (!foundNegative.includes(word)) foundNegative.push(word);
    }
  }

  const total = positiveCount + negativeCount;
  let score = 0;
  if (total > 0) {
    score = (positiveCount - negativeCount) / total;
  }

  // Detectar temas
  const foundTopics: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      foundTopics.push(topic);
    }
  }

  return {
    sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
    sentiment_score: Math.round(score * 100) / 100,
    topics: foundTopics,
    keywords_positive: foundPositive,
    keywords_negative: foundNegative,
  };
}

// ─── Analizar todas las reseñas pendientes ───────────────────
export async function analyzeAllReviews(organizationId: string): Promise<number> {
  const { data: reviews } = await supabaseAdmin
    .from("google_reviews")
    .select("id, text")
    .eq("organization_id", organizationId)
    .is("sentiment", null);

  if (!reviews || reviews.length === 0) return 0;

  let count = 0;
  for (const review of reviews) {
    if (!review.text) continue;
    const analysis = analyzeReview(review.text);
    await supabaseAdmin
      .from("google_reviews")
      .update({
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        topics: analysis.topics,
        keywords_positive: analysis.keywords_positive,
        keywords_negative: analysis.keywords_negative,
      })
      .eq("id", review.id);
    count++;
  }

  return count;
}

// ─── Generar respuesta con IA ────────────────────────────────
export function generateAIResponse(review: {
  author_name: string;
  rating: number;
  text: string;
  sentiment: string | null;
}): string {
  const name = review.author_name?.split(' ')[0] || '';
  const isPositive = review.sentiment === 'positive' || review.rating >= 4;
  const isNegative = review.sentiment === 'negative' || review.rating <= 2;

  if (isPositive) {
    const responses = [
      `¡Muchas gracias, ${name}! Nos alegra enormemente que hayas disfrutado tu experiencia con nosotros. Tu opinión nos motiva a seguir esforzándonos cada día. ¡Te esperamos pronto de nuevo!`,
      `¡Gracias por tus palabras, ${name}! Es un placer para nosotros saber que tu visita fue especial. Esperamos verte de nuevo pronto para seguir sorprendiéndote.`,
      `¡Mil gracias, ${name}! Tu reseña nos llena de alegría. Todo el equipo trabaja con pasión para ofrecer la mejor experiencia. ¡Hasta la próxima!`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isNegative) {
    const responses = [
      `Hola ${name}. Lamentamos sinceramente que tu experiencia no haya estado a la altura de tus expectativas. Nos gustaría conocer más detalles para poder solucionarlo. Por favor, escríbenos a hola@restopanel.es. Tu opinión nos ayuda a mejorar.`,
      `${name}, sentimos mucho leer esto. Trabajamos cada día para ofrecer la mejor experiencia y claramente no lo conseguimos contigo. Nos gustaría compensarte. Por favor, contáctanos directamente. Gracias por tu honestidad.`,
      `Gracias por tu sinceridad, ${name}. Lamentamos los inconvenientes. Tomamos tu feedback muy en serio y trabajaremos para mejorar. Nos encantaría tener la oportunidad de demostrarte lo que realmente podemos ofrecerte.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  return `¡Gracias por tu reseña, ${name}! Valoramos mucho tu opinión y la tendremos en cuenta para seguir mejorando. ¡Esperamos verte de nuevo pronto!`;
}

// ─── Detectar clientes influyentes ───────────────────────────
export function isInfluencerReview(review: {
  rating: number;
  text: string;
}): boolean {
  // Heurística simple: reseña larga (>500 chars) + rating extremo
  if (review.text && review.text.length > 500 && (review.rating === 1 || review.rating === 5)) {
    return true;
  }
  return false;
}
