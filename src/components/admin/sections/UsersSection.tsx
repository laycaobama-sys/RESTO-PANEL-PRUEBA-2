"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Users, Shield, Crown } from "lucide-react";
import { useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_super_admin: boolean;
  organization_id: string | null;
  organization_name: string | null;
  created_at: string;
  updated_at: string;
}

export function UsersSection() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api("/api/admin/users"),
  });

  const filtered = users
    .filter((u) => roleFilter === "ALL" || (roleFilter === "SUPER_ADMIN" && u.is_super_admin) || (!u.is_super_admin && u.role === roleFilter))
    .filter((u) => !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-[#16161a] rounded-xl border border-[#27272a] p-3 flex flex-wrap gap-2 items-center">
        <input
          placeholder="Buscar usuario por email o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 px-3 bg-[#1f1f23] border border-[#27272a] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FF6B35] flex-1 min-w-48"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 px-3 bg-[#1f1f23] border border-[#27272a] rounded-md text-sm text-white"
        >
          <option value="ALL">Todos los roles</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="ADMIN">Admin de empresa</option>
          <option value="STAFF">Staff</option>
        </select>
        <span className="text-xs text-neutral-500">{filtered.length} usuario(s)</span>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="bg-[#16161a] rounded-xl border border-[#27272a] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#1f1f23] border-b border-[#27272a]">
              <tr>
                <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-4 py-3">Usuario</th>
                <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Empresa</th>
                <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-4 py-3">Rol</th>
                <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Creado</th>
                <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Última actualización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-[#1f1f23]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        u.is_super_admin ? 'bg-gradient-to-br from-[#FF6B35] to-[#F94B1E] text-white' : 'bg-[#27272a] text-neutral-300'
                      }`}>
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{u.name}</p>
                        <p className="text-xs text-neutral-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.organization_name ? (
                      <span className="text-neutral-300">{u.organization_name}</span>
                    ) : (
                      <span className="text-neutral-600 italic">— global —</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_super_admin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-purple-500/15 text-purple-400">
                        <Crown className="w-3 h-3" /> SUPER ADMIN
                      </span>
                    ) : u.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-500/15 text-blue-400">
                        <Shield className="w-3 h-3" /> ADMIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-neutral-500/15 text-neutral-400">
                        <Users className="w-3 h-3" /> STAFF
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-neutral-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-neutral-400 text-xs">
                    {new Date(u.updated_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
