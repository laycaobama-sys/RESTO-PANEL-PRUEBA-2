"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpsellModalProps {
  open: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan: string;  // "professional" | "enterprise"
  currentPlan: string;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Growth",
  enterprise: "Enterprise",
};

const PLAN_PRICES: Record<string, number> = {
  starter: 59,
  professional: 119,
  enterprise: 249,
};

export function UpsellModal({ open, onClose, featureName, requiredPlan, currentPlan }: UpsellModalProps) {
  const handleUpgrade = () => {
    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planName: requiredPlan, billingCycle: "monthly" }),
    })
      .then(r => r.json())
      .then(d => { if (d.url) window.location.href = d.url; });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-[#1A1D24] to-[#0a0a0a] border border-[#C5A059]/20 p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 0 80px rgba(197,160,89,0.2)" }}
          >
            {/* Decorative gradient */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#C5A059]/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[#C5A059]/15 flex items-center justify-center mb-5">
                <Crown className="w-8 h-8 text-[#C5A059]" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                Desbloquea {featureName}
              </h2>
              <p className="text-sm text-neutral-400 mb-6">
                Esta función requiere el plan <span className="text-[#C5A059] font-semibold">{PLAN_LABELS[requiredPlan]}</span>.
                Estás en el plan <span className="text-white font-semibold">{PLAN_LABELS[currentPlan]}</span>.
                Aumenta tus reservas hoy.
              </p>

              {/* Beneficios */}
              <div className="space-y-2 mb-6">
                {[
                  "Prueba gratis de 7 días",
                  "Sin permanencia, cancela cuando quieras",
                  "Acceso inmediato a todas las funciones premium",
                  "Datos 100% tuyos",
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-neutral-300">
                    <div className="w-5 h-5 rounded-full bg-[#C5A059]/15 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-[#C5A059]" />
                    </div>
                    {b}
                  </div>
                ))}
              </div>

              {/* Precio */}
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl font-bold text-white">{PLAN_PRICES[requiredPlan]}€</span>
                <span className="text-sm text-neutral-500">/mes</span>
                <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  ROI medio 5x
                </span>
              </div>

              <Button
                onClick={handleUpgrade}
                className="w-full h-12 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-base font-semibold"
              >
                <Crown className="w-4 h-4 mr-2" />
                Iniciar prueba gratis de 7 días
              </Button>

              <p className="text-center text-[10px] text-neutral-600 mt-3">
                Al continuar, serás redirigido a Stripe para completar tu suscripción.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
