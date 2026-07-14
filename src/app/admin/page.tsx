"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Crown, Building2, Users, AlertTriangle, TrendingUp, DollarSign, Activity, Shield, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Verificar si el usuario es super-admin
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (data?.user?.isSuperAdmin) {
          setIsSuperAdmin(true);
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setAuthChecked(true));
  }, [router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return <AdminDashboard />;
}

function AdminDashboard() {
  const router = useRouter();

  // Cargar stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api("/api/admin/stats"),
  });

  // Cargar tenants
  const { data: tenantsData } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => api("/api/admin/tenants"),
  });

  // Cargar sistema
  const { data: systemStatus } = useQuery({
    queryKey: ["admin-system"],
    queryFn: () => api("/api/admin/system-status"),
  });

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  };

  const tenants = (tenantsData as any)?.tenants || (tenantsData as any) || [];
  const s = (stats as any) || {};

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0d0f12]/85 backdrop-blur-md border-b border-white/[0.06] h-16 flex items-center px-6 gap-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#C5A059]" />
          <h1 className="text-lg font-semibold text-white">Panel Super-Admin</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/")}
            className="border-white/10 text-neutral-300"
          >
            Ver Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/landing")}
            className="border-white/10 text-neutral-300"
          >
            Ver Landing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-red-500/20 text-red-400"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPIs globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminKpi
            icon={<Building2 className="w-5 h-5" />}
            label="Restaurantes"
            value={s.total_organizations || s.organizations || 0}
            color="blue"
          />
          <AdminKpi
            icon={<Users className="w-5 h-5" />}
            label="Usuarios totales"
            value={s.total_users || s.users || 0}
            color="purple"
          />
          <AdminKpi
            icon={<DollarSign className="w-5 h-5" />}
            label="MRR estimado"
            value={`${(s.mrr || 0).toFixed(0)}€`}
            color="green"
          />
          <AdminKpi
            icon={<Activity className="w-5 h-5" />}
            label="Reservas hoy"
            value={s.reservations_today || 0}
            color="orange"
          />
        </div>

        {/* Estado del sistema */}
        {systemStatus && (
          <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#C5A059]" />
              <h3 className="text-sm font-semibold text-white">Estado del sistema</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <SystemStat label="Base de datos" status="online" />
              <SystemStat label="API" status="online" />
              <SystemStat label="Auth" status="online" />
              <SystemStat label="Webhooks" status="online" />
            </div>
          </div>
        )}

        {/* Lista de restaurantes */}
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#C5A059]" />
              <h3 className="text-sm font-semibold text-white">Restaurantes ({Array.isArray(tenants) ? tenants.length : 0})</h3>
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#C5A059]" />
            </div>
          ) : Array.isArray(tenants) && tenants.length > 0 ? (
            <div className="space-y-2">
              {tenants.slice(0, 20).map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: t.primary_color || "#FF6B35" + "20" }}>
                    {t.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.city || "—"} · {t.email || "—"}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase",
                    t.status === "ACTIVE" ? "bg-green-500/15 text-green-400" : "bg-neutral-500/15 text-neutral-400"
                  )}>
                    {t.status || "ACTIVE"}
                  </span>
                </div>
              ))}
              {tenants.length > 20 && (
                <p className="text-center text-xs text-neutral-500 py-2">
                  ...y {tenants.length - 20} más
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-neutral-500 py-6">No hay restaurantes registrados</p>
          )}
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon={<TrendingUp className="w-4 h-4" />} label="Analíticas globales" onClick={() => router.push("/?section=analytics")} />
          <QuickAction icon={<AlertTriangle className="w-4 h-4" />} label="Logs de auditoría" onClick={() => router.push("/api/admin/logs")} />
          <QuickAction icon={<Settings className="w-4 h-4" />} label="Configuración" onClick={() => router.push("/api/admin/settings")} />
          <QuickAction icon={<Users className="w-4 h-4" />} label="Usuarios" onClick={() => router.push("/api/admin/users")} />
        </div>
      </main>
    </div>
  );
}

function AdminKpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    green: "text-green-400 bg-green-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    orange: "text-orange-400 bg-orange-500/10",
  };
  return (
    <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-400 uppercase tracking-wide">{label}</span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colors[color])}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SystemStat({ label, status }: { label: string; status: "online" | "offline" }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
      <span className={cn("w-2 h-2 rounded-full", status === "online" ? "bg-green-400 animate-pulse" : "bg-red-400")} />
      <span className="text-neutral-300">{label}</span>
      <span className={cn("ml-auto text-[10px] uppercase", status === "online" ? "text-green-400" : "text-red-400")}>
        {status}
      </span>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#111518] rounded-xl border border-white/[0.06] p-4 hover:border-[#C5A059]/30 transition flex items-center gap-3 text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 flex items-center justify-center text-[#C5A059]">
        {icon}
      </div>
      <span className="text-xs text-neutral-300">{label}</span>
    </button>
  );
}
