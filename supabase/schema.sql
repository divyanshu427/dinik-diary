-- Dinik Diary: cloud storage for sync (Build Phase 15).
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run again.
--
-- One generic table holds every record of every kind (habit, log, activity…), so a change to
-- the app's data shape never needs a new migration. Each row belongs to one signed-in user and
-- the database itself (row level security) stops anyone reading or writing another user's rows.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text        not null check (tbl in (
    'phases', 'categories', 'habits', 'habitTargets', 'habitLogs', 'dayStatus',
    'activities', 'metrics', 'concerns', 'concernUpdates', 'healthReports',
    'reportFiles', 'labValues', 'settings'
  )),
  id         text        not null,
  data       jsonb       not null,
  -- When the user last changed it (set by the app). The newer edit wins.
  updated_at timestamptz not null,
  -- A deleted record is kept as a marker so other devices delete it too.
  deleted    boolean     not null default false,
  -- When the server last changed it (set here, not by the app). Devices ask
  -- "what changed since <this>?", so a wrong phone clock can't make them miss anything.
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, tbl, id)
);

create index if not exists records_changes_idx on public.records (user_id, synced_at);

-- Server-side rules for every write: the user can't be faked, a stale edit can't overwrite a
-- newer one, and synced_at is always the server's clock.
create or replace function public.records_before_write() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return old; -- an older edit arrived late: keep what's there
    end if;
    new.user_id := old.user_id;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

-- Only signed-in users may use the table at all (newer projects grant nothing by default);
-- anonymous visitors get nothing.
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- Row level security: you only ever see and change your own rows.
alter table public.records enable row level security;

drop policy if exists "own rows: read" on public.records;
create policy "own rows: read" on public.records
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own rows: add" on public.records;
create policy "own rows: add" on public.records
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own rows: change" on public.records;
create policy "own rows: change" on public.records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows: delete" on public.records;
create policy "own rows: delete" on public.records
  for delete to authenticated using (user_id = auth.uid());

-- Live updates: a change on one device reaches the other within a moment.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end $$;

-- Private file storage for health-report photos and PDFs. Each user's files live in a
-- folder named after their user id, and only they can open it.
insert into storage.buckets (id, name, public)
values ('report-files', 'report-files', false)
on conflict (id) do nothing;

drop policy if exists "own files: read" on storage.objects;
create policy "own files: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: add" on storage.objects;
create policy "own files: add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: change" on storage.objects;
create policy "own files: change" on storage.objects
  for update to authenticated
  using (bucket_id = 'report-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: delete" on storage.objects;
create policy "own files: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-files' and (storage.foldername(name))[1] = auth.uid()::text);
