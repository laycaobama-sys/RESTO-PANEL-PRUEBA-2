"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, CreditCard, CheckCircle2, XCircle, Calendar, Download, Crown, AlertCircle, TrendingUp, Users, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PLANS = [
  { name: "starter", label: "Inicio", monthly: 59, yearly: 590, maxRestaurants: 1, maxUsers: 3, features: ["1 restaurante", "3 usuarios", "Reservas", "Plano básico", "CRM básico", "Analíticas básicas", "Google Reviews (lectura)", "Emails automáticos"] },
  { name: "professional", label: "Premium", monthly: 119, yearly: 1190, maxRestaurants: 3, maxUsers: 10, popular: true, features: ["Todo Inicio más:", "Plano premium", "Agrupación de mesas", "Transferencia avanzada", "Múltiples zonas", "CRM avanzado + campañas", "WhatsApp", "Gestión de turnos", "Chat interno", "Automatizaciones", "3 restaurantes", "10 usuarios"] },
  { name: "enterprise", label: "Empresarial", monthly: 249, yearly: 2490, maxRestaurants: 5, maxUsers: null, features: ["Todo Premium más:", "5 restaurantes incluidos", "Usuarios ilimitados", "API + Webhooks", "Multiempresa", "BI + Integraciones", "Account Manager", "SLA + Soporte prioritario", "Onboarding personalizado"] },
];

export function BillingSection() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPlans, setShowPlans] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api("/api/billing/subscription"),
  });

  const checkoutMut = useMutation({
    mutationFn: (opts: { planName: string; billingCycle: string }) =>
      api("/api/billing/checkout", { method: "POST", body: JSON.stringify(opts) }),
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast.error(e.message),
  });

  const portalMut = useMutation({
    mutationFn: () => api("/api/billing/portal", { method: "POST" }),
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const subMut = useMutation({
    mutationFn: (action: string) => api("/api/billing/subscription", { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: (data: any) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  if (isLoading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" /></div>;
  }

  const plan = data?.plan;
  const usage = data?.usage;
  const invoices = data?.invoices || [];
  const paymentMethods = data?.paymentMethods || [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Current Plan Card */}
      <div className="bg-gradient-to-br from-[#C5A059]/10 to-transparent rounded-2xl border border-[#C5A059]/20 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Crown className="w-6 h-6 text-[#C5A059]" />
              <h2 className="text-2xl font-bold text-[#f5f5f0]">Plan {plan?.planLabel || "Inicio"}</h2>
              <span className={cn(
                "text-xs px-3 py-1 rounded-full font-semibold uppercase",
                plan?.status === "active" ? "bg-green-500/15 text-green-400" :
                plan?.status === "trial" ? "bg-blue-500/15 text-blue-400" :
                plan?.status === "past_due" ? "bg-red-500/15 text-red-400" :
                "bg-neutral-500/15 text-neutral-400"
              )}>
                {plan?.status === "trial" ? "Periodo de prueba" : plan?.status === "active" ? "Activo" : plan?.status === "past_due" ? "Pago pendiente" : plan?.status}
              </span>
            </div>
            <p className="text-sm text-neutral-400">
              {plan?.billingCycle === "yearly" ? "Facturación anual" : "Facturación mensual"}
              {plan?.currentPeriodEnd && ` · Próximo cobro: ${new Date(plan.currentPeriodEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`}
            </p>
            {plan?.cancelAtPeriodEnd && (
              <div className="mt-3 flex items-center gap-2 text-xs text-orange-400">
                <AlertCircle className="w-4 h-4" />
                Cancelada — activa hasta {plan?.currentPeriodEnd ? new Date(plan.currentPeriodEnd).toLocaleDateString("es-ES") : "fin del periodo"}
                <button onClick={() => subMut.mutate("reactivate")} className="ml-2 text-[#C5A059] font-semibold hover:underline">
                  Reactivar
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowPlans(!showPlans)} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
              {showPlans ? "Cerrar planes" : "Cambiar plan"}
            </Button>
            {plan?.stripeCustomerId && (
              <Button variant="outline" onClick={() => portalMut.mutate()} className="border-white/15 text-neutral-300">
                <CreditCard className="w-4 h-4 mr-1.5" /> Gestionar pago
              </Button>
            )}
          </div>
        </div>

        {/* Usage bars */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <UsageBar icon={<Users className="w-4 h-4" />} label="Usuarios" current={usage?.users || 0} limit={plan?.maxUsers} />
          <UsageBar icon={<Grid3x3 className="w-4 h-4" />} label="Mesas" current={usage?.tables || 0} limit={plan?.maxTables} />
        </div>
      </div>

      {/* Plans (when toggled) */}
      {showPlans && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Billing cycle toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={cn("text-sm", cycle === "monthly" ? "text-[#f5f5f0] font-semibold" : "text-neutral-500")}>Mensual</span>
            <button
              onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
              className={cn("relative w-14 h-7 rounded-full transition-colors", cycle === "yearly" ? "bg-[#C5A059]" : "bg-white/10")}
            >
              <span className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform", cycle === "yearly" ? "translate-x-7" : "translate-x-0.5")} />
            </button>
            <span className={cn("text-sm", cycle === "yearly" ? "text-[#f5f5f0] font-semibold" : "text-neutral-500")}>Anual</span>
            <span className="text-xs text-green-400 font-semibold">Ahorra 20%</span>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "relative rounded-2xl border-2 p-5 flex flex-col",
                  p.popular ? "border-[#C5A059] bg-[#C5A059]/5" : "border-white/10 bg-white/[0.02]"
                )}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C5A059] text-[#0a0a0a] text-[10px] font-bold uppercase px-3 py-1 rounded-full">
                    Más Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-[#f5f5f0]">RestoPanel {p.label}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-[#f5f5f0]">{cycle === "monthly" ? p.monthly : p.yearly}€</span>
                  <span className="text-sm text-neutral-500">/{cycle === "monthly" ? "mes" : "año"}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-neutral-400 flex-1 mb-4">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => checkoutMut.mutate({ planName: p.name, billingCycle: cycle })}
                  disabled={checkoutMut.isPending || p.name === plan?.planName}
                  className={cn(
                    "w-full",
                    p.popular ? "bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" : "bg-white/5 border border-white/10 text-[#f5f5f0] hover:bg-white/10"
                  )}
                >
                  {p.name === plan?.planName ? "Plan actual" : "Elegir plan"}
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Payment methods */}
      {paymentMethods.length > 0 && (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f0] mb-3">Método de pago</h3>
          {paymentMethods.map((pm: any) => (
            <div key={pm.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
              <CreditCard className="w-5 h-5 text-[#C5A059]" />
              <div>
                <p className="text-sm text-[#f5f5f0] capitalize">{pm.brand} •••• {pm.last4}</p>
                <p className="text-xs text-neutral-500">Vence {pm.exp_month}/{pm.exp_year}</p>
              </div>
              {pm.is_default && <span className="ml-auto text-[10px] text-[#C5A059] font-semibold">PRINCIPAL</span>}
            </div>
          ))}
        </div>
      )}

      {/* Invoices */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#f5f5f0] mb-3">Historial de facturas</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-6">No hay facturas todavía</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-lg">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", inv.status === "paid" ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400")}>
                  {inv.status === "paid" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f5f5f0]">{inv.number || "Factura"}</p>
                  <p className="text-xs text-neutral-500">{new Date(inv.created_at).toLocaleDateString("es-ES")} · {inv.amount_paid}€</p>
                </div>
                {inv.invoice_pdf_url && (
                  <a href={inv.invoice_pdf_url} target="_blank" rel="noreferrer" className="text-[#C5A059] hover:underline text-xs flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel subscription */}
      {plan?.status === "active" && !plan?.cancelAtPeriodEnd && (
        <div className="text-center">
          <button
            onClick={() => {
              if (confirm("¿Cancelar la suscripción al final del periodo? Mantendrás acceso hasta la fecha de renovación.")) {
                subMut.mutate("cancel");
              }
            }}
            className="text-xs text-neutral-500 hover:text-red-400"
          >
            Cancelar suscripción
          </button>
        </div>
      )}
    </div>
  );
}

function UsageBar({ icon, label, current, limit }: { icon: React.ReactNode; label: string; current: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (current / limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-neutral-400 flex items-center gap-1.5">{icon} {label}</span>
        <span className="text-xs font-semibold text-[#f5f5f0]">{current}{limit ? `/${limit}` : ""}</span>
      </div>
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", pct > 80 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : "bg-[#C5A059]")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
