-- Comparacao "mesmo produto em outras lojas" feita pelo servidor do site, com
-- a API oficial do Mercado Livre (24/09/2026). A sessao de afiliado do Weslei
-- deixa de ler paginas para comparar; ela so gera o link das opcoes escolhidas.

-- Cache: o mesmo produto consultado de novo em ate 6 horas nao chama a API.
CREATE TABLE IF NOT EXISTS public.comparacoes (
  chave     text PRIMARY KEY,
  resposta  jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comparacoes ENABLE ROW LEVEL SECURITY;  -- so o servidor (service role)

-- Melhor cupom vigente de cada loja, pelo nome normalizado. Mesma regra do
-- melhor_cupom (conferido primeiro, depois bom, depois maior teto), sem
-- devolver cupom marcado como armadilha.
CREATE OR REPLACE FUNCTION public.melhores_cupons_por_nome(p_nomes text[])
 RETURNS TABLE(nome text, id bigint, vendedor text, desconto text, tipo text, valor numeric,
               teto numeric, sem_teto boolean, compra_min numeric, vence date, codigo_cupom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (public.normalizar_nome(c.vendedor))
         public.normalizar_nome(c.vendedor), c.id, c.vendedor, c.desconto, c.tipo, c.valor,
         c.teto, c.sem_teto, c.compra_min, c.vence, c.codigo_cupom
    FROM public.cupons c
   WHERE public.normalizar_nome(c.vendedor) = ANY (
           SELECT public.normalizar_nome(x) FROM unnest(p_nomes) AS x)
     AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
     AND c.qualidade IS DISTINCT FROM 'armadilha'
   ORDER BY public.normalizar_nome(c.vendedor),
            (c.teto IS NOT NULL OR c.sem_teto) DESC, (c.qualidade = 'bom') DESC,
            c.sem_teto DESC, c.teto DESC NULLS LAST, c.valor DESC NULLS LAST;
$function$;
REVOKE ALL ON FUNCTION public.melhores_cupons_por_nome(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.melhores_cupons_por_nome(text[]) TO service_role;
