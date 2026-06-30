export default function Head() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es RestoPanel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RestoPanel es un software en la nube que centraliza la gestión de reservas, mesas, clientes, eventos y analítica para restaurantes, discotecas, clubs, beach clubs y hoteles. Todo funciona desde un único panel accesible desde cualquier dispositivo con navegador.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué tipo de negocios pueden usar RestoPanel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RestoPanel está diseñado para restaurantes independientes y grupos hosteleros; negocios de ocio nocturno (discotecas, clubs, beach clubs, festivales); y hoteles con F&B, rooftops, bares y restaurantes internos.",
        },
      },
      {
        "@type": "Question",
        name: "¿Necesito formación para usarlo?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. La interfaz está pensada para personal de sala y de puerta. El onboarding es guiado: configuramos contigo tu plano de sala, tus turnos y tus canales en la primera sesión.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo se integra con mis canales actuales?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RestoPanel centraliza reservas que llegan de tu web propia, Google Maps, Instagram, Facebook, WhatsApp y teléfono. La disponibilidad se sincroniza en tiempo real entre todos los canales.",
        },
      },
      {
        "@type": "Question",
        name: "¿En qué idiomas está disponible la interfaz?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "La interfaz principal está en español. Próximamente: inglés y portugués de Brasil para locales con personal internacional o turista extranjero.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo se gestionan los datos y la privacidad de mis clientes?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Los datos de tus clientes viven en tu propia base de datos dentro de RestoPanel. Nunca se comparten con terceros ni se venden a OTAs. Cumplimos con el RGPD.",
        },
      },
      {
        "@type": "Question",
        name: "¿Puedo usarlo sólo para eventos o sólo para reservas de restaurante?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. RestoPanel es modular. Activa solo los módulos que necesitas: RestoBookings para reservas, RestoNight para eventos y ocio nocturno, o RestoCRM para fidelización.",
        },
      },
    ],
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RestoPanel",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Software de reservas y gestión para restaurantes y ocio nocturno. Centraliza reservas, reduce no-shows y fideliza clientes con CRM propio.",
    offers: {
      "@type": "Offer",
      price: "29",
      priceCurrency: "EUR",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
