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
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MenuItemPreview {
  name: string;
  description?: string;
  price?: string;
  category?: string;
  image?: string;
}

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
    tiktok?: string;
    youtube?: string;
  };
  menuItems: MenuItemPreview[];
  diff?: {
    newItems: MenuItemPreview[];
    changedItems: Array<{ name: string; oldPrice?: string; newPrice?: string }>;
    unchangedItems: string[];
    removedItems: string[];
  };
  crawledPages: Array<{ url: string; status: number }>;
  meta: {
    totalMenuItems: number;
    htmlSize: number;
    ogLocale: string | null;
    detectedVia: string;
    crawlError?: string | null;
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
      const itemsCount = j.preview.menuItems.length;
      const newCount = j.preview.diff?.newItems.length ?? 0;
      toast.success(
        `Análisis completado. ${itemsCount} platos detectados${newCount > 0 ? `, ${newCount} nuevos` : ""}.`
      );
    } catch {
      setError("Error de red al conectar con la web.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyNew() {
    if (!preview?.diff?.newItems.length) {
      toast.info("No hay platos nuevos que añadir.");
      return;
    }
    setApplying(true);
    try {
      let created = 0;
      for (const item of preview.diff.newItems) {
        const r = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            description: item.description || "",
            price: parseFloat(item.price || "0"),
            image: item.image || null,
          }),
        });
        if (r.ok) created++;
      }
      toast.success(`${created} platos añadidos a tu carta.`);
      // Re-analyze to refresh diff
      await handleReanalyze();
    } catch {
      toast.error("Error al añadir platos");
    } finally {
      setApplying(false);
    }
  }

  async function handleApplyRestaurantInfo() {
    if (!preview?.restaurant) return;
    setApplying(true);
    try {
      const patch: any = {};
      if (preview.restaurant.name) patch.name = preview.restaurant.name;
      if (preview.restaurant.phone) patch.phone = preview.restaurant.phone;
      if (preview.restaurant.email) patch.email = preview.restaurant.email;
      if (preview.restaurant.address) patch.address = preview.restaurant.address;
      if (preview.restaurant.website) patch.website_url = preview.restaurant.website;
      if (preview.restaurant.description) patch.description = preview.restaurant.description;

      if (Object.keys(patch).length > 0) {
        const r = await fetch("/api/restaurant", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!r.ok) {
          const j = await r.json();
          toast.error(j.error || "Error al guardar datos del restaurante");
          return;
        }
      }
      toast.success("Datos del restaurante actualizados.");
    } catch {
      toast.error("Error al aplicar los cambios");
    } finally {
      setApplying(false);
    }
  }

  async function handleReanalyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/restaurant/import-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (r.ok) {
        setPreview(j.preview);
        toast.success("Análisis actualizado.");
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
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
              Introduce la URL de tu restaurante. Analizamos automáticamente la página principal y las sub-páginas
              relacionadas (carta, contacto, horarios), extraemos toda la información pública disponible y la comparamos
              con lo que ya tienes en tu panel para mostrarte solo lo que ha cambiado.
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
                Causas comunes: la web bloquea bots (Cloudflare), requiere JavaScript para renderizar el contenido, o
                sirve la carta desde una API privada. En ese caso puedes introducir los datos manualmente en las otras
                pestañas, o subir tu carta en formato PDF/imagen y la procesaremos aparte.
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
            {/* Preview header */}
            <div className="bg-[#111518] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="bg-gradient-to-r from-[#C5A059]/15 to-transparent px-5 py-3 border-b border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-[#f5f5f0]">Vista previa del análisis</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                  <span>Detectado vía: <span className="text-[#C5A059]">{preview.meta.detectedVia}</span></span>
                  {preview.crawledPages.length > 0 && (
                    <span>{preview.crawledPages.length} sub-páginas analizadas</span>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Restaurant info */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Datos del restaurante</p>
                    <Button
                      onClick={handleApplyRestaurantInfo}
                      disabled={applying}
                      size="sm"
                      className="h-7 text-[11px] bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
                    >
                      {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Aplicar datos</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PreviewField icon={<UtensilsCrossed className="w-3.5 h-3.5" />} label="Nombre" value={preview.restaurant.name} />
                    <PreviewField icon={<Phone className="w-3.5 h-3.5" />} label="Teléfono" value={preview.restaurant.phone} />
                    <PreviewField icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={preview.restaurant.email} />
                    <PreviewField icon={<MapPin className="w-3.5 h-3.5" />} label="Dirección" value={preview.restaurant.address} />
                    <PreviewField icon={<Clock className="w-3.5 h-3.5" />} label="Horarios" value={preview.restaurant.openingHours} />
                    <PreviewField icon={<Sparkles className="w-3.5 h-3.5" />} label="Tipo de cocina" value={preview.restaurant.servesCuisine} />
                  </div>
                </div>

                {/* Description */}
                {preview.restaurant.description && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Descripción</p>
                    <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">{preview.restaurant.description}</p>
                  </div>
                )}

                {/* Social */}
                {Object.keys(preview.social).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Redes sociales detectadas</p>
                    <div className="flex flex-wrap gap-2">
                      {preview.social.instagram && <SocialChip icon={<Instagram className="w-3.5 h-3.5" />} label="Instagram" href={preview.social.instagram} />}
                      {preview.social.facebook && <SocialChip icon={<Facebook className="w-3.5 h-3.5" />} label="Facebook" href={preview.social.facebook} />}
                      {preview.social.whatsapp && <SocialChip icon={<Phone className="w-3.5 h-3.5" />} label="WhatsApp" href={preview.social.whatsapp} />}
                      {preview.social.tripadvisor && <SocialChip icon={<Globe className="w-3.5 h-3.5" />} label="TripAdvisor" href={preview.social.tripadvisor} />}
                      {preview.social.tiktok && <SocialChip icon={<Globe className="w-3.5 h-3.5" />} label="TikTok" href={preview.social.tiktok} />}
                      {preview.social.youtube && <SocialChip icon={<Globe className="w-3.5 h-3.5" />} label="YouTube" href={preview.social.youtube} />}
                    </div>
                  </div>
                )}

                {/* Diff summary */}
                {preview.diff && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Comparativa con tu carta actual</p>
                      {preview.diff.newItems.length > 0 && (
                        <Button
                          onClick={handleApplyNew}
                          disabled={applying}
                          size="sm"
                          className="h-7 text-[11px] bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
                        >
                          {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" />Añadir {preview.diff.newItems.length} nuevos</>}
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <DiffStat count={preview.diff.newItems.length} label="Nuevos" icon={<Plus className="w-3 h-3" />} color="text-green-400" bg="bg-green-500/10 border-green-500/20" />
                      <DiffStat count={preview.diff.changedItems.length} label="Cambiados" icon={<ArrowUp className="w-3 h-3" />} color="text-[#C5A059]" bg="bg-[#C5A059]/10 border-[#C5A059]/20" />
                      <DiffStat count={preview.diff.removedItems.length} label="No detectados" icon={<Minus className="w-3 h-3" />} color="text-red-400" bg="bg-red-500/10 border-red-500/20" />
                    </div>
                  </div>
                )}

                {/* New items */}
                {preview.diff && preview.diff.newItems.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-green-400 mb-2">Platos nuevos detectados ({preview.diff.newItems.length})</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {preview.diff.newItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-green-500/5 rounded-lg border border-green-500/15 p-2.5">
                          <Plus className="w-3 h-3 text-green-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#f5f5f0] truncate">{item.name}</p>
                            {item.description && <p className="text-[10px] text-neutral-500 truncate">{item.description}</p>}
                          </div>
                          {item.price && <span className="text-xs font-bold text-[#C5A059] flex-shrink-0">{item.price}€</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changed items */}
                {preview.diff && preview.diff.changedItems.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#C5A059] mb-2">Cambios de precio detectados ({preview.diff.changedItems.length})</p>
                    <div className="space-y-1.5">
                      {preview.diff.changedItems.slice(0, 10).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#C5A059]/5 rounded-lg border border-[#C5A059]/15 p-2.5">
                          <ArrowUp className="w-3 h-3 text-[#C5A059] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#f5f5f0] truncate">{item.name}</p>
                          </div>
                          <span className="text-[10px] text-neutral-500 line-through">{item.oldPrice}€</span>
                          <ArrowDown className="w-3 h-3 text-neutral-600" />
                          <span className="text-xs font-bold text-[#C5A059]">{item.newPrice}€</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All detected items (if no diff or for reference) */}
                {!preview.diff && preview.menuItems.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                      Platos detectados ({preview.menuItems.length})
                    </p>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {preview.menuItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/[0.02] rounded-lg border border-white/[0.04] p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#f5f5f0] truncate">{item.name}</p>
                            {item.description && <p className="text-[10px] text-neutral-500 truncate">{item.description}</p>}
                          </div>
                          {item.price && <span className="text-xs font-bold text-[#C5A059] flex-shrink-0">{item.price}€</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crawled pages */}
                {preview.crawledPages.length > 0 && (
                  <details className="text-[11px] text-neutral-500">
                    <summary className="cursor-pointer hover:text-neutral-300">Sub-páginas analizadas ({preview.crawledPages.length})</summary>
                    <ul className="mt-1.5 space-y-0.5 pl-3">
                      {preview.crawledPages.map((p, i) => (
                        <li key={i} className="truncate">
                          <span className={p.status === 200 ? "text-green-400" : "text-neutral-600"}>{p.status}</span> {p.url}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Limitations */}
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                  <p className="text-[11px] text-blue-300/80 leading-relaxed">
                    <strong>Cómo funciona:</strong> El importador lee el HTML público de tu web y extrae la información
                    automáticamente. Los platos nuevos se añaden a tu carta con un clic. Los cambios de precio y los
                    platos no detectados se muestran para que decidas qué hacer. La sincronización no es automática hacia
                    tu web — para eso necesitas una integración oficial (WordPress, Shopify, etc.).
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleReanalyze} variant="outline" className="border-white/15 text-neutral-300 hover:bg-white/5 h-10">
                    <Globe className="w-4 h-4 mr-1.5" />Re-analizar
                  </Button>
                  <Button
                    onClick={() => { setPreview(null); setUrl(""); }}
                    variant="outline"
                    className="border-white/15 text-neutral-300 hover:bg-white/5 h-10"
                  >
                    Cerrar
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

function DiffStat({ count, label, icon, color, bg }: { count: number; label: string; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div className={`${bg} border rounded-lg p-2.5 text-center`}>
      <div className={`flex items-center justify-center gap-1 ${color} mb-0.5`}>
        {icon}
        <span className="text-lg font-bold">{count}</span>
      </div>
      <p className="text-[10px] text-neutral-400">{label}</p>
    </div>
  );
}
