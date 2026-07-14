"use client";

const FAQS = [
  {
    q: "¿Qué hace RestoPanel?",
    a: "RestoPanel es un software integral de gestión para restaurantes que incluye motor de reservas sin comisiones, plano de mesas interactivo, CRM de clientes, gestión de reseñas, turnos de personal y analíticas de negocio. Todo centralizado en un solo panel.",
  },
  {
    q: "¿RestoPanel cobra comisiones por reserva?",
    a: "No. RestoPanel no cobra comisiones por reserva ni por comensal. Pagas una suscripción mensual o anual y todas las reservas son ilimitadas. Los datos son 100% propiedad del restaurante.",
  },
  {
    q: "¿Cómo ayuda RestoPanel a reducir no-shows?",
    a: "RestoPanel envía confirmaciones automáticas por WhatsApp y email, permite solicitar prepago a grupos grandes, y utiliza IA para identificar clientes con historial de no-shows.",
  },
  {
    q: "¿Se integra con la web del restaurante?",
    a: "Sí. RestoPanel se integra con tu web mediante un widget de reservas, y también con Google, Instagram y WhatsApp. Todas las reservas llegan al mismo panel.",
  },
];

export function StructuredData() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RestoPanel",
    "applicationCategory": "BusinessApplication",
    "applicationSubCategory": "Restaurant Management Software",
    "operatingSystem": "Web",
    "description": "Software de reservas y CRM para restaurantes. Sin comisiones por reserva. Plano de mesas inteligente, CRM de clientes, Google Reviews, analíticas y turnos de personal.",
    "url": "https://restopanel.es",
    "offers": [
      { "@type": "Offer", "name": "Independiente", "price": "59", "priceCurrency": "EUR" },
      { "@type": "Offer", "name": "Profesional", "price": "119", "priceCurrency": "EUR" },
      { "@type": "Offer", "name": "Cadena", "price": "249", "priceCurrency": "EUR" },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
    </>
  );
}
