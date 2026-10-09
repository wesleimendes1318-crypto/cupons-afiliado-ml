-- Em alta no catálogo, por categoria do site (Weslei, 09/10: "um bom volume
-- de produtos em alta para cada categoria"). Aditiva. A tabela é só do
-- servidor (agente operacao?tarefa=em_alta); o site lê pela função pública,
-- só leitura, apenas o que foi atualizado nos últimos 3 dias.
create table if not exists public.em_alta_catalogo (
  produto text primary key,
  categoria_site text not null,
  categoria_ml text,
  posicao int,
  nome text not null,
  imagem text,
  item text not null,
  preco numeric not null,
  ofertas int,
  frete_gratis boolean,
  loja_oficial boolean not null default false,
  url text not null,
  atualizado_em timestamptz not null default now(),
  enfileirado_em timestamptz,
  pedido_id bigint
);
create index if not exists em_alta_catalogo_cat on public.em_alta_catalogo (categoria_site, posicao);
alter table public.em_alta_catalogo enable row level security;
revoke all on public.em_alta_catalogo from anon, authenticated;

create or replace function public.em_alta_da_categoria(p_categoria text, p_limite int default 24)
returns table(produto text, categoria_site text, posicao int, nome text, imagem text, preco numeric,
              frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamptz)
language sql stable security definer set search_path to 'public' as $f$
  select e.produto, e.categoria_site, e.posicao, e.nome, e.imagem, e.preco, e.frete_gratis,
         e.loja_oficial, e.url, e.atualizado_em
    from public.em_alta_catalogo e
   where (p_categoria is null or e.categoria_site = p_categoria)
     and e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
   order by e.categoria_site, e.posicao nulls last
   limit least(greatest(coalesce(p_limite, 24), 1), 200);
$f$;
revoke all on function public.em_alta_da_categoria(text, int) from public;
grant execute on function public.em_alta_da_categoria(text, int) to anon, authenticated;

-- Uma categoria por execução (a mais desatualizada), de hora em hora: as 8
-- categorias renovam ao longo do dia; a fila respeita o teto dos agentes.
select cron.schedule('operacao-em-alta', '23 * * * *',
  $$select public.disparar_operacao('operacao?tarefa=em_alta');$$);
