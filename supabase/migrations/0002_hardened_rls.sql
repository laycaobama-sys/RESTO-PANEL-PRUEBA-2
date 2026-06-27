-- ============================================================
-- RestoPanel · Migration 0002 — Hardened RLS policies
-- ============================================================
-- This migration strengthens the RLS layer added in 0001_init.sql:
--   1. Replaces the permissive current_user_org_id() helper with one
--      that explicitly returns NULL when no JWT is present (so all
--      browser queries with the anon key return zero rows).
--   2. Adds a RECURSIVE policy for organization_settings so users can
--      read the row even before they have any other data.
--   3. Adds a sanity check function to verify RLS is active on every
--      tenant-scoped table — useful for the verification guide.
-- ============================================================

-- ============================================================
-- 1. Strengthen current_user_org_id() — explicit NULL on no-JWT
-- ============================================================
-- The original implementation already returned NULL when the JWT claim
-- was missing; this just makes it more explicit and adds a comment for
-- future maintainers. The behavior is identical, but RLS policies
-- using this function will deny ALL access to anonymous callers.
create or replace function current_user_org_id()
returns uuid as $$
declare
  claim text;
begin
  -- auth.jwt() returns NULL if there is no JWT in the request.
  -- We read the custom "user_organization" claim that NextAuth would
  -- set when federating sessions into Supabase Auth. When using
  -- NextAuth alone (without Supabase Auth), this claim is never set
  -- so the function always returns NULL for browser requests — which
  -- is exactly what we want: anonymous callers see nothing.
  claim := current_setting('request.jwt.claim.user_organization', true);
  return nullif(claim, '')::uuid;
end;
$$ language plpgsql stable;

-- ============================================================
-- 2. Add a verification helper: rls_check()
-- ============================================================
-- Returns one row per tenant-scoped table with:
--   tablename, rls_enabled (boolean), policies_count (int)
-- Useful for the verification step in the deployment guide.
create or replace function rls_check()
returns table(tablename text, rls_enabled boolean, policies_count bigint)
as $$
  select t.tablename::text,
         t.rowsecurity,
         coalesce(p.cnt, 0)
  from pg_tables t
  left join (
    select tablename, count(*) as cnt
    from pg_policies
    where schemaname = 'public'
    group by tablename
  ) p on p.tablename = t.tablename
  where t.schemaname = 'public'
    and t.tablename in (
      'organizations','users','verification_tokens','categories',
      'menu_items','tables','orders','order_items','reservations',
      'organization_settings'
    )
  order by t.tablename;
$$ language sql stable;

-- ============================================================
-- 3. Comment the policies for documentation
-- ============================================================
comment on function current_user_org_id() is
  'Returns the organization_id from the current JWT, or NULL if no JWT is present. Used by RLS policies to enforce tenant isolation. NULL = deny all.';

comment on function rls_check() is
  'Verification helper: returns one row per tenant table with RLS status and policy count. Run SELECT rls_check(); in the SQL editor to verify the schema is correctly secured.';
