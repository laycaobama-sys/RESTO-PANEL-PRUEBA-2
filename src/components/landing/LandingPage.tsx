"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  CalendarCheck,
  BookOpen,
  Grid3x3,
  ChefHat,
  BarChart3,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Check,
  ArrowRight,
  Star,
  Users,
  Globe,
  Lock,
  Bell,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* ============= HEADER ============= */}
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
            <a href="#features" className="hover:text-neutral-900 transition-colors">
              Características
            </a>
            <a href="#benefits" className="hover:text-neutral-900 transition-colors">
              Beneficios
            </a>
            <a href="#security" className="hover:text-neutral-900 transition-colors">
              Seguridad
            </a>
            <a href="#pricing" className="hover:text-neutral-900 transition-colors">
              Precios
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-sm hidden sm:inline-flex"
              onClick={() => router.push("/")}
            >
              Iniciar sesión
            </Button>
            <Button
              className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white text-sm"
              onClick={() => router.push("/")}
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* ============= HERO ============= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-yellow-200 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3" />
              Software de reservas y gestión para restaurantes
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              El panel de control que tu restaurante necesita
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/90 leading-relaxed max-w-2xl">
              Reservas online, carta digital, plano de mesas, POS, cocina y
              analíticas en una sola plataforma. Los cambios que hagas en el
              panel se reflejan al instante en tu web pública. Sin comisiones
              por reserva.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="bg-white text-[#FF6B35] hover:bg-white/90 text-base h-12 px-6 font-medium"
                onClick={() => router.push("/")}
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 text-base h-12 px-6 font-medium"
                onClick={() => router.push("/")}
              >
                Ver demo
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                14 días gratis
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Sin permanencia
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Sin comisiones por reserva
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Soporte en español
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============= SOCIAL PROOF ============= */}
      <section className="border-b border-[#ececed]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-[#FF6B35]">+500</p>
              <p className="text-sm text-neutral-500 mt-1">restaurantes activos</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#FF6B35]">2M+</p>
              <p className="text-sm text-neutral-500 mt-1">reservas gestionadas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#FF6B35]">98%</p>
              <p className="text-sm text-neutral-500 mt-1">satisfacción cliente</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#FF6B35]">24/7</p>
              <p className="text-sm text-neutral-500 mt-1">soporte y monitorización</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============= FEATURES ============= */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Todo en uno
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Una plataforma para gestionar todo tu restaurante
            </h2>
            <p className="mt-4 text-neutral-600 text-lg">
              Olvídate de saltar entre cinco herramientas distintas. RestoPanel
              reúne todo lo que necesitas para llevar tu negocio al siguiente
              nivel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<CalendarCheck className="w-5 h-5" />}
              title="Reservas online"
              desc="Calendario por turnos (comida/cena), zonas, estados visuales, confirmación automática y asociación a mesas."
              accent="primary"
            />
            <FeatureCard
              icon={<Grid3x3 className="w-5 h-5" />}
              title="Plano de mesas"
              desc="Mapa visual del salón con mesas por forma y zona (interior, terraza, VIP, barra). Click en una mesa y ve sus reservas."
              accent="indigo"
            />
            <FeatureCard
              icon={<BookOpen className="w-5 h-5" />}
              title="Carta digital"
              desc="CRUD completo de categorías y platos con fotos. Cambios se sincronizan con tu web pública al instante, sin tocar código."
              accent="green"
            />
            <FeatureCard
              icon={<ChefHat className="w-5 h-5" />}
              title="Cocina (KDS)"
              desc="Kitchen Display System con auto-refresh. Tarjetas de pedidos con tiempo transcurrido, alertas visuales y estados."
              accent="red"
            />
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Analíticas"
              desc="Ventas por día/semana/mes, ticket medio, platos estrella, horas punta y rotación de mesas en gráficas claras."
              accent="blue"
            />
            <FeatureCard
              icon={<Smartphone className="w-5 h-5" />}
              title="POS integrado"
              desc="Pedidos en mesa, para llevar y delivery. Cambio de estado (pendiente → preparando → servido → completado)."
              accent="yellow"
            />
          </div>
        </div>
      </section>

      {/* ============= BENEFITS ============= */}
      <section id="benefits" className="py-16 sm:py-24 bg-[#f6f6f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
                Beneficios
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
                Ahorra tiempo y vende más
              </h2>
              <p className="mt-4 text-neutral-600 text-lg">
                Diseñado para horas punta. Tu personal encontrará todo donde
                espera que esté, sin formación complicada.
              </p>
              <ul className="mt-8 space-y-4">
                <BenefitItem
                  icon={<Zap className="w-4 h-4" />}
                  title="Sincronización en tiempo real"
                  desc="Cambias un precio en el panel y aparece en tu web al instante. Sin redeploy, sin cachés que limpiar."
                />
                <BenefitItem
                  icon={<Clock className="w-4 h-4" />}
                  title="Reduce tiempos de espera"
                  desc="Cocina y sala coordinadas vía KDS. Los pedidos llegan claros, sin papeles perdidos."
                />
                <BenefitItem
                  icon={<TrendingUp className="w-4 h-4" />}
                  title="Decisiones con datos"
                  desc="Identifica tus platos estrella, horas punta y mesas más rentables. Optimiza tu carta y tu personal."
                />
                <BenefitItem
                  icon={<Users className="w-4 h-4" />}
                  title="Más reservas, menos no-shows"
                  desc="Confirmación automática, recordatorios y gestión de no-shows para reducir huecos en tu sala."
                />
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#D43A12] p-8 shadow-xl">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-neutral-900">Dashboard</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-700">Ventas hoy</p>
                      <p className="text-xl font-bold text-green-900">1.247 €</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-700">Pedidos</p>
                      <p className="text-xl font-bold text-blue-900">38</p>
                    </div>
                  </div>
                  <div className="h-24 flex items-end gap-1.5">
                    {[40, 65, 50, 80, 70, 95, 60].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#FF6B35] rounded-t"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= SECURITY ============= */}
      <section id="security" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Seguridad
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Tus datos y los de tus clientes, protegidos
            </h2>
            <p className="mt-4 text-neutral-600 text-lg">
              Cada restaurante tiene su propia base de datos aislada. Nadie,
              absolutamente nadie, puede ver tus datos sin tus credenciales.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SecurityCard
              icon={<Shield className="w-5 h-5" />}
              title="Aislamiento multi-tenant"
              desc="Cada restaurante vive en su propio contexto. Todas las consultas filtran por tenant, con validación en servidor. Un restaurante nunca puede ver datos de otro."
            />
            <SecurityCard
              icon={<Lock className="w-5 h-5" />}
              title="Contraseñas hasheadas"
              desc="Usamos bcrypt con salt único. Tu contraseña nunca se almacena en claro ni se envía por email. Sesiones JWT firmadas con secret propio."
            />
            <SecurityCard
              icon={<Globe className="w-5 h-5" />}
              title="Listo para producción"
              desc="Despliegue en Vercel + PostgreSQL en minutos. HTTPS automático, backups configurables y escalado horizontal sin tocar código."
            />
          </div>
        </div>
      </section>

      {/* ============= TESTIMONIALS ============= */}
      <section className="py-16 sm:py-24 bg-[#f6f6f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Testimonios
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Lo que dicen los restauradores
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TestimonialCard
              name="Carmen Zamorano"
              role="La Zamorana · Salamanca"
              quote="Desde que uso RestoPanel, mi carta online se actualiza sola. Cambio un precio y en dos segundos está en la web. Mis clientes lo agradecen."
              stars={5}
            />
            <TestimonialCard
              name="Laura Marín"
              role="Bistró del Puerto · Cádiz"
              quote="El plano de mesas nos salvó en verano. Veo de un vistazo qué mesas están libres, ocupadas o reservadas. Antes era un caos en papeles."
              stars={5}
            />
            <TestimonialCard
              name="Javier Ruiz"
              role="Asador El Roble · Madrid"
              quote="La cocina con KDS nos ha hecho reducir tiempos a la mitad. Los pedidos llegan claros, sin errores, y sabemos siempre qué pasa de largo."
              stars={5}
            />
          </div>
        </div>
      </section>

      {/* ============= PRICING ============= */}
      <section id="pricing" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wider">
              Precios
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mt-2 tracking-tight">
              Planes sin letra pequeña
            </h2>
            <p className="mt-4 text-neutral-600 text-lg">
              Sin comisiones por reserva. Sin permanencia. Cancela cuando quieras.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard
              name="Starter"
              price="29"
              tagline="Para bares y cafeterías que empiezan"
              features={[
                "Carta digital con QR",
                "Gestión de mesas (hasta 15)",
                "1 usuario admin",
                "Soporte por email",
              ]}
              cta="Empezar gratis"
            />
            <PricingCard
              name="Professional"
              price="59"
              tagline="Para restaurantes en pleno crecimiento"
              featured
              features={[
                "Todo lo de Starter, más:",
                "Reservas online ilimitadas",
                "Plano de mesas visual",
                "Cocina (KDS) con auto-refresh",
                "Analíticas avanzadas",
                "3 usuarios incluidos",
                "Soporte prioritario",
              ]}
              cta="Empezar gratis"
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              tagline="Para cadenas y grupos hosteleros"
              features={[
                "Todo lo de Professional, más:",
                "Multi-restaurante (varios locales)",
                "API y webhooks personalizados",
                "Integración con contabilidad",
                "Usuario ilimitados",
                "Gestor de cuenta dedicado",
                "SLA 99.9%",
              ]}
              cta="Contactar ventas"
            />
          </div>
        </div>
      </section>

      {/* ============= FINAL CTA ============= */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Empieza hoy. Sin riesgos.
          </h2>
          <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
            Crea tu cuenta en 2 minutos, configura tu carta y empieza a recibir
            reservas. Si no te convence, cancela cuando quieras.
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
              Probar demo
            </Button>
          </div>
        </div>
      </section>

      {/* ============= FOOTER ============= */}
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
                Software de reservas y gestión para restaurantes. Hecho por
                restauradores, para restauradores.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-900 mb-3 text-sm">Producto</h4>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#features" className="hover:text-neutral-900">Características</a></li>
                <li><a href="#pricing" className="hover:text-neutral-900">Precios</a></li>
                <li><a href="#security" className="hover:text-neutral-900">Seguridad</a></li>
                <li><button onClick={() => router.push("/")} className="hover:text-neutral-900">Demo</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-900 mb-3 text-sm">Empresa</h4>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-neutral-900">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-neutral-900">Contacto</a></li>
                <li><a href="#" className="hover:text-neutral-900">Términos</a></li>
                <li><a href="#" className="hover:text-neutral-900">Privacidad</a></li>
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
              <span className="flex items-center gap-1">
                <Bell className="w-3 h-3" /> Estado del servicio
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: "primary" | "green" | "blue" | "yellow" | "red" | "indigo";
}) {
  const accentBg = {
    primary: "bg-[#FFF3ED] text-[#FF6B35]",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    indigo: "bg-indigo-50 text-indigo-600",
  }[accent];
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6 hover:shadow-lg hover:border-[#FF6B35]/30 transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${accentBg}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900 text-lg">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
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

function SecurityCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#D43A12] text-white flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900 text-lg">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function TestimonialCard({
  name,
  role,
  quote,
  stars,
}: {
  name: string;
  role: string;
  quote: string;
  stars: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ececed] p-6">
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-neutral-700 leading-relaxed italic">"{quote}"</p>
      <div className="mt-4 pt-4 border-t border-[#ececed]">
        <p className="font-semibold text-neutral-900">{name}</p>
        <p className="text-sm text-neutral-500">{role}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  tagline,
  features,
  cta,
  featured,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
}) {
  const router = useRouter();
  return (
    <div
      className={`rounded-2xl p-6 border-2 relative ${
        featured
          ? "border-[#FF6B35] bg-white shadow-xl scale-105"
          : "border-[#ececed] bg-white"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FF6B35] text-white text-xs font-semibold">
          Más popular
        </div>
      )}
      <h3 className="font-semibold text-neutral-900 text-lg">{name}</h3>
      <p className="text-sm text-neutral-500 mt-1">{tagline}</p>
      <div className="mt-4 flex items-baseline gap-1">
        {price !== "Custom" && <span className="text-2xl font-bold text-neutral-900">€</span>}
        <span className="text-4xl font-bold text-neutral-900">{price}</span>
        {price !== "Custom" && <span className="text-sm text-neutral-500">/mes</span>}
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-neutral-700">
            <Check className="w-4 h-4 text-[#FF6B35] flex-shrink-0 mt-0.5" />
            <span className={f.endsWith(":") ? "font-semibold text-neutral-900" : ""}>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className={`w-full mt-6 ${
          featured
            ? "bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            : "bg-white border border-[#ececed] text-neutral-900 hover:bg-neutral-50"
        }`}
        onClick={() => router.push("/")}
      >
        {cta}
      </Button>
    </div>
  );
}
