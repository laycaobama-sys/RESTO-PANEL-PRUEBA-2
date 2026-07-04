-- ============================================================
-- RestoPanel · Missing Migrations (auto-generated)
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cttemgwmabzuhrbqzpsg.supabase.co/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════
-- MIGRATION: 0012_whatsapp_messages.sql
-- ════════════════════════════════════════════════════════

-- ============================================================
-- RestoPanel · Migration 0012 — WhatsApp message log + email queue
-- ============================================================
-- Stores every WhatsApp message and email sent by the system,
-- with status tracking (queued / sent / failed / retrying).
-- ============================================================

create table if not exists whatsapp_messages (
  id                  text primary key,
  organization_id     uuid references organizations(id) on delete cascade,
  to_phone            text not null,
  body                text,
  type                text not null,
  ref_id              text,
  status              text not null default 'queued',
  attempts            int not null default 0,
  error               text,
  whatsapp_message_id text,
  next_attempt_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists whatsapp_messages_org_idx on whatsapp_messages(organization_id);
create index if not exists whatsapp_messages_status_idx on whatsapp_messages(status);
create index if not exists whatsapp_messages_created_idx on whatsapp_messages(created_at desc);

alter table whatsapp_messages enable row level security;

drop policy if exists whatsapp_tenant_select on whatsapp_messages;
create policy whatsapp_tenant_select on whatsapp_messages
  for select using (organization_id = current_user_org_id());

drop policy if exists whatsapp_super_admin_select on whatsapp_messages;
create policy whatsapp_super_admin_select on whatsapp_messages
  for select using (is_current_user_super_admin());

drop policy if exists whatsapp_super_admin_update on whatsapp_messages;
create policy whatsapp_super_admin_update on whatsapp_messages
  for update using (is_current_user_super_admin()) with check (true);

drop policy if exists whatsapp_super_admin_delete on whatsapp_messages;
create policy whatsapp_super_admin_delete on whatsapp_messages
  for delete using (is_current_user_super_admin());

-- Service role (used by the WhatsApp processor) bypasses RLS, so
-- it can INSERT/UPDATE without policies. We add an explicit insert
-- policy for completeness — the service role doesn't need it, but
-- if we later switch to a non-service-role client, this allows it.
drop policy if exists whatsapp_tenant_insert on whatsapp_messages;
create policy whatsapp_tenant_insert on whatsapp_messages
  for insert with check (organization_id = current_user_org_id());

-- Trigger for updated_at
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists whatsapp_messages_touch on whatsapp_messages;
create trigger whatsapp_messages_touch
  before update on whatsapp_messages
  for each row execute function touch_updated_at();

comment on table whatsapp_messages is
  'WhatsApp message log. Every message sent via the WhatsApp service is tracked here for audit and retry purposes.';


-- ════════════════════════════════════════════════════════
-- MIGRATION: 0013_import_jobs.sql
-- ════════════════════════════════════════════════════════

-- ============================================================
-- RestoPanel · Migration 0013 — Web import jobs + cache
-- ============================================================
-- Tracks each web import job: URL, status, progress, results.
-- Also caches fetched HTML to avoid re-fetching on re-imports.
-- ============================================================

create table if not exists import_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  url             text not null,
  status          text not null default 'queued', -- queued | running | completed | failed | cancelled
  progress        int not null default 0,  -- 0-100
  progress_label  text,
  pages_crawled   int not null default 0,
  items_detected  int not null default 0,
  items_imported  int not null default 0,
  result          jsonb,  -- full preview object
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists import_jobs_org_idx on import_jobs(organization_id);
create index if not exists import_jobs_status_idx on import_jobs(status);
create index if not exists import_jobs_created_idx on import_jobs(created_at desc);

alter table import_jobs enable row level security;

drop policy if exists import_jobs_tenant_select on import_jobs;
create policy import_jobs_tenant_select on import_jobs
  for select using (organization_id = current_user_org_id());

drop policy if exists import_jobs_tenant_insert on import_jobs;
create policy import_jobs_tenant_insert on import_jobs
  for insert with check (organization_id = current_user_org_id());

drop policy if exists import_jobs_tenant_update on import_jobs;
create policy import_jobs_tenant_update on import_jobs
  for update using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

drop policy if exists import_jobs_super_admin_select on import_jobs;
create policy import_jobs_super_admin_select on import_jobs
  for select using (is_current_user_super_admin());

-- HTML cache table (avoids re-fetching the same URL within 24h)
create table if not exists import_html_cache (
  url         text primary key,
  html        text not null,
  status_code int,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index if not exists import_html_cache_expires_idx on import_html_cache(expires_at);

alter table import_html_cache enable row level security;
-- No public policies: only service_role can read/write the cache.
-- This is intentional — the cache is internal to the import service.

-- Trigger for updated_at
drop trigger if exists import_jobs_touch on import_jobs;
create trigger import_jobs_touch
  before update on import_jobs
  for each row execute function touch_updated_at();

comment on table import_jobs is
  'Web import job tracking. Each import creates a row here with progress, results, and error info.';
comment on table import_html_cache is
  '24h HTML cache for the web import service. Avoids re-fetching the same URL.';


