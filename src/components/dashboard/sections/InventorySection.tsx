"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Plus, Package, AlertTriangle, TrendingDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";

export function InventorySection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", lowStockOnly],
    queryFn: () => api(`/api/inventory${lowStockOnly ? "?lowStock=true" : ""}`),
  });

  const items = ((data as any)?.items || []).filter((i: any) =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.barcode?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventario</h2>
          <p className="text-sm text-neutral-400 mt-0.5">Gestión de stock, costes y escandallos</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo item
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código de barras..."
            className="w-full bg-[#111518] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#C5A059]"
          />
        </div>
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={cn("px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5",
            lowStockOnly ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-white/5 text-neutral-400 border-white/10")}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Stock bajo
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-neutral-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay items de inventario</p>
        </div>
      ) : (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-neutral-400 uppercase">
                <th className="text-left p-3 font-medium">Item</th>
                <th className="text-right p-3 font-medium">Stock</th>
                <th className="text-right p-3 font-medium">Mín</th>
                <th className="text-right p-3 font-medium">P. compra</th>
                <th className="text-right p-3 font-medium">P. venta</th>
                <th className="text-right p-3 font-medium">Margen</th>
                <th className="text-center p-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const stock = Number(item.stock_current);
                const min = Number(item.stock_min);
                const margin = item.margin_pct !== null ? Number(item.margin_pct) : 0;
                const isLow = stock <= min;
                return (
                  <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="p-3">
                      <p className="text-white font-medium">{item.name}</p>
                      {item.barcode && <p className="text-[10px] text-neutral-500">{item.barcode}</p>}
                    </td>
                    <td className="p-3 text-right text-white">{stock} {item.unit}</td>
                    <td className="p-3 text-right text-neutral-400">{min}</td>
                    <td className="p-3 text-right text-neutral-400">{Number(item.purchase_price).toFixed(2)}€</td>
                    <td className="p-3 text-right text-white">{Number(item.sale_price).toFixed(2)}€</td>
                    <td className="p-3 text-right">
                      <span className={cn("text-xs font-semibold", margin > 50 ? "text-green-400" : margin > 20 ? "text-yellow-400" : "text-red-400")}>
                        {margin.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {isLow ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">STOCK BAJO</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddItemDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddItemDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [stock, setStock] = useState("0");
  const [min, setMin] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [salePrice, setSalePrice] = useState("0");
  const [unit, setUnit] = useState("UNIDAD");

  const mut = useMutation({
    mutationFn: () => api("/api/inventory", {
      method: "POST",
      body: JSON.stringify({
        name, stock_current: Number(stock), stock_min: Number(min),
        purchase_price: Number(purchasePrice), sale_price: Number(salePrice), unit,
      }),
    }),
    onSuccess: () => {
      toast.success("Item creado");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#1A1D24] border-white/10">
        <DialogHeader><DialogTitle className="text-white">Nuevo item de inventario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Mín" className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              <option>UNIDAD</option><option>KG</option><option>LITRO</option><option>GRAMO</option><option>ML</option><option>CAJA</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="P. compra" className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="P. venta" className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-neutral-300">Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!name || mut.isPending} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
            {mut.isPending ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
