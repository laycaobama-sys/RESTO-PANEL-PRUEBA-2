-- ============================================================
-- RestoPanel · Migration 0021 — Performance indexes
-- ============================================================
-- Adds the indexes flagged by scripts/validate/performance.mjs
-- that were missing from previous migrations.
--
-- 1. notifications(organization_id, created_at DESC)
--    The tenant notifications list filters by organization_id AND
--    sorts by created_at DESC. Without this index, the query does
--    a seq scan over all notifications for all tenants.
--
-- 2. tables(organization_id, status)
--    The dashboard grid filters tables by organization_id AND
--    status. The existing tables_organization_id_idx covers
--    organization_id alone, but adding status as a second column
--    lets PG seek directly to "all OCCUPIED tables in tenant X".
--
-- 3. notifications(created_at DESC)
--    Super-admin queries that span all tenants sort by created_at
--    DESC without a user_id filter. The composite index
--    notifications_user_id_created_at_idx has user_id as the
--    leading column, so it can't be used when user_id is not in
--    the WHERE clause. This single-column index covers that case.
--
-- All indexes use IF NOT EXISTS so the migration is idempotent.
-- ============================================================

-- 1. Tenant notifications: org_id + created_at (composite, sorted)
CREATE INDEX IF NOT EXISTS notifications_organization_id_created_at_idx
  ON notifications(organization_id, created_at DESC);

-- 2. Tables: org_id + status (composite) for dashboard grid filter.
--    Also a single-column tables(status) index for cross-tenant queries
--    (super admin stats) — matches the pattern of orders_status_idx and
--    reservations_status_idx added in migration 0018.
CREATE INDEX IF NOT EXISTS tables_organization_id_status_idx
  ON tables(organization_id, status);
CREATE INDEX IF NOT EXISTS tables_status_idx
  ON tables(status);

-- 3. Notifications: created_at alone for super-admin cross-tenant queries
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON notifications(created_at DESC);

COMMENT ON INDEX notifications_organization_id_created_at_idx IS
  'Tenant notifications list: filters by organization_id, sorts by created_at DESC.';
COMMENT ON INDEX tables_organization_id_status_idx IS
  'Dashboard tables grid: filters by organization_id AND status.';
COMMENT ON INDEX notifications_created_at_idx IS
  'Super-admin notifications: sorts by created_at DESC without user_id filter.';

-- ============================================================
-- DONE. Re-run scripts/validate/performance.mjs to confirm 0 missing.
-- ============================================================
