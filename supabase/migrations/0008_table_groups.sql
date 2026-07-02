-- ============================================================
-- RestoPanel · Migration 0008 — Table grouping + drag positions
-- ============================================================

-- Add group_id for table grouping (multiple tables can form a group)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- Index for group queries
CREATE INDEX IF NOT EXISTS tables_group_id_idx ON tables(group_id) WHERE group_id IS NOT NULL;

-- RLS already covers tables, no new policies needed since group_id
-- is just another column filtered by organization_id.
