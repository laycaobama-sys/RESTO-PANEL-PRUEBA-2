"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: "text-sm", gap: "gap-1.5" },
  md: { icon: 36, text: "text-base", gap: "gap-2" },
  lg: { icon: 44, text: "text-lg", gap: "gap-2.5" },
  xl: { icon: 56, text: "text-2xl", gap: "gap-3" },
};

export function RestoPanelLogo({ size = "md", showText = true, className }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <defs>
          <linearGradient id="rpGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C5A059" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#E8C875" />
          </linearGradient>
        </defs>
        {/* Cuadrícula 3x3 */}
        <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.35" />
        <rect x="18" y="2" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.55" />
        <rect x="34" y="2" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.35" />
        <rect x="2" y="18" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.55" />
        <rect x="18" y="18" width="12" height="12" rx="2" fill="rgba(197,160,89,0.06)" stroke="url(#rpGold)" strokeWidth="2" />
        <rect x="34" y="18" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.55" />
        <rect x="2" y="34" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.35" />
        <rect x="18" y="34" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.55" />
        <rect x="34" y="34" width="12" height="12" rx="2" fill="none" stroke="url(#rpGold)" strokeWidth="1.5" opacity="0.35" />
        {/* Tenedor y cuchillo cruzados */}
        <g transform="translate(24,24)" stroke="url(#rpGold)" strokeWidth="1.2" strokeLinecap="round" fill="none">
          <path d="M-4 -5 L-4 5 M-4 -5 L-4 -2 M-3 -5 L-3 -2 M-5 -5 L-5 -2 M-4 -2 L-4 7" />
          <path d="M3 -5 L3 -1 L5 -1 L5 7" strokeLinejoin="round" />
        </g>
      </svg>
      {showText && (
        <span className={cn("font-bold tracking-tight", s.text)}>
          <span className="text-white">Resto</span>
          <span style={{ color: "#C5A059" }}>Panel</span>
        </span>
      )}
    </div>
  );
}

export function RestoPanelWatermark({ className }: { className?: string }) {
  return (
    <div className={cn("absolute pointer-events-none select-none", className)} style={{ opacity: 0.03 }}>
      <RestoPanelLogo size="xl" />
    </div>
  );
}
