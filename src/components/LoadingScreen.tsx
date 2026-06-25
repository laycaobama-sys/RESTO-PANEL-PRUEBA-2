"use client";

import { Loader2, UtensilsCrossed } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f6f6f7] gap-4">
      <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white">
        <UtensilsCrossed className="w-6 h-6" />
      </div>
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando RestoPanel...
      </div>
    </div>
  );
}
