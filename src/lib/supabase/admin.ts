import { createClient } from "@supabase/supabase-js";

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
 */
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL. Add it to your .env (server-only).");
}
if (!supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your .env (server-only). " +
      "This key MUST NOT be prefixed with NEXT_PUBLIC_."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
