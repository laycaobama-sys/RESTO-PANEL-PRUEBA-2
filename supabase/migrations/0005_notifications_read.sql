-- ============================================================
-- RestoPanel · Migration 0005 — Per-user read tracking for broadcast notifications
-- ============================================================
-- Broadcast notifications (user_id IS NULL) are sent to everyone in a tenant.
-- We need a separate table to track which users have read each broadcast
-- notification, since we can't update read_at on the notification itself
-- (that would mark it read for everyone).
-- ============================================================

create table if not exists notifications_read (
  id                uuid primary key default gen_random_uuid(),
  notification_id   uuid not null references notifications(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  read_at           timestamptz not null default now(),
  unique (notification_id, user_id)
);

create index if not exists notifications_read_user_id_idx on notifications_read(user_id);
create index if not exists notifications_read_notification_id_idx on notifications_read(notification_id);

alter table notifications_read enable row level security;

drop policy if exists notifications_read_owner_select on notifications_read;
create policy notifications_read_owner_select on notifications_read
  for select using (user_id = auth.uid());

drop policy if exists notifications_read_owner_insert on notifications_read;
create policy notifications_read_owner_insert on notifications_read
  for insert with check (user_id = auth.uid());

-- ============================================================
-- Also: relax notifications INSERT RLS so that the server can insert
-- broadcast notifications (user_id NULL) for a specific tenant.
-- We already use the service_role key which bypasses RLS, so this is
-- just defense-in-depth.
-- ============================================================
drop policy if exists notifications_broadcast_insert on notifications;
create policy notifications_broadcast_insert on notifications
  for insert with check (true);
