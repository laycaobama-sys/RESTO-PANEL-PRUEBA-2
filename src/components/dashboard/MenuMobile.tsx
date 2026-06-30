"use client";

import { useAppStore } from "@/lib/store";
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
  const { section, setSection } = useAppStore();
  return (
    <div className="lg:hidden sticky top-16 z-20 bg-[#0d0f12]/85 backdrop-blur border-b border-white/[0.06] overflow-x-auto">
      <div className="flex items-center gap-1 px-3 py-2 min-w-max">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id as any)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
              section === s.id
                ? "bg-[#C5A059] text-[#0a0a0a]"
                : "text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0]"
            )}
          >
            {s.short}
          </button>
        ))}
      </div>
    </div>
  );
}
