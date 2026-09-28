-- "Me ajude a escolher" do resultado (28/09): uma análise por pedido,
-- guardada para a mesma pergunta voltar na hora. Só o servidor lê e grava.
create table if not exists public.ajuda_escolha (
  pedido_id bigint primary key references public.pedidos_link(id) on delete cascade,
  versao integer not null,
  resposta jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.ajuda_escolha enable row level security;
revoke all on public.ajuda_escolha from anon, authenticated;
