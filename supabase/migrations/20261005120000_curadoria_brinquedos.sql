-- CURADORIA DE BRINQUEDOS (05/10): o agente mapeia na API oficial (mais
-- vendidos e buscas por faixa de idade), escolhe a oferta nova mais barata
-- do catálogo e põe na fila de comparação. O site lê só o que já foi
-- comparado e tem link de afiliado (meli.la).
create table if not exists public.curadoria_brinquedos_itens (
  produto text primary key,
  item text not null,
  nome text not null,
  imagem text,
  faixa text,
  em_alta boolean not null default false,
  posicao int,
  idade_texto text,
  busca text,
  preco_ref numeric,
  ofertas int,
  frete_gratis_ref boolean,
  url text not null,
  pedido_id bigint,
  enfileirado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.curadoria_brinquedos_itens enable row level security;
revoke all on public.curadoria_brinquedos_itens from anon, authenticated;
create index if not exists pedidos_link_url_alvo_idx on public.pedidos_link (url_alvo, id desc);

create or replace function public.curadoria_brinquedos()
returns table(
  produto text, faixa text, em_alta boolean, posicao int, nome text, imagem text,
  idade_texto text, ofertas int, url text, preco numeric, loja text, link text,
  frete_gratis boolean, atendido_em timestamptz, economia numeric, melhor_preco numeric,
  melhor_loja text, melhor_link text, melhor_frete_gratis boolean, lojas_comparadas int)
language sql stable security definer set search_path to 'public' as $$
  select c.produto, c.faixa, c.em_alta, c.posicao, c.nome,
         coalesce(nullif(pl.analise->>'imagem', ''), c.imagem),
         c.idade_texto, c.ofertas, c.url,
         nullif(pl.analise->>'preco', '')::numeric,
         pl.analise->>'vendedor', pl.link,
         (pl.analise->>'freteGratis')::boolean, pl.atendido_em,
         pv.economia, pv.melhor_preco, pv.melhor_loja, pv.melhor_link, pv.melhor_frete_gratis,
         pv.lojas_comparadas
    from public.curadoria_brinquedos_itens c
    join lateral (
      select p.link, p.analise, p.atendido_em
        from public.pedidos_link p
       where p.url_alvo = c.url and p.status = 'pronto' and p.link like 'https://meli.la/%'
       order by p.id desc limit 1) pl on true
    left join public.produtos_vistos pv on pv.chave = upper(c.item) and pv.url_produto = c.url
   where pl.atendido_em > now() - interval '10 days'
     and public.produto_permitido(c.nome)
   order by c.em_alta desc, c.posicao nulls last, c.atualizado_em desc
   limit 300;
$$;
grant execute on function public.curadoria_brinquedos() to anon, authenticated;

create or replace function public.disparar_operacao(p_caminho text)
 returns bigint language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'cron-garimpo', 'cron-garimpo?simular=1')
     AND p_caminho !~ '^operacao\?tarefa=remover&publicacao=[0-9]{1,9}$'
     AND p_caminho !~ '^operacao\?tarefa=sazonal(&temporada=(criancas|black_friday|natal))?(&max=[0-9]{1,2})?$'
     AND p_caminho !~ '^operacao\?tarefa=brinquedos(&alvo=(em_alta|bebe|3a5|6a8|9a12|doacao))?$' THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(
    url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;
