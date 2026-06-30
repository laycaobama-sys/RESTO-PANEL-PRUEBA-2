"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
      <Modules />
      <Automation />
      <Analytics />
      <RealWorldSection />
      <Hospitality />
      <UseCases />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────
function Header() {
  const router = useRouter();
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
        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
          <a href="#modulos" className="hover:text-[#C5A059] transition-colors">Módulos</a>
          <a href="#automatizacion" className="hover:text-[#C5A059] transition-colors">Automatización</a>
          <a href="#analitica" className="hover:text-[#C5A059] transition-colors">Analítica</a>
          <a href="#casos" className="hover:text-[#C5A059] transition-colors">Casos de uso</a>
          <a href="#faq" className="hover:text-[#C5A059] transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-sm hidden sm:inline-flex text-neutral-400 hover:text-[#f5f5f0] hover:bg-white/5"
            onClick={() => router.push("/")}
          >
            Entrar al panel
          </Button>
          <Button
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm font-semibold"
            onClick={() => router.push("/")}
          >
            Crear cuenta gratis
          </Button>
        </div>
      </div>
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
              onClick={() => router.push("/")}
            >
              Crear cuenta gratis
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="+500" label="restaurantes y clubs activos" />
          <Stat value="2M+" label="reservas gestionadas al año" />
          <Stat value="-35%" label="no-shows con reconfirmación auto" />
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
              <img src="/landing/photo-calendar.jpeg" alt="Gestión de reservas con calendario de mesas" className="w-full h-[400px] object-cover" />
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
            <img src="/landing/photo-confirmation.jpeg" alt="Confirmación de reserva en restaurante" className="w-full h-[320px] object-cover group-hover:scale-105 transition-transform duration-500" />
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
            <img src="/landing/photo-vip.jpeg" alt="Cliente VIP en gestión de restaurante" className="w-full h-[320px] object-cover group-hover:scale-105 transition-transform duration-500" />
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
            <img src="/landing/photo-support.jpeg" alt="Equipo de soporte de RestoPanel" className="w-full h-[360px] object-cover" />
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
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Casos reales</span>
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
            <Button size="lg" className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base h-12 px-8 font-semibold" onClick={() => router.push("/")}>
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-[#f5f5f0] hover:bg-white/5 text-base h-12 px-8" onClick={() => router.push("/")}>
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
              <li><a href="#" className="hover:text-[#C5A059]">Contacto</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-600">© {new Date().getFullYear()} RestoPanel · Todos los derechos reservados</p>
          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Español</span>
            <a href="#" className="hover:text-[#C5A059]">Términos</a>
            <a href="#" className="hover:text-[#C5A059]">Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
