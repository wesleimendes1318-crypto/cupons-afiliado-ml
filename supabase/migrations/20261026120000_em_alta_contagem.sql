-- 26/10 (Weslei: "O site ainda não tem a quantidade olhando"): quantos mais
-- vendidos cada categoria mostra (as mesmas regras de
-- em_alta_por_categoria_v3, teto de 300 como a página da categoria). Só
-- contagem, leitura pública.
CREATE OR REPLACE FUNCTION public.em_alta_contagem()
RETURNS TABLE(categoria_site text, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select e.categoria_site, least(count(*), 300)::int
    from public.em_alta_catalogo e
   where e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
   group by e.categoria_site;
$$;

GRANT EXECUTE ON FUNCTION public.em_alta_contagem() TO anon, authenticated;
