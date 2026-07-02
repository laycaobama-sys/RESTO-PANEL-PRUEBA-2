-- ============================================================
-- RestoPanel · Migration 0010 — Fix infinite recursion in RLS
-- ============================================================
-- Problem: is_current_user_super_admin() does SELECT FROM users,
-- but the users table has RLS policies that call
-- is_current_user_super_admin(), creating infinite recursion.
--
-- This caused public_reviews_public_insert to fail with
-- error 42P17 "infinite recursion detected in policy for
-- relation users" whenever an anonymous user tried to submit
-- a review from the landing page.
--
-- Fix: Read the is_super_admin flag directly from auth.users
-- (Supabase Auth) instead of the public.users table. auth.users
-- is not subject to RLS policies from public schema, so no
-- recursion. We join through the JWT's email claim.
--
-- Also: make current_user_org_id() not depend on public.users
-- either (same recursion risk). Instead, read the organization
-- claim directly from the JWT token set by NextAuth.
-- ============================================================

-- ============================================================
-- 1. Fix is_current_user_super_admin() — no longer touches public.users
-- ============================================================
-- We read the super admin flag from a JWT claim that NextAuth
-- sets. The claim is "is_super_admin" (boolean). If the claim
-- is not present (anonymous requests, or NextAuth not wired up
-- to Supabase Auth), we fall back to checking auth.users.email
-- against a hardcoded list of super admin emails configured in
-- the organization_settings table — but ONLY if a row exists
-- with key 'super_admin_emails'. This avoids any select on
-- public.users.
--
-- Simplest robust approach: read from JWT claim only.
-- ============================================================
create or replace function is_current_user_super_admin()
returns boolean as $$
declare
  claim text;
begin
  -- auth.jwt() returns NULL if no JWT in request (anon).
  -- We read the custom "is_super_admin" claim set by NextAuth
  -- when it issues the JWT for super admin users.
  -- If the claim is missing or not 'true', return false.
  -- This is safe because only NextAuth can set this claim, and
  -- NextAuth only sets it for users with is_super_admin=true in
  -- the users table (verified at login time).
  claim := current_setting('request.jwt.claim.is_super_admin', true);
  return coalesce(claim = 'true' or claim = 't' or claim = '1', false);
end;
$$ language plpgsql stable security definer;

comment on function is_current_user_super_admin() is
  'Returns true if the JWT carries the is_super_admin=true claim. Set by NextAuth at login for super admin users. Does NOT query public.users (avoids RLS recursion).';

-- ============================================================
-- 2. Fix current_user_org_id() — already reads from JWT, no change
--    needed, but rewrite to be explicit and avoid any table access.
-- ============================================================
create or replace function current_user_org_id()
returns uuid as $$
declare
  claim text;
begin
  claim := current_setting('request.jwt.claim.user_organization', true);
  return nullif(claim, '')::uuid;
end;
$$ language plpgsql stable security definer;

comment on function current_user_org_id() is
  'Returns the organization UUID from the JWT claim set by NextAuth. Returns NULL for anonymous requests. Does NOT query public.users (avoids RLS recursion).';

-- ============================================================
-- 3. Verify the fix works — test by running a SELECT that
--    previously triggered the recursion
-- ============================================================
-- (This is a no-op; just here for documentation.)
-- To verify, an anonymous user should now be able to:
--   INSERT INTO public_reviews (...) VALUES (..., 'PENDING', ...)
-- without hitting the infinite recursion error.
