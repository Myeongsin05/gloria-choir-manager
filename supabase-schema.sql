create table if not exists public.app_kv (
  key text primary key,
  value jsonb not null,
  add_date timestamptz not null default now(),
  mod_date timestamptz not null default now()
);

create or replace function public.set_app_kv_mod_date()
returns trigger
language plpgsql
as $$
begin
  new.mod_date = now();
  return new;
end;
$$;

drop trigger if exists trg_app_kv_mod_date on public.app_kv;

create trigger trg_app_kv_mod_date
before update on public.app_kv
for each row
execute function public.set_app_kv_mod_date();

alter table public.app_kv enable row level security;

drop policy if exists "service role can manage app_kv" on public.app_kv;

create policy "service role can manage app_kv"
on public.app_kv
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('score-files', 'score-files', true)
on conflict (id) do update set public = excluded.public;
