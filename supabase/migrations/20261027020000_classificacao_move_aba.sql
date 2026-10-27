-- 27/10 (Weslei escolheu "Todos os 702"): a aba antiga (categoria_site)
-- passa a seguir a classificação. O agente dos mais vendidos regrava a aba
-- pela lista ao reler o produto; a classificação (10 min depois) a corrige.
-- Toda troca guarda o valor anterior em _categoria_site_antes (desfazer:
-- update em_alta_catalogo e set categoria_site = a.antes from
-- _categoria_site_antes a where a.produto = e.produto).
CREATE TABLE IF NOT EXISTS public._categoria_site_antes (
  produto text PRIMARY KEY,
  antes text NOT NULL,
  depois text NOT NULL,
  movido_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._categoria_site_antes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gravar_classificacao(p_linhas jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (
    SELECT * FROM jsonb_to_recordset(p_linhas) AS x(
      produto text, dominio_ml text, categoria_ml_folha text, categoria_ml_caminho text,
      categoria_no text, confianca_categoria text, classificacao_motivo text, categoria_site text)
  ), antes AS (
    INSERT INTO public._categoria_site_antes (produto, antes, depois)
    SELECT e.produto, e.categoria_site, r.categoria_site
      FROM public.em_alta_catalogo e JOIN r ON r.produto = e.produto
     WHERE r.categoria_site IS NOT NULL AND r.categoria_site <> e.categoria_site
    ON CONFLICT (produto) DO UPDATE SET depois = excluded.depois, movido_em = now()
    RETURNING 1
  ), u AS (
    UPDATE public.em_alta_catalogo e
       SET dominio_ml = r.dominio_ml,
           categoria_ml_folha = r.categoria_ml_folha,
           categoria_ml_caminho = r.categoria_ml_caminho,
           categoria_no = r.categoria_no,
           confianca_categoria = r.confianca_categoria,
           classificacao_motivo = r.classificacao_motivo,
           categoria_site = coalesce(r.categoria_site, e.categoria_site),
           classificado_em = now()
      FROM r
     WHERE e.produto = r.produto
    RETURNING 1
  )
  SELECT count(*)::int FROM u;
$$;
REVOKE ALL ON FUNCTION public.gravar_classificacao(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_classificacao(jsonb) TO service_role;
