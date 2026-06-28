"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Building2,
  Loader2,
  Eye,
  Pause,
  Play,
  AlertTriangle,
  Users,
  UtensilsCrossed,
  Grid3x3,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  created_at: string;
  usersCount: number;
  menuItemsCount: number;
  tablesCount: number;
  reservationsCount: number;
  ordersCount: number;
}

export function TenantsSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [impersonateTarget, setImpersonateTarget] = useState<Tenant | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<{ tenant: Tenant; action: "SUSPENDED" | "ACTIVE" } | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["admin-tenants"],
    queryFn: () => api("/api/admin/tenants"),
  });

  const filtered = tenants
    .filter((t) => statusFilter === "ALL" || t.status === statusFilter)
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase()));

  const impersonateMut = useMutation({
    mutationFn: (orgId: string) =>
      api("/api/admin/impersonate", { method: "POST", body: JSON.stringify({ organizationId: orgId }) }),
    onSuccess: () => {
      toast.success("Modo cliente activado. Recargando...");
      setTimeout(() => window.location.reload(), 800);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      api("/api/admin/tenants", { method: "PATCH", body: JSON.stringify({ id, status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setConfirmSuspend(null);
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#16161a] rounded-xl border border-[#27272a] p-3 flex flex-wrap gap-2 items-center">
        <input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 px-3 bg-[#1f1f23] border border-[#27272a] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FF6B35]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 bg-[#1f1f23] border border-[#27272a] rounded-md text-sm text-white"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="SUSPENDED">Suspendidas</option>
          <option value="PENDING">Pendientes</option>
        </select>
        <span className="text-xs text-neutral-500 ml-auto">{filtered.length} empresa(s)</span>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#16161a] rounded-2xl border border-[#27272a] py-12 text-center text-neutral-500">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
          No hay empresas que mostrar
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-[#16161a] rounded-xl border border-[#27272a] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#F94B1E] flex items-center justify-center text-white">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-neutral-500">
                      /{t.slug} · {t.city || "—"}, {t.country}
                    </p>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                <Stat icon={<Users className="w-3.5 h-3.5" />} value={t.usersCount} label="users" />
                <Stat icon={<UtensilsCrossed className="w-3.5 h-3.5" />} value={t.menuItemsCount} label="platos" />
                <Stat icon={<Grid3x3 className="w-3.5 h-3.5" />} value={t.tablesCount} label="mesas" />
                <Stat icon={<CalendarCheck className="w-3.5 h-3.5" />} value={t.reservationsCount} label="reservas" />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#27272a]">
                <Button
                  size="sm"
                  className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white h-8 text-xs flex-1"
                  onClick={() => setImpersonateTarget(t)}
                  disabled={t.status === "SUSPENDED"}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Entrar como cliente
                </Button>
                {t.status === "ACTIVE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setConfirmSuspend({ tenant: t, action: "SUSPENDED" })}
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" />
                    Suspender
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                    onClick={() => setConfirmSuspend({ tenant: t, action: "ACTIVE" })}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Activar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Impersonate confirmation */}
      <Dialog open={!!impersonateTarget} onOpenChange={(v) => !v && setImpersonateTarget(null)}>
        <DialogContent className="bg-[#16161a] border-[#27272a] text-white">
          <DialogHeader>
            <DialogTitle>Entrar como {impersonateTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <AlertTriangle className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-200">
                Vas a entrar al panel de este cliente con todos sus permisos.
                Esta acción queda registrada en el log de auditoría con tu email.
                Para volver a tu sesión de super admin, pulsa "Salir del modo cliente"
                en el banner que aparecerá arriba.
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              Mientras estés en modo impersonación, cualquier cambio que hagas
              (reservas, mesas, carta, ajustes) se hará en la cuenta del cliente.
              El cliente NO verá que estás dentro, pero el log de auditoría
              registrará tu acceso.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImpersonateTarget(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
              onClick={() => impersonateTarget && impersonateMut.mutate(impersonateTarget.id)}
              disabled={impersonateMut.isPending}
            >
              {impersonateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend/Activate confirmation */}
      <AlertDialog open={!!confirmSuspend} onOpenChange={(v) => !v && setConfirmSuspend(null)}>
        <AlertDialogContent className="bg-[#16161a] border-[#27272a] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSuspend?.action === "SUSPENDED" ? "¿Suspender empresa?" : "¿Activar empresa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSuspend?.action === "SUSPENDED"
                ? `${confirmSuspend?.tenant.name} no podrá iniciar sesión hasta que la reactives. Los datos NO se borran.`
                : `${confirmSuspend?.tenant.name} volverá a estar operativa inmediatamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmSuspend?.action === "SUSPENDED"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"}
              onClick={() => confirmSuspend && statusMut.mutate({ id: confirmSuspend.tenant.id, status: confirmSuspend.action })}
              disabled={statusMut.isPending}
            >
              {statusMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    ACTIVE: "bg-green-500/15 text-green-400",
    SUSPENDED: "bg-red-500/15 text-red-400",
    PENDING: "bg-yellow-500/15 text-yellow-400",
  }[status] || "bg-neutral-500/15 text-neutral-400";
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase", cls)}>
      {status}
    </span>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-[#1f1f23] rounded-lg p-2">
      <div className="flex items-center justify-center text-neutral-400 mb-0.5">{icon}</div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-neutral-600">{label}</p>
    </div>
  );
}
