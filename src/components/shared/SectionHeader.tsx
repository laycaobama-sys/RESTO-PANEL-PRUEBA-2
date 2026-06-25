"use client";

import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6",
        className
      )}
    >
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-neutral-900">{title}</p>
      {description && (
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
