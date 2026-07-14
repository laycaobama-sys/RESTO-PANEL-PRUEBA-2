"use client";

import { motion } from "framer-motion";
import {
  ArrowRight, Check, Shield, Zap, Brain, MessageCircle, CalendarCheck,
  Users, BarChart3, Play, Gift, Bell, TrendingUp, Clock, Crown,
  UtensilsCrossed, Package, ChefHat, ShoppingCart, Sparkles, Star,
  CreditCard, Globe, Smartphone, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/dashboard/sections/PricingSection";
import { StructuredData } from "@/components/landing/StructuredData";

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#b08d4e] flex items-center justify-center font-bold text-[#0a0a0a] text-lg">R</div>
              <span className="text-lg font-bold">RestoPanel</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
              <a href="#features" className="hover:text-white transition">Funciones</a>
              <a href="#pricing" className="hover:text-white transition">Precios</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </div>
            <Button onClick={() => window.location.href = "/login"} size="sm" className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
              Iniciar sesión
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative pt-16 pb-16 px-4 max-w-7xl mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#C5A059]/5 blur-3xl pointer-events-none" />
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-400 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Cero comisiones por reserva · Datos 100% tuyos
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                El Sistema Operativo que{" "}
                <span className="bg-gradient-to-r from-[#C5A059] to-amber-300 bg-clip-text text-transparent">
                  llena tus mesas
                </span>{" "}
                y elimina los no-shows
              </h1>
              <p className="text-lg text-neutral-400 mb-8 max-w-xl">
                Software de reservas para restaurantes con IA predictiva, automatización de WhatsApp, CRM inteligente y revenue management. La alternativa a CoverManager sin comisiones.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Button size="lg" className="h-12 px-6 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold" onClick={() => window.location.href = "/login"}>
                  Prueba gratis de 7 días <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 border-white/15 text-white" onClick={() => document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" })}>
                  <Play className="w-4 h-4 mr-2" /> Ver demo
                </Button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Sin permanencia</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Cancela cuando quieras</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Onboarding gratis</span>
              </div>
            </motion.div>

            {/* Dashboard preview con efecto 3D */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="relative">
              <div className="relative rounded-2xl bg-gradient-to-br from-[#1A1D24] to-[#0d0f12] border border-white/10 p-4 overflow-hidden" style={{ transform: "perspective(1000px) rotateY(-8deg) rotateX(4deg)" }}>
                {/* Mock dashboard */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#C5A059]/20 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-[#C5A059]" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-20 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-12 bg-white/5 rounded-full mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Ingresos", value: "2.450€", color: "text-green-400" },
                    { label: "Reservas", value: "87", color: "text-blue-400" },
                    { label: "Mesas", value: "12/15", color: "text-[#C5A059]" },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-lg p-2">
                      <p className="text-[8px] text-neutral-500 uppercase">{s.label}</p>
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {/* Mini chart */}
                <div className="flex items-end gap-1 h-16 mb-2">
                  {[40, 65, 50, 80, 45, 70, 90, 55, 75, 60, 85, 50].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-[#C5A059]/40 to-[#C5A059]/80 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
                {/* Table grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const statuses = ["bg-green-500/20 border-green-500/40", "bg-red-500/20 border-red-500/40", "bg-yellow-500/20 border-yellow-500/40", "bg-green-500/20 border-green-500/40"];
                    return <div key={i} className={`aspect-square rounded-lg border-2 ${statuses[i % 4]} flex items-center justify-center text-[10px] font-bold`}>{i + 1}</div>;
                  })}
                </div>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-md text-[9px] text-white">● En vivo</div>
              </div>
              <div className="absolute -inset-4 bg-[#C5A059]/10 blur-3xl -z-10" />
            </motion.div>
          </div>
        </section>

        {/* Video Preview con blur */}
        <section id="preview" className="py-12 px-4 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">Mira lo que desbloqueas</h2>
            <p className="text-neutral-400">Una vista rápida de tu nuevo panel de control</p>
          </motion.div>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 group cursor-pointer">
            <div className="aspect-video bg-gradient-to-br from-[#1A1D24] via-[#0d0f12] to-[#0a0a0a] relative overflow-hidden" style={{ filter: "blur(8px) brightness(0.5)" }}>
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-4 p-8">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="rounded-lg bg-white/5" />)}
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div whileHover={{ scale: 1.1 }} className="w-20 h-20 rounded-full bg-[#C5A059] flex items-center justify-center shadow-2xl" style={{ boxShadow: "0 0 40px rgba(197,160,89,0.5)" }}>
                <Play className="w-8 h-8 text-[#0a0a0a] ml-1" fill="currentColor" />
              </motion.div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white font-semibold">Dashboard en acción · 0:07</p>
              <p className="text-xs text-neutral-400">Reservas, mesas, CRM e IA en una sola pantalla</p>
            </div>
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs text-[#C5A059] font-semibold border border-[#C5A059]/30">
              🔒 Desbloquea con tu prueba
            </div>
          </div>
        </section>

        {/* Bento Grid de Funcionalidades */}
        <section id="features" className="py-20 px-4 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-3">Todo tu restaurante en un solo panel</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">15+ módulos integrados con IA. No es solo reservas, es el sistema operativo completo.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[180px]">
            <FeatureCard className="md:col-span-2 md:row-span-2" icon={<Brain className="w-6 h-6" />} title="CRM con IA Predictiva" description="Predice quién cancelará, quién volverá y quién es VIP. Segmentación automática, fidelización con puntos y timeline 360° de cada cliente." gradient="from-[#C5A059]/20" features={["Predicción de no-shows", "Segmentación automática VIP", "Timeline completo del cliente", "LTV y ticket medio"]} />
            <FeatureCard icon={<MessageCircle className="w-5 h-5" />} title="WhatsApp Automatizado" description="Confirmaciones, recordatorios y respuestas automáticas." gradient="from-green-500/20" />
            <FeatureCard icon={<CalendarCheck className="w-5 h-5" />} title="Motor de Reservas IA" description="Asignación inteligente de mesas. Cero overbooking." gradient="from-blue-500/20" />
            <FeatureCard icon={<ChefHat className="w-5 h-5" />} title="KDS Cocina" description="Display de cocina en tiempo real por estaciones." gradient="from-orange-500/20" />
            <FeatureCard icon={<BarChart3 className="w-5 h-5" />} title="Revenue Management" description="ROI por canal, ingresos perdidos y recuperados." gradient="from-purple-500/20" />
            <FeatureCard icon={<Zap className="w-5 h-5" />} title="Upselling IA" description="Recomienda vino, menús y experiencias automáticamente." gradient="from-amber-500/20" />
            <FeatureCard icon={<Package className="w-5 h-5" />} title="Inventario + Escandallos" description="Stock, costes, merma y rentabilidad por plato." gradient="from-cyan-500/20" />
            <FeatureCard icon={<ShoppingCart className="w-5 h-5" />} title="Compras IA" description="Pedidos automáticos cuando el stock baja." gradient="from-pink-500/20" />
            <FeatureCard icon={<Gift className="w-5 h-5" />} title="Fidelización" description="Puntos, niveles Bronze→Diamond y recompensas." gradient="from-indigo-500/20" />
            <FeatureCard icon={<Shield className="w-5 h-5" />} title="Seguridad Enterprise" description="RLS, RBAC, auditoría. Datos 100% tuyos." gradient="from-teal-500/20" />
          </div>
        </section>

        {/* Integraciones */}
        <section className="py-12 px-4 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Integrado con tus herramientas</h2>
            <p className="text-sm text-neutral-400">WhatsApp, Google, Instagram, Stripe, TPV y más</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {["WhatsApp Business", "Google Reviews", "Instagram", "Stripe", "Square", "Lightspeed", "Resend", "Apple Pay", "Google Pay", "Bizum"].map((tool) => (
              <div key={tool} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300 hover:border-[#C5A059]/30 transition">{tool}</div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div><p className="text-4xl font-bold text-[#C5A059]">0€</p><p className="text-sm text-neutral-400 mt-1">Comisión por reserva</p></div>
              <div><p className="text-4xl font-bold text-[#C5A059]">100%</p><p className="text-sm text-neutral-400 mt-1">Datos tuyos</p></div>
              <div><p className="text-4xl font-bold text-[#C5A059]">24/7</p><p className="text-sm text-neutral-400 mt-1">Automatización activa</p></div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 px-4 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-3">Precios sin sorpresas</h2>
            <p className="text-neutral-400">Prueba gratis 7 días. Sin permanencia.</p>
          </motion.div>
          <PricingSection />
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-4 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {[
              { q: "¿RestoPanel cobra comisiones por reserva?", a: "No. RestoPanel NO cobra comisiones por reserva. Pagas una suscripción mensual y todas las reservas son gratis e ilimitadas." },
              { q: "¿Cómo reduce los no-shows?", a: "Mediante confirmaciones automáticas por WhatsApp 24h antes, recordatorios, depósitos para grupos y puntuación de clientes." },
              { q: "¿Es alternativa a CoverManager?", a: "Sí, sin comisiones por reserva. Incluye motor de reservas IA, CRM, WhatsApp, fidelización y revenue management." },
              { q: "¿Hay prueba gratuita?", a: "Sí, 7 días de prueba gratis sin tarjeta. Acceso completo a todas las funciones premium." },
              { q: "¿Funciona en móvil y tablet?", a: "Sí, está optimizado para móvil, tablet (iPad) y escritorio. 100% responsive con modo oscuro." },
            ].map((f, i) => (
              <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-white mb-2">{f.q}</h3>
                <p className="text-sm text-neutral-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Empieza hoy. <span className="text-[#C5A059]">7 días gratis.</span></h2>
            <p className="text-neutral-400 mb-8">Sin tarjeta durante el trial. Onboarding asistido. Cancela cuando quieras.</p>
            <Button size="lg" className="h-14 px-8 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold" onClick={() => window.location.href = "/login"}>
              Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 px-4">
          <div className="max-w-7xl mx-auto text-center text-xs text-neutral-600">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C5A059] to-[#b08d4e] flex items-center justify-center font-bold text-[#0a0a0a] text-sm">R</div>
              <span className="font-bold text-neutral-400">RestoPanel</span>
            </div>
            <p>© {new Date().getFullYear()} RestoPanel · Software de reservas para restaurantes · Alternativa a CoverManager</p>
            <p className="mt-1">Cero comisiones por reserva · Datos 100% tuyos · Hecho en España</p>
          </div>
        </footer>
      </div>
    </>
  );
}

function FeatureCard({ icon, title, description, gradient, features, className }: {
  icon: React.ReactNode; title: string; description: string; gradient: string;
  features?: string[]; className?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} whileHover={{ y: -4 }}
      className={`relative rounded-2xl border border-white/[0.06] p-5 overflow-hidden bg-white/[0.02] backdrop-blur-md ${className || ""}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3 text-[#C5A059]">{icon}</div>
        <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-neutral-400 leading-relaxed mb-2">{description}</p>
        {features && (
          <ul className="space-y-1 mt-2">
            {features.map((f, i) => <li key={i} className="flex items-center gap-1.5 text-[11px] text-neutral-300"><Check className="w-3 h-3 text-[#C5A059]" />{f}</li>)}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
