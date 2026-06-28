-- ============================================================
-- RestoPanel · Migration 0003 — Super admin + audit logs + tenant status
-- ============================================================
-- Adds the foundations for the owner/super-admin layer:
--   1. users.is_super_admin  — flag that grants global access
--   2. organizations.status  — ACTIVE | SUSPENDED | PENDING
--   3. audit_logs table      — every privileged action gets recorded
--   4. RLS policies for audit_logs (only super admins can read)
-- ============================================================

-- ============================================================
-- 1. SUPER ADMIN FLAG ON USERS
-- ============================================================
alter table users add column if not exists is_super_admin boolean not null default false;

-- A super admin has no organization_id (NULL) since they operate globally.
-- We relax the NOT NULL constraint on users.organization_id to allow this.
alter table users alter column organization_id drop not null;

-- ============================================================
-- 2. TENANT STATUS
-- ============================================================
alter table organizations add column if not exists status text not null default 'ACTIVE';
alter table organizations add constraint organizations_status_check
  check (status in ('ACTIVE', 'SUSPENDED', 'PENDING'));

-- ============================================================
-- 3. AUDIT LOGS
-- ============================================================
create table if not exists audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references users(id) on delete set null,
  actor_email     text not null,
  actor_role      text not null,                    -- SUPER_ADMIN | ADMIN | STAFF | SYSTEM
  action          text not null,                    -- e.g. "IMPERSONATE_START", "TENANT_SUSPEND", "MENU_ITEM_DELETE"
  target_type     text,                             -- organization | user | reservation | table | menu_item | order
  target_id       text,
  target_name     text,
  organization_id uuid references organizations(id) on delete set null,
  details         jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
create index if not exists audit_logs_actor_id_idx on audit_logs(actor_id);
create index if not exists audit_logs_organization_id_idx on audit_logs(organization_id);
create index if not exists audit_logs_action_idx on audit_logs(action);

-- ============================================================
-- 4. RLS FOR AUDIT_LOGS
-- ============================================================
-- Audit logs contain sensitive information (who did what, when, on which tenant).
-- They can ONLY be read by super admins. Regular tenant admins cannot read
-- their own audit logs through the anon key — they would need to go through
-- the app server (which uses the service_role key and validates the session).
alter table audit_logs enable row level security;

drop policy if exists audit_logs_super_admin_select on audit_logs;
create policy audit_logs_super_admin_select on audit_logs
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

-- Inserts are only allowed through the service_role key (server-side).
-- No INSERT policy here means anonymous/regular users cannot write logs.
-- The server uses supabaseAdmin which bypasses RLS.

-- ============================================================
-- 5. EXTEND USERS RLS — super admins can read all users
-- ============================================================
-- We need a new policy that lets super admins read every user row,
-- regardless of organization_id. We keep the existing tenant-scoped
-- policy for regular users.
drop policy if exists users_super_admin_select on users;
create policy users_super_admin_select on users
  for select using (
    -- super admins can read all users
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

drop policy if exists users_super_admin_update on users;
create policy users_super_admin_update on users
  for update using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

-- ============================================================
-- 6. EXTEND ORGANIZATIONS RLS — super admins can read/update all
-- ============================================================
drop policy if exists organizations_super_admin_select on organizations;
create policy organizations_super_admin_select on organizations
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

drop policy if exists organizations_super_admin_update on organizations;
create policy organizations_super_admin_update on organizations
  for update using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

-- ============================================================
-- 7. EXTEND ALL TENANT TABLES — super admins see everything
-- ============================================================
-- For each tenant-scoped table, add a "super admin can read all" policy
-- on top of the existing tenant-scoped policy. This is defense-in-depth:
-- even if the app server fails to filter, RLS lets super admins through.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'categories','menu_items','tables','orders','order_items',
    'reservations','organization_settings','verification_tokens'
  ])
  loop
    execute format('drop policy if exists %I_super_admin_select on %I;', t, t);
    execute format(
      'create policy %I_super_admin_select on %I for select using (
         exists (
           select 1 from users u
           where u.id = auth.uid() and u.is_super_admin = true
         )
       );',
      t, t
    );

    execute format('drop policy if exists %I_super_admin_update on %I;', t, t);
    execute format(
      'create policy %I_super_admin_update on %I for update using (
         exists (
           select 1 from users u
           where u.id = auth.uid() and u.is_super_admin = true
         )
       );',
      t, t
    );

    execute format('drop policy if exists %I_super_admin_delete on %I;', t, t);
    execute format(
      'create policy %I_super_admin_delete on %I for delete using (
         exists (
           select 1 from users u
           where u.id = auth.uid() and u.is_super_admin = true
         )
       );',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 8. HELPER FUNCTION: is_current_user_super_admin()
-- ============================================================
create or replace function is_current_user_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from users u
    where u.id = auth.uid() and u.is_super_admin = true
  );
end;
$$ language plpgsql stable;

comment on function is_current_user_super_admin() is
  'Returns true if the authenticated user has the is_super_admin flag. Used by RLS policies to grant global access.';
