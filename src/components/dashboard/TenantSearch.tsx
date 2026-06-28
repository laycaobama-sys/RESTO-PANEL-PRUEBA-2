"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, CalendarCheck, UtensilsCrossed, Grid3x3, Users, X, Loader2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

interface TenantSearchResult {
  reservations: Array<{ id: string; customer_name: string; phone: string; email: string | null; party_size: number; date: string; status: string; shift: string; zone: string | null }>;
  menuItems: Array<{ id: string; name: string; description: string | null; price: number; available: boolean; categoryName: string | null }>;
  tables: Array<{ id: string; number: string; name: string | null; capacity: number; zone: string; status: string }>;
  customers: Array<{ name: string; phone: string; email: string | null; reservations: number }>;
}

export function TenantSearch() {
  const setSection = useAppStore((s) => s.setSection);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'reservations' | 'menuItems' | 'tables' | 'customers'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<TenantSearchResult>({
    queryKey: ['tenant-search', query],
    queryFn: () => api(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 5000,
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const results = data || { reservations: [], menuItems: [], tables: [], customers: [] };
  const total = results.reservations.length + results.menuItems.length + results.tables.length + results.customers.length;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveTab('all'); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar reserva, plato, mesa, cliente... (⌘K)"
          className="pl-9 pr-9 h-9 w-full bg-[#f6f6f7] border border-[#ececed] rounded-md text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white border border-[#ececed] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center gap-1 p-2 border-b border-[#ececed] overflow-x-auto">
              {[
                { id: 'all', label: 'Todos', count: total },
                { id: 'reservations', label: 'Reservas', count: results.reservations.length },
                { id: 'menuItems', label: 'Platos', count: results.menuItems.length },
                { id: 'tables', label: 'Mesas', count: results.tables.length },
                { id: 'customers', label: 'Clientes', count: results.customers.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap',
                    activeTab === t.id ? 'bg-[#FF6B35] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  {t.label}
                  <span className={cn(
                    'text-[9px] px-1 rounded',
                    activeTab === t.id ? 'bg-white/20' : 'bg-neutral-200'
                  )}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center text-neutral-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : total === 0 ? (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Sin resultados para "{query}"</p>
                  <p className="text-xs text-neutral-400 mt-1">Prueba con otro término</p>
                </div>
              ) : (
                <>
                  {(activeTab === 'all' || activeTab === 'reservations') && results.reservations.length > 0 && (
                    <Group title="Reservas" icon={<CalendarCheck className="w-3 h-3" />}>
                      {results.reservations.map(r => (
                        <Item
                          key={r.id}
                          title={r.customer_name}
                          subtitle={`${r.party_size} pax · ${new Date(r.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${r.phone}`}
                          badge={r.status}
                          badgeColor={r.status === 'CONFIRMED' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'yellow'}
                          onClick={() => { setSection('reservations'); setOpen(false); }}
                        />
                      ))}
                    </Group>
                  )}
                  {(activeTab === 'all' || activeTab === 'menuItems') && results.menuItems.length > 0 && (
                    <Group title="Platos" icon={<UtensilsCrossed className="w-3 h-3" />}>
                      {results.menuItems.map(m => (
                        <Item
                          key={m.id}
                          title={m.name}
                          subtitle={`${m.price.toFixed(2)} € · ${m.categoryName || 'Sin categoría'}`}
                          badge={m.available ? 'Disponible' : 'Agotado'}
                          badgeColor={m.available ? 'green' : 'red'}
                          onClick={() => { setSection('menus'); setOpen(false); }}
                        />
                      ))}
                    </Group>
                  )}
                  {(activeTab === 'all' || activeTab === 'tables') && results.tables.length > 0 && (
                    <Group title="Mesas" icon={<Grid3x3 className="w-3 h-3" />}>
                      {results.tables.map(t => (
                        <Item
                          key={t.id}
                          title={t.name || `Mesa ${t.number}`}
                          subtitle={`${t.capacity} pax · ${t.zone} · ${t.status}`}
                          badge={t.status}
                          badgeColor={t.status === 'AVAILABLE' ? 'green' : t.status === 'OCCUPIED' ? 'red' : 'yellow'}
                          onClick={() => { setSection('tables'); setOpen(false); }}
                        />
                      ))}
                    </Group>
                  )}
                  {(activeTab === 'all' || activeTab === 'customers') && results.customers.length > 0 && (
                    <Group title="Clientes" icon={<Users className="w-3 h-3" />}>
                      {results.customers.map((c, i) => (
                        <Item
                          key={i}
                          title={c.name}
                          subtitle={`${c.phone}${c.email ? ` · ${c.email}` : ''} · ${c.reservations} reserva(s)`}
                          badge={`${c.reservations}`}
                          badgeColor="blue"
                          onClick={() => { setSection('reservations'); setOpen(false); }}
                        />
                      ))}
                    </Group>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-neutral-100 text-neutral-600',
};

function Group({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Item({ title, subtitle, badge, badgeColor, onClick }: { title: string; subtitle: string; badge?: string; badgeColor?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-900 truncate">{title}</p>
        <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
      </div>
      {badge && (
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap', BADGE_COLORS[badgeColor || 'gray'])}>
          {badge}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors flex-shrink-0" />
    </button>
  );
}
