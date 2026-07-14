import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://restopanel.es"),
  title: "RestoPanel · Software de Reservas y CRM para Restaurantes",
  description: "Software de reservas para restaurantes sin comisiones. CRM, plano de mesas inteligente, Google Reviews, turnos de personal y analíticas. Control total de tu restaurante en un solo panel.",
  keywords: [
    "software de reservas para restaurantes",
    "sistema de reservas online sin comisiones",
    "CRM para hostelería",
    "plano de mesas inteligente",
    "software para cadenas de restaurantes",
    "analíticas para restaurantes",
    "gestión de reservas",
    "software gestión restaurante",
  ],
  openGraph: {
    title: "RestoPanel · Software de Reservas y CRM para Restaurantes",
    description: "Sin comisiones por reserva. CRM, mesas, analíticas y reputación en un panel. Datos 100% tuyos.",
    type: "website",
    locale: "es_ES",
    siteName: "RestoPanel",
  },
  twitter: {
    card: "summary_large_image",
    title: "RestoPanel · Software de Reservas para Restaurantes",
    description: "Sin comisiones por reserva. CRM, mesas, analíticas y reputación en un panel.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://restopanel.es/landing" },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
