-- AMIGO SECRETO (05/11/2026): the person's gift list saved in the account
-- (start on the phone, finish on the PC). Additive only. Holds what the person
-- typed (names, wishes, budget, showcase terms, "presente já escolhido");
-- never products, prices or affiliate data. Each user reads/writes only
-- their own row (RLS on auth.uid()).
create table if not exists public.amigo_secreto_conta (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint amigo_secreto_conta_tamanho check (pg_column_size(dados) < 65536)
);

alter table public.amigo_secreto_conta enable row level security;

drop policy if exists amigo_secreto_conta_ler on public.amigo_secreto_conta;
create policy amigo_secreto_conta_ler on public.amigo_secreto_conta
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists amigo_secreto_conta_criar on public.amigo_secreto_conta;
create policy amigo_secreto_conta_criar on public.amigo_secreto_conta
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists amigo_secreto_conta_mudar on public.amigo_secreto_conta;
create policy amigo_secreto_conta_mudar on public.amigo_secreto_conta
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists amigo_secreto_conta_apagar on public.amigo_secreto_conta;
create policy amigo_secreto_conta_apagar on public.amigo_secreto_conta
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.amigo_secreto_conta to authenticated;
