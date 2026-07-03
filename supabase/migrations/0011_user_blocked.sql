-- ============================================================
-- RestoPanel · Migration 0011 — User blocked column + audit
-- ============================================================
-- Adds a `blocked` boolean column to the users table so the super
-- admin can block/unblock individual users without deleting them.
-- A blocked user cannot log in (checked in authorize()).
-- ============================================================

alter table users add column if not exists blocked boolean not null default false;

create index if not exists users_blocked_idx on users(blocked) where blocked = true;

-- RLS: tenant admins can read blocked status for their own users,
-- super admins can update it. We extend the existing policies.
drop policy if exists users_super_admin_update on users;
create policy users_super_admin_update on users
  for update using (is_current_user_super_admin())
  with check (true);

comment on column users.blocked is
  'When true, the user cannot log in. Set by super admin from /admin → Usuarios.';
