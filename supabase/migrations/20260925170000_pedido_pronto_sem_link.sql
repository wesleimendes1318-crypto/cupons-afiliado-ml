-- Com analise (produto lido e comparado), o pedido fica PRONTO mesmo sem o
-- link de afiliado: o site mostra a comparacao e um botao que gera o link no
-- clique. Antes, sem link virava 'falhou' e o cliente perdia tudo.
CREATE OR REPLACE FUNCTION public.atender_pedido(p_token text, p_id bigint, p_link text, p_codigo text DEFAULT NULL::text, p_erro text DEFAULT NULL::text, p_analise jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  UPDATE public.pedidos_link
     SET link = p_link, codigo = p_codigo, erro = p_erro,
         analise = COALESCE(p_analise, analise),
         titulo = COALESCE(p_analise->>'titulo', titulo),
         status = CASE WHEN p_link IS NOT NULL OR (p_analise IS NOT NULL AND p_analise ? 'titulo' AND p_analise->>'titulo' IS NOT NULL)
                       THEN 'pronto' ELSE 'falhou' END,
         atendido_em = now()
   WHERE id = p_id;
END $function$;
