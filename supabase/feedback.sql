-- Baton feedback (uninstall page, in-extension Feedback page, 5-pass check-in).
-- Run once in YOUR Supabase project: Dashboard → SQL Editor → paste → Run.
-- Anyone can add a row with the public key; nobody can read rows with it. Read them in Table Editor.
create table if not exists public.baton_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('uninstall', 'bug', 'idea', 'confusing', 'praise', 'checkin')),
  reason text check (char_length(reason) <= 40),
  message text check (char_length(message) <= 1500),
  site text check (char_length(site) <= 20),
  version text check (char_length(version) <= 20),
  browser text check (char_length(browser) <= 20)
);
alter table public.baton_feedback enable row level security;
revoke all on public.baton_feedback from anon, authenticated;
grant insert on public.baton_feedback to anon, authenticated;
drop policy if exists "Anyone can send feedback" on public.baton_feedback;
create policy "Anyone can send feedback" on public.baton_feedback
for insert to anon, authenticated
with check (true);
