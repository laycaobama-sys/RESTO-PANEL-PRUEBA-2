"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { OrderStatusBadge } from "@/components/shared/StatusBadge";
import {
  ClipboardList,
  Search,
  Plus,
  ChevronRight,
  X,
  Loader2,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  menuItem: { id: string; name: string; price: number };
}
interface Order {
  id: string;
  number: number;
  status: string;
  orderType: string;
  total: number;
  notes?: string | null;
  createdAt: string;
  table?: { id: string; number: string; name?: string | null; zone: string } | null;
  orderItems: OrderItem[];
}

const FILTERS = [
  { id: "ALL", label: "Todos" },
  { id: "PENDING", label: "Pendientes" },
  { id: "PREPARING", label: "Preparando" },
  { id: "SERVED", label: "Servidos" },
  { id: "COMPLETED", label: "Completados" },
  { id: "CANCELLED", label: "Cancelados" },
];

export function OrdersSection() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", filter],
    queryFn: () =>
      api(
        `/api/orders?limit=200${
          filter !== "ALL" ? `&status=${filter}` : ""
        }`
      ),
  });

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.number).includes(q) ||
      o.table?.number?.toLowerCase().includes(q) ||
      o.orderItems.some((i) => i.menuItem.name.toLowerCase().includes(q))
    );
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "advance" | "cancel" }) =>
      api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader
        title="Pedidos"
        subtitle="Gestiona todos los pedidos en tiempo real"
        actions={
          <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo pedido
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Tabs value={filter} onValueChange={setFilter} className="flex-1 overflow-x-auto">
          <TabsList className="bg-[#111518] border border-white/[0.06] h-9 p-1">
            {FILTERS.map((f) => (
              <TabsTrigger
                key={f.id}
                value={f.id}
                className="text-xs data-[state=active]:bg-[#C5A05910] data-[state=active]:text-[#C5A059]"
              >
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Buscar pedido, mesa o plato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-[#111518] border-white/[0.06]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06]">
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title="No hay pedidos"
            description="Los pedidos que crees aparecerán aquí. Crea el primero con el botón de arriba."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onView={() => setSelected(o)}
              onAdvance={() =>
                advanceMutation.mutate({ id: o.id, action: "advance" })
              }
            />
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Pedido #{selected?.number}</span>
              {selected && <OrderStatusBadge status={selected.status} />}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Mesa" value={selected.table?.name || selected.table?.number || "Para llevar"} />
                <Info label="Tipo" value={selected.orderType === "DINE_IN" ? "En mesa" : selected.orderType === "TAKEAWAY" ? "Para llevar" : "Delivery"} />
                <Info label="Hora" value={formatDateTime(selected.createdAt)} />
                <Info label="Tiempo" value={timeAgo(selected.createdAt)} />
              </div>
              <div className="border-t border-white/[0.06] pt-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                  Platos
                </p>
                <div className="space-y-2">
                  {selected.orderItems.map((i) => (
                    <div key={i.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex-1">
                        <p className="font-medium text-[#f5f5f0]">
                          {i.quantity}× {i.menuItem.name}
                        </p>
                        {i.notes && (
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Nota: {i.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-neutral-400">
                        {formatCurrency(i.unitPrice * i.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
                <span className="font-medium text-neutral-300">Total</span>
                <span className="text-xl font-bold text-[#C5A059]">
                  {formatCurrency(selected.total)}
                </span>
              </div>
              {selected.notes && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-800">
                  <strong>Nota del cliente:</strong> {selected.notes}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {selected.status !== "COMPLETED" && selected.status !== "CANCELLED" && (
                  <>
                    <Button
                      className="flex-1 bg-[#C5A059] hover:bg-[#b08d4e] text-white"
                      onClick={() =>
                        advanceMutation.mutate({ id: selected.id, action: "advance" })
                      }
                      disabled={advanceMutation.isPending}
                    >
                      {advanceMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Avanzar estado
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() =>
                        advanceMutation.mutate({ id: selected.id, action: "cancel" })
                      }
                      disabled={advanceMutation.isPending}
                    >
                      Cancelar pedido
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({
  order,
  onView,
  onAdvance,
}: {
  order: Order;
  onView: () => void;
  onAdvance: () => void;
}) {
  const totalItems = order.orderItems.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="bg-[#111518] rounded-xl border border-white/[0.06] p-4 hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-neutral-400">#{order.number}</p>
          <p className="font-semibold text-[#f5f5f0]">
            {order.table?.name || order.table?.number ? `Mesa ${order.table?.number}` : "Para llevar"}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="space-y-1 mb-3 max-h-24 overflow-hidden">
        {order.orderItems.slice(0, 3).map((i) => (
          <div key={i.id} className="text-xs text-neutral-400 truncate">
            <span className="font-medium text-[#f5f5f0]">{i.quantity}×</span>{" "}
            {i.menuItem.name}
          </div>
        ))}
        {order.orderItems.length > 3 && (
          <p className="text-xs text-neutral-400">
            +{order.orderItems.length - 3} más...
          </p>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
        <span>{totalItems} platos · {timeAgo(order.createdAt)}</span>
        <span className="font-bold text-base text-[#C5A059]">
          {formatCurrency(order.total)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs"
          onClick={onView}
        >
          <Eye className="w-3 h-3 mr-1" />
          Ver
        </Button>
        {(order.status === "PENDING" || order.status === "PREPARING" || order.status === "SERVED") && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-[#C5A059] hover:bg-[#b08d4e] text-white"
            onClick={onAdvance}
          >
            Avanzar
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-sm font-medium text-[#f5f5f0]">{value}</p>
    </div>
  );
}
