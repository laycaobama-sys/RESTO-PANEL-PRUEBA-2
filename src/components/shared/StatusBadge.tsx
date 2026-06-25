"use client";

import { cn } from "@/lib/utils";

const ORDER_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING: { label: "Pendiente", cls: "status-pending", dot: "bg-yellow-500" },
  PREPARING: { label: "Preparando", cls: "status-preparing", dot: "bg-blue-500" },
  SERVED: { label: "Servido", cls: "status-served", dot: "bg-indigo-500" },
  COMPLETED: { label: "Completado", cls: "status-completed", dot: "bg-green-500" },
  CANCELLED: { label: "Cancelado", cls: "status-cancelled", dot: "bg-red-500" },
};

const TABLE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  AVAILABLE: { label: "Disponible", cls: "status-available", dot: "bg-green-500" },
  OCCUPIED: { label: "Ocupada", cls: "status-occupied", dot: "bg-red-500" },
  RESERVED: { label: "Reservada", cls: "status-reserved", dot: "bg-yellow-500" },
  PREPARING: { label: "En preparación", cls: "status-preparing-table", dot: "bg-blue-500" },
};

const RESERVATION_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "status-pending" },
  CONFIRMED: { label: "Confirmada", cls: "status-completed" },
  CANCELLED: { label: "Cancelada", cls: "status-cancelled" },
  SEATED: { label: "Sentados", cls: "status-preparing" },
  COMPLETED: { label: "Completada", cls: "status-served" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS[status] || ORDER_STATUS.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        meta.cls
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function TableStatusBadge({ status }: { status: string }) {
  const meta = TABLE_STATUS[status] || TABLE_STATUS.AVAILABLE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        meta.cls
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function ReservationStatusBadge({ status }: { status: string }) {
  const meta = RESERVATION_STATUS[status] || RESERVATION_STATUS.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
}

export const ORDER_STATUS_META = ORDER_STATUS;
export const TABLE_STATUS_META = TABLE_STATUS;
export const RESERVATION_STATUS_META = RESERVATION_STATUS;

export const ZONE_LABEL: Record<string, string> = {
  INTERIOR: "Interior",
  TERRACE: "Terraza",
  BAR: "Barra",
};
