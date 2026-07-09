"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    name: "starter",
    label: "Inicio",
    monthly: 59,
    yearly: 590,
    icon: "🚀",
    features: [
      "1 restaurante", "3 usuarios", "Reservas multicanal", "Plano de sala básico",
      "CRM básico", "Clientes ilimitados", "Analíticas básicas", "Google Reviews (lectura)",
      "Emails automáticos", "Soporte estándar"
    ],
  },
  {
    name: "professional",
    label: "Premium",
    monthly: 119,
    yearly: 1190,
    icon: "👑",
    popular: true,
    features: [
      "Todo lo de Inicio", "Plano premium con zonas", "Agrupación de mesas", "Transferencia de reservas",
      "CRM avanzado + campañas", "Reputación online", "WhatsApp Business", "Gestión de turnos",
      "Chat interno", "Automatizaciones", "3 restaurantes", "10 usuarios", "Soporte prioritario"
    ],
  },
  {
    name: "enterprise",
    label: "Empresarial",
    monthly: 249,
    yearly: 2490,
    icon: "🏢",
    features: [
      "Todo lo de Premium", "5 restaurantes incluidos", "Usuarios ilimitados", "API + Webhooks",
      "Multiempresa", "Business Intelligence", "Integraciones personalizadas", "Account Manager dedicado",
      "SLA garantizado", "Onboarding personalizado", "Restaurantes extra desde 49€/mes"
    ],
  },
];

const FAQ = [
  { q: "¿Puedo cambiar de plan en cualquier momento?", a: "Sí. Los cambios son inmediatos. Si mejoras, pagas la diferencia prorrateada. Si bajas, el cambio aplica al próximo ciclo." },
  { q: "¿Qué pasa si cancelo?", a: "Nada se elimina. Tu cuenta pasa a modo lectura hasta que reactives. Todos tus datos, reservas y clientes permanecen intactos." },
  { q: "¿Hay permanencia?", a: "No. Puedes cancelar cuando quieras sin penalización. El acceso se mantiene hasta el final del periodo facturado." },
  { q: "¿Incluye soporte?", a: "Todos los planes incluyen soporte. Inicio: email. Premium: prioritario. Empresarial: Account Manager dedicado y SLA." },
  { q: "¿Puedo probar antes de pagar?", a: "Sí. Al registrarte empiezas con el plan Inicio. Puedes mejorar a Premium o Empresarial en cualquier momento desde el panel de facturación." },
];

export function PricingSection() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const router = useRouter();

  return (
    <section id="pricing" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#C5A059]/5 blur-[120px]" />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[#C5A059] uppercase tracking-wider">Precios</span>
          <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f5f5f0] tracking-tight">
            Elige tu plan. <span className="bg-gradient-to-r from-[#C5A059] to-[#e3c987] bg-clip-text text-transparent">Cambia cuando quieras.</span>
          </h2>
          <p className="mt-4 text-base text-neutral-400">Sin permanencia. Sin comisiones por reserva. Cambia o cancela cuando quieras.</p>

          {/* Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className={cn("text-sm", cycle === "monthly" ? "text-[#f5f5f0] font-semibold" : "text-neutral-500")}>Mensual</span>
            <button onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
              className={cn("relative w-14 h-7 rounded-full transition-colors", cycle === "yearly" ? "bg-[#C5A059]" : "bg-white/10")}>
              <span className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform", cycle === "yearly" ? "translate-x-7" : "translate-x-0.5")} />
            </button>
            <span className={cn("text-sm", cycle === "yearly" ? "text-[#f5f5f0] font-semibold" : "text-neutral-500")}>Anual</span>
            <span className="text-xs text-green-400 font-semibold bg-green-400/10 px-2 py-1 rounded-full">Ahorra 20%</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn(
                "relative rounded-3xl border-2 p-6 flex flex-col",
                plan.popular ? "border-[#C5A059] bg-gradient-to-br from-[#C5A059]/10 to-transparent shadow-[0_0_40px_-10px_rgba(197,160,89,0.3)]" : "border-white/10 bg-white/[0.02]"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C5A059] text-[#0a0a0a] text-[10px] font-bold uppercase px-4 py-1.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Más Popular
                </span>
              )}
              <div className="text-3xl mb-2">{plan.icon}</div>
              <h3 className="text-xl font-bold text-[#f5f5f0]">RestoPanel {plan.label}</h3>
              <div className="mt-3 mb-5">
                <span className="text-4xl font-bold text-[#f5f5f0]">{cycle === "monthly" ? plan.monthly : plan.yearly}€</span>
                <span className="text-sm text-neutral-500">/{cycle === "monthly" ? "mes" : "año"}</span>
              </div>
              <ul className="space-y-2 text-sm text-neutral-400 flex-1 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#C5A059] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => router.push("/login")}
                className={cn("w-full h-12 font-semibold",
                  plan.popular ? "bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" : "bg-white/5 border border-white/10 text-[#f5f5f0] hover:bg-white/10"
                )}
              >
                Comenzar ahora <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-[#f5f5f0] text-center mb-8">Preguntas frecuentes</h3>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
                <p className="text-sm font-semibold text-[#f5f5f0] mb-1.5">{item.q}</p>
                <p className="text-sm text-neutral-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
