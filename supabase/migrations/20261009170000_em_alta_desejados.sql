-- Mais desejados (09/10, noite): de onde veio cada produto dos mais
-- vendidos ('vendidos' = lista de mais vendidos; 'tendencia' = busca em
-- alta na lista oficial, com o termo; 'curadoria' = busca fixa) e leitura
-- pública com esses campos (a v2/por_categoria continuam iguais).
ALTER TABLE public.em_alta_catalogo ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.em_alta_catalogo ADD COLUMN IF NOT EXISTS busca text;

CREATE OR REPLACE FUNCTION public.em_alta_por_categoria_v3(p_categoria text, p_por_categoria integer DEFAULT 24)
 RETURNS TABLE(produto text, categoria_site text, posicao integer, nome text, imagem text, imagem2 text,
               preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamp with time zone,
               origem text, busca text)
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
   where x.rn <= least(greatest(coalesce(p_por_categoria, 24), 1), 100)
   order by x.categoria_site, x.posicao nulls last, x.produto;
$function$;
REVOKE ALL ON FUNCTION public.em_alta_por_categoria_v3(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.em_alta_por_categoria_v3(text, integer) TO anon, authenticated, service_role;

-- 100 por categoria (09/10, noite): o agente roda a cada 30 min (minutos
-- 23 e 53), sozinho no banco, sem depender de quem edita o site.
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'operacao-em-alta'),
                      schedule := '23,53 * * * *');
