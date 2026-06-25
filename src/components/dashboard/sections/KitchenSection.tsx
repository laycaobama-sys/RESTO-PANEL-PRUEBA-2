"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatCurrency, minutesBetween } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { ChefHat, Loader2, Check, X, Flame, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  notes?: string | null;
  menuItem: { id: string; name: string };
}
interface Order {
  id: string;
  number: number;
  status: string;
  total: number;
  createdAt: string;
  table?: { number: string; name?: string | null; zone: string } | null;
  orderItems: OrderItem[];
}

export function KitchenSection() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["kitchen-orders"],
    queryFn: () => api("/api/orders?status=PREPARING&limit=50"),
    refetchInterval: 15000,
  });

  const { data: pending = [] } = useQuery<Order[]>({
    queryKey: ["kitchen-pending"],
    queryFn: () => api("/api/orders?status=PENDING&limit=50"),
    refetchInterval: 15000,
  });

  const advance = useMutation({
    mutationFn: (id: string) =>
      api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "advance" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      qc.invalidateQueries({ queryKey: ["kitchen-pending"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Pedido marcado como servido");
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      qc.invalidateQueries({ queryKey: ["kitchen-pending"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido cancelado");
    },
  });

  const now = new Date();

  return (
    <div>
      <SectionHeader
        title="Cocina · KDS"
        subtitle="Pedidos en preparación y pendientes. Actualización automática cada 15s."
        actions={
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            En directo
          </div>
        }
      />

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : orders.length === 0 && pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ececed]">
          <EmptyState
            icon={<ChefHat className="w-6 h-6" />}
            title="Cocina al día"
            description="No hay pedidos pendientes ni en preparación. ¡Buen trabajo!"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preparing - in progress */}
          {orders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-[#FF6B35]" />
                <h3 className="font-semibold text-neutral-900">
                  En preparación
                </h3>
                <span className="text-xs text-neutral-500">
                  {orders.length} pedidos
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {orders.map((o, i) => (
                  <KitchenCard
                    key={o.id}
                    order={o}
                    now={now}
                    delay={i * 0.04}
                    onAdvance={() => advance.mutate(o.id)}
                    onCancel={() => cancel.mutate(o.id)}
                    loading={advance.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending - queue */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-yellow-500" />
                <h3 className="font-semibold text-neutral-900">
                  En cola (pendientes)
                </h3>
                <span className="text-xs text-neutral-500">
                  {pending.length} pedidos
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pending.map((o, i) => (
                  <KitchenCard
                    key={o.id}
                    order={o}
                    now={now}
                    delay={i * 0.04}
                    pending
                    onAdvance={() => advance.mutate(o.id)}
                    onCancel={() => cancel.mutate(o.id)}
                    loading={advance.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KitchenCard({
  order,
  now,
  delay,
  pending,
  onAdvance,
  onCancel,
  loading,
}: {
  order: Order;
  now: Date;
  delay: number;
  pending?: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const minutes = minutesBetween(order.createdAt, now);
  const urgent = minutes >= 15;
  const warning = minutes >= 10 && minutes < 15;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={cn(
        "bg-white rounded-2xl border-2 p-4",
        urgent
          ? "border-red-200"
          : warning
          ? "border-yellow-200"
          : pending
          ? "border-[#ececed]"
          : "border-[#FF6B35]/30"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-neutral-400">#{order.number}</p>
          <p className="font-bold text-neutral-900 text-base">
            {order.table?.name || order.table?.number ? `Mesa ${order.table?.number}` : "Para llevar"}
          </p>
        </div>
        <div
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-md",
            urgent
              ? "bg-red-100 text-red-700"
              : warning
              ? "bg-yellow-100 text-yellow-700"
              : "bg-neutral-100 text-neutral-600"
          )}
        >
          {minutes} min
        </div>
      </div>

      <div className="space-y-1.5 mb-3 border-t border-dashed border-[#ececed] pt-3">
        {order.orderItems.map((i) => (
          <div key={i.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-5 h-5 px-1 rounded text-xs font-bold",
                  pending ? "bg-yellow-100 text-yellow-700" : "bg-[#FF6B35] text-white"
                )}
              >
                {i.quantity}
              </span>
              <span className="font-medium text-neutral-900">
                {i.menuItem.name}
              </span>
            </div>
            {i.notes && (
              <p className="text-xs text-neutral-500 ml-7 italic">
                → {i.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white"
          onClick={onAdvance}
          disabled={loading}
        >
          <Check className="w-4 h-4 mr-1" />
          {pending ? "Empezar" : "Listo"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-red-600 border-red-200 hover:bg-red-50"
          onClick={onCancel}
          disabled={loading}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
