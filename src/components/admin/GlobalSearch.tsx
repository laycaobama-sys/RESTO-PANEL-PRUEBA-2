"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Building2, Users, CalendarCheck, X, Loader2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface SearchResult {
  tenants: Array<{ id: string; name: string; slug: string; email: string | null; phone: string | null; city: string | null; country: string; status: string }>;
  users: Array<{ id: string; email: string; name: string; phone: string | null; role: string; is_super_admin: boolean; organization?: { id: string; name: string; slug: string } | null }>;
  reservations: Array<{ id: string; customer_name: string; phone: string; email: string | null; party_size: number; date: string; status: string; shift: string; organization?: { id: string; name: string; slug: string } | null }>;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'tenants' | 'users' | 'reservations'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['admin-search', query],
    queryFn: () => api(`/api/admin/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 5000,
  });

  // Cmd/Ctrl + K to focus
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

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const results = data || { tenants: [], users: [], reservations: [] };
  const total = results.tenants.length + results.users.length + results.reservations.length;

  const filteredTenants = activeTab === 'all' || activeTab === 'tenants' ? results.tenants : [];
  const filteredUsers = activeTab === 'all' || activeTab === 'users' ? results.users : [];
  const filteredReservations = activeTab === 'all' || activeTab === 'reservations' ? results.reservations : [];

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveTab('all'); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar empresa, usuario, reserva... (⌘K)"
          className="pl-9 pr-9 h-9 w-full bg-[#1f1f23] border border-[#27272a] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FF6B35] transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white"
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
            className="absolute top-full mt-2 left-0 right-0 bg-[#16161a] border border-[#27272a] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-[#27272a]">
              {[
                { id: 'all', label: 'Todos', count: total },
                { id: 'tenants', label: 'Empresas', count: results.tenants.length },
                { id: 'users', label: 'Usuarios', count: results.users.length },
                { id: 'reservations', label: 'Reservas', count: results.reservations.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1',
                    activeTab === t.id ? 'bg-[#FF6B35] text-white' : 'text-neutral-400 hover:bg-[#1f1f23]'
                  )}
                >
                  {t.label}
                  <span className={cn(
                    'text-[9px] px-1 rounded',
                    activeTab === t.id ? 'bg-white/20' : 'bg-[#27272a]'
                  )}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="max-h-[480px] overflow-y-auto">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center text-neutral-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : total === 0 ? (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Sin resultados para "{query}"</p>
                  <p className="text-xs text-neutral-600 mt-1">Prueba con otro término</p>
                </div>
              ) : (
                <>
                  {filteredTenants.length > 0 && (
                    <ResultGroup title="Empresas" icon={<Building2 className="w-3 h-3" />}>
                      {filteredTenants.map(t => (
                        <ResultItem
                          key={t.id}
                          onClick={() => { router.push(`/admin?tenant=${t.id}`); setOpen(false); }}
                          title={t.name}
                          subtitle={`${t.city || '—'}, ${t.country} · ${t.email || '—'}`}
                          badge={t.status}
                          badgeColor={t.status === 'ACTIVE' ? 'green' : t.status === 'SUSPENDED' ? 'red' : 'yellow'}
                        />
                      ))}
                    </ResultGroup>
                  )}
                  {filteredUsers.length > 0 && (
                    <ResultGroup title="Usuarios" icon={<Users className="w-3 h-3" />}>
                      {filteredUsers.map(u => (
                        <ResultItem
                          key={u.id}
                          onClick={() => { setOpen(false); /* TODO: open user detail */ }}
                          title={u.name}
                          subtitle={u.email + (u.organization ? ` · ${u.organization.name}` : '')}
                          badge={u.is_super_admin ? 'SUPER' : u.role}
                          badgeColor={u.is_super_admin ? 'purple' : u.role === 'ADMIN' ? 'blue' : 'gray'}
                        />
                      ))}
                    </ResultGroup>
                  )}
                  {filteredReservations.length > 0 && (
                    <ResultGroup title="Reservas" icon={<CalendarCheck className="w-3 h-3" />}>
                      {filteredReservations.map(r => (
                        <ResultItem
                          key={r.id}
                          onClick={() => { setOpen(false); /* TODO: open reservation detail */ }}
                          title={r.customer_name}
                          subtitle={`${r.party_size} pax · ${new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${r.organization?.name || ''}`}
                          badge={r.status}
                          badgeColor={r.status === 'CONFIRMED' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'yellow'}
                        />
                      ))}
                    </ResultGroup>
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
  green: 'bg-green-500/15 text-green-400',
  red: 'bg-red-500/15 text-red-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  blue: 'bg-blue-500/15 text-blue-400',
  purple: 'bg-purple-500/15 text-purple-400',
  gray: 'bg-neutral-500/15 text-neutral-400',
};

function ResultGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function ResultItem({
  title, subtitle, badge, badgeColor, onClick,
}: {
  title: string; subtitle: string; badge?: string; badgeColor?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#1f1f23] transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
      </div>
      {badge && (
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap', BADGE_COLORS[badgeColor || 'gray'])}>
          {badge}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-white transition-colors flex-shrink-0" />
    </button>
  );
}
