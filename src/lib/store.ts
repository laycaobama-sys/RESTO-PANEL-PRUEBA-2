"use client";

import { create } from "zustand";

export type Section =
  | "dashboard"
  | "executive"
  | "orders"
  | "tables"
  | "kitchen"
  | "menus"
  | "analytics"
  | "reservations"
  | "waitlist"
  | "customers"
  | "loyalty"
  | "automations"
  | "whatsapp"
  | "billing"
  | "inventory"
  | "suppliers"
  | "purchases"
  | "staff"
  | "schedule"
  | "settings"
  | "public";

interface AppState {
  section: Section;
  setSection: (s: Section) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  section: "dashboard",
  setSection: (section) => set({ section, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
