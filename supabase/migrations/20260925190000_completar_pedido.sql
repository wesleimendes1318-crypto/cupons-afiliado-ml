-- Segunda volta da comparacao (regra do Weslei, 25/09: enquanto nao achar
-- opcao mais barata ou nao tiver a analise completa, nao desapontar o
-- cliente). O pedido ja esta PRONTO na tela com o link de afiliado; quando a
-- extensao termina a comparacao que tinha ficado incompleta, so a analise e
-- trocada. atendido_em NAO muda: tempo_estimado continua medindo a resposta.
CREATE OR REPLACE FUNCTION public.completar_pedido(p_token text, p_id bigint, p_analise jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF p_analise IS NULL THEN RETURN; END IF;
  UPDATE public.pedidos_link
     SET analise = p_analise,
         titulo = COALESCE(p_analise->>'titulo', titulo)
   WHERE id = p_id AND status = 'pronto';
END $function$;

-- Quantos clientes estao na fila, SEM reservar (pedidos_pendentes reserva).
-- A segunda volta consulta isto a cada 4 s: cliente novo passa na frente.
CREATE OR REPLACE FUNCTION public.pedidos_esperando(p_token text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN (SELECT count(*)::int FROM public.pedidos_link
           WHERE status = 'pendente' AND criado_em > now() - interval '3 days');
END $function$;
