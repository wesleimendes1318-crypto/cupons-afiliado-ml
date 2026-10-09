-- Leitura pública dos Mais vendidos com teto POR categoria (09/10, Weslei:
-- "pelo menos 20 anúncios em cada"): a v2 cortava as últimas categorias da
-- home no limite geral de 200. Mesmas regras de exibição da v2.
CREATE OR REPLACE FUNCTION public.em_alta_por_categoria(p_categoria text, p_por_categoria integer DEFAULT 24)
 RETURNS TABLE(produto text, categoria_site text, posicao integer, nome text, imagem text, imagem2 text,
               preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.produto, x.categoria_site, x.posicao, x.nome, x.imagem, x.imagem2, x.preco, x.frete_gratis,
         x.loja_oficial, x.url, x.atualizado_em
    from (
      select e.*, row_number() over (partition by e.categoria_site order by e.posicao nulls last, e.produto) as rn
        from public.em_alta_catalogo e
       where (p_categoria is null or e.categoria_site = p_categoria)
         and e.atualizado_em > now() - interval '3 days'
         and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
    ) x
   where x.rn <= least(greatest(coalesce(p_por_categoria, 24), 1), 60)
   order by x.categoria_site, x.posicao nulls last, x.produto;
$function$;
REVOKE ALL ON FUNCTION public.em_alta_por_categoria(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.em_alta_por_categoria(text, integer) TO anon, authenticated, service_role;
