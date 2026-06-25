"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatCurrency } from "@/lib/format";
import { SectionHeader } from "@/components/shared/SectionHeader";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Clock,
  UtensilsCrossed,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PublicMenu {
  restaurant: {
    name: string;
    slug: string;
    description?: string | null;
    logo?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    primaryColor: string;
    currency: string;
    openingHours?: string | null;
    websiteUrl?: string | null;
    settings?: any;
  };
  categories: Array<{
    id: string;
    name: string;
    icon?: string | null;
    menuItems: Array<{
      id: string;
      name: string;
      description?: string | null;
      price: number;
      image?: string | null;
      available: boolean;
      allergens?: string | null;
    }>;
  }>;
}

export function PublicMenuSection({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery<PublicMenu>({
    queryKey: ["public-menu", slug],
    queryFn: () => api(`/api/public/${slug}`),
  });
  const [activeCat, setActiveCat] = useState<string>("");

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <SectionHeader title="Carta pública" subtitle="No disponible" />
        <p className="text-neutral-500">No se pudo cargar la carta pública.</p>
      </div>
    );
  }

  const { restaurant, categories } = data;
  const publicUrl = `/api/public/${slug}`;

  // Auto-select first category
  const activeCategory =
    categories.find((c) => c.id === activeCat) || categories[0];

  return (
    <div>
      <SectionHeader
        title="Carta pública"
        subtitle="Vista previa de lo que ven tus clientes en la web"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`);
              toast.success("URL copiada al portapapeles");
            }}
          >
            Copiar URL pública
          </Button>
        }
      />

      <div className="bg-white rounded-2xl border border-[#ececed] overflow-hidden max-w-5xl mx-auto">
        {/* Browser chrome */}
        <div className="border-b border-[#ececed] bg-neutral-50 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white border border-[#ececed] rounded-md px-3 py-1 text-xs text-neutral-500 font-mono truncate">
              {typeof window !== "undefined" ? window.location.origin : "https://tu-restaurante.es"}
              {publicUrl}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
        </div>

        {/* Restaurant hero */}
        <div className="relative bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white p-8 sm:p-10 overflow-hidden">
          <div className="absolute inset-0 opacity-15">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-yellow-200 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <UtensilsCrossed className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{restaurant.name}</h2>
              {restaurant.description && (
                <p className="text-white/85 mt-1 text-sm sm:text-base max-w-xl">
                  {restaurant.description}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-3 text-xs sm:text-sm text-white/90">
                {restaurant.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {restaurant.address}, {restaurant.city}
                  </span>
                )}
                {restaurant.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {restaurant.phone}
                  </span>
                )}
                {restaurant.openingHours && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {restaurant.openingHours}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sync indicator */}
        <div className="bg-[#FFF3ED] border-b border-[#FFE0CB] px-6 py-2.5 flex items-center gap-2 text-xs text-[#9a3b18]">
          <Check className="w-3.5 h-3.5" />
          Carta sincronizada en tiempo real · Última actualización: ahora mismo
        </div>

        {/* Categories nav */}
        <div className="sticky top-0 bg-white border-b border-[#ececed] z-10">
          <div className="px-4 py-3 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
                    activeCategory?.id === c.id
                      ? "bg-[#FF6B35] text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="p-4 sm:p-6">
          {activeCategory ? (
            <>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                {activeCategory.icon} {activeCategory.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeCategory.menuItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-xl border border-[#ececed] hover:border-[#FF6B35]/40 hover:shadow-sm transition-all",
                      !item.available && "opacity-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-neutral-900 text-sm">
                          {item.name}
                          {!item.available && (
                            <span className="ml-2 text-[10px] font-medium text-red-600 uppercase">
                              Agotado
                            </span>
                          )}
                        </p>
                        <span className="font-bold text-[#FF6B35] whitespace-nowrap">
                          {formatCurrency(item.price, restaurant.currency)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {item.allergens && (
                        <p className="text-[10px] text-neutral-400 mt-1.5">
                          Alérgenos: {item.allergens}
                        </p>
                      )}
                    </div>
                    {item.image && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
                {activeCategory.menuItems.length === 0 && (
                  <p className="text-sm text-neutral-400 col-span-2 py-8 text-center">
                    No hay platos en esta categoría
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-12">
              Tu carta está vacía. Añade platos desde la sección "Menús / Carta".
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#ececed] px-6 py-4 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} {restaurant.name} · Powered by RestoPanel
        </div>
      </div>
    </div>
  );
}
