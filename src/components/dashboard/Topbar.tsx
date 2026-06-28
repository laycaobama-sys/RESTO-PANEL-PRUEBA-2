"use client";

import { useAppStore, type Section } from "@/lib/store";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Bell,
  Menu as MenuIcon,
  LogOut,
  ChevronDown,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-[#ececed] h-16 flex items-center px-4 sm:px-6 gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-md"
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-semibold text-neutral-900 leading-tight truncate">
          {meta.title}
        </h1>
        <p className="text-xs text-neutral-500 truncate hidden sm:block">
          {meta.subtitle}
        </p>
      </div>

      <div className="hidden md:flex items-center relative w-72">
        <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
        <Input
          placeholder="Buscar plato, pedido, mesa..."
          className="pl-9 h-9 bg-[#f6f6f7] border-transparent focus-visible:bg-white focus-visible:border-[#FF6B35]"
        />
      </div>

      <button className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-md">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B35] rounded-full ring-2 ring-white" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-neutral-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#F94B1E] text-white flex items-center justify-center text-xs font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-neutral-700">
              {user.name.split(" ")[0]}
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-400 hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-neutral-500 font-normal">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserIcon className="w-4 h-4 mr-2" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => useAppStore.getState().setSection("settings")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Ajustes
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-700"
            onClick={async () => {
              toast.success("Cerrando sesión...");
              // signOut clears the session cookie. The AppRouter listens to
              // useSession and will swap to AuthScreen automatically. We
              // also call router.refresh() so the server component re-reads
              // getServerSession and stops passing `user` to the client.
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
