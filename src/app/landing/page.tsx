import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "RestoPanel · Software de reservas y gestión para restaurantes",
  description:
    "Software todo-en-uno para restaurantes: reservas online, carta digital, plano de mesas, POS, cocina (KDS) y analíticas. Prueba gratis. Sin comisiones por reserva.",
  keywords: [
    "software de reservas para restaurantes",
    "gestión de restaurantes",
    "carta digital",
    "POS restaurante",
    "plano de mesas",
    "sistema de reservas online",
    "software de hostelería",
    "KDS cocina",
    "multi-tenant restaurantes",
    "reservas online España",
  ],
  authors: [{ name: "RestoPanel" }],
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "RestoPanel · Software de reservas y gestión para restaurantes",
    description:
      "El panel de control que tu restaurante necesita: reservas, carta, mesas, cocina y analíticas en una sola plataforma. Cuenta demo gratuita.",
    type: "website",
    locale: "es_ES",
    siteName: "RestoPanel",
  },
  twitter: {
    card: "summary_large_image",
    title: "RestoPanel · Software para restaurantes",
    description:
      "Reservas online, carta digital, plano de mesas y POS en una sola plataforma.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return <LandingPage />;
}
