-- 26/10 (Weslei: "Aumente 200 produtos em cada categoria todos os dias,
-- sempre mantendo listas vivas"): a meta do agente sobe 200 por dia
-- (src/lib/em-alta-catalogo.ts); a leitura pública e a contagem deixam de
-- parar em 300 (teto 5000 por categoria) e o agente roda a cada 5 min.
CREATE OR REPLACE FUNCTION public.em_alta_por_categoria_v3(p_categoria text, p_por_categoria integer DEFAULT 24)
RETURNS TABLE(produto text, categoria_site text, posicao integer, nome text, imagem text, imagem2 text, preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamp with time zone, origem text, busca text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select x.produto, x.categoria_site, x.posicao, x.nome, x.imagem, x.imagem2, x.preco, x.frete_gratis,
         x.loja_oficial, x.url, x.atualizado_em, coalesce(x.origem, 'vendidos'), x.busca
    from (
      select e.*, row_number() over (partition by e.categoria_site order by e.posicao nulls last, e.produto) as rn
        from public.em_alta_catalogo e
       where (p_categoria is null or e.categoria_site = p_categoria)
         and e.atualizado_em > now() - interval '3 days'
         and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
    ) x
   where x.rn <= least(greatest(coalesce(p_por_categoria, 24), 1), 5000)
   order by x.categoria_site, x.posicao nulls last, x.produto;
$function$;

CREATE OR REPLACE FUNCTION public.em_alta_contagem()
RETURNS TABLE(categoria_site text, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select e.categoria_site, least(count(*), 5000)::int
    from public.em_alta_catalogo e
   where e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
   group by e.categoria_site;
$$;

SELECT cron.alter_job(jobid, schedule => '*/5 * * * *')
FROM cron.job
WHERE jobname = 'operacao-em-alta';
