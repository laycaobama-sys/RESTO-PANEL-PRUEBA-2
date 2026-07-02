-- ============================================================
-- RestoPanel · Migration 0009 — Public Google Reviews
-- ============================================================
-- Real reviews submitted from the public landing page by clients
-- or by restaurant companies. Stored, moderated, and shown back
-- on the landing page automatically.
--
-- The table is PUBLIC-readable for approved rows (no JWT needed),
-- so anonymous visitors on the landing page can see real reviews.
-- Writes from the public form are accepted without auth, but all
-- new rows start in 'PENDING' status and must be approved by an
-- ADMIN / SUPER_ADMIN before they appear publicly.
-- ============================================================

-- ============================================================
-- 1. PUBLIC_REVIEWS — submitted from the landing page
-- ============================================================
-- A review can be left by:
--   * a CLIENT (a customer of a restaurant using RestoPanel)
--   * a COMPANY (a restaurant/business itself giving feedback)
-- source = 'LANDING'  -> submitted through the landing form
-- source = 'GOOGLE'   -> mirrored from Google (future integration)
-- status = 'PENDING'  -> awaiting moderation
--          'APPROVED' -> visible publicly on the landing
--          'REJECTED' -> hidden
-- ============================================================

create table if not exists public_reviews (
  id              uuid primary key default gen_random_uuid(),
  -- Who is reviewing
  author_name     text not null,
  author_role     text not null default 'CLIENT',  -- CLIENT | COMPANY
  author_company  text,                              -- restaurant name (when COMPANY)
  author_email    text,                              -- optional, for verification
  author_avatar   text,                              -- optional URL or initial-based
  -- What they say
  rating          int not null check (rating >= 1 and rating <= 5),
  title           text,
  body            text not null,
  -- Tagging (helps the landing page filter)
  tags            text[] not null default '{}',      -- e.g. {'Reservas','CRM','Soporte'}
  -- Source & moderation
  source          text not null default 'LANDING',  -- LANDING | GOOGLE
  status          text not null default 'PENDING',  -- PENDING | APPROVED | REJECTED
  -- Target restaurant (nullable: a review can be about RestoPanel itself
  -- or about a specific restaurant using the platform)
  organization_id uuid references organizations(id) on delete set null,
  -- Admin response (the restaurant can reply publicly)
  response_text   text,
  response_at     timestamptz,
  responded_by    uuid,  -- user id (not enforced FK to keep it loose)
  -- Metrics that the restaurant owner can mark as "verified" outcomes
  -- (e.g. "this client increased occupancy 30% after RestoPanel")
  verified_metric text,                              -- e.g. "+30% ocupación"
  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists public_reviews_status_idx on public_reviews(status);
create index if not exists public_reviews_org_idx on public_reviews(organization_id) where organization_id is not null;
create index if not exists public_reviews_rating_idx on public_reviews(rating);
create index if not exists public_reviews_created_idx on public_reviews(created_at desc);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
-- Public users (anon key, no JWT) can:
--   * SELECT approved reviews
--   * INSERT new PENDING reviews (rate-limited at the API layer)
-- Authenticated ADMIN / SUPER_ADMIN can:
--   * SELECT, UPDATE, DELETE anything in their org (or everything if super)
-- ============================================================

alter table public_reviews enable row level security;

-- Public: read approved reviews (anon allowed)
drop policy if exists public_reviews_public_select on public_reviews;
create policy public_reviews_public_select on public_reviews
  for select using (status = 'APPROVED');

-- Public: insert pending reviews (anon allowed)
drop policy if exists public_reviews_public_insert on public_reviews;
create policy public_reviews_public_insert on public_reviews
  for insert with check (
    status = 'PENDING'
    and rating >= 1 and rating <= 5
    and length(author_name) >= 2 and length(author_name) <= 120
    and length(body) >= 10 and length(body) <= 2000
  );

-- Tenant admin: full CRUD on reviews linked to their org
drop policy if exists public_reviews_tenant_select on public_reviews;
create policy public_reviews_tenant_select on public_reviews
  for select using (organization_id = current_user_org_id());

drop policy if exists public_reviews_tenant_update on public_reviews;
create policy public_reviews_tenant_update on public_reviews
  for update using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

drop policy if exists public_reviews_tenant_delete on public_reviews;
create policy public_reviews_tenant_delete on public_reviews
  for delete using (organization_id = current_user_org_id());

-- Super admin: full access to every review
drop policy if exists public_reviews_super_admin_select on public_reviews;
create policy public_reviews_super_admin_select on public_reviews
  for select using (is_current_user_super_admin());

drop policy if exists public_reviews_super_admin_update on public_reviews;
create policy public_reviews_super_admin_update on public_reviews
  for update using (is_current_user_super_admin())
  with check (true);

drop policy if exists public_reviews_super_admin_delete on public_reviews;
create policy public_reviews_super_admin_delete on public_reviews
  for delete using (is_current_user_super_admin());

-- ============================================================
-- 3. GOOGLE_REVIEW_SETTINGS — per-restaurant configuration
-- ============================================================
-- Each restaurant can configure:
--   * their Google Business Profile place_id
--   * their Google review URL (so the landing page can deep-link
--     "leave a review on Google")
--   * the cached aggregate rating (refreshed nightly by a cron job)
-- ============================================================

create table if not exists google_review_settings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  google_place_id     text,
  google_review_url   text,
  google_rating_avg   numeric(2,1),
  google_review_count int,
  auto_response_mode  text not null default 'MANUAL',  -- MANUAL | SUGGESTED | AUTO
  synced_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists google_review_settings_org_idx on google_review_settings(organization_id);

alter table google_review_settings enable row level security;

drop policy if exists grs_tenant_select on google_review_settings;
create policy grs_tenant_select on google_review_settings
  for select using (organization_id = current_user_org_id());

drop policy if exists grs_tenant_insert on google_review_settings;
create policy grs_tenant_insert on google_review_settings
  for insert with check (organization_id = current_user_org_id());

drop policy if exists grs_tenant_update on google_review_settings;
create policy grs_tenant_update on google_review_settings
  for update using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

drop policy if exists grs_super_admin_select on google_review_settings;
create policy grs_super_admin_select on google_review_settings
  for select using (is_current_user_super_admin());

drop policy if exists grs_super_admin_update on google_review_settings;
create policy grs_super_admin_update on google_review_settings
  for update using (is_current_user_super_admin())
  with check (true);

-- ============================================================
-- 4. updated_at trigger for both tables
-- ============================================================
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists public_reviews_touch on public_reviews;
create trigger public_reviews_touch
  before update on public_reviews
  for each row execute function touch_updated_at();

drop trigger if exists google_review_settings_touch on google_review_settings;
create trigger google_review_settings_touch
  before update on google_review_settings
  for each row execute function touch_updated_at();

-- ============================================================
-- 5. Seed: a few approved real-style reviews to bootstrap the wall
--    (these are placeholder examples — they will be replaced by
--     real reviews submitted via the landing form once it goes live)
-- ============================================================
-- We deliberately DO NOT seed fake reviews here. The wall starts
-- empty and grows as real users submit reviews through the public
-- form. The API endpoint /api/public/reviews returns only APPROVED
-- rows, so the wall will only show real submissions.

comment on table public_reviews is
  'Public reviews submitted by clients or restaurant companies from the landing page. Real reviews only — no seeding. Moderated by ADMIN/SUPER_ADMIN before they appear publicly.';
