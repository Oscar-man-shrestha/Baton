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

-- Spam limits, enforced in the database so they hold even for requests made outside Baton with the public key.
-- Per sender: 3 in 10 minutes, 10 a day. Everyone together: 60 an hour. The same message only once a day.
-- A sender is a one-way hash of the network address Cloudflare reports, kept in a private table for one day only.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.feedback_senders (sender text not null, at timestamptz not null default now());
create index if not exists feedback_senders_sender_at on private.feedback_senders (sender, at);
alter table private.feedback_senders enable row level security;
create or replace function private.feedback_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  address text := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1), 'unknown');
  who text := encode(pg_catalog.sha256(convert_to(address || ':baton-feedback', 'UTF8')), 'hex');
begin
  -- The server sets the time: a backdated row can't slip past the hourly limit.
  new.id := gen_random_uuid(); new.created_at := now();
  delete from private.feedback_senders where at < now() - interval '1 day';
  if (select count(*) from private.feedback_senders where sender = who and at > now() - interval '10 minutes') >= 3
    or (select count(*) from private.feedback_senders where sender = who) >= 10 then
    raise exception 'Too much feedback from one place. Please try again later.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.baton_feedback where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Feedback is busy. Please try again later.' using errcode = 'P0001';
  end if;
  if new.message is not null and exists (select 1 from public.baton_feedback where message = new.message and created_at > now() - interval '1 day') then
    raise exception 'This feedback was already sent.' using errcode = 'P0001';
  end if;
  insert into private.feedback_senders (sender) values (who);
  return new;
end $$;
revoke all on function private.feedback_guard() from public, anon, authenticated;
drop trigger if exists feedback_guard on public.baton_feedback;
create trigger feedback_guard before insert on public.baton_feedback for each row execute function private.feedback_guard();
