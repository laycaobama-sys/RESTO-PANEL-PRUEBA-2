"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Zap, Brain, MessageCircle, CalendarCheck, Users, BarChart3, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/dashboard/sections/PricingSection";
import { StructuredData } from "@/components/landing/StructuredData";

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
        {/* Hero */}
        <section className="relative pt-20 pb-16 px-4 max-w-7xl mx-auto">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#C5A059]/5 blur-3xl pointer-events-none" />

          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-400 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Cero comisiones por reserva · Datos 100% tuyos
              </div>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                El Sistema Operativo que{" "}
                <span className="bg-gradient-to-r from-[#C5A059] to-amber-300 bg-clip-text text-transparent">
                  llena tus mesas
                </span>{" "}
                y elimina los no-shows
              </h1>

              <p className="text-lg text-neutral-400 mb-8 max-w-xl">
                Software de reservas para restaurantes con IA predictiva, automatización de WhatsApp, CRM inteligente y revenue management. La alternativa a CoverManager sin comisiones por reserva.
              </p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Button
                  size="lg"
                  className="h-12 px-6 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold"
                  onClick={() => window.location.href = "/login"}
                >
                  Prueba gratis de 7 días
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 border-white/15 text-white"
                  onClick={() => document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Ver demo
                </Button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Sin permanencia</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Cancela cuando quieras</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Onboarding gratis</span>
              </div>
            </motion.div>

            {/* 3D Mockup del plano de mesas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div
                className="relative rounded-2xl bg-gradient-to-br from-[#1A1D24] to-[#0d0f12] border border-white/10 p-4 overflow-hidden"
                style={{ transform: "perspective(1000px) rotateY(-8deg) rotateX(4deg)" }}
              >
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const statuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "AVAILABLE", "OCCUPIED"];
                    const status = statuses[i % 5];
                    const colors: Record<string, string> = {
                      AVAILABLE: "border-green-500 bg-green-500/10",
                      OCCUPIED: "border-red-500 bg-red-500/10",
                      RESERVED: "border-yellow-400 bg-yellow-400/10",
                    };
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-lg border-2 ${colors[status]} flex items-center justify-center text-xs font-bold`}
                      >
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[10px] text-white">
                  En vivo · 12 mesas
                </div>
              </div>
              {/* Glow */}
              <div className="absolute -inset-4 bg-[#C5A059]/10 blur-3xl -z-10" />
            </motion.div>
          </div>
        </section>

        {/* Video Preview con blur */}
        <section id="preview" className="py-16 px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold mb-2">Mira lo que desbloqueas</h2>
            <p className="text-neutral-400">Una vista rápida de tu nuevo panel de control</p>
          </motion.div>

          <div className="relative rounded-2xl overflow-hidden border border-white/10 group cursor-pointer">
            {/* Imagen con blur */}
            <div
              className="aspect-video bg-gradient-to-br from-[#1A1D24] via-[#0d0f12] to-[#0a0a0a] relative overflow-hidden"
              style={{
                backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 450%22><rect fill=%22%23111%22 width=%22800%22 height=%22450%22/><rect fill=%22%23C5A059%22 opacity=%220.3%22 x=%2250%22 y=%2250%22 width=%22200%22 height=%22100%22 rx=%228%22/><rect fill=%22%23fff%22 opacity=%220.1%22 x=%2250%22 y=%22180%22 width=%22300%22 height=%22100%22 rx=%228%22/><rect fill=%22%23fff%22 opacity=%220.1%22 x=%22400%22 y=%2250%22 width=%22350%22 height=%22100%22 rx=%228%22/><rect fill=%22%23fff%22 opacity=%220.1%22 x=%22400%22 y=%22180%22 width=%22350%22 height=%22100%22 rx=%228%22/><rect fill=%22%23fff%22 opacity=%220.1%22 x=%2250%22 y=%22310%22 width=%22700%22 height=%22100%22 rx=%228%22/></svg>')",
                backgroundSize: "cover",
                filter: "blur(12px) brightness(0.6)",
                transition: "filter 0.5s",
              }}
            >
              {/* Grid simulando dashboard */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-4 p-8 opacity-60">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rounded-lg bg-white/5" />
                ))}
              </div>
            </div>

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-20 h-20 rounded-full bg-[#C5A059] flex items-center justify-center shadow-2xl"
                style={{ boxShadow: "0 0 40px rgba(197,160,89,0.5)" }}
              >
                <Play className="w-8 h-8 text-[#0a0a0a] ml-1" fill="currentColor" />
              </motion.div>
            </div>

            {/* Texto */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white font-semibold">Dashboard en acción · 0:07</p>
              <p className="text-xs text-neutral-400">Reservas, mesas, CRM e IA en una sola pantalla</p>
            </div>

            {/* Overlay "Premium" */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs text-[#C5A059] font-semibold border border-[#C5A059]/30">
              🔒 Desbloquea con tu prueba
            </div>
          </div>
        </section>

        {/* Bento Grid de Beneficios */}
        <section className="py-20 px-4 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-3">Todo lo que necesitas en un solo panel</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              No es solo un software de reservas. Es el sistema operativo completo para tu restaurante.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[200px]">
            {/* CRM Inteligente (large) */}
            <BentoCard
              className="md:col-span-2 md:row-span-2"
              icon={<Brain className="w-6 h-6" />}
              title="CRM con IA predictiva"
              description="Predice quién va a cancelar, quién va a volver y quién es VIP. Segmentación automática, fidelización con puntos y recompensas, timeline 360° de cada cliente."
              gradient="from-[#C5A059]/20 to-transparent"
            />

            {/* WhatsApp */}
            <BentoCard
              icon={<MessageCircle className="w-5 h-5" />}
              title="WhatsApp automatizado"
              description="Confirmaciones, recordatorios y respuestas automáticas."
              gradient="from-green-500/20 to-transparent"
            />

            {/* Reservas */}
            <BentoCard
              icon={<CalendarCheck className="w-5 h-5" />}
              title="Motor de reservas IA"
              description="Asignación inteligente de mesas. Cero overbooking."
              gradient="from-blue-500/20 to-transparent"
            />

            {/* Revenue */}
            <BentoCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Revenue Management"
              description="ROI por canal. Ingresos perdidos y recuperados."
              gradient="from-purple-500/20 to-transparent"
            />

            {/* Upselling */}
            <BentoCard
              icon={<Zap className="w-5 h-5" />}
              title="Upselling automático"
              description="La IA recomienda vino, menús y experiencias."
              gradient="from-orange-500/20 to-transparent"
            />

            {/* Seguridad */}
            <BentoCard
              icon={<Shield className="w-5 h-5" />}
              title="Seguridad Enterprise"
              description="RLS, RBAC, auditoría completa. Datos 100% tuyos."
              gradient="from-cyan-500/20 to-transparent"
            />
          </div>
        </section>

        {/* Social Proof / Trust */}
        <section className="py-16 border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-4xl font-bold text-[#C5A059]">0€</p>
                <p className="text-sm text-neutral-400 mt-1">Comisión por reserva</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-[#C5A059]">100%</p>
                <p className="text-sm text-neutral-400 mt-1">Datos tuyos</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-[#C5A059]">24/7</p>
                <p className="text-sm text-neutral-400 mt-1">Automatización activa</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-3">Precios sin sorpresas</h2>
            <p className="text-neutral-400">Prueba gratis 7 días. Sin permanencia.</p>
          </motion.div>
          <PricingSection />
        </section>

        {/* CTA Final */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">
              Empieza hoy. <span className="text-[#C5A059]">7 días gratis.</span>
            </h2>
            <p className="text-neutral-400 mb-8">
              Sin tarjeta durante el trial. Onboarding asistido. Cancela cuando quieras.
            </p>
            <Button
              size="lg"
              className="h-14 px-8 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold"
              onClick={() => window.location.href = "/login"}
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 px-4">
          <div className="max-w-7xl mx-auto text-center text-xs text-neutral-600">
            © {new Date().getFullYear()} RestoPanel · Software de reservas para restaurantes · Alternativa a CoverManager
          </div>
        </footer>
      </div>
    </>
  );
}

function BentoCard({ icon, title, description, gradient, className }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      className={`relative rounded-2xl border border-white/[0.06] p-6 overflow-hidden bg-white/[0.02] backdrop-blur-md ${className || ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3 text-[#C5A059]">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
