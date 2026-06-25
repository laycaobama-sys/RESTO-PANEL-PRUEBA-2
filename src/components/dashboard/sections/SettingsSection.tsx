"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SectionHeader } from "@/components/shared/SectionHeader";
import {
  Loader2,
  Save,
  Store,
  Clock,
  ToggleLeft,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  description?: string | null;
  logo?: string | null;
  primaryColor: string;
  currency: string;
  openingHours?: string | null;
  websiteUrl?: string | null;
  publicEnabled: boolean;
  posEnabled: boolean;
  reservationsEnabled: boolean;
  settings?: {
    monOpen: string;
    monClose: string;
    tueOpen: string;
    tueClose: string;
    wedOpen: string;
    wedClose: string;
    thuOpen: string;
    thuClose: string;
    friOpen: string;
    friClose: string;
    satOpen: string;
    satClose: string;
    sunOpen: string;
    sunClose: string;
    taxRate: number;
    serviceCharge: number;
  } | null;
}

export function SettingsSection() {
  const qc = useQueryClient();
  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["restaurant"],
    queryFn: () => api("/api/restaurant"),
  });

  const [form, setForm] = useState<Partial<Restaurant>>({});
  const [hoursForm, setHoursForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const current = { ...restaurant, ...form } as Restaurant;
  const currentHours = { ...restaurant?.settings, ...hoursForm };

  const update = (key: keyof Restaurant, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateHours = (key: string, value: string) => {
    setHoursForm((h) => ({ ...h, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const settings =
        Object.keys(hoursForm).length > 0 ? hoursForm : undefined;
      const payload: any = { ...form };
      if (settings) payload.settings = settings;
      return api("/api/restaurant", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Cambios guardados · web pública actualizada");
      qc.invalidateQueries({ queryKey: ["restaurant"] });
      qc.invalidateQueries({ queryKey: ["public-menu"] });
      setForm({});
      setHoursForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleUploadLogo(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      update("logo", url);
      // Save immediately
      await api("/api/restaurant", {
        method: "PATCH",
        body: JSON.stringify({ logo: url }),
      });
      qc.invalidateQueries({ queryKey: ["restaurant"] });
      toast.success("Logo actualizado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  const dirty = Object.keys(form).length > 0 || Object.keys(hoursForm).length > 0;

  if (isLoading || !restaurant) {
    return (
      <div className="py-20 flex items-center justify-center text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Ajustes"
        subtitle="Configura tu restaurante y tu carta pública"
        actions={
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Guardar cambios
              </>
            )}
          </Button>
        }
      />

      <Tabs defaultValue="general">
        <TabsList className="bg-white border border-[#ececed] h-9 p-1 mb-5">
          <TabsTrigger value="general" className="data-[state=active]:bg-[#FFF3ED] data-[state=active]:text-[#FF6B35]">
            General
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-[#FFF3ED] data-[state=active]:text-[#FF6B35]">
            Branding
          </TabsTrigger>
          <TabsTrigger value="hours" className="data-[state=active]:bg-[#FFF3ED] data-[state=active]:text-[#FF6B35]">
            Horarios
          </TabsTrigger>
          <TabsTrigger value="modules" className="data-[state=active]:bg-[#FFF3ED] data-[state=active]:text-[#FF6B35]">
            Módulos
          </TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <div className="bg-white rounded-2xl border border-[#ececed] p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <Store className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="font-semibold text-neutral-900">
                Información del restaurante
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nombre del restaurante</Label>
                <Input value={current.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input value={current.phone || ""} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={current.email || ""} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dirección</Label>
                <Input value={current.address || ""} onChange={(e) => update("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ciudad</Label>
                  <Input value={current.city || ""} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código postal</Label>
                  <Input value={current.postalCode || ""} onChange={(e) => update("postalCode", e.target.value)} />
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Descripción (se muestra en la web pública)</Label>
                <Textarea
                  rows={3}
                  value={current.description || ""}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">URL web pública (opcional)</Label>
                <Input
                  value={current.websiteUrl || ""}
                  onChange={(e) => update("websiteUrl", e.target.value)}
                  placeholder="https://lazamorana.es"
                />
              </div>
              <div className="col-span-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                <p className="font-medium text-neutral-700 mb-1">URL pública de tu carta</p>
                <code className="text-[#FF6B35]">/api/public/{current.slug}</code>
                <p className="mt-1">Cualquier cambio en tu panel se refleja en esta URL.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <div className="bg-white rounded-2xl border border-[#ececed] p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <ImageIcon className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="font-semibold text-neutral-900">Branding y logo</h3>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-200 overflow-hidden flex items-center justify-center">
                {current.logo ? (
                  <img src={current.logo} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-neutral-300" />
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#ececed] rounded-lg text-sm cursor-pointer hover:bg-neutral-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {uploading ? "Subiendo..." : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLogo(f);
                    }}
                  />
                </label>
                <p className="text-xs text-neutral-400 mt-1.5">PNG o SVG · Cuadrado · Máx 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Color principal</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={current.primaryColor}
                    onChange={(e) => update("primaryColor", e.target.value)}
                    className="w-12 h-10 rounded-md border border-[#ececed] cursor-pointer"
                  />
                  <Input value={current.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Input value={current.currency} onChange={(e) => update("currency", e.target.value)} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Hours */}
        <TabsContent value="hours">
          <div className="bg-white rounded-2xl border border-[#ececed] p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="font-semibold text-neutral-900">Horarios de apertura</h3>
            </div>
            <div className="space-y-2">
              {[
                { day: "Lunes", o: "monOpen", c: "monClose" },
                { day: "Martes", o: "tueOpen", c: "tueClose" },
                { day: "Miércoles", o: "wedOpen", c: "wedClose" },
                { day: "Jueves", o: "thuOpen", c: "thuClose" },
                { day: "Viernes", o: "friOpen", c: "friClose" },
                { day: "Sábado", o: "satOpen", c: "satClose" },
                { day: "Domingo", o: "sunOpen", c: "sunClose" },
              ].map((d) => (
                <div key={d.o} className="grid grid-cols-3 items-center gap-3 py-2 border-b border-[#f1f1f3] last:border-0">
                  <Label className="text-sm text-neutral-700">{d.day}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={currentHours[d.o] || "09:00"}
                      onChange={(e) => updateHours(d.o, e.target.value)}
                      className="h-9"
                    />
                    <span className="text-neutral-400 text-xs">→</span>
                    <Input
                      type="time"
                      value={currentHours[d.c] || "23:00"}
                      onChange={(e) => updateHours(d.c, e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">IVA (%)</Label>
                <Input
                  type="number"
                  value={currentHours.taxRate ?? 10}
                  onChange={(e) => updateHours("taxRate", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Servicio (%)</Label>
                <Input
                  type="number"
                  value={currentHours.serviceCharge ?? 0}
                  onChange={(e) => updateHours("serviceCharge", Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Modules */}
        <TabsContent value="modules">
          <div className="bg-white rounded-2xl border border-[#ececed] p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <ToggleLeft className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="font-semibold text-neutral-900">Módulos visibles</h3>
            </div>
            <div className="space-y-4">
              <ModuleToggle
                title="Web pública activa"
                description="Si la desactivas, tu carta pública dejará de ser accesible para clientes."
                checked={current.publicEnabled}
                onCheckedChange={(v) => update("publicEnabled", v)}
              />
              <ModuleToggle
                title="POS y Pedidos"
                description="Activa el sistema de pedidos y el panel de cocina (KDS)."
                checked={current.posEnabled}
                onCheckedChange={(v) => update("posEnabled", v)}
              />
              <ModuleToggle
                title="Reservas online"
                description="Permite que los clientes soliciten reservas en tu web."
                checked={current.reservationsEnabled}
                onCheckedChange={(v) => update("reservationsEnabled", v)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModuleToggle({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-[#ececed]">
      <div className="flex-1">
        <p className="font-medium text-sm text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[#FF6B35]"
      />
    </div>
  );
}
