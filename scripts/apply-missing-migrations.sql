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


