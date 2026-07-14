"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Zap, Brain, MessageCircle, CalendarCheck, Users, BarChart3, Play, Package, ChefHat, Crown, Gift, ShoppingCart, TrendingUp, Bell, Globe, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/dashboard/sections/PricingSection";
import { StructuredData } from "@/components/landing/StructuredData";

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C5A059] to-amber-600 flex items-center justify-center">
                <span className="text-[#0a0a0a] font-bold text-sm">R</span>
              </div>
              <span className="font-bold text-lg">RestoPanel</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
              <a href="#features" className="hover:text-white transition">Funcionalidades</a>
              <a href="#pricing" className="hover:text-white transition">Precios</a>
              <a href="#preview" className="hover:text-white transition">Demo</a>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.location.href = "/login"} className="text-neutral-300 hover:text-white">
                Iniciar sesión
              </Button>
              <Button size="sm" onClick={() => window.location.href = "/login"} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
                Prueba gratis
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative pt-28 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#C5A059]/5 blur-3xl pointer-events-none" />
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Cero comisiones por reserva · Datos 100% tuyos
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                El Sistema Operativo que{" "}
                <span className="bg-gradient-to-r from-[#C5A059] to-amber-300 bg-clip-text text-transparent">llena tus mesas</span>{" "}
                y elimina los no-shows
              </h1>
              <p className="text-base sm:text-lg text-neutral-400 mb-8 max-w-xl">
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

            {/* Dashboard mockup */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="relative">
              <div className="relative rounded-2xl bg-gradient-to-br from-[#1A1D24] to-[#0d0f12] border border-white/10 p-5 overflow-hidden shadow-2xl" style={{ transform: "perspective(1200px) rotateY(-6deg) rotateX(3deg)" }}>
                {/* KPIs row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[{label:"Ingresos",val:"2.480€",c:"#10B981"},{label:"Reservas",val:"47",c:"#C5A059"},{label:"Mesas",val:"12/15",c:"#3B82F6"}].map((k,i) => (
                    <div key={i} className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[9px] text-neutral-500 uppercase">{k.label}</p>
                      <p className="text-lg font-bold" style={{color:k.c}}>{k.val}</p>
                    </div>
                  ))}
                </div>
                {/* Chart mockup */}
                <div className="rounded-lg bg-white/5 p-3 mb-3">
                  <div className="flex items-end gap-1.5 h-20">
                    {[40,65,50,80,45,90,70,60,85,55,75,95].map((h,i) => (
                      <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#C5A059]/40 to-[#C5A059] transition-all" style={{height:`${h}%`}} />
                    ))}
                  </div>
                </div>
                {/* Tables grid */}
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({length:12}).map((_,i) => {
                    const st = i%4;
                    const colors = ["bg-green-500/20 border-green-500/40","bg-red-500/20 border-red-500/40","bg-yellow-500/20 border-yellow-500/40","bg-blue-500/20 border-blue-500/40"];
                    return <div key={i} className={`aspect-square rounded border ${colors[st]} flex items-center justify-center text-[10px] font-bold`}>{i+1}</div>;
                  })}
                </div>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[9px] text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> En vivo
                </div>
              </div>
              <div className="absolute -inset-4 bg-[#C5A059]/10 blur-3xl -z-10" />
            </motion.div>
          </div>
        </section>

        {/* Video preview con blur */}
        <section id="preview" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Mira lo que desbloqueas</h2>
            <p className="text-neutral-400 text-sm">Una vista rápida de tu nuevo panel de control</p>
          </motion.div>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 group cursor-pointer">
            <div className="aspect-video bg-gradient-to-br from-[#1A1D24] via-[#0d0f12] to-[#0a0a0a] relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-4 gap-3 p-6 opacity-50" style={{filter:"blur(8px)"}}>
                {Array.from({length:16}).map((_,i) => (
                  <div key={i} className="rounded-lg bg-white/5 flex items-center justify-center">
                    <div className="w-full h-2 rounded bg-white/10" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 to-transparent" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div whileHover={{ scale: 1.1 }} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#C5A059] flex items-center justify-center" style={{ boxShadow: "0 0 40px rgba(197,160,89,0.5)" }}>
                <Play className="w-7 h-7 sm:w-8 sm:h-8 text-[#0a0a0a] ml-1" fill="currentColor" />
              </motion.div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white font-semibold">Dashboard en acción · 0:07</p>
              <p className="text-xs text-neutral-400">Reservas, mesas, CRM e IA en una sola pantalla</p>
            </div>
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs text-[#C5A059] font-semibold border border-[#C5A059]/30">
              🔒 Desbloquea con tu prueba
            </div>
          </div>
        </section>

        {/* Features grid — TODAS las funcionalidades */}
        <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Todo lo que necesitas en un solo panel</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-sm sm:text-base">No es solo un software de reservas. Es el sistema operativo completo para tu restaurante.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: CalendarCheck, title: "Motor de reservas IA", desc: "Asignación inteligente de mesas. Cero overbooking. Horarios dinámicos.", color: "#C5A059" },
              { icon: Brain, title: "CRM con IA predictiva", desc: "Predice quién cancelará, quién volverá y quién es VIP. Segmentación automática.", color: "#8B5CF6" },
              { icon: MessageCircle, title: "WhatsApp automatizado", desc: "Confirmaciones, recordatorios y respuestas automáticas sin intervención.", color: "#22C55E" },
              { icon: BarChart3, title: "Revenue Management", desc: "ROI por canal. Ingresos perdidos y recuperados. Dashboard ejecutivo.", color: "#3B82F6" },
              { icon: Zap, title: "Automatizaciones", desc: "Constructor visual tipo Make/Zapier. 14 triggers, 11 acciones.", color: "#F59E0B" },
              { icon: Gift, title: "Fidelización", desc: "Puntos, 5 niveles (Bronze→Diamond), recompensas canjeables.", color: "#EC4899" },
              { icon: ChefHat, title: "Cocina (KDS)", desc: "Sistema de cocina en tiempo real. Estaciones, prioridades, temporizadores.", color: "#EF4444" },
              { icon: Package, title: "Inventario + Escandallos", desc: "Stock, costes, merma, lotes, caducidad. Recálculo automático.", color: "#14B8A6" },
              { icon: ShoppingCart, title: "Compras IA", desc: "Pedidos automáticos cuando el stock baja. Proveedor recomendado.", color: "#F97316" },
              { icon: Users, title: "Personal + Turnos", desc: "Control horario con geolocalización. Planificador drag & drop.", color: "#6366F1" },
              { icon: TrendingUp, title: "Upselling IA", desc: "Recomendaciones automáticas de vino, menús y experiencias.", color: "#C5A059" },
              { icon: Globe, title: "Carta digital + Web", desc: "Importa tu web actual. QR a la carta. SEO optimizado.", color: "#06B6D4" },
              { icon: Bell, title: "Notificaciones", desc: "Centro unificado: email, WhatsApp, push. Alertas IA en tiempo real.", color: "#A855F7" },
              { icon: Clock, title: "Lista de espera IA", desc: "Priorización inteligente. Tiempo estimado. Auto-notificación.", color: "#8B5CF6" },
              { icon: Crown, title: "Panel Super-Admin", desc: "Gestión global de restaurantes. KPIs agregados. Auditoría completa.", color: "#C5A059" },
              { icon: Shield, title: "Seguridad Enterprise", desc: "RLS, RBAC, CSP, HSTS. Datos 100% tuyos. OWASP Top 10 cerrado.", color: "#10B981" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} whileHover={{ y: -4 }}
                className="relative rounded-2xl border border-white/[0.06] p-5 overflow-hidden bg-white/[0.02] backdrop-blur-md">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: f.color }} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: f.color + "20" }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Integraciones */}
        <section className="py-12 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Integraciones</h3>
            <p className="text-sm text-neutral-400">Conecta con las herramientas que ya usas</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {["Stripe","WhatsApp","Google Reviews","Instagram","Square","Lightspeed","Toast","Revo","Resend","Supabase"].map((n,i) => (
              <div key={i} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400">{n}</div>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <section className="py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-3xl sm:text-4xl font-bold text-[#C5A059]">0€</p><p className="text-xs text-neutral-400 mt-1">Comisión por reserva</p></div>
              <div><p className="text-3xl sm:text-4xl font-bold text-[#C5A059]">100%</p><p className="text-xs text-neutral-400 mt-1">Datos tuyos</p></div>
              <div><p className="text-3xl sm:text-4xl font-bold text-[#C5A059]">24/7</p><p className="text-xs text-neutral-400 mt-1">Automatización activa</p></div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Precios sin sorpresas</h2>
            <p className="text-neutral-400 text-sm">Prueba gratis 7 días. Sin permanencia.</p>
          </motion.div>
          <PricingSection />
        </section>

        {/* CTA Final */}
        <section className="py-16 sm:py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Empieza hoy. <span className="text-[#C5A059]">7 días gratis.</span></h2>
            <p className="text-neutral-400 mb-8 text-sm">Sin tarjeta durante el trial. Onboarding asistido. Cancela cuando quieras.</p>
            <Button size="lg" className="h-14 px-8 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold" onClick={() => window.location.href = "/login"}>
              Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C5A059] to-amber-600 flex items-center justify-center">
                <span className="text-[#0a0a0a] font-bold text-xs">R</span>
              </div>
              <span className="text-sm text-neutral-400">© {new Date().getFullYear()} RestoPanel</span>
            </div>
            <p className="text-xs text-neutral-600">Software de reservas para restaurantes · Alternativa a CoverManager sin comisiones</p>
          </div>
        </footer>
      </div>
    </>
  );
}
