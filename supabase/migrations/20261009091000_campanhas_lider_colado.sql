-- MercadoLíder do próprio anúncio colado (extensão 1.156.0, 09/10): o
-- "já é o menor preço" também pode entrar nas campanhas com vendedor
-- confiável. Aditiva (a função ganha a coluna colado_lider).
DROP FUNCTION IF EXISTS public.confiabilidade_da_vitrine(text[]);
CREATE OR REPLACE FUNCTION public.confiabilidade_da_vitrine(p_chaves text[])
RETURNS TABLE (
  chave text, pedido_id bigint, conferido_em timestamptz, categoria text,
  melhor_oficial boolean, melhor_lider text, alt_oficial boolean, alt_lider text,
  colado_oficial boolean, colado_condicao text, colado_lider text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ult AS (
    SELECT DISTINCT ON (k.chave) k.chave, p.id, coalesce(p.atendido_em, p.criado_em) AS em,
           p.analise AS a, p.link
      FROM public.pedidos_link p
      CROSS JOIN LATERAL (SELECT public.chave_do_url(p.url_alvo) AS chave) k
     WHERE p.status = 'pronto' AND p.criado_em > now() - interval '30 days'
       AND k.chave = ANY (p_chaves)
     ORDER BY k.chave, coalesce(p.atendido_em, p.criado_em) DESC
  )
  SELECT u.chave, u.id, u.em, u.a->>'categoria',
         public.jsonb_sim(m.o->'lojaOficial'), nullif(m.o->>'mercadoLider', ''),
         public.jsonb_sim(par.o->'lojaOficial'), nullif(par.o->>'mercadoLider', ''),
         public.jsonb_sim(u.a->'lojaOficial'), u.a->>'condicao', nullif(u.a->>'mercadoLider', '')
    FROM ult u
    LEFT JOIN public.produtos_vistos pv ON pv.chave = u.chave
    LEFT JOIN LATERAL (
      SELECT o FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(u.a->'outrasLojas') = 'array' THEN u.a->'outrasLojas' ELSE '[]'::jsonb END)
             WITH ORDINALITY AS t(o, n)
       WHERE coalesce(o->>'link', '') <> '' AND o->>'link' <> u.link
         AND NOT public.jsonb_sim(o->'semAfiliado') AND NOT public.jsonb_sim(o->'mesmaPagina')
       ORDER BY n LIMIT 1) m ON true
    LEFT JOIN LATERAL (
      SELECT o FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(u.a->'parecidos') = 'array' THEN u.a->'parecidos' ELSE '[]'::jsonb END) AS t(o)
       WHERE pv.alt_link IS NOT NULL AND o->>'link' = pv.alt_link
       LIMIT 1) par ON true
$$;
REVOKE ALL ON FUNCTION public.confiabilidade_da_vitrine(text[]) FROM PUBLIC, anon, authenticated;
