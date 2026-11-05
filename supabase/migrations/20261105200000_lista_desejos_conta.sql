-- PRECISA APLICAR SQL. WISHLIST (05/11/2026): the visitor's hearted products
-- saved in the account (sync between devices). Additive only. Each user
-- reads/writes only their own row (RLS on auth.uid()). Holds what the page
-- showed (title, photo, price seen, Weslei's affiliate link); no commission
-- or earnings data.
create table if not exists public.lista_desejos_conta (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint lista_desejos_conta_tamanho check (pg_column_size(dados) < 131072)
);

alter table public.lista_desejos_conta enable row level security;

create policy lista_desejos_conta_ler on public.lista_desejos_conta
  for select to authenticated using (auth.uid() = user_id);

create policy lista_desejos_conta_criar on public.lista_desejos_conta
  for insert to authenticated with check (auth.uid() = user_id);

create policy lista_desejos_conta_mudar on public.lista_desejos_conta
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.lista_desejos_conta to authenticated;
