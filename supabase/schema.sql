-- Run in YOUR Supabase project after reviewing. No public read policy.
create table if not exists public.handoff_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  backup text not null check (octet_length(backup) <= 20000000),
  updated_at timestamptz not null default now()
);
alter table public.handoff_backups enable row level security;
revoke all on public.handoff_backups from anon, authenticated;
grant select, insert, update, delete on public.handoff_backups to authenticated;
drop policy if exists "Owners manage their backup" on public.handoff_backups;
create policy "Owners manage their backup" on public.handoff_backups
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
