"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number;
  icon?: React.ReactNode;
  accent?: "primary" | "green" | "blue" | "yellow" | "red" | "indigo" | "purple";
  delay?: number;
}

const ACCENT_BG: Record<string, string> = {
  primary: "bg-[#C5A059]/15 text-[#C5A059]",
  green: "bg-green-500/15 text-green-400",
  blue: "bg-blue-500/15 text-blue-400",
  yellow: "bg-yellow-500/15 text-yellow-400",
  red: "bg-red-500/15 text-red-400",
  indigo: "bg-indigo-500/15 text-indigo-400",
  purple: "bg-purple-500/15 text-purple-400",
};

export function StatCard({
  label, value, hint, trend, icon, accent = "primary", delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      className="bg-[#111518] rounded-xl border border-white/[0.06] p-4 hover:border-[#C5A059]/20 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", ACCENT_BG[accent])}>
          {icon}
        </div>
        {typeof trend === "number" && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded",
            trend >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#f5f5f0]">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-neutral-400 mt-0.5">{hint}</p>}
    </motion.div>
  );
}
