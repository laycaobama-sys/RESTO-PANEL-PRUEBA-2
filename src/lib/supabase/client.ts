"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Uses ONLY the publishable (NEXT_PUBLIC_*) env vars. The anon key is
 * safe to ship to the browser because Row Level Security (RLS) on every
 * table prevents any cross-tenant read or write — even if the key leaks.
 *
 * The service_role key is NEVER imported here.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to your .env.local (see .env.example)."
  );
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // sessions are managed by NextAuth
    autoRefreshToken: false,
  },
});
