"use client";

import { useAppStore, type Section } from "@/lib/store";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Menu as MenuIcon,
  LogOut,
  ChevronDown,
  Settings,
  User as UserIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { TenantSearch } from "./TenantSearch";
import { TenantNotificationBell } from "./TenantNotificationBell";

const SECTION_TITLES: Record<Section, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Resumen del día de tu restaurante" },
  orders: { title: "Pedidos", subtitle: "Gestiona todos los pedidos en tiempo real" },
  tables: { title: "Mesas", subtitle: "Estado y configuración de las mesas" },
  kitchen: { title: "Cocina", subtitle: "Pedidos en preparación (KDS)" },
  menus: { title: "Menús / Carta", subtitle: "Administra categorías y platos" },
  analytics: { title: "Analíticas", subtitle: "Métricas y rendimiento del restaurante" },
  reservations: { title: "Reservas", subtitle: "Listado y gestión de reservas" },
  settings: { title: "Ajustes", subtitle: "Configuración del restaurante" },
  public: { title: "Carta pública", subtitle: "Vista que ven tus clientes" },
};

export function Topbar({
  user,
}: {
  user: {
    name: string;
    email: string;
    restaurantName: string;
    role?: string;
  };
}) {
  const section = useAppStore((s) => s.section);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const meta = SECTION_TITLES[section];

  return (
    <header className="sticky top-0 z-30 bg-[#0d0f12]/85 backdrop-blur-md border-b border-white/[0.06] h-16 flex items-center px-3 sm:px-6 gap-2 sm:gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 -ml-1 text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0] rounded-md flex-shrink-0"
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-shrink-0 lg:flex-1 lg:min-w-0">
        <h1 className="text-sm sm:text-lg font-semibold text-[#f5f5f0] leading-tight truncate">
          <span className="hidden sm:inline">{meta.title}</span>
          <span className="sm:hidden">{meta.title.split(" ")[0]}</span>
        </h1>
        <p className="text-xs text-neutral-500 truncate hidden lg:block">{meta.subtitle}</p>
      </div>

      <div className="hidden sm:block flex-1 max-w-md">
        <TenantSearch />
      </div>

      <TenantNotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-full hover:bg-white/[0.03] flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-xs font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-neutral-300">{user.name.split(" ")[0]}</span>
            <ChevronDown className="w-4 h-4 text-neutral-500 hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[#111518] border-white/[0.06]">
          <DropdownMenuLabel className="text-[#f5f5f0]">
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-neutral-500 font-normal">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem disabled className="text-neutral-400">
            <UserIcon className="w-4 h-4 mr-2" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => useAppStore.getState().setSection("settings")} className="text-neutral-300 hover:bg-white/[0.03] hover:text-[#f5f5f0]">
            <Settings className="w-4 h-4 mr-2" />
            Ajustes
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300 hover:bg-red-500/10"
            onClick={async () => {
              toast.success("Cerrando sesión...");
              await signOut({ redirect: false, callbackUrl: "/" });
              setTimeout(() => window.location.reload(), 150);
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
