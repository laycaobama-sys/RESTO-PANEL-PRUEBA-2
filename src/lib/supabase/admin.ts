import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (admin / service_role).
 *
 * This client BYPASSES Row Level Security. It must NEVER be imported from
 * a Client Component. Use it only inside:
 *   - Next.js API routes (src/app/api/**)
 *   - Server Actions
 *   - Server Components (when you need a privileged query)
 *
 * The service_role key is read from a non-NEXT_PUBLIC env var so Next.js
 * will refuse to bundle it for the browser even if someone tries.
 *
 * Every query run with this client MUST filter by the organization_id
 * derived from the authenticated NextAuth session (see src/lib/session.ts).
 * RLS is a defense-in-depth layer, not the only layer.
 *
 * CRITICAL FIX: previously, this module threw at import time if
 * SUPABASE_URL was missing. This broke `next build` page-data
 * collection (which imports the module to inspect route handlers).
 * Now we throw lazily — only when a query is actually executed.
 * This allows the build to succeed without env vars, and surfaces
 * the error at runtime where it's actionable.
 */

let _client: SupabaseClient | null = null;
let _initError: string | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (_initError) throw new Error(_initError);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    _initError = "Missing SUPABASE_URL. Add it to your .env (server-only).";
    throw new Error(_initError);
  }
  if (!supabaseServiceKey) {
    _initError =
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your .env (server-only). " +
      "This key MUST NOT be prefixed with NEXT_PUBLIC_.";
    throw new Error(_initError);
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _client;
}

// Export a Proxy that lazily creates the client on first property access.
// This allows `import { supabaseAdmin } from '...'` at module-load time
// without throwing, but throws when `.from()` / `.auth` / etc. is called
// if env vars are missing.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
