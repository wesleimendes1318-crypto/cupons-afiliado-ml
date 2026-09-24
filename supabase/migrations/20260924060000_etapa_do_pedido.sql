-- Etapa real do atendimento, para o site mostrar ao cliente o que esta
-- acontecendo: 'cupom' (lendo o anuncio e o cupom da loja), 'outras_lojas'
-- (procurando o mesmo produto mais barato) e 'links' (gerando os links de
-- afiliado). Fica em analise.etapa ate a extensao gravar o resultado final,
-- que substitui a analise inteira.
CREATE OR REPLACE FUNCTION public.marcar_etapa(p_token text, p_id bigint, p_etapa text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n integer;
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF p_etapa NOT IN ('cupom', 'outras_lojas', 'links') THEN RETURN false; END IF;
  UPDATE public.pedidos_link
     SET analise = coalesce(analise, '{}'::jsonb) || jsonb_build_object('etapa', p_etapa)
   WHERE id = p_id AND status = 'processando';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $function$;
GRANT EXECUTE ON FUNCTION public.marcar_etapa(text, bigint, text) TO anon, authenticated, service_role;
