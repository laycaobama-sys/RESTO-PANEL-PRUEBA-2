"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api"; import { formatCurrency } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder: number;
  visible: boolean;
  _count?: { menuItems: number };
}
interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  available: boolean;
  visible: boolean;
  allergens?: string | null;
  sortOrder: number;
  categoryId: string;
  category?: { id: string; name: string };
}

export function MenusSection() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    item?: MenuItem;
  }>({ open: false });
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category?: Category;
  }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "item"; id: string; name: string }
    | { type: "category"; id: string; name: string }
    | null
  >(null);

  const { data: categories = [], isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api("/api/categories"),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu-items", showHidden],
    queryFn: () => api(`/api/menu?all=${showHidden}`),
  });

  const filteredItems = items.filter((i) => {
    if (activeCategory !== "ALL" && i.categoryId !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["menu-items"] });
    qc.invalidateQueries({ queryKey: ["public-menu"] });
  };

  // Quick toggle visibility/availability
  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MenuItem> }) =>
      api(`/api/menu/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => invalidateAll(),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: typeof deleteTarget) => {
      if (!target) return;
      if (target.type === "item") {
        await api(`/api/menu/${target.id}`, { method: "DELETE" });
      } else {
        await api(`/api/categories/${target.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => {
      toast.success("Eliminado correctamente");
      invalidateAll();
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteTarget(null);
    },
  });

  return (
    <div>
      <SectionHeader
        title="Menús / Carta"
        subtitle="Los cambios que hagas aquí se reflejan al instante en tu carta pública"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setCategoryDialog({ open: true })}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Categoría
            </Button>
            <Button
              className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
              onClick={() => setItemDialog({ open: true })}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Añadir plato
            </Button>
          </>
        }
      />

      {/* Sync notice */}
      <div className="mb-4 flex items-start gap-2.5 bg-[#FFF3ED] border border-[#FFE0CB] rounded-xl p-3 text-sm">
        <div className="w-8 h-8 rounded-full bg-[#FF6B35]/10 flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-[#FF6B35]" />
        </div>
        <div className="flex-1 text-[#9a3b18]">
          <p className="font-medium">Sincronización con web pública activada</p>
          <p className="text-xs mt-0.5 opacity-80">
            Cualquier cambio (precio, foto, descripción, visible/oculto) se
            actualiza automáticamente en tu web. Tus clientes siempre ven la
            versión más reciente.
          </p>
        </div>
      </div>

      {/* Categories tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          onClick={() => setActiveCategory("ALL")}
          className={cn(
            "px-3.5 py-1.5 text-sm font-medium rounded-full whitespace-nowrap border transition-colors",
            activeCategory === "ALL"
              ? "bg-[#FF6B35] text-white border-[#FF6B35]"
              : "bg-white text-neutral-600 border-[#ececed] hover:bg-neutral-50"
          )}
        >
          Todos ({items.length})
        </button>
        {categories.map((c) => {
          const count = items.filter((i) => i.categoryId === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "px-3.5 py-1.5 text-sm font-medium rounded-full whitespace-nowrap border transition-colors flex items-center gap-1.5",
                activeCategory === c.id
                  ? "bg-[#FF6B35] text-white border-[#FF6B35]"
                  : "bg-white text-neutral-600 border-[#ececed] hover:bg-neutral-50"
              )}
            >
              {c.icon && <span>{c.icon}</span>}
              {c.name} ({count})
              {!c.visible && <EyeOff className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Buscar plato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white border-[#ececed]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer bg-white border border-[#ececed] rounded-lg px-3 h-10">
          <Switch
            checked={showHidden}
            onCheckedChange={setShowHidden}
            className="data-[state=checked]:bg-[#FF6B35]"
          />
          Mostrar ocultos
        </label>
      </div>

      {/* Items grid */}
      {itemsLoading || catLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ececed]">
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title={search ? "Sin resultados" : "Tu carta está vacía"}
            description={
              search
                ? "Prueba con otra búsqueda."
                : "Crea tu primera categoría y empieza a añadir platos. Se publicarán en tu web al instante."
            }
            action={
              !search && (
                <Button
                  className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
                  onClick={() => setItemDialog({ open: true })}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Añadir primer plato
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              delay={i * 0.03}
              onEdit={() => setItemDialog({ open: true, item })}
              onDelete={() =>
                setDeleteTarget({
                  type: "item",
                  id: item.id,
                  name: item.name,
                })
              }
              onToggleVisibility={() =>
                toggleMutation.mutate({
                  id: item.id,
                  data: { visible: !item.visible },
                })
              }
              onToggleAvailability={() =>
                toggleMutation.mutate({
                  id: item.id,
                  data: { available: !item.available },
                })
              }
            />
          ))}
        </div>
      )}

      {/* Item dialog */}
      <ItemDialog
        key={itemDialog.item?.id || "new-item"}
        open={itemDialog.open}
        item={itemDialog.item}
        categories={categories}
        onClose={() => setItemDialog({ open: false })}
        onSaved={() => {
          invalidateAll();
          setItemDialog({ open: false });
        }}
      />

      {/* Category dialog */}
      <CategoryDialog
        key={categoryDialog.category?.id || "new-cat"}
        open={categoryDialog.open}
        category={categoryDialog.category}
        onClose={() => setCategoryDialog({ open: false })}
        onSaved={() => {
          invalidateAll();
          setCategoryDialog({ open: false });
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "item" ? (
                <>
                  Vas a eliminar <strong>{deleteTarget?.name}</strong> de tu
                  carta. Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  Vas a eliminar la categoría{" "}
                  <strong>{deleteTarget?.name}</strong>. Si tiene platos
                  asociados, deberás eliminarlos o moverlos primero.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sí, eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemCard({
  item,
  delay,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleAvailability,
}: {
  item: MenuItem;
  delay: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onToggleAvailability: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={cn(
        "bg-white rounded-2xl border border-[#ececed] overflow-hidden group hover:shadow-md transition-all",
        !item.visible && "opacity-60"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-neutral-300" />
          </div>
        )}
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {!item.available && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500 text-white">
              Agotado
            </span>
          )}
          {!item.visible && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800/80 text-white backdrop-blur">
              Oculto
            </span>
          )}
        </div>
        {/* Quick actions overlay */}
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleVisibility}
            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-neutral-700 hover:bg-white shadow-sm"
            title={item.visible ? "Ocultar" : "Mostrar"}
          >
            {item.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-neutral-900 text-sm leading-tight">
            {item.name}
          </h3>
          <span className="font-bold text-[#FF6B35] whitespace-nowrap">
            {formatCurrency(item.price)}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-neutral-500 line-clamp-2 mb-3">
            {item.description}
          </p>
        )}
        {item.allergens && (
          <p className="text-[10px] text-neutral-400 mb-3">
            Alérgenos: {item.allergens}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#ececed]">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
            <Switch
              checked={item.available}
              onCheckedChange={onToggleAvailability}
              className="data-[state=checked]:bg-green-600 scale-90"
            />
            Disponible
          </label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-neutral-500 hover:text-[#FF6B35] hover:bg-[#FFF3ED]"
              onClick={onEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-neutral-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ItemDialog({
  open,
  item,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  item?: MenuItem;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item?.price?.toString() || "");
  const [image, setImage] = useState(item?.image || "");
  const [categoryId, setCategoryId] = useState(item?.categoryId || categories[0]?.id || "");
  const [allergens, setAllergens] = useState(item?.allergens || "");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setImage(url);
      toast.success("Imagen subida");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!price || Number(price) < 0) return toast.error("Precio inválido");
    if (!categoryId) return toast.error("Selecciona una categoría");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        image: image || null,
        categoryId,
        allergens: allergens.trim() || null,
        available,
        visible,
      };
      if (item) {
        await api(`/api/menu/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Plato actualizado · cartel público sincronizado");
      } else {
        await api("/api/menu", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Plato añadido a la carta");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? `Editar: ${item.name}` : "Nuevo plato"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Image upload */}
          <div className="md:col-span-2">
            <Label className="text-xs mb-1.5 block">Imagen del plato</Label>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 rounded-xl bg-neutral-100 border-2 border-dashed border-neutral-200 overflow-hidden flex items-center justify-center">
                {image ? (
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-neutral-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#ececed] rounded-lg text-sm cursor-pointer hover:bg-neutral-50">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </label>
                {image && (
                  <button
                    onClick={() => setImage("")}
                    className="block text-xs text-red-600 hover:underline"
                  >
                    Quitar imagen
                  </button>
                )}
                <p className="text-xs text-neutral-400">
                  JPG, PNG o WebP · Máximo 5MB · Recomendado 800×600px
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hamburguesa Clásica"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Precio (€) *</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="9.50"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Carne de ternera 150g, lechuga, tomate, queso..."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoría *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Alérgenos</Label>
            <Input
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="gluten, lactosa, huevo"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={available}
                onCheckedChange={setAvailable}
                className="data-[state=checked]:bg-green-600"
              />
              Disponible (no agotado)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={visible}
                onCheckedChange={setVisible}
                className="data-[state=checked]:bg-[#FF6B35]"
              />
              Visible en carta pública
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : item ? "Guardar cambios" : "Crear plato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "");
  const [visible, setVisible] = useState(category?.visible ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return toast.error("Nombre obligatorio");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim() || null,
        visible,
      };
      if (category) {
        await api(`/api/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Categoría actualizada");
      } else {
        await api("/api/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Categoría creada");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? `Editar: ${category.name}` : "Nueva categoría"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-3">
            <div className="w-16 space-y-1.5">
              <Label className="text-xs">Icono</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍔"
                maxLength={2}
                className="text-center text-xl"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Nombre de la categoría *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hamburguesas"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              className="data-[state=checked]:bg-[#FF6B35]"
            />
            Visible en la carta pública
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : category ? "Guardar" : "Crear categoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
