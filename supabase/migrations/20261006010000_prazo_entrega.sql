-- PRAZO DE ENTREGA (06/10): estimativa oficial por anúncio e CEP, guardada
-- 30 min para não repetir a consulta. Só o servidor lê e grava.
create table if not exists public.prazo_entrega_cache (
  item text not null,
  cep text not null,
  opcoes jsonb not null default '[]'::jsonb,
  status int not null,
  em timestamptz not null default now(),
  primary key (item, cep)
);
create index if not exists prazo_entrega_cache_em_idx on public.prazo_entrega_cache (em);
alter table public.prazo_entrega_cache enable row level security;
revoke all on public.prazo_entrega_cache from anon, authenticated;
