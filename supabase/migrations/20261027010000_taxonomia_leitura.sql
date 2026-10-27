-- 27/10 (taxonomia): gravação da classificação (só servidor), leitura por
-- nó da árvore e contagem por nó (públicas, sem dado sensível) e o que a
-- classificação marca como "fora" (adulto, digital, peça de tela, falso)
-- some das leituras públicas. Nada é apagado.

-- Grava SÓ as colunas da classificação (nunca categoria_site, preço ou link).
CREATE OR REPLACE FUNCTION public.gravar_classificacao(p_linhas jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (
    SELECT * FROM jsonb_to_recordset(p_linhas) AS x(
      produto text, dominio_ml text, categoria_ml_folha text, categoria_ml_caminho text,
      categoria_no text, confianca_categoria text, classificacao_motivo text)
  ), u AS (
    UPDATE public.em_alta_catalogo e
       SET dominio_ml = r.dominio_ml,
           categoria_ml_folha = r.categoria_ml_folha,
           categoria_ml_caminho = r.categoria_ml_caminho,
           categoria_no = r.categoria_no,
           confianca_categoria = r.confianca_categoria,
           classificacao_motivo = r.classificacao_motivo,
           classificado_em = now()
      FROM r
     WHERE e.produto = r.produto
    RETURNING 1
  )
  SELECT count(*)::int FROM u;
$$;
REVOKE ALL ON FUNCTION public.gravar_classificacao(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_classificacao(jsonb) TO service_role;

-- Mesma leitura da v3 (mesmos campos e regras), sem os itens "fora".
CREATE OR REPLACE FUNCTION public.em_alta_por_categoria_v3(p_categoria text, p_por_categoria integer DEFAULT 24)
RETURNS TABLE(produto text, categoria_site text, posicao integer, nome text, imagem text, imagem2 text, preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamp with time zone, origem text, busca text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select x.produto, x.categoria_site, x.posicao, x.nome, x.imagem, x.imagem2, x.preco, x.frete_gratis,
         x.loja_oficial, x.url, x.atualizado_em, coalesce(x.origem, 'vendidos'), x.busca
    from (
      select e.*, row_number() over (partition by e.categoria_site order by e.posicao nulls last, e.produto) as rn
        from public.em_alta_catalogo e
       where (p_categoria is null or e.categoria_site = p_categoria)
         and e.atualizado_em > now() - interval '3 days'
         and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
         and e.categoria_no is distinct from 'fora'
    ) x
   where x.rn <= least(greatest(coalesce(p_por_categoria, 24), 1), 5000)
   order by x.categoria_site, x.posicao nulls last, x.produto;
$$;

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
     and e.categoria_no is distinct from 'fora'
   group by e.categoria_site;
$$;

-- Produtos de um conjunto de nós (a página da categoria passa a subárvore).
-- Ainda não classificado: vale a categoria antiga (os 10 slugs antigos são
-- nós da árvore), então nada some enquanto a classificação não roda.
CREATE OR REPLACE FUNCTION public.em_alta_por_no(p_nos text[], p_limite integer DEFAULT 5000)
RETURNS TABLE(produto text, categoria_site text, categoria_no text, confianca_categoria text, posicao integer, nome text, imagem text, imagem2 text, preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamp with time zone, origem text, busca text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select e.produto, e.categoria_site, coalesce(e.categoria_no, e.categoria_site), e.confianca_categoria,
         e.posicao, e.nome, e.imagem, e.imagem2, e.preco, e.frete_gratis, e.loja_oficial, e.url,
         e.atualizado_em, coalesce(e.origem, 'vendidos'), e.busca
    from public.em_alta_catalogo e
   where coalesce(e.categoria_no, e.categoria_site) = any(p_nos)
     and e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
   order by e.posicao nulls last, e.produto
   limit least(greatest(coalesce(p_limite, 5000), 1), 5000);
$$;

-- Quantos produtos cada nó tem (sem os "fora"); a página soma a subárvore.
CREATE OR REPLACE FUNCTION public.em_alta_contagem_nos()
RETURNS TABLE(categoria_no text, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(e.categoria_no, e.categoria_site), count(*)::int
    from public.em_alta_catalogo e
   where e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
     and e.categoria_no is distinct from 'fora'
   group by 1;
$$;

GRANT EXECUTE ON FUNCTION public.em_alta_por_no(text[], integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.em_alta_contagem_nos() TO anon, authenticated;

-- Classificação contínua: produtos novos ou relidos são classificados em
-- até 10 min (operacao?tarefa=classificar, src/lib/classificar-catalogo.ts).
SELECT cron.schedule('operacao-classificar', '7-59/10 * * * *',
  $$SELECT public.disparar_operacao('operacao?tarefa=classificar');$$);
