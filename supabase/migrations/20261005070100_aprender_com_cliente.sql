-- APRENDER COM O CLIENTE (Weslei, 05/10: "voce precisa aprender e melhorar,
-- como machine learning"). Em cada Parecido e na Melhor alternativa o
-- cliente responde "Faz sentido?" (sim / nao e equivalente). Sem IP, sem id.
-- Efeito so no sentido SEGURO: um "nao e equivalente" tira a indicacao da
-- recomendacao (qualidade 'incerta' no veredito guardado e na analise do
-- pedido, o que atualiza a vitrine pelo gatilho); o item continua nos
-- Parecidos. "Sim" so conta para o relatorio (nunca promove sozinho, para
-- ninguem conseguir forcar recomendacao).
CREATE TABLE IF NOT EXISTS public.avaliacoes_indicacao (
  id bigserial PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  pedido_id bigint NOT NULL,
  item text NOT NULL,
  util boolean NOT NULL,
  motivo text,
  chave_original text,
  aplicado boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS avaliacoes_indicacao_dia ON public.avaliacoes_indicacao (criado_em DESC);
ALTER TABLE public.avaliacoes_indicacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avaliacoes_indicacao FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.avaliar_indicacao(
  p_pedido bigint, p_item text, p_util boolean, p_motivo text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ped public.pedidos_link;
  v_item text := upper(left(regexp_replace(coalesce(p_item, ''), '[^A-Za-z0-9]', '', 'g'), 20));
  v_orig text;
  v_par jsonb;
  v_motivo text := left(nullif(trim(coalesce(p_motivo, '')), ''), 200);
BEGIN
  IF v_item !~ '^MLB[0-9]{6,}$' OR p_util IS NULL THEN RETURN false; END IF;
  -- Freio: 60 avaliacoes por minuto no site todo; 1 por item e pedido.
  IF (SELECT count(*) FROM public.avaliacoes_indicacao WHERE criado_em > now() - interval '1 minute') >= 60 THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.avaliacoes_indicacao
              WHERE pedido_id = p_pedido AND item = v_item AND criado_em > now() - interval '1 day') THEN
    RETURN true;
  END IF;
  SELECT * INTO v_ped FROM public.pedidos_link WHERE id = p_pedido;
  IF v_ped.id IS NULL THEN RETURN false; END IF;
  -- So item que aparece nos parecidos deste pedido.
  SELECT x INTO v_par FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_ped.analise->'parecidos') = 'array' THEN v_ped.analise->'parecidos' ELSE '[]'::jsonb END) x
   WHERE upper(x->>'item') = v_item LIMIT 1;
  IF v_par IS NULL THEN RETURN false; END IF;
  v_orig := upper(coalesce(
    substring(v_ped.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    'MLB' || substring(v_ped.url_alvo from '(?i)/MLB-([0-9]{6,})')));
  INSERT INTO public.avaliacoes_indicacao (pedido_id, item, util, motivo, chave_original, aplicado)
  VALUES (p_pedido, v_item, p_util, v_motivo, v_orig, NOT p_util);
  IF NOT p_util THEN
    UPDATE public.ia_vereditos
       SET qualidade = 'incerta', qualidade_motivo = 'Cliente apontou que não é equivalente'
     WHERE chave_candidato = v_item
       AND (v_orig IS NULL OR chave_original = v_orig
            OR NOT EXISTS (SELECT 1 FROM public.ia_vereditos v
                            WHERE v.chave_candidato = v_item AND v.chave_original = v_orig));
    UPDATE public.pedidos_link p
       SET analise = jsonb_set(p.analise, '{parecidos}', (
             SELECT jsonb_agg(CASE WHEN upper(x->>'item') = v_item
                     THEN x || jsonb_build_object('qualidade', 'incerta',
                            'qualidadeMotivo', 'Cliente apontou que não é equivalente',
                            'avaliadoPeloCliente', true)
                     ELSE x END)
               FROM jsonb_array_elements(p.analise->'parecidos') x))
     WHERE p.id = p_pedido AND jsonb_typeof(p.analise->'parecidos') = 'array';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.avaliar_indicacao(bigint, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliar_indicacao(bigint, text, boolean, text) TO anon, authenticated;

-- Resumo semanal para o relatorio da operacao (so leitura administrativa).
CREATE OR REPLACE VIEW public.aprendizado_indicacoes AS
SELECT date_trunc('week', a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
       count(*) FILTER (WHERE a.util) AS fazem_sentido,
       count(*) FILTER (WHERE NOT a.util) AS nao_equivalentes,
       count(DISTINCT a.pedido_id) AS pedidos
  FROM public.avaliacoes_indicacao a GROUP BY 1;
REVOKE ALL ON public.aprendizado_indicacoes FROM anon, authenticated;
