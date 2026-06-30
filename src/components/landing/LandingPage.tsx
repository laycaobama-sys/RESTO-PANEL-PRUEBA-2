"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// RestoPanel · Landing page
// ============================================================
// Copy strategy: every headline points to a concrete business
// outcome (revenue, occupancy, fewer no-shows, owned data).
// No "demo" CTAs anywhere — direct action only.
// Module branding: RestoBookings, RestoFloor, RestoGuard,
// RestoCRM, RestoNight, RestoQueue, RestoAnalytics.
// ============================================================

export function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <SocialProof />
      <Modules />
      <Automation />
      <Analytics />
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
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#ececed]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B35] flex items-center justify-center text-white">
            <UtensilsCrossed className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-neutral-900">
            RestoPanel
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-600">
          <a href="#modulos" className="hover:text-neutral-900 transition-colors">Módulos</a>
          <a href="#automatizacion" className="hover:text-neutral-900 transition-colors">Automatización</a>
          <a href="#analitica" className="hover:text-neutral-900 transition-colors">Analítica</a>
          <a href="#casos" className="hover:text-neutral-900 transition-colors">Casos de uso</a>
          <a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-sm hidden sm:inline-flex"
            onClick={() => router.push("/")}
          >
            Entrar al panel
          </Button>
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white text-sm"
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
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-yellow-200 blur-3xl" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3" />
            Software de reservas y gestión para hostelería y ocio nocturno
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Llena más mesas.
            <br />
            Pierde menos reservas.
            <br />
            <span className="text-white/90">Conoce a cada cliente.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/90 leading-relaxed max-w-2xl">
            RestoPanel centraliza en un solo panel todas tus reservas —web,
            Google, Instagram, WhatsApp y teléfono—, reduce no-shows con
            reconfirmación automática y te da un CRM propio para fidelizar
            sin intermediarios.
          </p>

          {/* 3 value bullets */}
          <div className="mt-8 grid sm:grid-cols-3 gap-4 max-w-2xl">
            <Bullet
              icon={<CalendarCheck className="w-4 h-4" />}
              text="Reservas de todos los canales en un único libro digital"
            />
            <Bullet
              icon={<ShieldCheck className="w-4 h-4" />}
              text="Menos no-shows con reconfirmación y prepago automáticos"
            />
            <Bullet
              icon={<Users className="w-4 h-4" />}
              text="CRM propio: historial, ticket medio y campañas a tus clientes"
            />
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="bg-white text-[#FF6B35] hover:bg-white/90 text-base h-12 px-8 font-medium"
              onClick={() => router.push("/")}
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 text-base h-12 px-8 font-medium"
              onClick={() => {
                document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Explorar RestoPanel
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Sin comisiones por reserva
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Sin permanencia
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Datos 100% tuyos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <p className="text-sm text-white/90 leading-snug">{text}</p>
    </div>
  );
}

// ─── SOCIAL PROOF ────────────────────────────────────────────
function SocialProof() {
  return (
    <section className="border-b border-[#ececed]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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
    <div>
      <p className="text-3xl font-bold text-[#FF6B35]">{value}</p>
      <p className="text-sm text-neutral-500 mt-1">{label}</p>
    </div>
  );
}

// ─── MODULES ─────────────────────────────────────────────────
function Modules() {
  return (
    <section id="modulos" className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
            Una plataforma, siete módulos
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
            Todo lo que pasa en tu sala, en un solo panel
          </h2>
          <p className="mt-4 text-neutral-600 text-lg">
            Olvídate de saltar entre cinco herramientas distintas. Cada
            módulo de RestoPanel resuelve un problema concreto de la
            operativa diaria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ModuleCard
            tag="RestoBookings"
            icon={<CalendarCheck className="w-5 h-5" />}
            title="Centralización de reservas"
            desc="Todas las reservas que llegan de tu web, Google Maps, Instagram, Facebook, WhatsApp y teléfono van a parar al mismo libro digital. En tiempo real, sin cuadernos ni hojas sueltas."
            benefits={["Un solo calendario para todo", "Sin doble reserva", "Disponibilidad sincronizada"]}
            accent="primary"
          />
          <ModuleCard
            tag="RestoFloor"
            icon={<LayoutGrid className="w-5 h-5" />}
            title="Asignación inteligente de mesas"
            desc="Un motor de sala combina tu plano, las zonas (terraza, interior, VIP), los turnos y la duración media para asignar mesas automáticamente y maximizar el aforo sin huecos vacíos."
            benefits={["Más cubiertos por turno", "Menos huecos muertos", "Reglas configurables"]}
            accent="indigo"
          />
          <ModuleCard
            tag="RestoGuard"
            icon={<ShieldCheck className="w-5 h-5" />}
            title="Control avanzado de no-shows"
            desc="Reconfirmación automática por email, SMS o WhatsApp antes de cada reserva. Tarjeta como garantía opcional y prepago de menús, experiencias o entradas según tu política."
            benefits={["Hasta -35% de ausencias", "Prepago de experiencias", "Política flexible por local"]}
            accent="green"
          />
          <ModuleCard
            tag="RestoCRM"
            icon={<Users className="w-5 h-5" />}
            title="CRM y base de datos propia"
            desc="Cada cliente queda registrado con historial de visitas, ticket medio, frecuencia, preferencias y alergias. Lanza campañas segmentadas por SMS, email o WhatsApp a tus clientes reales."
            benefits={["Datos 100% tuyos", "Campañas segmentadas", "Sin depender de OTAs"]}
            accent="blue"
          />
          <ModuleCard
            tag="RestoNight"
            icon={<Moon className="w-5 h-5" />}
            title="Ocio nocturno y eventos"
            desc="El mismo panel sirve para el servicio de mediodía y para la noche. Vende entradas online, controla accesos y listas de invitados, gestiona zonas VIP, mesas, botellas y packs."
            benefits={["Entradas y listas en un clic", "Control de aforo", "Zonas VIP y botellas"]}
            accent="purple"
          />
          <ModuleCard
            tag="RestoQueue"
            icon={<Clock className="w-5 h-5" />
            }
            title="Cola virtual y listas de espera"
            desc="Cuando la sala está llena, los clientes entran en una cola virtual con notificación por SMS o WhatsApp. Tú decides cuándo llamarlos; ellos no esperan de pie en la puerta."
            benefits={["Menos abandonos en puerta", "Notificación automática", "Más consumo en barra"]}
            accent="yellow"
          />
        </div>
      </div>
    </section>
  );
}

const ACCENT_BG: Record<string, string> = {
  primary: "bg-[#FFF3ED] text-[#FF6B35]",
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  indigo: "bg-indigo-50 text-indigo-600",
  purple: "bg-purple-50 text-purple-600",
};

function ModuleCard({
  tag, icon, title, desc, benefits, accent,
}: {
  tag: string; icon: React.ReactNode; title: string; desc: string;
  benefits: string[]; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6 hover:shadow-lg hover:border-[#FF6B35]/30 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACCENT_BG[accent]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-neutral-100 text-neutral-500 uppercase tracking-wider">
          {tag}
        </span>
      </div>
      <h3 className="font-semibold text-neutral-900 text-lg">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{desc}</p>
      <ul className="mt-4 space-y-1.5">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
            <Check className="w-4 h-4 text-[#FF6B35] flex-shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── AUTOMATION ──────────────────────────────────────────────
function Automation() {
  return (
    <section id="automatizacion" className="py-16 sm:py-24 bg-[#f6f6f7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Modo automático
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Tú defines las reglas. RestoPanel hace el trabajo.
            </h2>
            <p className="mt-4 text-neutral-600 text-lg">
              Configura una vez tus políticas de reserva, tiempos de mesa,
              cobros y recordatorios. El sistema se encarga de ejecutarlas
              sin que tengas que tocar nada más.
            </p>
            <ul className="mt-8 space-y-4">
              <Benefit
                icon={<Zap className="w-4 h-4" />}
                title="Confirmaciones y reconfirmaciones automáticas"
                desc="Email, SMS o WhatsApp según el canal por el que llegó la reserva. Tú eliges cuándo y cuántas veces."
              />
              <Benefit
                icon={<CalendarCheck className="w-4 h-4" />}
                title="Reposicionamiento y listas de espera"
                desc="Si alguien cancela, el sistema reposiciona automáticamente a quien estaba en cola y le avisa."
              />
              <Benefit
                icon={<Globe className="w-4 h-4" />}
                title="Sincronización multicanal"
                desc="La disponibilidad se actualiza al instante en tu web, Google Maps y redes sociales. Nadie reserva una mesa que ya no existe."
              />
            </ul>
            <div className="mt-8 p-4 rounded-xl bg-[#FFF3ED] border border-[#FFE0CB]">
              <p className="text-sm text-[#9a3b18] font-medium">
                Menos llamadas y WhatsApps improvisados. Más reservas
                confirmadas. Más tiempo para cuidar la experiencia en sala.
              </p>
            </div>
          </div>

          {/* Channels visual */}
          <div className="relative">
            <div className="aspect-square max-w-md mx-auto rounded-3xl bg-gradient-to-br from-[#FF6B35] to-[#D43A12] p-8 shadow-xl">
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-neutral-900">Reservas hoy</span>
                </div>
                <div className="space-y-2">
                  <ChannelRow icon={<Globe className="w-3.5 h-3.5" />} name="Web propia" count={12} color="bg-blue-100 text-blue-600" />
                  <ChannelRow icon={<MapPin className="w-3.5 h-3.5" />} name="Google Maps" count={8} color="bg-red-100 text-red-600" />
                  <ChannelRow icon={<Instagram className="w-3.5 h-3.5" />} name="Instagram" count={5} color="bg-purple-100 text-purple-600" />
                  <ChannelRow icon={<MessageSquare className="w-3.5 h-3.5" />} name="WhatsApp" count={7} color="bg-green-100 text-green-600" />
                  <ChannelRow icon={<Phone className="w-3.5 h-3.5" />} name="Teléfono" count={3} color="bg-yellow-100 text-yellow-600" />
                </div>
                <div className="mt-4 pt-4 border-t border-[#ececed] flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Total centralizado</span>
                  <span className="text-2xl font-bold text-[#FF6B35]">35</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#FFF3ED] text-[#FF6B35] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}

function ChannelRow({ icon, name, count, color }: { icon: React.ReactNode; name: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-neutral-50">
      <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>{icon}</div>
      <span className="text-sm text-neutral-700 flex-1">{name}</span>
      <span className="text-sm font-bold text-neutral-900">{count}</span>
    </div>
  );
}

// ─── ANALYTICS ───────────────────────────────────────────────
function Analytics() {
  return (
    <section id="analitica" className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Dashboard mockup */}
          <div className="order-2 lg:order-1">
            <div className="bg-white rounded-2xl border border-[#ececed] p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="font-semibold text-neutral-900">RestoAnalytics</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniKpi label="Ocupación" value="87%" trend="+12%" />
                <MiniKpi label="Ticket medio" value="34€" trend="+5%" />
                <MiniKpi label="No-shows" value="4%" trend="-35%" />
              </div>
              <div className="h-32 flex items-end gap-1.5">
                {[40, 65, 50, 80, 70, 95, 60, 75, 85, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-[#FF6B35] rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-xs text-neutral-400 mt-2">Reservas por día · últimos 12 días</p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Mesa de control
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Ver claro qué da dinero y qué no
            </h2>
            <p className="mt-4 text-neutral-600 text-lg">
              RestoAnalytics convierte cada reserva, cada mesa y cada cliente
              en datos accionables. No son números para mirar: son números
              para decidir.
            </p>
            <ul className="mt-8 space-y-3">
              <li className="flex items-start gap-2 text-neutral-700">
                <Check className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
                <span>KPIs en tiempo real: ocupación, ticket medio, recurrencia, % no-shows y rendimiento por turno y por canal.</span>
              </li>
              <li className="flex items-start gap-2 text-neutral-700">
                <Check className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
                <span>Identifica clientes VIP y frecuentes sin buscarlos manualmente.</span>
              </li>
              <li className="flex items-start gap-2 text-neutral-700">
                <Check className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
                <span>Informes listos para decidir horarios, equipo, precios y campañas.</span>
              </li>
              <li className="flex items-start gap-2 text-neutral-700">
                <Check className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
                <span>Comparativa entre locales para grupos y cadenas.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniKpi({ label, value, trend }: { label: string; value: string; trend: string }) {
  const positive = trend.startsWith("+") || (label === "No-shows" && trend.startsWith("-"));
  return (
    <div className="bg-neutral-50 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold text-neutral-900">{value}</p>
      <p className={`text-[10px] font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>{trend}</p>
    </div>
  );
}

// ─── HOSPITALITY ─────────────────────────────────────────────
function Hospitality() {
  return (
    <section className="py-16 sm:py-24 bg-[#f6f6f7]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
          No estás solo
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
          Tu partner de operaciones, no solo tu software
        </h2>
        <p className="mt-4 text-neutral-600 text-lg">
          RestoPanel no se instala y se abandona. Te acompañamos para que
          saques el máximo desde el primer día.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <SupportCard
            icon={<Smartphone className="w-5 h-5" />}
            title="Onboarding guiado"
            desc="Configuramos contigo tu sala, tus turnos y tus canales. No empiezas desde cero."
          />
          <SupportCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Recomendaciones de configuración"
            desc="Te sugerimos flujos de reserva, políticas de no-show y reglas de mesa probadas en hostelería real."
          />
          <SupportCard
            icon={<Bell className="w-5 h-5" />}
            title="Soporte humano y recursos"
            desc="Equipo de soporte, guías, vídeos y base de conocimiento. Cuando tengas una duda, ahí estamos."
          />
        </div>
      </div>
    </section>
  );
}

function SupportCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6 text-left">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#D43A12] text-white flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── USE CASES ───────────────────────────────────────────────
function UseCases() {
  return (
    <section id="casos" className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
            Casos reales
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
            Tres negocios, tres problemas resueltos
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UseCaseCard
            tag="Restaurante"
            icon={<UtensilsCrossed className="w-5 h-5" />}
            title="De agenda en papel a panel digital"
            desc="Un restaurante independiente pasó de apuntar reservas en un cuaderno a centralizar todos los canales en RestoPanel. Llenó mejor los turnos vacíos y redujo no-shows con reconfirmación automática por WhatsApp."
            metric="+30% ocupación en turnos débiles"
            metricLabel="mejora en huecos de mediodía"
          />
          <UseCaseCard
            tag="Discoteca / Club"
            icon={<Moon className="w-5 h-5" />}
            title="Listas, accesos y VIP sin caos en puerta"
            desc="Una discoteca mediana gestionaba listas de invitados por Instagram DM y papel. Con RestoNight unificó entradas online, listas y zonas VIP en un panel. Menos aglomeración en puerta, más control de aforo."
            metric="-50% tiempo de espera"
            metricLabel="en acceso a zona VIP"
          />
          <UseCaseCard
            tag="Grupo de restaurantes"
            icon={<BarChart3 className="w-5 h-5" />}
            title="Cuatro locales, un solo panel"
            desc="Un grupo con cuatro restaurantes unificó la gestión en RestoPanel. Ahora ve KPIs consolidados de grupo y desglose por local. Compara rendimiento, rota personal y lanza campañas cruzadas con su CRM propio."
            metric="4 locales · 1 panel"
            metricLabel="decenas de miles de comensales/año"
          />
        </div>
      </div>
    </section>
  );
}

function UseCaseCard({
  tag, icon, title, desc, metric, metricLabel,
}: {
  tag: string; icon: React.ReactNode; title: string; desc: string;
  metric: string; metricLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#FFF3ED] text-[#FF6B35] flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{tag}</span>
      </div>
      <h3 className="font-semibold text-neutral-900 text-lg">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed flex-1">{desc}</p>
      <div className="mt-4 pt-4 border-t border-[#ececed]">
        <p className="text-2xl font-bold text-[#FF6B35]">{metric}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{metricLabel}</p>
      </div>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    {
      q: "¿Qué es RestoPanel?",
      a: "RestoPanel es un software en la nube que centraliza la gestión de reservas, mesas, clientes, eventos y analítica para restaurantes, discotecas, clubs, beach clubs y hoteles. Todo funciona desde un único panel accesible desde cualquier dispositivo con navegador. No necesitas instalar nada: creas tu cuenta, configuras tu sala y empiezas a trabajar.",
    },
    {
      q: "¿Qué tipo de negocios pueden usar RestoPanel?",
      a: "RestoPanel está diseñado para tres grandes perfiles: restaurantes independientes y grupos hosteleros; negocios de ocio nocturno (discotecas, clubs, beach clubs, festivales); y hoteles con F&B, rooftops, bares y restaurantes internos. Cada perfil puede activar los módulos que necesita y dejar desactivados los que no use.",
    },
    {
      q: "¿Necesito formación para usarlo?",
      a: "No. La interfaz está pensada para personal de sala y de puerta que atiende clientes en horas de máxima demanda. El onboarding es guiado: configuramos contigo tu plano de sala, tus turnos y tus canales en la primera sesión. Si tu equipo sabe usar un WhatsApp, sabe usar RestoPanel.",
    },
    {
      q: "¿Cómo se integra con mis canales actuales?",
      a: "RestoPanel centraliza reservas que llegan de tu web propia, Google Maps, Instagram, Facebook, WhatsApp y teléfono. La disponibilidad se sincroniza en tiempo real entre todos los canales, así que nunca se acepta una reserva para una mesa que ya no está libre. Los walk-ins también se registran en el mismo panel.",
    },
    {
      q: "¿En qué idiomas está disponible la interfaz?",
      a: "La interfaz principal está en español (tono neutro profesional, apto para España y Latinoamérica). El equipo de soporte atiende en español. Próximamente: inglés y portugués de Brasil para locales con personal internacional o turista extranjero.",
    },
    {
      q: "¿Cómo se gestionan los datos y la privacidad de mis clientes?",
      a: "Los datos de tus clientes viven en tu propia base de datos dentro de RestoPanel. Nunca se comparten con terceros, nunca se venden a OTAs ni a plataformas de reservas externas. Tú decides qué datos guardas, qué campañas lanzas y cuándo las lanzas. Cumplimos con la normativa europea de protección de datos (RGPD).",
    },
    {
      q: "¿Puedo usarlo sólo para eventos o sólo para reservas de restaurante?",
      a: "Sí. RestoPanel es modular. Si solo necesitas gestionar reservas de restaurante, activas RestoBookings, RestoFloor y RestoCRM. Si además haces eventos o tienes ocio nocturno, activas RestoNight para entradas, listas y zonas VIP. Si solo quieres el CRM para fidelizar clientes existentes, también puedes usarlo independientemente.",
    },
  ];

  return (
    <section id="faq" className="py-16 sm:py-24 bg-[#f6f6f7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
            Preguntas frecuentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
            Todo lo que necesitas saber antes de empezar
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#ececed] overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="font-medium text-neutral-900 text-sm sm:text-base">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-neutral-400 flex-shrink-0 ml-2 transition-transform",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-neutral-600 leading-relaxed">
                  {faq.a}
                </div>
              )}
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
    <section className="py-16 sm:py-24 bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
          Empieza hoy. Sin riesgos.
        </h2>
        <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
          Crea tu cuenta en minutos, configura tu sala y empieza a recibir
          reservas centralizadas desde el primer día. Si no te convence,
          cancelas cuando quieras.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="bg-white text-[#FF6B35] hover:bg-white/90 text-base h-12 px-8 font-medium"
            onClick={() => router.push("/")}
          >
            Crear cuenta gratis
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 text-base h-12 px-8 font-medium"
            onClick={() => router.push("/")}
          >
            Entrar al panel
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-[#ececed] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B35] flex items-center justify-center text-white">
                <UtensilsCrossed className="w-4.5 h-4.5" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-neutral-900">
                RestoPanel
              </span>
            </div>
            <p className="text-sm text-neutral-500 max-w-md">
              Software de gestión de reservas, experiencias y CRM para
              hostelería y ocio nocturno. Datos propios, sin intermediarios.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 mb-3 text-sm">Módulos</h4>
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
            <h4 className="font-semibold text-neutral-900 mb-3 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li><a href="#modulos" className="hover:text-neutral-900">Características</a></li>
              <li><a href="#casos" className="hover:text-neutral-900">Casos de uso</a></li>
              <li><a href="#faq" className="hover:text-neutral-900">FAQ</a></li>
              <li><a href="#" className="hover:text-neutral-900">Contacto</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-[#ececed] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} RestoPanel · Todos los derechos reservados
          </p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" /> Español
            </span>
            <a href="#" className="hover:text-neutral-900">Términos</a>
            <a href="#" className="hover:text-neutral-900">Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
