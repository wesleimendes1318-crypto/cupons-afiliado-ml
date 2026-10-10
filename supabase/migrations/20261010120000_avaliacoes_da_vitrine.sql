-- AVALIAÇÃO DAS PESSOAS NAS VITRINES (Weslei, 10/10: "publique as
-- atualizações de avaliações. não encontrei no meu site"). A nota e o total
-- de avaliações lidos pela extensão (1.164.0) ficam na análise do pedido
-- (analise.avaliacoes do colado e .avaliacoes de cada loja/parecido). Esta
-- leitura pública devolve, para cada produto da vitrine, a nota de cada
-- OFERTA pelo link de afiliado (meli.la): o cartão mostra a nota do anúncio
-- que está atrás do botão. Só leitura (as análises já são públicas por
-- consultar_pedido); até 300 produtos por chamada; nada inventado: sem nota
-- válida (0 < nota <= 5, total >= 1), a linha não sai. Aditiva.

create or replace function public.avaliacoes_da_vitrine(p_chaves text[])
returns table(chave text, link text, nota numeric, total integer)
language sql stable security definer set search_path to 'public' as $f$
  with pedidas as (
    select unnest(p_chaves[1:300]) as chave
  ), ult as (
    select distinct on (k.chave) k.chave, p.analise as a, p.link
      from public.pedidos_link p
      cross join lateral (select public.chave_do_url(p.url_alvo) as chave) k
     where p.status = 'pronto' and p.criado_em > now() - interval '30 days'
       and k.chave in (select chave from pedidas)
     order by k.chave, coalesce(p.atendido_em, p.criado_em) desc
  ), ofertas as (
    select u.chave, u.link as link, u.a->'avaliacoes' as av from ult u
    union all
    select u.chave, o->>'link', o->'avaliacoes'
      from ult u
      cross join lateral jsonb_array_elements(
        (case when jsonb_typeof(u.a->'outrasLojas') = 'array' then u.a->'outrasLojas' else '[]'::jsonb end)
        || (case when jsonb_typeof(u.a->'referencias') = 'array' then u.a->'referencias' else '[]'::jsonb end)
        || (case when jsonb_typeof(u.a->'parecidos') = 'array' then u.a->'parecidos' else '[]'::jsonb end)
      ) as o
  )
  select distinct on (o.chave, o.link) o.chave, o.link,
         round((o.av->>'nota')::numeric, 1), (o.av->>'total')::integer
    from ofertas o
   where o.link like 'https://meli.la/%'
     and jsonb_typeof(o.av) = 'object'
     and (o.av->>'nota') ~ '^[0-9]+(\.[0-9]+)?$'
     and (o.av->>'total') ~ '^[0-9]{1,9}$'
     and (o.av->>'nota')::numeric > 0 and (o.av->>'nota')::numeric <= 5
     and (o.av->>'total')::integer >= 1
   order by o.chave, o.link
$f$;

revoke all on function public.avaliacoes_da_vitrine(text[]) from public;
grant execute on function public.avaliacoes_da_vitrine(text[]) to anon, authenticated;
