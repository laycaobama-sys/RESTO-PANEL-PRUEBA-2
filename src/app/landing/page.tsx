import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "RestoPanel · Software de reservas y gestión para restaurantes y ocio nocturno",
  description:
    "Centraliza reservas de web, Google, Instagram, WhatsApp y teléfono en un solo panel. Reduce no-shows con reconfirmación automática, gestiona mesas, eventos y listas VIP. CRM propio, analítica en tiempo real. Sin intermediarios.",
  keywords: [
    "software de reservas para restaurantes",
    "sistema de reservas online para hostelería",
    "CRM para restaurantes y discotecas",
    "gestor de reservas para ocio nocturno",
    "centralizar reservas en un único panel",
    "cola virtual para restaurantes y clubs",
    "reducir no-shows en restaurantes",
    "fidelización de clientes en hostelería",
    "software de gestión de experiencias gastronómicas",
    "motor de reservas",
    "libro de reservas online",
    "panel de control de reservas",
    "software de hostelería",
    "reservas digitales",
  ],
  authors: [{ name: "RestoPanel" }],
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "RestoPanel · El panel de control de tu sala y tu noche",
    description:
      "Reservas, mesas, no-shows, CRM, eventos y analítica en una sola plataforma. Para restaurantes, discotecas, clubs y hoteles. Crea tu cuenta y empieza hoy.",
    type: "website",
    locale: "es_ES",
    siteName: "RestoPanel",
  },
  twitter: {
    card: "summary_large_image",
    title: "RestoPanel · Software de reservas para hostelería y ocio nocturno",
    description:
      "Centraliza reservas, reduce no-shows y fideliza clientes con datos propios. Sin intermediarios.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return <LandingPage />;
}
