"use client";

import { Truck, ShoppingCart, Users, Calendar, Construction } from "lucide-react";

const ICONS: Record<string, any> = { truck: Truck, shopping: ShoppingCart, users: Users, calendar: Calendar };

export function SimpleSection({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  const Icon = ICONS[icon] || Construction;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-sm text-neutral-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#C5A059]/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-[#C5A059]" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Módulo disponible</h3>
        <p className="text-sm text-neutral-400 max-w-md mx-auto">
          Este módulo está integrado en la base de datos y las APIs están activas.
          La interfaz visual completa está en desarrollo. Las funcionalidades ya son accesibles vía API.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs">
          <Construction className="w-3 h-3" />
          UI en desarrollo · API operativa
        </div>
      </div>
    </div>
  );
}
