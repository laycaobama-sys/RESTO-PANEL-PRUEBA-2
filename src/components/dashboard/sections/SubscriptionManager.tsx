"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, CreditCard, Calendar, Crown, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SubscriptionManager() {
  const { data, isLoading } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: () => api("/api/billing/subscription"),
  });

  const portalMut = useMutation({
    mutationFn: () => api("/api/billing/portal", { method: "POST" }),
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  const plan = (data as any)?.plan;
  if (!plan) return null;

  const trialDaysLeft = plan.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(plan.currentPeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const isTrialing = plan.status === "trial";
  const isActive = plan.status === "active";
  const isPastDue = plan.status === "past_due";
  const isCanceled = plan.status === "canceled";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Plan actual */}
      <div
        className={cn(
          "rounded-2xl p-6 border",
          isTrialing ? "bg-blue-500/5 border-blue-500/20"
          : isActive ? "bg-[#C5A059]/5 border-[#C5A059]/20"
          : isPastDue ? "bg-red-500/5 border-red-500/20"
          : "bg-white/[0.03] border-white/[0.08]"
        )}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Crown className="w-6 h-6 text-[#C5A059]" />
              <h2 className="text-2xl font-bold text-white">Plan {plan.planLabel}</h2>
              <span
                className={cn(
                  "text-xs px-3 py-1 rounded-full font-semibold uppercase",
                  isTrialing ? "bg-blue-500/15 text-blue-400"
                  : isActive ? "bg-green-500/15 text-green-400"
                  : isPastDue ? "bg-red-500/15 text-red-400"
                  : "bg-neutral-500/15 text-neutral-400"
                )}
              >
                {isTrialing ? "Prueba gratuita" : isActive ? "Activo" : isPastDue ? "Pago pendiente" : plan.status}
              </span>
            </div>

            {isTrialing && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400">
                  {trialDaysLeft} días restantes de prueba · Después se cobrarán {plan.billingCycle === "yearly" ? "anualmente" : "mensualmente"}
                </span>
              </div>
            )}

            {plan.currentPeriodEnd && !isTrialing && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-400">
                  Próximo cobro: {new Date(plan.currentPeriodEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            )}

            {plan.cancelAtPeriodEnd && (
              <div className="flex items-center gap-2 mt-3 text-sm text-orange-400">
                <AlertCircle className="w-4 h-4" />
                <span>Cancelada — activa hasta {plan.currentPeriodEnd ? new Date(plan.currentPeriodEnd).toLocaleDateString("es-ES") : "fin del periodo"}</span>
              </div>
            )}

            {isPastDue && (
              <div className="flex items-center gap-2 mt-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Pago pendiente. Actualiza tu método de pago para evitar la interrupción del servicio.</span>
              </div>
            )}
          </div>

          {plan.stripeCustomerId && (
            <Button
              onClick={() => portalMut.mutate()}
              disabled={portalMut.isPending}
              variant="outline"
              className="border-white/15 text-neutral-300"
            >
              {portalMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CreditCard className="w-4 h-4 mr-1.5" />}
              Gestionar facturación
            </Button>
          )}
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-neutral-400">Usuarios</span>
              <span className="text-xs font-semibold text-white">
                {(data as any)?.usage?.users || 0}{plan.maxUsers ? `/${plan.maxUsers}` : ""}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C5A059] rounded-full"
                style={{
                  width: plan.maxUsers
                    ? `${Math.min(100, ((data as any)?.usage?.users || 0) / plan.maxUsers * 100)}%`
                    : "100%"
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-neutral-400">Mesas</span>
              <span className="text-xs font-semibold text-white">
                {(data as any)?.usage?.tables || 0}{plan.maxTables ? `/${plan.maxTables}` : " ∞"}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C5A059] rounded-full"
                style={{
                  width: plan.maxTables
                    ? `${Math.min(100, ((data as any)?.usage?.tables || 0) / plan.maxTables * 100)}%`
                    : "5%"
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6">
        <h3 className="text-lg font-bold text-white mb-6">Cambiar de plan</h3>
        <PricingSectionInline currentPlan={plan.planName} />
      </div>
    </div>
  );
}

// Inline pricing (compact version for billing dashboard)
function PricingSectionInline({ currentPlan }: { currentPlan: string }) {
  const PLANS = [
    { id: "starter", name: "Starter", monthly: 59, yearly: 566, color: "#64748B" },
    { id: "professional", name: "Growth", monthly: 119, yearly: 1142, color: "#C5A059", popular: true },
    { id: "enterprise", name: "Enterprise", monthly: 249, yearly: 2390, color: "#8B5CF6" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {PLANS.map((p) => {
        const isCurrent = currentPlan === p.id;
        return (
          <div
            key={p.id}
            className={cn(
              "rounded-xl p-4 border text-center",
              isCurrent ? "bg-[#C5A059]/10 border-[#C5A059]/30" : "bg-white/[0.03] border-white/[0.06]"
            )}
          >
            <p className="text-xs font-semibold text-white mb-1">{p.name}</p>
            <p className="text-2xl font-bold" style={{ color: p.color }}>{p.monthly}€</p>
            <p className="text-[10px] text-neutral-500 mb-2">/mes</p>
            {isCurrent ? (
              <div className="flex items-center justify-center gap-1 text-xs text-[#C5A059]">
                <CheckCircle2 className="w-3 h-3" /> Actual
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-white/10 text-neutral-300"
                onClick={() => {
                  fetch("/api/stripe/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ planName: p.id, billingCycle: "monthly" }),
                  }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
                }}
              >
                Cambiar
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
