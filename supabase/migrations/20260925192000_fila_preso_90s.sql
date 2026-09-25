-- Pedido preso em 'processando' (o service worker da extensao morreu no meio)
-- volta para a fila depois de 90 s (era 2 min; pedido 259 em 25/09: 139 s).
CREATE OR REPLACE FUNCTION public.pedidos_pendentes(p_token text)
 RETURNS TABLE(id bigint, cupom_id bigint, vendedor text, url_alvo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;

  /* Reserva atomica da fila (FOR UPDATE SKIP LOCKED): cada instancia da
     extensao leva um pedaco diferente da fila.
     Pedido preso em 'processando' (o service worker morreu no meio) volta
     para a fila depois de 90 s (era 2 min; pedido 259 em 25/09 esperou 139 s). */
  RETURN QUERY
  WITH alvo AS (
    SELECT p.id
      FROM public.pedidos_link p
     WHERE p.criado_em > now() - interval '3 days'
       AND (p.status = 'pendente'
            OR (p.status = 'processando'
                AND coalesce(p.processando_em, p.criado_em) < now() - interval '90 seconds'))
     ORDER BY p.criado_em
     LIMIT 12
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pedidos_link q
     SET status = 'processando', processando_em = now()
    FROM alvo
   WHERE q.id = alvo.id
  RETURNING q.id, q.cupom_id, q.vendedor, q.url_alvo;
END
$function$;
