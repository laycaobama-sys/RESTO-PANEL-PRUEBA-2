"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Check, Shield, Zap, Brain, MessageCircle, CalendarCheck,
  Users, BarChart3, Package, ChefHat, Crown, Gift, ShoppingCart,
  TrendingUp, Bell, Globe, Clock, Star, Phone, Mail, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StructuredData } from "@/components/landing/StructuredData";
import { useState } from "react";

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <>
      <StructuredData />
      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
        {/* ─── NAV ─── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A059] to-amber-700 flex items-center justify-center shadow-lg">
                <span className="text-[#0a0a0a] font-black text-lg">R</span>
              </div>
              <span className="font-bold text-lg tracking-tight">RestoPanel</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
              <a href="#que-es" className="hover:text-white transition">Qué es</a>
              <a href="#funcionalidades" className="hover:text-white transition">Funcionalidades</a>
              <a href="#estadisticas" className="hover:text-white transition">Analíticas</a>
              <a href="#planes" className="hover:text-white transition">Planes</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.location.href = "/login"} className="text-neutral-300 hover:text-white hidden sm:flex">
                Iniciar sesión
              </Button>
              <Button size="sm" onClick={() => window.location.href = "/login"} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] font-semibold">
                Solicitar acceso
              </Button>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="relative pt-28 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[#C5A059]/5 blur-3xl pointer-events-none" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <motion.div initial={reduceMotion ? {} : { opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Sin comisiones por reserva · Datos 100% tuyos
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                El panel de reservas,{" "}
                <span className="bg-gradient-to-r from-[#C5A059] to-amber-300 bg-clip-text text-transparent">clientes y datos</span>{" "}
                que tu restaurante se merece
              </h1>
              <p className="text-base sm:text-lg text-neutral-400 mb-8 max-w-xl">
                Software de reservas y CRM para restaurantes que quieren jugar en primera división. Más reservas directas, menos no-shows, mejor control de clientes y más ingresos.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Button size="lg" className="h-12 px-6 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold" onClick={() => window.location.href = "/login"}>
                  Solicitar acceso <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 border-white/15 text-white" onClick={() => document.getElementById("dashboard-preview")?.scrollIntoView({ behavior: "smooth" })}>
                  Ver el panel en acción
                </Button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Sin permanencia</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Sin comisiones por reserva</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Datos 100% tuyos</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Onboarding incluido</span>
              </div>
            </motion.div>

            {/* Dashboard real animado (CSS-only, sin video externo) */}
            <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="relative" id="dashboard-preview">
              <div className="relative rounded-2xl bg-gradient-to-br from-[#1A1D24] to-[#0d0f12] border border-white/10 p-4 overflow-hidden shadow-2xl" style={{ transform: "perspective(1200px) rotateY(-6deg) rotateX(3deg)" }}>
                {/* Barra superior del dashboard */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#C5A059] to-amber-700 flex items-center justify-center">
                      <span className="text-[#0a0a0a] font-black text-[10px]">R</span>
                    </div>
                    <span className="text-xs font-semibold text-white">RestoPanel · Dashboard</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[9px] text-neutral-500">En vivo</span>
                  </div>
                </div>

                {/* KPIs row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Ingresos hoy", val: "2.480€", c: "#10B981", trend: "+18%" },
                    { label: "Reservas", val: "47", c: "#C5A059", trend: "+12%" },
                    { label: "Ocupación", val: "82%", c: "#3B82F6", trend: "+5%" },
                  ].map((k, i) => (
                    <div key={i} className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[9px] text-neutral-500 uppercase tracking-wide">{k.label}</p>
                      <p className="text-lg font-bold" style={{ color: k.c }}>{k.val}</p>
                      <p className="text-[8px] text-green-400">{k.trend}</p>
                    </div>
                  ))}
                </div>

                {/* Chart animado */}
                <div className="rounded-lg bg-white/5 p-3 mb-3">
                  <div className="flex items-end gap-1 h-16">
                    {[40, 65, 50, 80, 45, 90, 70, 60, 85, 55, 75, 95].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={reduceMotion ? {} : { height: "0%" }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                        className="flex-1 rounded-t bg-gradient-to-t from-[#C5A059]/30 to-[#C5A059]"
                      />
                    ))}
                  </div>
                </div>

                {/* Mesas grid */}
                <div className="grid grid-cols-6 gap-1.5 mb-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const st = i % 4;
                    const colors = [
                      "bg-green-500/20 border-green-500/40",
                      "bg-red-500/20 border-red-500/40",
                      "bg-yellow-500/20 border-yellow-500/40",
                      "bg-blue-500/20 border-blue-500/40",
                    ];
                    return (
                      <div key={i} className={`aspect-square rounded border ${colors[st]} flex items-center justify-center text-[10px] font-bold`}>
                        {i + 1}
                      </div>
                    );
                  })}
                </div>

                {/* CRM mini-preview */}
                <div className="rounded-lg bg-white/5 p-2.5 flex items-center gap-2" style={{ filter: "blur(3px)" }}>
                  <div className="w-8 h-8 rounded-full bg-[#C5A059]/20" />
                  <div className="flex-1">
                    <div className="h-2 w-24 rounded bg-white/20" />
                    <div className="h-1.5 w-16 rounded bg-white/10 mt-1" />
                  </div>
                  <div className="text-[9px] text-[#C5A059]">VIP</div>
                </div>
                <div className="absolute top-12 right-4 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[8px] text-neutral-400">
                  Datos protegidos
                </div>
              </div>
              <div className="absolute -inset-4 bg-[#C5A059]/10 blur-3xl -z-10" />
            </motion.div>
          </div>

          {/* Logos compatibilidad */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-6 opacity-50">
            <span className="text-xs text-neutral-500 uppercase tracking-wider mr-2">Compatible con:</span>
            {["Google", "WhatsApp", "Stripe", "Supabase", "OpenAI", "Cloudflare", "Resend"].map((n, i) => (
              <span key={i} className="text-sm font-semibold text-neutral-400">{n}</span>
            ))}
          </div>
        </section>

        {/* ─── QUÉ ES ─── */}
        <section id="que-es" className="py-16 sm:py-24 px-4 sm:px-6 max-w-4xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-center">Qué es RestoPanel</h2>
            <div className="space-y-4 text-neutral-400 text-base leading-relaxed">
              <p>
                RestoPanel es un <strong className="text-white">software de reservas y gestión integral para restaurantes</strong> que reúne en un solo panel todo lo que necesita tu negocio: motor de reservas propio sin comisiones, libro digital de reservas, plano de mesas inteligente, CRM de clientes, gestión de reputación online y analíticas de negocio.
              </p>
              <p>
                Diseñado para restaurantes que quieren <strong className="text-white">controlar sus datos y sus reservas sin intermediarios</strong>, RestoPanel elimina las comisiones por comensal y pone al restaurante al mando de su relación con el cliente. Cada reserva, cada visita, cada preferencia queda registrada en tu CRM, listo para fidelizar y aumentar el ticket medio.
              </p>
              <p>
                Desde restaurantes independientes hasta <strong className="text-white">cadenas y grupos hosteleros</strong>, RestoPanel se adapta a tu volumen y a tu forma de trabajar, con herramientas de comunicación interna, turnos de personal y analíticas avanzadas que te permiten tomar decisiones basadas en datos reales.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ─── FUNCIONALIDADES ─── */}
        <section id="funcionalidades" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Qué puedes hacer con RestoPanel</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Todo lo que tu restaurante necesita para ganar más y trabajar mejor.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: CalendarCheck, title: "Reservas sin comisiones", desc: "Motor de reservas propio integrado en tu web, Google, Instagram y WhatsApp. Política de cancelación, prepago y reconfirmaciones automáticas. Cada reserva es tuya, sin intermediarios.", color: "#C5A059", kw: "sistema de reservas online sin comisiones" },
              { icon: Package, title: "Plano de mesas inteligente", desc: "Vista de sala interactiva con estados en tiempo real: libre, ocupada, reservada, VIP, incidente. Agrupación de mesas, movimiento por zonas y estadísticas de ocupación por turno.", color: "#3B82F6", kw: "plano de mesas inteligente" },
              { icon: Users, title: "CRM profesional de clientes", desc: "Fichas de clientes con datos, preferencias, alergias e historial completo. Segmentación automática (VIP, recurrentes, nuevos). Campañas de email y SMS para aumentar visitas y ticket medio.", color: "#8B5CF6", kw: "CRM para hostelería" },
              { icon: Star, title: "Reputación y Google Reviews", desc: "Panel centralizado de reseñas. Visualiza y responde reseñas sin salir de la aplicación. Analíticas de reputación, puntuación media y tendencias de opinión.", color: "#F59E0B", kw: "gestión de reseñas restaurantes" },
              { icon: ChefHat, title: "Turnos de personal", desc: "Timeline semanal de sala, cocina, barra y eventos. Cálculo de horas y coste estimado. Gestión de cambios, vacaciones y disponibilidad del equipo.", color: "#EF4444", kw: "gestión de personal restaurante" },
              { icon: MessageCircle, title: "Comunicación interna", desc: "Chat entre sala, cocina, barra y recepción en tiempo real. Mensajes operativos: plato agotado, mesa lista, incidencia. Estados de alerta normal, urgente y crítica.", color: "#22C55E", kw: "comunicación interna restaurante" },
              { icon: BarChart3, title: "Analíticas de negocio", desc: "KPIs en tiempo real: reservas por día y turno, ocupación por zona, ticket medio, recurrencia, porcentaje de no-shows. Gráficos interactivos con filtros por fechas y canales.", color: "#06B6D4", kw: "analíticas para restaurantes" },
              { icon: Brain, title: "IA predictiva", desc: "Predicción de no-shows, probabilidad de cancelación, demanda prevista y recomendaciones de personal. La IA trabaja para que tomes mejores decisiones.", color: "#C5A059", kw: "IA para restaurantes" },
              { icon: Shield, title: "Seguridad Enterprise", desc: "Row Level Security, control de roles (RBAC), auditoría completa y copias de seguridad. Tus datos y los de tus clientes protegidos al máximo nivel.", color: "#10B981", kw: "seguridad software restaurante" },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? {} : { opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl border border-white/[0.06] p-5 overflow-hidden bg-white/[0.02] backdrop-blur-md"
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: f.color }} />
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: f.color + "20" }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── ESTADÍSTICAS ─── */}
        <section id="estadisticas" className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Analíticas en tiempo real</h2>
            <p className="text-neutral-400 text-sm">Datos que importan. Decisiones que generan ingresos.</p>
          </motion.div>

          {/* Stats animadas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Reservas gestionadas", val: "+1.000.000", icon: CalendarCheck, color: "#C5A059" },
              { label: "Menos llamadas", val: "98%", icon: Phone, color: "#22C55E" },
              { label: "Más ocupación", val: "+24%", icon: TrendingUp, color: "#3B82F6" },
              { label: "Más ticket medio", val: "+18%", icon: BarChart3, color: "#8B5CF6" },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
              >
                <s.icon className="w-6 h-6 mx-auto mb-3" style={{ color: s.color }} />
                <p className="text-2xl sm:text-3xl font-bold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-xs text-neutral-400 mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Gráfica mockup */}
          <div className="rounded-2xl bg-[#111518] border border-white/[0.06] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Reservas vs No-shows (últimos 30 días)</h3>
              <span className="text-[10px] text-neutral-500 px-2 py-0.5 rounded bg-white/5">Tiempo real</span>
            </div>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 30 }).map((_, i) => {
                const h1 = 30 + Math.sin(i * 0.5) * 20 + Math.random() * 30;
                const h2 = Math.max(5, h1 * 0.08 + Math.random() * 5);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
                    <div className="rounded-t bg-[#C5A059]" style={{ height: `${h1}%` }} />
                    <div className="rounded-b bg-red-500/40" style={{ height: `${h2}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px]">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#C5A059]" /> Reservas confirmadas</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-500/40" /> No-shows</span>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIOS ─── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Restaurantes que confían en RestoPanel</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: "Bistró del Puerto", city: "Cádiz", desc: "Reducimos los no-shows un 70% en 3 meses. El CRM nos permite conocer a cada cliente antes de que llegue.", impact: "+24% ocupación", rating: 5 },
              { name: "Trattoria Bella", city: "Madrid", desc: "Las campañas por WhatsApp nos trajeron 150 reservas en la primera semana. Sin comisiones, todo nuestro.", impact: "+18% ticket medio", rating: 5 },
              { name: "Castizo Serrano", city: "Salamanca", desc: "El plano de mesas interactivo cambió nuestra forma de trabajar. La sala funciona sola.", impact: "-90% llamadas", rating: 5 },
            ].map((t, i) => (
              <motion.div key={i} initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 text-[#C5A059]" fill="currentColor" />)}
                </div>
                <p className="text-sm text-neutral-300 mb-4 italic">"{t.desc}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.city}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 font-semibold">{t.impact}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── POR QUÉ ELEGIR ─── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-4xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Por qué elegir RestoPanel</h2>
          </motion.div>
          <div className="space-y-4">
            {[
              { num: "01", title: "Control total desde un solo panel", desc: "Reservas, eventos, pagos, clientes y reputación. Todo centralizado, todo bajo tu control. Sin saltar entre aplicaciones." },
              { num: "02", title: "Más negocio con canales directos", desc: "Web, Google, redes sociales y teléfono. Sin intermediarios, sin comisiones por comensal. Cada reserva es 100% tuya." },
              { num: "03", title: "Datos propios y CRM profesional", desc: "Base de datos de clientes actualizada en tiempo real, lista para fidelizar. Tú decides cómo y cuándo comunicarte con ellos." },
            ].map((r, i) => (
              <motion.div key={i} initial={reduceMotion ? {} : { opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-start gap-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
                <span className="text-3xl font-bold text-[#C5A059]/40">{r.num}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{r.title}</h3>
                  <p className="text-sm text-neutral-400">{r.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── PLANES ─── */}
        <section id="planes" className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Planes de contratación</h2>
            <p className="text-neutral-400 text-sm">Sin comisiones por reserva. Sin permanencia. Todo incluido.</p>
          </motion.div>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <span className={cycle === "monthly" ? "text-white font-semibold text-sm" : "text-neutral-500 text-sm"}>Mensual</span>
            <button onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")} className="relative w-14 h-7 rounded-full transition-colors" style={{ backgroundColor: cycle === "yearly" ? "#C5A059" : "#ffffff15" }}>
              <motion.div className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg" animate={{ x: cycle === "yearly" ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
            <span className={cycle === "yearly" ? "text-white font-semibold text-sm" : "text-neutral-500 text-sm"}>Anual</span>
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-semibold">−20%</span>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Independiente", monthly: 59, yearly: 566, desc: "Para restaurantes individuales", features: ["Reservas ilimitadas", "Plano de mesas", "CRM básico", "Carta digital", "1 restaurante · 3 usuarios"], popular: false, color: "#64748B" },
              { name: "Profesional", monthly: 119, yearly: 1142, desc: "Para restaurantes con volumen", features: ["Todo lo de Independiente", "WhatsApp automatizado", "Automatizaciones", "Fidelización + IA", "Lista de espera IA", "Campañas de marketing", "3 restaurantes · 10 usuarios"], popular: true, color: "#C5A059" },
              { name: "Cadena", monthly: 249, yearly: 2390, desc: "Para grupos y cadenas", features: ["Todo lo de Profesional", "API pública + Webhooks", "Multi-empresa", "BI + Integraciones", "Account manager", "5 restaurantes · ilimitados"], popular: false, color: "#8B5CF6" },
            ].map((p, i) => {
              const price = cycle === "monthly" ? p.monthly : p.yearly;
              return (
                <div key={i} className={`relative rounded-2xl p-6 flex flex-col backdrop-blur-md ${p.popular ? "bg-white/[0.06] border-2 border-[#C5A059]" : "bg-white/[0.03] border border-white/[0.08]"}`} style={p.popular ? { boxShadow: "0 0 40px rgba(197,160,89,0.15)" } : undefined}>
                  {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#C5A059] text-[#0a0a0a] text-[10px] font-bold uppercase">Más contratado</div>}
                  <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
                  <p className="text-xs text-neutral-400 mb-4">{p.desc}</p>
                  <div className="mb-5">
                    <span className="text-4xl font-bold text-white">{price}€</span>
                    <span className="text-sm text-neutral-500">/{cycle === "monthly" ? "mes" : "año"}</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-neutral-300">
                        <Check className="w-3.5 h-3.5 text-[#C5A059] flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full h-11 ${p.popular ? "bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"}`} onClick={() => window.location.href = "/login"}>
                    Solicitar acceso
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-neutral-500 mt-6">Sin comisiones por reserva · Sin permanencia · Onboarding incluido</p>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 max-w-3xl mx-auto">
          <motion.div initial={reduceMotion ? {} : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Preguntas frecuentes</h2>
          </motion.div>
          <div className="space-y-3">
            {[
              { q: "¿Qué hace RestoPanel?", a: "RestoPanel es un software integral de gestión para restaurantes que incluye motor de reservas sin comisiones, plano de mesas interactivo, CRM de clientes, gestión de reseñas, turnos de personal y analíticas de negocio. Todo centralizado en un solo panel." },
              { q: "¿Para quién es RestoPanel?", a: "Para restaurantes independientes, grupos hosteleros y cadenas que quieren controlar sus reservas, sus clientes y sus datos sin depender de intermediarios ni pagar comisiones por comensal." },
              { q: "¿Cómo ayuda a reducir no-shows?", a: "RestoPanel envía confirmaciones automáticas por WhatsApp y email, permite solicitar prepago o depósito a grupos grandes, y utiliza IA para identificar clientes con historial de no-shows, permitiéndote tomar medidas preventivas." },
              { q: "¿Cómo gestiona clientes y reseñas?", a: "El CRM registra cada visita, preferencia y alergia de tus clientes. Las reseñas de Google se centralizan en el panel, donde puedes responderlas directamente sin cambiar de aplicación, con analíticas de sentimiento y reputación." },
              { q: "¿Se integra con la web del restaurante?", a: "Sí. RestoPanel se integra con tu web mediante un widget de reservas, y también con Google, Instagram y WhatsApp. Todas las reservas llegan al mismo panel, sin importar el canal." },
              { q: "¿Cobra comisiones por reserva?", a: "No. RestoPanel no cobra comisiones por reserva ni por comensal. Pagas una suscripción mensual o anual y todas las reservas son gratis e ilimitadas. Los datos son 100% propiedad del restaurante." },
            ].map((f, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-4 flex items-center justify-between text-left">
                  <span className="text-sm font-semibold text-white">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-4 pb-4">
                    <p className="text-sm text-neutral-400">{f.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA FINAL ─── */}
        <section className="py-16 sm:py-24 px-4">
          <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-[#C5A059]/10 to-transparent border border-[#C5A059]/20 p-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Lleva tu restaurante a la siguiente división</h2>
            <p className="text-neutral-400 mb-8 text-sm">Sin comisiones. Sin intermediarios. Sin perder el control de tus datos.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button size="lg" className="h-12 px-8 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold" onClick={() => window.location.href = "/login"}>
                Solicitar acceso <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 border-white/15 text-white" onClick={() => window.location.href = "/login"}>
                Hablar con ventas
              </Button>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="border-t border-white/5 py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C5A059] to-amber-700 flex items-center justify-center">
                    <span className="text-[#0a0a0a] font-black text-xs">R</span>
                  </div>
                  <span className="font-bold text-sm">RestoPanel</span>
                </div>
                <p className="text-xs text-neutral-500">Software de reservas y CRM para restaurantes. Sin comisiones, sin intermediarios.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-3">Producto</p>
                <div className="space-y-2 text-xs text-neutral-500">
                  <a href="#que-es" className="block hover:text-white">Qué es</a>
                  <a href="#funcionalidades" className="block hover:text-white">Funcionalidades</a>
                  <a href="#planes" className="block hover:text-white">Planes</a>
                  <a href="#faq" className="block hover:text-white">FAQ</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-3">Soporte</p>
                <div className="space-y-2 text-xs text-neutral-500">
                  <a href="#" className="block hover:text-white">Centro de ayuda</a>
                  <a href="#" className="block hover:text-white">Documentación API</a>
                  <a href="#" className="block hover:text-white">Estado del sistema</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-3">Contacto</p>
                <div className="space-y-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> hola@restopanel.es</span>
                  <span className="flex items-center gap-2"><Phone className="w-3 h-3" /> +34 900 000 000</span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-neutral-600">© {new Date().getFullYear()} RestoPanel. Todos los derechos reservados.</p>
              <div className="flex gap-4 text-xs text-neutral-600">
                <a href="#" className="hover:text-white">Privacidad</a>
                <a href="#" className="hover:text-white">Términos</a>
                <a href="#" className="hover:text-white">Cookies</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
