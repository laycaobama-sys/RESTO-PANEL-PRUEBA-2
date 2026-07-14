import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RestoPanel · Software de Reservas para Restaurantes | Alternativa a CoverManager",
  description: "El sistema operativo que llena tus mesas y elimina los no-shows. IA predictiva, automatización de WhatsApp, CRM inteligente, fidelización y revenue management. Cero comisiones por reserva. Prueba gratis 7 días.",
  keywords: [
    "software de reservas para restaurantes",
    "alternativa a CoverManager",
    "sistema de reservas",
    "gestión de sala y mesas",
    "CRM restaurante",
    "WhatsApp Business restaurante",
    "fidelización clientes restaurante",
    "revenue management hostelero",
    "motor de reservas IA",
    "no-shows restaurante",
  ],
  openGraph: {
    title: "RestoPanel · Software de Reservas para Restaurantes",
    description: "Cero comisiones por reserva. IA predictiva, WhatsApp automatizado, CRM inteligente. Prueba gratis 7 días.",
    type: "website",
    locale: "es_ES",
    siteName: "RestoPanel",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "RestoPanel — Software de reservas para restaurantes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RestoPanel · Software de Reservas para Restaurantes",
    description: "Cero comisiones por reserva. IA predictiva, WhatsApp, CRM. Prueba gratis 7 días.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: "https://restopanel.es/landing",
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
