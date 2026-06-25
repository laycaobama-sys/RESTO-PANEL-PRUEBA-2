"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number; // % compared to previous period
  icon?: React.ReactNode;
  accent?: "primary" | "green" | "blue" | "yellow" | "red" | "indigo";
  delay?: number;
}

const ACCENT_BG: Record<string, string> = {
  primary: "bg-[#FFF3ED] text-[#FF6B35]",
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  indigo: "bg-indigo-50 text-indigo-600",
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent = "primary",
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-2xl border border-[#ececed] p-5 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            ACCENT_BG[accent]
          )}
        >
          {icon}
        </div>
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
              trend >= 0
                ? "text-green-700 bg-green-50"
                : "text-red-700 bg-red-50"
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-neutral-900">
        {value}
      </p>
      <p className="text-sm text-neutral-500 mt-0.5">{label}</p>
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </motion.div>
  );
}
