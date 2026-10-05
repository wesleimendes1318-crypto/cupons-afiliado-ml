-- RECOMENDADOS DO HUB DE AFILIADOS (Weslei, 05/10: "consulte os principais
-- produtos que o próprio Mercado Livre recomenda" no hub de afiliados). A
-- extensão lê a página logada uma vez por dia e manda os produtos SEM a
-- comissão (Ganhos nunca sai do navegador). Os primeiros entram na fila de
-- comparação (teto de 6 por leitura, cada produto no máximo a cada 48 h) e
-- só aparecem no site depois de comparados, com link de afiliado.
create table if not exists public.hub_recomendados (
  item text primary key,
  url text not null,
  titulo text,
  imagem text,
  preco numeric,
  preco_original numeric,
  desconto_pct int,
  mais_vendido boolean not null default false,
  avaliacao numeric,
  vendidos text,
  posicao int,
  lido_em timestamptz not null default now(),
  pedido_id bigint,
  enfileirado_em timestamptz
);
alter table public.hub_recomendados enable row level security;
revoke all on public.hub_recomendados from anon, authenticated;

create or replace function public.registrar_hub(p_token text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  r record;
  v_gravados int := 0;
  v_fila int := 0;
  v_pedido bigint;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return jsonb_build_object('gravados', 0); end if;
  for r in
    select * from jsonb_to_recordset(p_itens) as x(
      item text, url text, titulo text, imagem text, preco numeric, preco_original numeric,
      desconto_pct int, mais_vendido boolean, avaliacao numeric, vendidos text, posicao int)
    limit 80
  loop
    continue when r.item is null or r.item !~ '^MLB[0-9]{6,}$' or coalesce(r.url, '') !~ '^https://(www|produto)\.mercadolivre\.com\.br/';
    insert into public.hub_recomendados as h
      (item, url, titulo, imagem, preco, preco_original, desconto_pct, mais_vendido, avaliacao, vendidos, posicao, lido_em)
    values (r.item, r.url, left(r.titulo, 200), left(r.imagem, 400), r.preco, r.preco_original,
            r.desconto_pct, coalesce(r.mais_vendido, false), r.avaliacao, left(r.vendidos, 40), r.posicao, now())
    on conflict (item) do update set
      url = excluded.url, titulo = coalesce(excluded.titulo, h.titulo), imagem = coalesce(excluded.imagem, h.imagem),
      preco = excluded.preco, preco_original = excluded.preco_original, desconto_pct = excluded.desconto_pct,
      mais_vendido = excluded.mais_vendido, avaliacao = excluded.avaliacao, vendidos = excluded.vendidos,
      posicao = excluded.posicao, lido_em = now();
    v_gravados := v_gravados + 1;
  end loop;
  -- Fila de comparação: mais vendidos e maiores descontos primeiro.
  for r in
    select item, url from public.hub_recomendados
     where lido_em > now() - interval '1 hour'
       and (enfileirado_em is null or enfileirado_em < now() - interval '48 hours')
     order by mais_vendido desc, coalesce(desconto_pct, 0) desc, posicao nulls last
     limit 6
  loop
    begin
      v_pedido := public.pedir_link_novo(r.url);
      update public.hub_recomendados set pedido_id = v_pedido, enfileirado_em = now() where item = r.item;
      v_fila := v_fila + 1;
    exception when others then
      null;
    end;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'enfileirados', v_fila);
end $f$;
revoke all on function public.registrar_hub(text, jsonb) from public;
grant execute on function public.registrar_hub(text, jsonb) to anon, authenticated;
