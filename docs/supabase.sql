-- Uruchom raz w Supabase: SQL Editor → New query → wklej → Run.
-- Tabela bez polityk RLS = brak bezpośredniego dostępu; klient używa tylko dwóch funkcji.

create table progress (
  sync_key uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table progress enable row level security; -- brak polityk = brak bezpośredniego dostępu

create function get_progress(k uuid) returns jsonb
language sql security definer set search_path = public as $$
  select data from progress where sync_key = k
$$;

create function save_progress(k uuid, d jsonb) returns void
language sql security definer set search_path = public as $$
  insert into progress (sync_key, data, updated_at) values (k, d, now())
  on conflict (sync_key) do update set data = excluded.data, updated_at = now()
$$;

grant execute on function get_progress(uuid), save_progress(uuid, jsonb) to anon;
