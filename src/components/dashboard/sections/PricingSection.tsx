"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Crown, Sparkles, Zap, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: Sparkles,
    monthly: 59,
    yearly: 566,
    description: "Para restaurantes que empiezan",
    features: [
      "Reservas ilimitadas",
      "Plano de mesas interactivo",
      "CRM básico",
      "Carta digital",
      "Analíticas básicas",
      "Google Reviews (lectura)",
      "Emails automáticos",
      "1 restaurante · 3 usuarios",
    ],
    color: "#64748B",
    popular: false,
  },
  {
    id: "professional",
    name: "Growth",
    icon: Zap,
    monthly: 119,
    yearly: 1142,
    description: "Para restaurantes en crecimiento",
    features: [
      "Todo Starter más:",
      "WhatsApp Business",
      "Automatizaciones",
      "Fidelización (puntos + niveles)",
      "Lista de espera inteligente",
      "Motor de upselling IA",
      "Campañas de marketing",
      "IA Insights & predicciones",
      "Google Reviews IA",
      "3 restaurantes · 10 usuarios",
    ],
    color: "#C5A059",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    monthly: 249,
    yearly: 2390,
    description: "Para grupos y cadenas",
    features: [
      "Todo Growth más:",
      "API pública + Webhooks",
      "Multi-empresa",
      "BI + Integraciones",
      "Account Manager dedicado",
      "SLA + Soporte prioritario",
      "Onboarding personalizado",
      "5 restaurantes · usuarios ilimitados",
    ],
    color: "#8B5CF6",
    popular: false,
  },
];

export function PricingSection({ currentPlan }: { currentPlan?: string }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCheckout = async (planName: string) => {
    setLoadingPlan(planName);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, billingCycle: cycle }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "No se pudo iniciar el checkout");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="w-full">
      {/* Toggle mensual / anual */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span className={cn("text-sm transition", cycle === "monthly" ? "text-white font-semibold" : "text-neutral-500")}>
          Mensual
        </span>
        <button
          onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
          className="relative w-14 h-7 rounded-full bg-white/10 transition-colors"
          style={{ backgroundColor: cycle === "yearly" ? "#C5A059" : undefined }}
        >
          <motion.div
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg"
            animate={{ x: cycle === "yearly" ? 28 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
        <span className={cn("text-sm transition", cycle === "yearly" ? "text-white font-semibold" : "text-neutral-500")}>
          Anual
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-semibold">
          −20%
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const price = cycle === "monthly" ? plan.monthly : plan.yearly;
          const isCurrent = currentPlan === plan.id;
          const isLoading = loadingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-3xl p-6 flex flex-col backdrop-blur-md transition-all",
                plan.popular
                  ? "bg-white/[0.06] border-2 border-[#C5A059] shadow-[0_0_40px_rgba(197,160,89,0.15)]"
                  : "bg-white/[0.03] border border-white/[0.08]"
              )}
              style={plan.popular ? { boxShadow: "0 0 60px rgba(197,160,89,0.2)" } : undefined}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#C5A059] text-[#0a0a0a] text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Más popular
                </div>
              )}

              <div className="mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: plan.color + "20" }}
                >
                  <Icon className="w-5 h-5" style={{ color: plan.color }} />
                </div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{plan.description}</p>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{price}€</span>
                  <span className="text-sm text-neutral-500">/{cycle === "monthly" ? "mes" : "año"}</span>
                </div>
                {cycle === "yearly" && (
                  <p className="text-xs text-green-400 mt-1">
                    Ahorras {(plan.monthly * 12 - plan.yearly).toFixed(0)}€ al año
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className={cn(
                    "flex items-start gap-2 text-xs",
                    f.endsWith(":") ? "text-neutral-300 font-semibold pt-1" : "text-neutral-400"
                  )}>
                    {!f.endsWith(":") && <Check className="w-3.5 h-3.5 text-[#C5A059] flex-shrink-0 mt-0.5" />}
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCurrent || isLoading}
                className={cn(
                  "w-full h-11",
                  plan.popular
                    ? "bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
                    : "bg-white/5 border border-white/10 text-white hover:bg-white/10",
                  isCurrent && "opacity-50 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  "Plan actual"
                ) : (
                  "Iniciar prueba gratis de 7 días"
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-neutral-500 mt-6">
        Sin permanencia · Cancela cuando quieras · Datos 100% tuyos
      </p>
    </div>
  );
}
