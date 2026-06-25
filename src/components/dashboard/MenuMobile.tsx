"use client";

import { useAppStore } from "@/lib/store";
import { Menu as MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "dashboard", label: "Inicio", short: "Inicio" },
  { id: "orders", label: "Pedidos", short: "Pedidos" },
  { id: "tables", label: "Mesas", short: "Mesas" },
  { id: "kitchen", label: "Cocina", short: "Cocina" },
  { id: "menus", label: "Carta", short: "Carta" },
  { id: "analytics", label: "Analíticas", short: "Stats" },
  { id: "reservations", label: "Reservas", short: "Reservas" },
  { id: "settings", label: "Ajustes", short: "Ajustes" },
  { id: "public", label: "Carta pública", short: "Web" },
] as const;

export function MenuMobile({ restaurantName }: { restaurantName: string }) {
  const { section, setSection, sidebarOpen } = useAppStore();
  return (
    <div className="lg:hidden sticky top-16 z-20 bg-white/85 backdrop-blur border-b border-[#ececed] overflow-x-auto">
      <div className="flex items-center gap-1 px-3 py-2 min-w-max">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id as any)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
              section === s.id
                ? "bg-[#FF6B35] text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            {s.short}
          </button>
        ))}
      </div>
    </div>
  );
}
