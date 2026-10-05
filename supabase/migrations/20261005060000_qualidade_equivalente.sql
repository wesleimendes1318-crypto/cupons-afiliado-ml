-- QUALIDADE EQUIVALENTE OU MELHOR (Weslei, 05/10: "a recomendacao nao deve
-- oferecer somente o menor valor, mas tambem a melhor qualidade ou
-- equivalente do que foi buscado. Isso e uma premissa"). Caso: projetor
-- L018 (Full HD nativo) x Magcubic HY300 Pro (linha mini, 720p) pela metade
-- do preco saiu como Melhor alternativa e no canal.

-- Veredito de qualidade da conferencia guardado junto do resto.
ALTER TABLE public.ia_vereditos ADD COLUMN IF NOT EXISTS qualidade text;
ALTER TABLE public.ia_vereditos ADD COLUMN IF NOT EXISTS qualidade_motivo text;

-- Vitrine e preparo do garimpo: so parecido com qualidade equivalente ou
-- superior (veredito da conferencia) ou que muda so cor/acabamento/estampa;
-- resolucao nativa menor no titulo (1080p -> 720p) veta. Mesma premissa de
-- src/lib/qualidade.ts (o site tambem compara as fichas).
CREATE OR REPLACE FUNCTION public.alternativa_da_analise(a jsonb, p_base numeric)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  select to_jsonb(x) from (
    select p->>'titulo' as titulo, nullif(p->>'preco', '')::numeric as preco,
           p->>'link' as link, p->>'vendedor' as loja,
           (coalesce(p->>'lojaOficial', '') = 'true' or coalesce(p->>'daBuscaOficial', '') = 'true') as oficial,
           nullif(p->>'vantagem', '') as vantagem,
           coalesce(p->>'freteGratis', '') = 'true' as frete_gratis,
           nullif(p->>'muda', '') as muda,
           nullif(p->>'qualidade', '') as qualidade,
           nullif(p->>'qualidadeMotivo', '') as qualidade_motivo
      from jsonb_array_elements(case when jsonb_typeof(a->'parecidos') = 'array' then a->'parecidos' else '[]'::jsonb end) p
     where p_base is not null
       and nullif(p->>'preco', '')::numeric <= p_base - 2
       and coalesce(p->>'freteGratis', '') <> 'false'
       and coalesce(p->>'link', '') <> ''
       and (coalesce(nullif(p->>'semelhanca', '')::numeric, 0) >= 85 or coalesce(p->>'mesmaFoto', '') = 'true')
       and regexp_replace(coalesce(p->>'muda', ''), '\mmesm[oa]s?\M[^,.;]*', '', 'gi') !~* public.muda_nao_e_alternativa()
       and (lower(coalesce(p->>'qualidade', '')) in ('superior', 'equivalente')
            or (coalesce(p->>'qualidade', '') = ''
                and coalesce(p->>'muda', '') ~* '^\s*(cor|cores|acabamento|estampa)\M[^;]*$'))
       and not (coalesce(a->>'titulo', '') ~* '(1080p|full ?hd|fhd)' and coalesce(p->>'titulo', '') ~* '\m(720|540|480)p\M')
     order by coalesce(nullif(p->>'semelhanca', '')::numeric,
                       case when coalesce(p->>'mesmaFoto', '') = 'true' then 90 else 0 end)
              + 10 * public.cobertura_do_titulo(a->>'titulo', p->>'titulo') desc,
              nullif(p->>'preco', '')::numeric asc
     limit 1
  ) x;
$$;

-- Reaplica na vitrine da ultima semana.
DO $$
DECLARE r public.pedidos_link;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.url_alvo) p.* FROM public.pedidos_link p
     WHERE p.status = 'pronto' AND p.criado_em > now() - interval '7 days'
     ORDER BY p.url_alvo, p.id DESC
  LOOP
    BEGIN
      PERFORM public.atualizar_produto_visto(r);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
