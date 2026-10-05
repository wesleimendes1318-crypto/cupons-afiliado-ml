-- BUSCA GUIADA (05/10): cache das buscas do site e controle da fila que
-- alimenta a vitrine. Só o servidor (service role) lê e grava.
create table if not exists public.busca_guiada (
  id bigserial primary key,
  chave text not null,
  contexto text,
  resposta jsonb not null,
  enfileirados int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists busca_guiada_chave_idx on public.busca_guiada (chave, criado_em desc);
create index if not exists busca_guiada_criado_idx on public.busca_guiada (criado_em desc);
alter table public.busca_guiada enable row level security;
revoke all on public.busca_guiada from anon, authenticated;
