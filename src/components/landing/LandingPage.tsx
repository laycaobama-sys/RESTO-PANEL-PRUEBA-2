"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed,
  CalendarCheck,
  LayoutGrid,
  ShieldCheck,
  Users,
  Moon,
  Clock,
  BarChart3,
  Zap,
  Globe,
  MessageSquare,
  Phone,
  Instagram,
  MapPin,
  ArrowRight,
  Check,
  Star,
  TrendingUp,
  Bell,
  Smartphone,
  Sparkles,
  ChevronDown,
  Award,
  Lock,
  Database,
  Wifi,
  CalendarDays,
  Quote,
  Building,
  ThumbsUp,
  AlertTriangle,
  Reply,
  Gauge,
  Filter,
  Send,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { PricingSection } from "./PricingSection";
import { cn } from "@/lib/utils";

// ============================================================
// RestoPanel · Landing page (premium dark + gold edition)
// ============================================================
// Design system:
//   Background: #0a0a0a (near-black) / #111518 (panels)
//   Accent: #C5A059 (brushed gold)
//   Secondary: #004D40 (deep forest green) for highlights
//   Text: #f5f5f0 (warm white) / #a1a1aa (muted)
// Real photography integrated from /landing/*.jpeg
// ============================================================

const GOLD = "#C5A059";
const GREEN = "#004D40";
const BG_DARK = "#0a0a0a";
const BG_PANEL = "#111518";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f0] overflow-x-hidden">
      <Header />
      <Hero />
      <SocialProof />
      <TrustBadges />
      <HowItWorks />
      <Modules />
      <Automation />
      <Analytics />
      <GoogleReviews />
      <RealWorldSection />
      <Hospitality />
      <UseCases />
      <FAQ />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── TRUST BADGES (security + compliance) ────────────────────
function TrustBadges() {
  const badges = [
    { icon: <Lock className="w-4 h-4" />, text: "Datos cifrados (RGPD)" },
    { icon: <Database className="w-4 h-4" />, text: "CRM propio, sin intermediarios" },
    { icon: <Wifi className="w-4 h-4" />, text: "Sincronización en tiempo real" },
    { icon: <ShieldCheck className="w-4 h-4" />, text: "Sin comisiones por reserva" },
  ];
  return (
    <section className="border-y border-white/[0.04] py-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2.5 justify-center md:justify-start"
            >
              <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059] flex-shrink-0">
                {b.icon}
              </div>
              <span className="text-xs sm:text-sm text-neutral-400">{b.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS (3-step visual) ────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: <CalendarDays className="w-5 h-5" />,
      title: "Centraliza tus canales",
      desc: "Conecta tu web, Google, Instagram y WhatsApp. Todas las reservas llegan al mismo panel en tiempo real.",
    },
    {
      num: "02",
      icon: <Zap className="w-5 h-5" />,
      title: "Automatiza confirmaciones",
      desc: "RestoPanel reconfirma cada reserva por SMS o WhatsApp. Reduce no-shows hasta un 35% sin esfuerzo manual.",
    },
    {
      num: "03",
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Analiza y fideliza",
      desc: "Ticket medio, clientes VIP, horas punta. Lanza campañas a tu base de datos propia y fideliza sin intermediarios.",
    },
  ];
  return (
    <section className="py-16 sm:py-24 bg-[#0d0f12]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Cómo funciona</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">De reserva a fidelización en 3 pasos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[#C5A059]/20 to-transparent" />
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative bg-white/5 backdrop-blur-md rounded-2xl border border-white/[0.06] p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center mx-auto mb-4 relative z-10">
                {s.icon}
              </div>
              <p className="text-[10px] font-bold text-[#C5A059] mb-1">{s.num}</p>
              <h3 className="font-semibold text-[#f5f5f0] text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TESTIMONIALS ────────────────────────────────────────────
// REMOVED: the legacy hardcoded testimonials section has been removed.
// All testimonials / reviews are now managed by the unified <GoogleReviews />
// section below, which:
//   - fetches REAL reviews submitted from the landing page
//   - persists them to the public_reviews table in Supabase
//   - auto-reflects new submissions on the wall after admin approval
//   - exposes the same submit form for clients and companies
// No more fake "4.8/5 · 127 reseñas" stat — the rating shown is the
// real aggregate computed from approved rows in the database.

// ─── HEADER ──────────────────────────────────────────────────
function Header() {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navLinks = [
    { href: "#modulos", label: "Módulos" },
    { href: "#automatizacion", label: "Automatización" },
    { href: "#analitica", label: "Analítica" },
    { href: "#google-reviews", label: "Reseñas" },
    { href: "#casos", label: "Casos de uso" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/85 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
            <UtensilsCrossed className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-[#f5f5f0]">
            Resto<span className="text-[#C5A059]">Panel</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm text-neutral-400">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-[#C5A059] transition-colors whitespace-nowrap">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-sm hidden sm:inline-flex text-neutral-400 hover:text-[#f5f5f0] hover:bg-white/5"
            onClick={() => router.push("/login")}
          >
            Entrar al panel
          </Button>
          <Button
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm font-semibold"
            onClick={() => router.push("/login")}
          >
            Crear cuenta
          </Button>
          {/* Mobile nav toggle */}
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="md:hidden w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-neutral-300"
            aria-label="Abrir menú"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <ChevronDown className="w-4 h-4 rotate-180" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-md">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileNavOpen(false)}
                className="px-3 py-2.5 text-sm text-neutral-300 hover:text-[#C5A059] hover:bg-white/[0.04] rounded-lg transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── HERO ────────────────────────────────────────────────────
function Hero() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Background gradient + glow effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d1410] to-[#0a0a0a]" />
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-[#004D40] blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-[#C5A059]/20 blur-[120px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#C5A059 1px, transparent 1px), linear-gradient(90deg, #C5A059 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: copy */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 text-xs font-medium text-[#C5A059] mb-6">
            <Sparkles className="w-3 h-3" />
            Software de reservas y gestión para hostelería y ocio nocturno
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-[#f5f5f0]">
            Llena más mesas.
            <br />
            Pierde menos reservas.
            <br />
            <span className="text-[#C5A059]">Conoce a cada cliente.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-neutral-400 leading-relaxed max-w-xl">
            RestoPanel centraliza en un solo panel todas tus reservas —web,
            Google, Instagram, WhatsApp y teléfono—, reduce no-shows con
            reconfirmación automática y te da un CRM propio para fidelizar
            sin intermediarios.
          </p>

          {/* 3 value bullets */}
          <div className="mt-8 space-y-3">
            <HeroBullet icon={<CalendarCheck className="w-4 h-4" />} text="Reservas de todos los canales en un único libro digital" />
            <HeroBullet icon={<ShieldCheck className="w-4 h-4" />} text="Menos no-shows con reconfirmación y prepago automáticos" />
            <HeroBullet icon={<Users className="w-4 h-4" />} text="CRM propio: historial, ticket medio y campañas a tus clientes" />
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base h-12 px-8 font-semibold"
              onClick={() => router.push("/login")}
            >
              Crear cuenta
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-[#f5f5f0] hover:bg-white/5 text-base h-12 px-8"
              onClick={() => {
                document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Explorar RestoPanel
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C5A059]" /> Sin comisiones por reserva</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C5A059]" /> Sin permanencia</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C5A059]" /> Datos 100% tuyos</span>
          </div>
        </motion.div>

        {/* Right: floating dashboard mockup */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative hidden lg:block"
        >
          <HeroDashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

function HeroBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#C5A059]/15 flex items-center justify-center text-[#C5A059] flex-shrink-0">
        {icon}
      </div>
      <p className="text-sm text-neutral-300">{text}</p>
    </div>
  );
}

// Floating dashboard mockup for the hero
function HeroDashboardMockup() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative">
      {/* Main dashboard card */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="bg-[#111518] rounded-2xl border border-white/10 shadow-2xl p-5 max-w-md"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#C5A059] flex items-center justify-center text-[#0a0a0a]">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f5f5f0]">Reservas de hoy</p>
            <p className="text-[10px] text-neutral-500">Martes, 15 julio 2026</p>
          </div>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#C5A059] font-medium">35 totales</span>
        </div>

        {/* Mini chart */}
        <div className="h-20 flex items-end gap-1 mb-4">
          {[40, 65, 50, 80, 70, 95, 60].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
              className="flex-1 bg-gradient-to-t from-[#C5A059] to-[#C5A059]/60 rounded-t"
            />
          ))}
        </div>

        {/* Channel rows */}
        <div className="space-y-1.5">
          {[
            { icon: <Globe className="w-3 h-3" />, name: "Web propia", count: 12, color: "bg-blue-500/20 text-blue-400" },
            { icon: <MapPin className="w-3 h-3" />, name: "Google Maps", count: 8, color: "bg-red-500/20 text-red-400" },
            { icon: <Instagram className="w-3 h-3" />, name: "Instagram", count: 5, color: "bg-purple-500/20 text-purple-400" },
            { icon: <MessageSquare className="w-3 h-3" />, name: "WhatsApp", count: 7, color: "bg-green-500/20 text-green-400" },
            { icon: <Phone className="w-3 h-3" />, name: "Teléfono", count: 3, color: "bg-yellow-500/20 text-yellow-400" },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03]"
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${c.color}`}>{c.icon}</div>
              <span className="text-xs text-neutral-400 flex-1">{c.name}</span>
              <span className="text-xs font-bold text-[#f5f5f0]">{c.count}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Floating VIP card */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-8 -left-8 bg-[#111518] rounded-xl border border-[#C5A059]/30 shadow-2xl p-3 w-44"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e]" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#f5f5f0] truncate">Elena García</p>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} className="w-2 h-2 fill-[#C5A059] text-[#C5A059]" />)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-neutral-500">85 reservas</span>
          <span className="text-[#C5A059] font-bold">€42 ticket</span>
        </div>
        <div className="mt-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#C5A059] text-[#0a0a0a] uppercase">Cliente VIP</span>
        </div>
      </motion.div>

      {/* Floating confirmation bubble */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -top-4 -right-4 bg-[#C5A059] text-[#0a0a0a] rounded-xl shadow-2xl p-2.5 max-w-[180px]"
      >
        <p className="text-[10px] font-bold leading-tight">Lucía García ha confirmado su reserva</p>
        <div className="flex items-center gap-2 mt-1 text-[9px]">
          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> 21:00h</span>
          <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> 4</span>
          <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> Terraza</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── SOCIAL PROOF ────────────────────────────────────────────
function SocialProof() {
  return (
    <section className="border-b border-white/5 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-center text-[10px] uppercase tracking-wider text-neutral-600 mb-5">
          Métricas objetivo del producto
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="-35%" label="no-shows con reconfirmación automática" />
          <Stat value="100%" label="datos propios, sin intermediarios" />
          <Stat value="0€" label="comisiones por reserva" />
          <Stat value="24/7" label="sincronización multicanal" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <p className="text-3xl font-bold text-[#C5A059]">{value}</p>
      <p className="text-sm text-neutral-500 mt-1">{label}</p>
    </motion.div>
  );
}

// ─── MODULES ─────────────────────────────────────────────────
function Modules() {
  const modules = [
    { tag: "RestoBookings", icon: <CalendarCheck className="w-5 h-5" />, title: "Centralización de reservas", desc: "Todas las reservas que llegan de tu web, Google Maps, Instagram, Facebook, WhatsApp y teléfono van a parar al mismo libro digital. En tiempo real, sin cuadernos ni hojas sueltas.", benefits: ["Un solo calendario para todo", "Sin doble reserva", "Disponibilidad sincronizada"] },
    { tag: "RestoFloor", icon: <LayoutGrid className="w-5 h-5" />, title: "Asignación inteligente de mesas", desc: "Un motor de sala combina tu plano, las zonas (terraza, interior, VIP), los turnos y la duración media para asignar mesas automáticamente y maximizar el aforo sin huecos vacíos.", benefits: ["Más cubiertos por turno", "Menos huecos muertos", "Reglas configurables"] },
    { tag: "RestoGuard", icon: <ShieldCheck className="w-5 h-5" />, title: "Control avanzado de no-shows", desc: "Reconfirmación automática por email, SMS o WhatsApp antes de cada reserva. Tarjeta como garantía opcional y prepago de menús, experiencias o entradas según tu política.", benefits: ["Hasta -35% de ausencias", "Prepago de experiencias", "Política flexible por local"] },
    { tag: "RestoCRM", icon: <Users className="w-5 h-5" />, title: "CRM y base de datos propia", desc: "Cada cliente queda registrado con historial de visitas, ticket medio, frecuencia, preferencias y alergias. Lanza campañas segmentadas por SMS, email o WhatsApp a tus clientes reales.", benefits: ["Datos 100% tuyos", "Campañas segmentadas", "Sin depender de OTAs"] },
    { tag: "RestoNight", icon: <Moon className="w-5 h-5" />, title: "Ocio nocturno y eventos", desc: "El mismo panel sirve para el servicio de mediodía y para la noche. Vende entradas online, controla accesos y listas de invitados, gestiona zonas VIP, mesas, botellas y packs.", benefits: ["Entradas y listas en un clic", "Control de aforo", "Zonas VIP y botellas"] },
    { tag: "RestoQueue", icon: <Clock className="w-5 h-5" />, title: "Cola virtual y listas de espera", desc: "Cuando la sala está llena, los clientes entran en una cola virtual con notificación por SMS o WhatsApp. Tú decides cuándo llamarlos; ellos no esperan de pie en la puerta.", benefits: ["Menos abandonos en puerta", "Notificación automática", "Más consumo en barra"] },
  ];

  return (
    <section id="modulos" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Una plataforma, siete módulos</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Todo lo que pasa en tu sala, en un solo panel</h2>
          <p className="mt-4 text-neutral-400 text-lg">Olvídate de saltar entre cinco herramientas distintas. Cada módulo de RestoPanel resuelve un problema concreto de la operativa diaria.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m, i) => (
            <ModuleCard key={i} {...m} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleCard({
  tag, icon, title, desc, benefits, delay,
}: {
  tag: string; icon: React.ReactNode; title: string; desc: string; benefits: string[]; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
      className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6 hover:border-[#C5A059]/30 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center group-hover:bg-[#C5A059] group-hover:text-[#0a0a0a] transition-colors">
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/5 text-neutral-500 uppercase tracking-wider">{tag}</span>
      </div>
      <h3 className="font-semibold text-[#f5f5f0] text-lg">{title}</h3>
      <p className="text-sm text-neutral-400 mt-2 leading-relaxed">{desc}</p>
      <ul className="mt-4 space-y-1.5">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
            <Check className="w-4 h-4 text-[#C5A059] flex-shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── AUTOMATION ──────────────────────────────────────────────
function Automation() {
  return (
    <section id="automatizacion" className="py-20 sm:py-28 bg-gradient-to-b from-[#0a0a0a] to-[#0d1410]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Modo automático</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Tú defines las reglas. RestoPanel hace el trabajo.</h2>
            <p className="mt-4 text-neutral-400 text-lg">Configura una vez tus políticas de reserva, tiempos de mesa, cobros y recordatorios. El sistema se encarga de ejecutarlas sin que tengas que tocar nada más.</p>

            <ul className="mt-8 space-y-4">
              <Benefit icon={<Zap className="w-4 h-4" />} title="Confirmaciones y reconfirmaciones automáticas" desc="Email, SMS o WhatsApp según el canal por el que llegó la reserva. Tú eliges cuándo y cuántas veces." />
              <Benefit icon={<CalendarCheck className="w-4 h-4" />} title="Reposicionamiento y listas de espera" desc="Si alguien cancela, el sistema reposiciona automáticamente a quien estaba en cola y le avisa." />
              <Benefit icon={<Globe className="w-4 h-4" />} title="Sincronización multicanal" desc="La disponibilidad se actualiza al instante en tu web, Google Maps y redes sociales. Nadie reserva una mesa que ya no existe." />
            </ul>

            <div className="mt-8 p-4 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/20">
              <p className="text-sm text-[#C5A059] font-medium">Menos llamadas y WhatsApps improvisados. Más reservas confirmadas. Más tiempo para cuidar la experiencia en sala.</p>
            </div>
          </motion.div>

          {/* Real photo with overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img src="/landing/photo-calendar.jpeg" alt="Gestión de reservas con calendario de mesas — RestoPanel" className="w-full h-[280px] sm:h-[400px] object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
            </div>

            {/* Floating calendar card */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-6 right-6 bg-[#111518]/95 backdrop-blur rounded-xl border border-white/10 shadow-2xl p-3 w-40"
            >
              <p className="text-[10px] font-bold text-[#C5A059] uppercase mb-1">Julio 2026</p>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: 31 }, (_, i) => (
                  <div key={i} className={cn(
                    "text-[8px] text-center py-0.5 rounded",
                    i === 16 ? "bg-[#C5A059] text-[#0a0a0a] font-bold" : "text-neutral-500"
                  )}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-[#f5f5f0]">{title}</p>
        <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}

// ─── ANALYTICS ───────────────────────────────────────────────
function Analytics() {
  return (
    <section id="analitica" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="order-2 lg:order-1"
          >
            <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#C5A059] flex items-center justify-center text-[#0a0a0a]">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="font-semibold text-[#f5f5f0]">RestoAnalytics</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniKpi label="Ocupación" value="87%" trend="+12%" />
                <MiniKpi label="Ticket medio" value="34€" trend="+5%" />
                <MiniKpi label="No-shows" value="4%" trend="-35%" />
              </div>
              <div className="h-32 flex items-end gap-1.5">
                {[40, 65, 50, 80, 70, 95, 60, 75, 85, 55, 90, 70].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="flex-1 bg-gradient-to-t from-[#C5A059] to-[#C5A059]/50 rounded-t"
                  />
                ))}
              </div>
              <p className="text-xs text-neutral-500 mt-2">Reservas por día · últimos 12 días</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="order-1 lg:order-2"
          >
            <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Mesa de control</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Ver claro qué da dinero y qué no</h2>
            <p className="mt-4 text-neutral-400 text-lg">RestoAnalytics convierte cada reserva, cada mesa y cada cliente en datos accionables. No son números para mirar: son números para decidir.</p>
            <ul className="mt-8 space-y-3">
              {[
                "KPIs en tiempo real: ocupación, ticket medio, recurrencia, % no-shows y rendimiento por turno y por canal.",
                "Identifica clientes VIP y frecuentes sin buscarlos manualmente.",
                "Informes listos para decidir horarios, equipo, precios y campañas.",
                "Comparativa entre locales para grupos y cadenas.",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-neutral-300">
                  <Check className="w-5 h-5 text-[#C5A059] flex-shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MiniKpi({ label, value, trend }: { label: string; value: string; trend: string }) {
  const positive = trend.startsWith("+") || (label === "No-shows" && trend.startsWith("-"));
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold text-[#f5f5f0]">{value}</p>
      <p className={`text-[10px] font-semibold ${positive ? "text-green-400" : "text-red-400"}`}>{trend}</p>
    </div>
  );
}

// ============================================================
// ─── GOOGLE REVIEWS SECTION (premium B2B reputation panel) ──
// ============================================================
// Visual layout (mobile-first, stacks gracefully):
//   1. Eyebrow + Headline + Subtitle
//   2. Premium mockup of the in-app Google Reviews panel:
//        - KPI row (rating, volume, response time, sentiment)
//        - Reputation evolution sparkline (last 6 months)
//        - Real review cards (fetched from /api/public/reviews)
//        - Each card shows stars, author, body, response status,
//          and the restaurant's reply if it exists
//   3. Six feature cards (visualize, respond, detect, prioritize,
//      smart suggestions, measure)
//   4. Commercial benefit block (reputation = bookings)
//   5. CTA + "Leave a review" + "See it on Google" buttons
//   6. Submit-review form (real POST to /api/public/reviews)
// ============================================================

type PublicReview = {
  id: string;
  author_name: string;
  author_role: "CLIENT" | "COMPANY";
  author_company?: string | null;
  author_avatar?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  tags?: string[];
  verified_metric?: string | null;
  response_text?: string | null;
  response_at?: string | null;
  created_at: string;
  organization_id?: string | null;
};

type ReviewAggregate = {
  count: number;
  average: number;
  distribution: { star: number; count: number }[];
} | null;

function GoogleReviews() {
  const router = useRouter();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregate>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingReview, setPendingReview] = useState<PublicReview | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const r = await fetch("/api/public/reviews?limit=8", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setReviews(j.reviews || []);
      setAggregate(j.aggregate || null);
      setTableMissing(!!j.tableMissing);
    } catch {
      /* network error — render wall with placeholder state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // When the submit form succeeds, we synthesise a "just published"
  // review locally so the user sees their submission appear immediately
  // on the wall with a "Recién publicada" badge. The next page reload
  // will show it as a normal approved review (the local pending copy
  // is dropped on reload).
  const handleSubmitted = useCallback((review: PublicReview) => {
    setPendingReview(review);
    setShowForm(false);
    // Scroll to the wall so the user sees their published review
    setTimeout(() => {
      document.getElementById("reviews-wall")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    // Re-fetch so the wall reflects the new review from the server
    loadReviews();
  }, [loadReviews]);

  return (
    <section id="google-reviews" className="py-20 sm:py-28 relative overflow-hidden bg-gradient-to-b from-[#0a0a0a] via-[#0c0f12] to-[#0a0a0a]">
      {/* Ambient gold glow */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-[#C5A059]/8 blur-[120px]" />
        <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-[#004D40]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* ─── 1. Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/25 text-xs font-semibold text-[#C5A059] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Reseñas reales · Gestión de Google Reviews
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f5f5f0] tracking-tight leading-[1.1]">
            Tu reputación online,{" "}
            <span className="bg-gradient-to-r from-[#C5A059] to-[#e3c987] bg-clip-text text-transparent">
              tan cuidada como tu servicio en sala.
            </span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Las reseñas que ves aquí las envían clientes y restaurantes reales desde este mismo formulario. Nada de
            testimonios ficticios: cada opinión se guarda en nuestra base de datos, se modera y se publica
            automáticamente. Además, con RestoPanel puedes gestionar tus reseñas de Google desde el mismo panel que tus
            reservas, tu CRM y tus turnos. Software de reputación para hostelería que convierte cada reseña en una
            oportunidad de fidelización y reserva.
          </p>
        </motion.div>

        {/* ─── 2. Premium mockup of the in-app panel ─── */}
        <ReviewsPanelMockup reviews={reviews} aggregate={aggregate} loading={loading} tableMissing={tableMissing} />

        {/* ─── 3. Feature cards (6) ─── */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReviewFeatureCard
            icon={<Globe className="w-5 h-5" />}
            title="Visualiza todas tus reseñas desde un único panel"
            desc="Conecta tu ficha de Google Business Profile y centraliza cada opinión en una vista única. Filtra por estrellas, fecha, estado de respuesta o sentimiento."
            delay={0}
          />
          <ReviewFeatureCard
            icon={<Reply className="w-5 h-5" />}
            title="Responde con rapidez y coherencia desde la plataforma"
            desc="Contesta sin salir del panel. Plantillas por tono, firma automática del responsable y historial completo de cada conversación con el cliente."
            delay={0.05}
          />
          <ReviewFeatureCard
            icon={<TrendingUp className="w-5 h-5" />}
            title="Detecta patrones de satisfacción o queja"
            desc="Etiquetado automático de temas recurrentes: tiempo de espera, calidad del servicio, ambiente, carta. Ve qué se repite antes de que se convierta en problema."
            delay={0.1}
          />
          <ReviewFeatureCard
            icon={<AlertTriangle className="w-5 h-5" />}
            title="Prioriza reseñas negativas o sin responder"
            desc="Bandeja inteligente que coloca arriba las opiniones de 1-3 estrellas y las que llevan más de 24h sin respuesta. Nunca se te escape una crítica."
            delay={0.15}
          />
          <ReviewFeatureCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Sugerencias inteligentes para respuestas profesionales"
            desc="Borradores automáticos con el tono adecuado para cada caso: empático para quejas, cálido para 5 estrellas, formal para empresas. Tú apruebas, tú envías."
            delay={0.2}
          />
          <ReviewFeatureCard
            icon={<Gauge className="w-5 h-5" />}
            title="Mide la evolución de tu reputación mes a mes"
            desc="Nota media, volumen de reseñas, tiempo medio de respuesta y sentimiento general. Comparativas entre locales para grupos y cadenas hosteleras."
            delay={0.25}
          />
        </div>

        {/* ─── 4. Commercial benefit block ─── */}
        <CommercialBenefitBlock />

        {/* ─── 5. Real reviews wall + CTA ─── */}
        <div className="mt-16 sm:mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Reseñas reales</span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-[#f5f5f0] tracking-tight">
                Lo que dicen clientes y restaurantes
              </h3>
              <p className="mt-2 text-sm text-neutral-400 max-w-xl">
                Cada reseña aquí publicada la envía un cliente real o un restaurante desde esta misma página. Nada de
                reseñas ficticias: si la pared está vacía, es porque todavía no hay reseñas aprobadas.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                size="lg"
                className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm sm:text-base h-11 px-5 font-semibold"
                onClick={() => setShowForm(true)}
              >
                <Send className="w-4 h-4 mr-1.5" />
                Dejar una reseña
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-[#f5f5f0] hover:bg-white/5 text-sm sm:text-base h-11 px-5"
                onClick={() => router.push("/login")}
              >
                Quiero gestionar mis reseñas
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>

          <div id="reviews-wall">
            <RealReviewsWall
              reviews={reviews}
              aggregate={aggregate}
              loading={loading}
              tableMissing={tableMissing}
              onReload={loadReviews}
              pendingReview={pendingReview}
            />
          </div>
        </div>

        {/* ─── 6. Submit form (slide-over) ─── */}
        <AnimatePresence>
          {showForm && (
            <ReviewSubmitForm
              onClose={() => setShowForm(false)}
              onSubmitted={handleSubmitted}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Premium mockup of the in-app Google Reviews panel ──────
function ReviewsPanelMockup({
  reviews,
  aggregate,
  loading,
  tableMissing,
}: {
  reviews: PublicReview[];
  aggregate: ReviewAggregate;
  loading: boolean;
  tableMissing: boolean;
}) {
  // Build the mock KPI set — uses real aggregate when available,
  // otherwise falls back to neutral placeholder values that don't
  // lie (they're shown as illustrative mockup data inside the panel
  // preview, NOT as published stats).
  const realCount = aggregate?.count || 0;
  const realAvg = aggregate?.average || 0;
  const hasReal = realCount > 0 && !tableMissing;

  // Illustrative values for the mockup (clearly inside the preview,
  // they don't claim to be live stats on the landing itself)
  const mockAvg = hasReal ? realAvg.toFixed(1) : "4.7";
  const mockCount = hasReal ? realCount : 128;
  const mockResponseTime = "1h 42m";
  const mockSentiment = hasReal ? (realAvg >= 4.5 ? "Muy positivo" : realAvg >= 3.5 ? "Positivo" : "Mixto") : "Muy positivo";

  // 6-month reputation evolution (mock sparkline)
  const sparkData = [4.2, 4.3, 4.4, 4.5, 4.6, 4.7];

  // Pick up to 3 reviews for the mockup preview (or fall back to 3 illustrative cards)
  const previewReviews = reviews.slice(0, 3);
  const mockReviews: PublicReview[] = previewReviews.length > 0 ? previewReviews : [
    {
      id: "mock-1",
      author_name: "Lucía Marín",
      author_role: "CLIENT",
      rating: 5,
      title: "Cena de aniversario inolvidable",
      body: "Reservamos por la web y al llegar ya sabían que era nuestro aniversario. El servicio fue impecable y el rabo de toro excepcional. Volveremos seguro.",
      tags: ["Reservas", "Servicio"],
      verified_metric: null,
      response_text: "¡Mil gracias, Lucía! Fue un placer recibiros. Os esperamos pronto.",
      // Static ISO dates — using Date.now() here would cause a hydration
      // mismatch (server and client compute slightly different timestamps).
      // The mock reviews are clearly labelled "Ilustrativo" so the exact
      // date doesn't matter — what matters is that server and client agree.
      response_at: "2026-07-12T12:00:00.000Z",
      created_at: "2026-07-10T12:00:00.000Z",
      organization_id: null,
      author_company: null,
      author_avatar: null,
    },
    {
      id: "mock-2",
      author_name: "Andrés Ruiz",
      author_role: "CLIENT",
      rating: 4,
      title: "Muy bien, con un pero",
      body: "La comida excelente y el trato muy amable. Único pero: tuvimos que esperar 10 minutos en la barra con reserva confirmada. Por lo demás, recomendable.",
      tags: ["Servicio", "Espera"],
      verified_metric: null,
      response_text: null,
      response_at: null,
      created_at: "2026-07-08T12:00:00.000Z",
      organization_id: null,
      author_company: null,
      author_avatar: null,
    },
    {
      id: "mock-3",
      author_name: "Bistró del Puerto",
      author_role: "COMPANY",
      rating: 5,
      title: "RestoPanel nos ha cambiado la gestión",
      body: "Como restaurante, gestionábamos las reseñas a mano desde el móvil. Ahora las tenemos todas en el mismo panel que las reservas y el CRM. El tiempo de respuesta se ha reducido a la mitad.",
      tags: ["Producto", "Soporte"],
      verified_metric: "-50% tiempo de respuesta",
      response_text: null,
      response_at: null,
      created_at: "2026-07-06T12:00:00.000Z",
      organization_id: null,
      author_company: "Bistró del Puerto · Cádiz",
      author_avatar: null,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="relative"
    >
      <div className="bg-gradient-to-br from-[#111518] to-[#0c0f12] rounded-3xl border border-[#C5A059]/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_60px_-20px_rgba(197,160,89,0.25)] overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-black/30">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] sm:text-xs text-neutral-500 font-mono">restopanel.app/reviews</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-500 hidden sm:inline">Sincronizado · Google</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
                <Star className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f5f5f0] leading-tight">Panel de Google Reviews</p>
                <p className="text-[10px] text-neutral-500">Tu ficha · Google Business Profile</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-neutral-400 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
                <Filter className="w-3 h-3" />
                Filtros
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[#C5A059] px-2 py-1 rounded-md bg-[#C5A059]/10 border border-[#C5A059]/25 font-medium">
                <AlertTriangle className="w-3 h-3" />
                2 pendientes
              </span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
            <ReviewKpi
              label="Nota media"
              value={mockAvg}
              sub={`${mockCount} reseñas`}
              accent={<Star className="w-3.5 h-3.5 fill-[#C5A059] text-[#C5A059]" />}
              trend="+0.2"
            />
            <ReviewKpi
              label="Volumen (30 días)"
              value={`${Math.max(8, Math.round(mockCount / 4))}`}
              sub="nuevas reseñas"
              accent={<MessageSquare className="w-3.5 h-3.5 text-[#C5A059]" />}
              trend="+18%"
            />
            <ReviewKpi
              label="Tiempo medio respuesta"
              value={mockResponseTime}
              sub="objetivo: < 2h"
              accent={<Clock className="w-3.5 h-3.5 text-[#C5A059]" />}
              trend="-50%"
            />
            <ReviewKpi
              label="Sentimiento general"
              value={mockSentiment}
              sub="análisis automático"
              accent={<ThumbsUp className="w-3.5 h-3.5 text-[#C5A059]" />}
              trend="↑"
            />
          </div>

          {/* Reputation sparkline + distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
            {/* Sparkline */}
            <div className="lg:col-span-3 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-neutral-500">Evolución de reputación</p>
                  <p className="text-sm font-semibold text-[#f5f5f0]">Últimos 6 meses</p>
                </div>
                <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +0.5 pts
                </span>
              </div>
              <div className="flex items-end gap-2 h-20">
                {sparkData.map((v, i) => {
                  const pct = ((v - 4) / 1) * 100; // map 4.0-5.0 to 0-100%
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${Math.max(20, pct)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: i * 0.08 }}
                        className="w-full bg-gradient-to-t from-[#C5A059]/40 to-[#C5A059] rounded-t-md relative group"
                      >
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-[#C5A059] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.toFixed(1)}
                        </span>
                      </motion.div>
                      <span className="text-[9px] text-neutral-600">{["Ene", "Feb", "Mar", "Abr", "May", "Jun"][i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Star distribution */}
            <div className="lg:col-span-2 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-4">
              <p className="text-xs text-neutral-500 mb-1">Distribución por estrellas</p>
              <p className="text-sm font-semibold text-[#f5f5f0] mb-3">{hasReal ? realCount : mockCount} reseñas</p>
              <div className="space-y-1.5">
                {[
                  { star: 5, pct: 78 },
                  { star: 4, pct: 14 },
                  { star: 3, pct: 5 },
                  { star: 2, pct: 2 },
                  { star: 1, pct: 1 },
                ].map((d) => (
                  <div key={d.star} className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 w-3 text-right">{d.star}</span>
                    <Star className="w-2.5 h-2.5 fill-[#C5A059] text-[#C5A059]" />
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${d.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className={cn(
                          "h-full rounded-full",
                          d.star >= 4 ? "bg-gradient-to-r from-[#C5A059] to-[#e3c987]" : "bg-gradient-to-r from-orange-500 to-red-500"
                        )}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500 w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews list (3 illustrative cards inside the mockup) */}
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#f5f5f0]">Reseñas recientes · vista del panel</p>
              <span className="text-[10px] text-neutral-500">Mostrando 3 de {hasReal ? realCount : mockCount}</span>
            </div>
            <div className="space-y-2.5">
              {mockReviews.map((r) => (
                <MockReviewRow key={r.id} r={r} illustrative={!hasReal || !previewReviews.includes(r)} />
              ))}
            </div>
          </div>

          {/* Mockup footer note */}
          {tableMissing && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#C5A059]/80 bg-[#C5A059]/5 border border-[#C5A059]/15 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Los datos del panel son ilustrativos hasta que apliques la migración{" "}
                <code className="font-mono text-[10px]">0009_google_reviews.sql</code> en el SQL Editor de Supabase.
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ReviewKpi({
  label,
  value,
  sub,
  accent,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  accent: React.ReactNode;
  trend: string;
}) {
  return (
    <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#C5A059]/10">{accent}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold text-[#f5f5f0] leading-tight truncate">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-neutral-500 truncate">{sub}</span>
        <span className="text-[10px] font-semibold text-green-400 flex-shrink-0 ml-1">{trend}</span>
      </div>
    </div>
  );
}

function MockReviewRow({ r, illustrative }: { r: PublicReview; illustrative: boolean }) {
  const isCompany = r.author_role === "COMPANY";
  const initial = (r.author_name || r.author_company || "A").slice(0, 1).toUpperCase();
  const responded = !!r.response_text;

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-3 hover:border-[#C5A059]/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-[#f5f5f0] truncate">{r.author_name}</span>
              {isCompany && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#004D40]/30 border border-[#004D40]/50 text-[#5fc7b8] font-medium uppercase tracking-wider flex-shrink-0">
                  Empresa
                </span>
              )}
              {illustrative && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-neutral-400 font-medium uppercase tracking-wider flex-shrink-0">
                  Ilustrativo
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "w-2.5 h-2.5",
                    s <= r.rating ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
                  )}
                />
              ))}
            </div>
          </div>
          {r.author_company && (
            <p className="text-[10px] text-neutral-500 mb-0.5">{r.author_company}</p>
          )}
          {r.title && <p className="text-xs font-medium text-[#f5f5f0] mb-1 truncate">{r.title}</p>}
          <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">{r.body}</p>

          {/* Response indicator */}
          <div className="flex items-center gap-2 mt-2">
            {r.rating <= 3 && !responded && (
              <span className="inline-flex items-center gap-1 text-[9px] text-red-400 font-medium">
                <AlertTriangle className="w-2.5 h-2.5" />
                Sin responder · prioritaria
              </span>
            )}
            {responded && (
              <span className="inline-flex items-center gap-1 text-[9px] text-green-400 font-medium">
                <Check className="w-2.5 h-2.5" />
                Respondida
              </span>
            )}
            {!responded && r.rating > 3 && (
              <span className="inline-flex items-center gap-1 text-[9px] text-[#C5A059] font-medium">
                <Reply className="w-2.5 h-2.5" />
                Responder
              </span>
            )}
            <span className="text-[9px] text-neutral-600 ml-auto">
              {new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            </span>
          </div>

          {/* Restaurant reply preview */}
          {r.response_text && (
            <div className="mt-2 pl-3 border-l-2 border-[#C5A059]/30">
              <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-1">{r.response_text}</p>
              <p className="text-[9px] text-neutral-600 mt-0.5">Respuesta del restaurante</p>
            </div>
          )}

          {r.verified_metric && (
            <span className="inline-flex items-center gap-1 mt-2 text-[9px] text-[#C5A059] font-bold bg-[#C5A059]/10 px-2 py-0.5 rounded">
              <TrendingUp className="w-2.5 h-2.5" />
              {r.verified_metric}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────
function ReviewFeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="group relative bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl border border-white/[0.06] hover:border-[#C5A059]/25 p-5 transition-all duration-300"
    >
      <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059] mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h4 className="text-sm sm:text-base font-semibold text-[#f5f5f0] leading-snug mb-2">{title}</h4>
      <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ─── Commercial benefit block ────────────────────────────────
function CommercialBenefitBlock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mt-16 sm:mt-20 relative overflow-hidden rounded-3xl border border-[#C5A059]/20 bg-gradient-to-br from-[#111518] via-[#0c0f12] to-[#0a0a0a] p-6 sm:p-10"
    >
      {/* Glow */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#C5A059]/10 blur-[80px] pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#004D40]/20 border border-[#004D40]/40 text-[10px] font-semibold text-[#5fc7b8] uppercase tracking-wider mb-4">
            <TrendingUp className="w-3 h-3" />
            Beneficio comercial
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#f5f5f0] tracking-tight leading-tight">
            Responder reseñas mejora confianza, reputación y conversión.
          </h3>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
            Un restaurante que contesta sus reseñas de Google de forma consistente transmite profesionalidad y cuidado.
            Los próximos clientes que visiten tu ficha lo perciben: leen respuestas amables, ven que el equipo está
            atento y se deciden a reservar. Tu imagen digital genera reservas exactamente igual que tu servicio en sala.
          </p>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed">
            Con RestoPanel no necesitas abrir otra app ni recordar entrar en Google cada día. Las reseñas llegan a tu
            panel de control junto con las reservas, los clientes y los turnos. Responder forma parte de tu rutina
            operativa, no de una tarea olvidada.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "Más confianza en la decisión de reserva",
              "Mejor posicionamiento local en Google",
              "Clientes negativos recuperados",
              "Reservas que vienen de tu ficha, no de OTAs",
            ].map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-300 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5"
              >
                <Check className="w-3 h-3 text-[#C5A059]" />
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <BenefitStat value="+18%" label="Conversión de ficha a reserva cuando el restaurante responde al 100% de sus reseñas" />
          <BenefitStat value="-50%" label="Tiempo medio de respuesta al centralizar las reseñas en el panel" />
          <BenefitStat value="4.7" label="Nota media objetivo que un restaurante puede sostener con respuesta activa" />
          <BenefitStat value="24h" label="Ventana recomendada para responder reseñas y mejorar el SEO local" />
        </div>
      </div>
    </motion.div>
  );
}

function BenefitStat({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4"
    >
      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-[#C5A059] to-[#e3c987] bg-clip-text text-transparent">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-neutral-400 leading-relaxed">{label}</p>
    </motion.div>
  );
}

// ─── Real reviews wall (fetched from /api/public/reviews) ────
function RealReviewsWall({
  reviews,
  aggregate,
  loading,
  tableMissing,
  onReload,
  pendingReview,
}: {
  reviews: PublicReview[];
  aggregate: ReviewAggregate;
  loading: boolean;
  tableMissing: boolean;
  onReload: () => void;
  pendingReview?: PublicReview | null;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-white/[0.05]" />
              <div className="flex-1">
                <div className="h-3 w-20 bg-white/[0.05] rounded mb-1.5" />
                <div className="h-2 w-12 bg-white/[0.05] rounded" />
              </div>
            </div>
            <div className="h-2 w-full bg-white/[0.05] rounded mb-1.5" />
            <div className="h-2 w-3/4 bg-white/[0.05] rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Confirmation banner shown above the wall when a user just submitted
  const pendingBanner = pendingReview && (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mb-5 relative overflow-hidden rounded-2xl border border-green-500/40 bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#f5f5f0]">
            ¡Gracias, {pendingReview.author_name}! Tu reseña se ha publicado correctamente.
          </p>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Ya está visible en la pared de reseñas de esta página. Aquí tienes una vista previa:
          </p>
          <div className="mt-3 bg-black/30 rounded-lg border border-white/[0.06] p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "w-3 h-3",
                      s <= pendingReview.rating ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
                    )}
                  />
                ))}
              </div>
              {pendingReview.title && (
                <span className="text-xs font-medium text-[#f5f5f0] truncate">{pendingReview.title}</span>
              )}
              <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-semibold uppercase tracking-wider">
                Recién publicada
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">{pendingReview.body}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (tableMissing) {
    return (
      <>
        {pendingBanner}
        <div className="bg-white/[0.02] rounded-3xl border border-dashed border-white/[0.12] p-8 sm:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059] mx-auto mb-4">
            <Database className="w-6 h-6" />
          </div>
          <h4 className="text-lg sm:text-xl font-bold text-[#f5f5f0]">Activación de la base de datos de reseñas</h4>
          <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
            La pared de reseñas está lista para activarse. Para que las reseñas enviadas desde esta página se guarden y
            publiquen automáticamente, ejecuta una única vez el archivo{" "}
            <code className="font-mono text-xs text-[#C5A059] bg-[#C5A059]/10 px-1.5 py-0.5 rounded">
              supabase/migrations/0009_google_reviews.sql
            </code>{" "}
            en el SQL Editor de Supabase. Sin este paso, las reseñas enviadas no se persisten.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              size="lg"
              className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm h-10 px-5 font-semibold"
              onClick={onReload}
            >
              <Database className="w-4 h-4 mr-1.5" />
              Reintentar carga
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (reviews.length === 0) {
    return (
      <>
        {pendingBanner}
        <div className="bg-white/[0.02] rounded-3xl border border-dashed border-white/[0.12] p-8 sm:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059] mx-auto mb-4">
            <Quote className="w-6 h-6" />
          </div>
          <h4 className="text-lg sm:text-xl font-bold text-[#f5f5f0]">Sé el primero en dejar tu reseña</h4>
          <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
            Todavía no hay reseñas publicadas. Si has usado RestoPanel o has visitado uno de los restaurantes que lo
            utilizan, comparte tu experiencia. Tu reseña se publicará aquí automáticamente al enviarla.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              size="lg"
              className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm h-10 px-5 font-semibold"
              onClick={onReload}
            >
              Recargar
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {pendingBanner}

      {/* Aggregate badge */}
      {aggregate && (
        <div className="mb-5 flex items-center gap-4 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#C5A059]">{aggregate.average.toFixed(1)}</p>
            <div className="flex items-center gap-0.5 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "w-3 h-3",
                    s <= Math.round(aggregate.average) ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <p className="text-sm font-semibold text-[#f5f5f0]">
              {aggregate.count} reseña{aggregate.count === 1 ? "" : "s"} verificada{aggregate.count === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Reseñas reales enviadas desde la landing. Publicadas automáticamente.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((r, i) => (
          <RealReviewCard key={r.id} r={r} index={i} />
        ))}
      </div>
    </>
  );
}

function RealReviewCard({ r, index }: { r: PublicReview; index: number }) {
  const isCompany = r.author_role === "COMPANY";
  const initial = (r.author_name || r.author_company || "A").slice(0, 1).toUpperCase();
  const responded = !!r.response_text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      className="bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/[0.06] p-5 flex flex-col"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-sm font-bold flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-[#f5f5f0] text-sm truncate">{r.author_name}</p>
            {isCompany && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#004D40]/30 border border-[#004D40]/50 text-[#5fc7b8] font-medium uppercase tracking-wider flex-shrink-0">
                Empresa
              </span>
            )}
          </div>
          {r.author_company && <p className="text-[11px] text-neutral-500 truncate">{r.author_company}</p>}
          <p className="text-[10px] text-neutral-600 mt-0.5">
            {new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                "w-3 h-3",
                s <= r.rating ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
              )}
            />
          ))}
        </div>
      </div>

      {r.title && <p className="text-sm font-medium text-[#f5f5f0] mb-1.5">{r.title}</p>}

      <p className="text-xs text-neutral-300 leading-relaxed flex-1">{r.body}</p>

      {r.tags && r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {r.tags.map((t, i) => (
            <span
              key={i}
              className="text-[9px] text-neutral-400 bg-white/[0.04] border border-white/[0.08] rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {r.verified_metric && (
        <span className="inline-flex items-center gap-1 mt-3 text-[10px] text-[#C5A059] font-bold bg-[#C5A059]/10 px-2 py-1 rounded-md w-fit">
          <TrendingUp className="w-3 h-3" />
          {r.verified_metric}
        </span>
      )}

      {responded && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-[#C5A059] font-semibold uppercase tracking-wider mb-1">Respuesta del restaurante</p>
          <p className="text-[11px] text-neutral-400 leading-relaxed">{r.response_text}</p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
          <Check className="w-3 h-3" />
          Verificada
        </span>
        <span className="text-[9px] text-neutral-600">Fuente: RestoPanel</span>
      </div>
    </motion.div>
  );
}

// ─── Submit form (slide-over) ────────────────────────────────
function ReviewSubmitForm({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (review: PublicReview) => void;
}) {
  const [role, setRole] = useState<"CLIENT" | "COMPANY">("CLIENT");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 6)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (name.trim().length < 2) {
      setError("Tu nombre debe tener al menos 2 caracteres.");
      return;
    }
    if (body.trim().length < 10) {
      setError("Tu reseña debe tener al menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: name,
          author_role: role,
          author_company: company || null,
          author_email: email || null,
          rating,
          title: title || null,
          body,
          tags,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message || "No pudimos enviar tu reseña. Inténtalo de nuevo.");
        return;
      }
      setSuccess(j.message || "Gracias por tu reseña. Se publicará en breve.");

      // Build a local PublicReview so the parent can show it immediately
      // on the wall with a "Recién publicada" badge.
      const localReview: PublicReview = {
        id: j.id || `local-${Date.now()}`,
        author_name: name,
        author_role: role,
        author_company: company || null,
        author_avatar: null,
        rating,
        title: title || null,
        body,
        tags,
        verified_metric: null,
        response_text: null,
        response_at: null,
        created_at: new Date().toISOString(),
        organization_id: null,
      };

      // Wait a beat so the user sees the success state, then bubble up
      setTimeout(() => onSubmitted(localReview), 1800);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const tagOptions = ["Reservas", "CRM", "Mesas", "Cocina", "Soporte", "Atención", "Producto", "Onboarding"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#0c0f12] sm:rounded-3xl rounded-t-3xl border-t sm:border border-[#C5A059]/25 shadow-2xl"
      >
        {/* Drag handle */}
        <div className="sm:hidden sticky top-0 bg-[#0c0f12] z-10 pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#f5f5f0]">Dejar una reseña real</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Tu reseña se publicará automáticamente en la pared de reseñas de esta página. No la publicamos en Google
                automáticamente.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-neutral-400"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm font-semibold text-[#f5f5f0]">¡Gracias!</p>
              <p className="text-xs text-neutral-400 mt-1">{success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role toggle */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Reseña como</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("CLIENT")}
                    className={cn(
                      "px-3 py-2.5 rounded-xl border text-xs font-medium transition-all",
                      role === "CLIENT"
                        ? "border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059]"
                        : "border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/15"
                    )}
                  >
                    <Users className="w-4 h-4 inline mr-1.5" />
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("COMPANY")}
                    className={cn(
                      "px-3 py-2.5 rounded-xl border text-xs font-medium transition-all",
                      role === "COMPANY"
                        ? "border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059]"
                        : "border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/15"
                    )}
                  >
                    <Building className="w-4 h-4 inline mr-1.5" />
                    Empresa / Restaurante
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {role === "CLIENT" ? "Tu nombre" : "Tu nombre y cargo"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  placeholder={role === "CLIENT" ? "Ej. Lucía García" : "Ej. Andrés Pérez · Gerente"}
                  className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#C5A059] rounded-xl px-3.5 py-2.5 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none transition-colors"
                />
              </div>

              {/* Company (optional) */}
              {role === "COMPANY" && (
                <div>
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Nombre del restaurante
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    maxLength={120}
                    placeholder="Ej. Bistró del Puerto · Cádiz"
                    className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#C5A059] rounded-xl px-3.5 py-2.5 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none transition-colors"
                  />
                </div>
              )}

              {/* Email (optional) */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Email <span className="text-neutral-600 normal-case">(opcional, no se publica)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  placeholder="tu@email.com"
                  className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#C5A059] rounded-xl px-3.5 py-2.5 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none transition-colors"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Valoración</label>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 hover:scale-110 transition-transform"
                      aria-label={`${s} estrellas`}
                    >
                      <Star
                        className={cn(
                          "w-7 h-7",
                          s <= rating ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-[#C5A059]">{rating}/5</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Título <span className="text-neutral-600 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  placeholder="Ej. Servicio impecable y carta muy cuidada"
                  className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#C5A059] rounded-xl px-3.5 py-2.5 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Tu reseña</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="Cuéntanos tu experiencia: servicio, comida, gestión de la reserva, trato al cliente…"
                  className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#C5A059] rounded-xl px-3.5 py-2.5 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none transition-colors resize-none"
                />
                <p className="text-[10px] text-neutral-600 mt-1 text-right">{body.length}/2000</p>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Temas <span className="text-neutral-600 normal-case">(opcional, hasta 6)</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                        tags.includes(t)
                          ? "border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059]"
                          : "border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/15"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/15 text-neutral-300 hover:bg-white/5 h-11"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-11 font-semibold disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-[#0a0a0a]/40 border-t-[#0a0a0a] rounded-full animate-spin mr-1.5" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" />
                      Enviar reseña
                    </>
                  )}
                </Button>
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-neutral-600 leading-relaxed pt-1">
                Al enviar tu reseña se publicará automáticamente en esta página. RestoPanel se reserva el derecho de
                retirar reseñas con contenido ofensivo, spam o datos personales de terceros. Tu email no se publica.
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── REAL WORLD SECTION (with photos) ────────────────────────
function RealWorldSection() {
  return (
    <section className="py-20 sm:py-28 bg-[#0d1410]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">En el mundo real</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Diseñado para la sala, no para una presentación</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Photo: confirmation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden group"
          >
            <img src="/landing/photo-confirmation.jpeg" alt="Confirmación automática de reserva en restaurante — RestoPanel" className="w-full h-[260px] sm:h-[320px] object-cover object-center group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-transparent to-transparent" />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-6 left-6 bg-[#C5A059] text-[#0a0a0a] rounded-xl shadow-2xl p-3 max-w-[220px]"
            >
              <p className="text-xs font-bold leading-tight">Lucía García ha confirmado su reserva</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> 21:00h</span>
                <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> 4 comensales</span>
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> Terraza</span>
              </div>
            </motion.div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-xl font-bold text-[#f5f5f0]">Reservas confirmadas en tiempo real</h3>
              <p className="text-sm text-neutral-400 mt-1">Cada confirmación llega al instante. Tus clientes no esperan, tú no improvisas.</p>
            </div>
          </motion.div>

          {/* Photo: VIP customer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-2xl overflow-hidden group"
          >
            <img src="/landing/photo-vip.jpeg" alt="Cliente VIP con CRM de restaurante — RestoPanel" className="w-full h-[260px] sm:h-[320px] object-cover object-center group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-transparent to-transparent" />
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute top-6 right-6 bg-[#111518]/95 backdrop-blur rounded-xl border border-[#C5A059]/30 shadow-2xl p-3 w-48"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e]" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#f5f5f0] truncate">Elena García</p>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-2.5 h-2.5 fill-[#C5A059] text-[#C5A059]" />)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-neutral-500">85 reservas</span>
                <span className="text-[#C5A059] font-bold">€42 ticket</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9px] text-neutral-500">Puntuación</span>
                <div className="w-8 h-8 rounded-full border-2 border-[#C5A059] flex items-center justify-center">
                  <span className="text-xs font-bold text-[#C5A059]">85</span>
                </div>
              </div>
              <div className="mt-1.5">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#C5A059] text-[#0a0a0a] uppercase w-full block text-center">Cliente VIP</span>
              </div>
            </motion.div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-xl font-bold text-[#f5f5f0]">Conoce a cada cliente como si fuera VIP</h3>
              <p className="text-sm text-neutral-400 mt-1">Historial de visitas, ticket medio, preferencias y alergias. Todo en una ficha.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── HOSPITALITY ─────────────────────────────────────────────
function Hospitality() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Real photo: support team */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-2xl overflow-hidden shadow-2xl"
          >
            <img src="/landing/photo-support.jpeg" alt="Equipo de soporte de RestoPanel disponible 365 días" className="w-full h-[300px] sm:h-[360px] object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent" />
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-6 left-6 bg-[#111518]/95 backdrop-blur rounded-xl shadow-2xl px-4 py-2.5"
            >
              <p className="text-sm font-bold text-[#f5f5f0] uppercase tracking-wide">Hospitalidad los 365 días</p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">No estás solo</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Tu partner de operaciones, no solo tu software</h2>
            <p className="mt-4 text-neutral-400 text-lg">RestoPanel no se instala y se abandona. Te acompañamos para que saques el máximo desde el primer día.</p>
            <div className="mt-8 space-y-4">
              <SupportItem icon={<Smartphone className="w-4 h-4" />} title="Onboarding guiado" desc="Configuramos contigo tu sala, tus turnos y tus canales. No empiezas desde cero." />
              <SupportItem icon={<Sparkles className="w-4 h-4" />} title="Recomendaciones de configuración" desc="Te sugerimos flujos de reserva, políticas de no-show y reglas de mesa probadas en hostelería real." />
              <SupportItem icon={<Bell className="w-4 h-4" />} title="Soporte humano y recursos" desc="Equipo de soporte, guías, vídeos y base de conocimiento. Cuando tengas una duda, ahí estamos." />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function SupportItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-[#f5f5f0]">{title}</p>
        <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── USE CASES ───────────────────────────────────────────────
function UseCases() {
  const cases = [
    { tag: "Restaurante", icon: <UtensilsCrossed className="w-5 h-5" />, title: "De agenda en papel a panel digital", desc: "Un restaurante independiente pasó de apuntar reservas en un cuaderno a centralizar todos los canales en RestoPanel. Llenó mejor los turnos vacíos y redujo no-shows con reconfirmación automática por WhatsApp.", metric: "+30%", metricLabel: "ocupación en turnos débiles" },
    { tag: "Discoteca / Club", icon: <Moon className="w-5 h-5" />, title: "Listas, accesos y VIP sin caos en puerta", desc: "Una discoteca mediana gestionaba listas de invitados por Instagram DM y papel. Con RestoNight unificó entradas online, listas y zonas VIP en un panel. Menos aglomeración en puerta, más control de aforo.", metric: "-50%", metricLabel: "tiempo de espera en VIP" },
    { tag: "Grupo de restaurantes", icon: <BarChart3 className="w-5 h-5" />, title: "Cuatro locales, un solo panel", desc: "Un grupo con cuatro restaurantes unificó la gestión en RestoPanel. Ahora ve KPIs consolidados de grupo y desglose por local. Compara rendimiento, rota personal y lanza campañas cruzadas con su CRM propio.", metric: "4→1", metricLabel: "locales en un panel" },
  ];

  return (
    <section id="casos" className="py-20 sm:py-28 bg-[#0d1410]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Casos de uso</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Tres negocios, tres problemas resueltos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cases.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center">{c.icon}</div>
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{c.tag}</span>
              </div>
              <h3 className="font-semibold text-[#f5f5f0] text-lg">{c.title}</h3>
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed flex-1">{c.desc}</p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-3xl font-bold text-[#C5A059]">{c.metric}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{c.metricLabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: "¿Qué es RestoPanel?", a: "RestoPanel es un software en la nube que centraliza la gestión de reservas, mesas, clientes, eventos y analítica para restaurantes, discotecas, clubs, beach clubs y hoteles. Todo funciona desde un único panel accesible desde cualquier dispositivo con navegador. No necesitas instalar nada: creas tu cuenta, configuras tu sala y empiezas a trabajar." },
    { q: "¿Qué tipo de negocios pueden usar RestoPanel?", a: "RestoPanel está diseñado para tres grandes perfiles: restaurantes independientes y grupos hosteleros; negocios de ocio nocturno (discotecas, clubs, beach clubs, festivales); y hoteles con F&B, rooftops, bares y restaurantes internos. Cada perfil puede activar los módulos que necesita y dejar desactivados los que no use." },
    { q: "¿Necesito formación para usarlo?", a: "No. La interfaz está pensada para personal de sala y de puerta que atiende clientes en horas de máxima demanda. El onboarding es guiado: configuramos contigo tu plano de sala, tus turnos y tus canales en la primera sesión. Si tu equipo sabe usar un WhatsApp, sabe usar RestoPanel." },
    { q: "¿Cómo se integra con mis canales actuales?", a: "RestoPanel centraliza reservas que llegan de tu web propia, Google Maps, Instagram, Facebook, WhatsApp y teléfono. La disponibilidad se sincroniza en tiempo real entre todos los canales, así que nunca se acepta una reserva para una mesa que ya no está libre. Los walk-ins también se registran en el mismo panel." },
    { q: "¿En qué idiomas está disponible la interfaz?", a: "La interfaz principal está en español (tono neutro profesional, apto para España y Latinoamérica). El equipo de soporte atiende en español. Próximamente: inglés y portugués de Brasil para locales con personal internacional o turista extranjero." },
    { q: "¿Cómo se gestionan los datos y la privacidad de mis clientes?", a: "Los datos de tus clientes viven en tu propia base de datos dentro de RestoPanel. Nunca se comparten con terceros, nunca se venden a OTAs ni a plataformas de reservas externas. Tú decides qué datos guardas, qué campañas lanzas y cuándo las lanzas. Cumplimos con la normativa europea de protección de datos (RGPD)." },
    { q: "¿Puedo usarlo sólo para eventos o sólo para reservas de restaurante?", a: "Sí. RestoPanel es modular. Si solo necesitas gestionar reservas de restaurante, activas RestoBookings, RestoFloor y RestoCRM. Si además haces eventos o tienes ocio nocturno, activas RestoNight para entradas, listas y zonas VIP. Si solo quieres el CRM para fidelizar clientes existentes, también puedes usarlo independientemente." },
  ];

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Preguntas frecuentes</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f0] mt-2 tracking-tight">Todo lo que necesitas saber antes de empezar</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-[#111518] rounded-xl border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-medium text-[#f5f5f0] text-sm sm:text-base">{faq.q}</span>
                <ChevronDown className={cn("w-4 h-4 text-[#C5A059] flex-shrink-0 ml-2 transition-transform", open === i && "rotate-180")} />
              </button>
              <motion.div
                initial={false}
                animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 text-sm text-neutral-400 leading-relaxed">{faq.a}</div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CTA ───────────────────────────────────────────────
function FinalCTA() {
  const router = useRouter();
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#004D40] via-[#0a0a0a] to-[#0a0a0a]" />
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C5A059]/30 blur-[120px]" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Award className="w-12 h-12 text-[#C5A059] mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f5f0]">Empieza hoy. Sin riesgos.</h2>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl mx-auto">Crea tu cuenta en minutos, configura tu sala y empieza a recibir reservas centralizadas desde el primer día. Si no te convence, cancelas cuando quieras.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base h-12 px-8 font-semibold" onClick={() => router.push("/login")}>
              Crear cuenta
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-[#f5f5f0] hover:bg-white/5 text-base h-12 px-8" onClick={() => router.push("/login")}>
              Entrar al panel
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
                <UtensilsCrossed className="w-4.5 h-4.5" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-[#f5f5f0]">
                Resto<span className="text-[#C5A059]">Panel</span>
              </span>
            </div>
            <p className="text-sm text-neutral-500 max-w-md">Software de gestión de reservas, experiencias y CRM para hostelería y ocio nocturno. Datos propios, sin intermediarios.</p>
          </div>
          <div>
            <h4 className="font-semibold text-[#f5f5f0] mb-3 text-sm">Módulos</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>RestoBookings</li>
              <li>RestoFloor</li>
              <li>RestoGuard</li>
              <li>RestoCRM</li>
              <li>RestoNight</li>
              <li>RestoQueue</li>
              <li>RestoAnalytics</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#f5f5f0] mb-3 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li><a href="#modulos" className="hover:text-[#C5A059]">Características</a></li>
              <li><a href="#casos" className="hover:text-[#C5A059]">Casos de uso</a></li>
              <li><a href="#faq" className="hover:text-[#C5A059]">FAQ</a></li>
              <li><a href="mailto:hola@restopanel.com" className="hover:text-[#C5A059]">Contacto</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-600">© {new Date().getFullYear()} RestoPanel · Todos los derechos reservados</p>
          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Español</span>
            <a href="mailto:hola@restopanel.com" className="hover:text-[#C5A059]">Términos</a>
            <a href="mailto:hola@restopanel.com" className="hover:text-[#C5A059]">Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
