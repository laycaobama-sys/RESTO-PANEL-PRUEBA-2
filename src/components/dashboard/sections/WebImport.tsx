"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Instagram,
  Facebook,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ============================================================
// WebImport — Import data from a restaurant's existing website
// ============================================================
// Flow:
//   1. User enters their website URL
//   2. We fetch it server-side, parse schema.org + heuristics
//   3. Show a preview of detected fields (name, phone, address,
//      hours, social, menu items)
//   4. User clicks "Aplicar cambios" to save each section
//
// We never auto-save — the user reviews every field before it
// touches the database.
// ============================================================

interface Preview {
  url: string;
  fetchedAt: string;
  restaurant: {
    name: string | null;
    description: string | null;
    image: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    openingHours: string | null;
    servesCuisine: string | null;
    priceRange: string | null;
    website: string;
  };
  social: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    whatsapp?: string;
    tripadvisor?: string;
  };
  menuItems: Array<{
    name: string;
    description?: string;
    price?: string;
    category?: string;
    image?: string;
  }>;
  meta: {
    totalMenuItems: number;
    htmlSize: number;
    ogLocale: string | null;
    detectedVia: string;
  };
}

export function WebImport() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const r = await fetch("/api/restaurant/import-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message || "No pudimos importar la web.");
        toast.error(j.message || "Error al importar");
        return;
      }
      setPreview(j.preview);
      toast.success(`Importación completada. ${j.preview.menuItems.length} platos detectados.`);
    } catch {
      setError("Error de red al conectar con la web.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyAll() {
    if (!preview) return;
    setApplying(true);
    try {
      // Save restaurant info
      const restaurantPatch: any = {};
      if (preview.restaurant.name) restaurantPatch.name = preview.restaurant.name;
      if (preview.restaurant.phone) restaurantPatch.phone = preview.restaurant.phone;
      if (preview.restaurant.email) restaurantPatch.email = preview.restaurant.email;
      if (preview.restaurant.address) restaurantPatch.address = preview.restaurant.address;
      if (preview.restaurant.website) restaurantPatch.website_url = preview.restaurant.website;
      if (preview.restaurant.description) restaurantPatch.description = preview.restaurant.description;

      if (Object.keys(restaurantPatch).length > 0) {
        const r1 = await fetch("/api/restaurant", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(restaurantPatch),
        });
        if (!r1.ok) {
          const j = await r1.json();
          toast.error(j.error || "Error al guardar datos del restaurante");
          return;
        }
      }

      // Save menu items (creates new items in default category)
      if (preview.menuItems.length > 0) {
        for (const item of preview.menuItems) {
          await fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              description: item.description || "",
              price: parseFloat(item.price || "0"),
              image: item.image || null,
            }),
          });
        }
      }

      toast.success(`¡Importación aplicada! ${preview.menuItems.length} platos añadidos a la carta.`);
      setPreview(null);
      setUrl("");
      // Reload to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error("Error al aplicar los cambios");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#C5A059]/10 to-transparent rounded-2xl border border-[#C5A059]/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059] text-[#0a0a0a] flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#f5f5f0]">Importar desde tu web actual</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Introduce la URL de la página web de tu restaurante. Analizaremos automáticamente la información pública
              disponible (datos de contacto, horarios, redes sociales y carta/menú) y te mostraremos una vista previa
              antes de guardar nada.
            </p>
          </div>
        </div>
      </div>

      {/* URL input */}
      <form onSubmit={handleImport} className="flex gap-2">
        <div className="flex-1 relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mirestaurante.com"
            className="pl-9 h-11 bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"
            required
          />
        </div>
        <Button type="submit" disabled={loading || !url.trim()} className="h-11 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] font-semibold px-5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1.5" />Analizar web</>}
        </Button>
      </form>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">No pudimos importar la web</p>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
              <p className="text-[11px] text-neutral-500 mt-2">
                Si tu web usa JavaScript para renderizar el contenido, protege con Cloudflare, o exige login, el
                importador no podrá leerla. Puedes introducir los datos manualmente en las otras pestañas.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="bg-[#111518] rounded-2xl border border-white/[0.06] overflow-hidden">
              {/* Preview header */}
              <div className="bg-gradient-to-r from-[#C5A059]/15 to-transparent px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-[#f5f5f0]">Vista previa de la importación</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 flex-shrink-0">
                    Detectado vía: <span className="text-[#C5A059]">{preview.meta.detectedVia}</span>
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Restaurant info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <PreviewField icon={<UtensilsCrossed className="w-3.5 h-3.5" />} label="Nombre" value={preview.restaurant.name} />
                  <PreviewField icon={<Phone className="w-3.5 h-3.5" />} label="Teléfono" value={preview.restaurant.phone} />
                  <PreviewField icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={preview.restaurant.email} />
                  <PreviewField icon={<MapPin className="w-3.5 h-3.5" />} label="Dirección" value={preview.restaurant.address} />
                  <PreviewField icon={<Clock className="w-3.5 h-3.5" />} label="Horarios" value={preview.restaurant.openingHours} />
                  <PreviewField icon={<Sparkles className="w-3.5 h-3.5" />} label="Tipo de cocina" value={preview.restaurant.servesCuisine} />
                </div>

                {/* Description */}
                {preview.restaurant.description && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Descripción</p>
                    <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">{preview.restaurant.description}</p>
                  </div>
                )}

                {/* Social */}
                {(preview.social.instagram || preview.social.facebook || preview.social.whatsapp || preview.social.tripadvisor) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Redes sociales detectadas</p>
                    <div className="flex flex-wrap gap-2">
                      {preview.social.instagram && (
                        <SocialChip icon={<Instagram className="w-3.5 h-3.5" />} label="Instagram" href={preview.social.instagram} />
                      )}
                      {preview.social.facebook && (
                        <SocialChip icon={<Facebook className="w-3.5 h-3.5" />} label="Facebook" href={preview.social.facebook} />
                      )}
                      {preview.social.whatsapp && (
                        <SocialChip icon={<Phone className="w-3.5 h-3.5" />} label="WhatsApp" href={preview.social.whatsapp} />
                      )}
                      {preview.social.tripadvisor && (
                        <SocialChip icon={<Globe className="w-3.5 h-3.5" />} label="TripAdvisor" href={preview.social.tripadvisor} />
                      )}
                    </div>
                  </div>
                )}

                {/* Menu items */}
                {preview.menuItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Platos detectados ({preview.menuItems.length})
                      </p>
                      <span className="text-[10px] text-[#C5A059]">Se añadirán a tu carta</span>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {preview.menuItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/[0.02] rounded-lg border border-white/[0.04] p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#f5f5f0] truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-[10px] text-neutral-500 truncate">{item.description}</p>
                            )}
                          </div>
                          {item.price && (
                            <span className="text-xs font-bold text-[#C5A059] flex-shrink-0">{item.price}€</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Limitations note */}
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                  <p className="text-[11px] text-blue-300/80 leading-relaxed">
                    <strong>Limitaciones:</strong> La importación solo funciona con información públicamente accesible
                    en el HTML. Si tu web carga la carta con JavaScript o la sirve desde una API privada, es posible
                    que no detectemos todos los platos. Los platos importados no se sincronizan automáticamente con tu
                    web — son una copia para tu panel. Para sincronización bidireccional necesitas una integración
                    oficial (WordPress, Shopify, etc.) que configuraremos aparte.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleApplyAll}
                    disabled={applying}
                    className="flex-1 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-10 font-semibold"
                  >
                    {applying ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Aplicando...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-1.5" />Aplicar todo a mi panel</>
                    )}
                  </Button>
                  <Button
                    onClick={() => { setPreview(null); setUrl(""); }}
                    variant="outline"
                    className="border-white/15 text-neutral-300 hover:bg-white/5 h-10"
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviewField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/[0.04] p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-neutral-500">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      </div>
      {value ? (
        <p className="text-xs text-[#f5f5f0] truncate" title={value}>{value}</p>
      ) : (
        <p className="text-xs text-neutral-600 italic">No detectado</p>
      )}
    </div>
  );
}

function SocialChip({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[11px] text-neutral-300 bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1 hover:border-[#C5A059]/30 hover:text-[#C5A059] transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}
