-- CLIENTE PRIMEIRO NA FILA (Weslei, 10/10: "está demorando muito para
-- consultar e o usuário desiste"; pedido 1208 esperou 2 pedidos internos e a
-- tela dizia "Pronto em até 10min 05s").
--  1) tempo_estimado: só pedidos de CLIENTE (os internos entram em lote e
--     esperam na fila; com eles a previsão foi a 10 min, o real é ~45 s).
--  2) pedidos_pendentes: pedido interno UM por rodada (eram 2).
--  3) pedir_link_base: o mesmo link já na fila/andamento não duplica também
--     no uso normal (1208/1209: o mesmo link em 4 s entrou duas vezes).
--  4) pedidos_pendentes_v2 (com a origem) e clientes_esperando: a extensão
--     1.165.3 corta o pedido interno em andamento quando um cliente chega.

CREATE OR REPLACE FUNCTION public.tempo_estimado()
 RETURNS TABLE(segundos integer, amostras integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ult AS (
    SELECT extract(epoch FROM atendido_em - criado_em) AS s
      FROM public.pedidos_link
     WHERE status = 'pronto' AND atendido_em IS NOT NULL
       AND coalesce(origem, '') <> 'teste'
       AND criado_em > now() - interval '7 days'
       AND atendido_em > criado_em
     ORDER BY id DESC
     LIMIT 20
  )
  SELECT CASE WHEN count(*) >= 3 THEN ceil(percentile_cont(0.75) WITHIN GROUP (ORDER BY s))::int END,
         count(*)::int
    FROM ult;
$function$;

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
  RETURN QUERY
  WITH livres AS (
    SELECT p.id, coalesce(p.origem, '') = 'teste' AS interno, p.criado_em
      FROM public.pedidos_link p
     WHERE p.criado_em > now() - interval '3 days'
       AND (p.status = 'pendente'
            OR (p.status = 'processando'
                AND coalesce(p.processando_em, p.criado_em) < now() - interval '90 seconds'))
  ),
  clientes AS (
    SELECT l.id FROM livres l WHERE NOT l.interno ORDER BY l.criado_em LIMIT 12
  ),
  internos AS (
    SELECT l.id FROM livres l
     WHERE l.interno AND NOT EXISTS (SELECT 1 FROM clientes)
     ORDER BY l.criado_em LIMIT 1
  ),
  alvo AS (
    SELECT p.id FROM public.pedidos_link p
     WHERE p.id IN (SELECT c.id FROM clientes c UNION ALL SELECT i.id FROM internos i)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pedidos_link q
     SET status = 'processando', processando_em = now()
    FROM alvo
   WHERE q.id = alvo.id
  RETURNING q.id, q.cupom_id, q.vendedor, q.url_alvo;
END
$function$;

CREATE OR REPLACE FUNCTION public.pedir_link_base(p_url text, p_reusar boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text; v_wid text;
BEGIN
  IF p_url IS NULL OR length(p_url) > 2000
     OR p_url !~* '^https?://([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(/|$)' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;
  IF p_url ~* '/pagina/' OR p_url ~* '_CustId_' OR p_url ~* '/perfil/' THEN
    RAISE EXCEPTION 'link de loja nao gera link de afiliado valido';
  END IF;
  v_url := split_part(p_url, '#', 1);
  v_wid := substring(p_url from '(?i)[#&?]wid=(MLB[0-9]{6,})');
  IF v_wid IS NOT NULL AND v_url !~* 'item_id' THEN
    v_url := v_url || CASE WHEN position('?' in v_url) > 0 THEN '&' ELSE '?' END
                   || 'pdp_filters=item_id%3A' || upper(v_wid);
  END IF;
  IF p_reusar THEN
    SELECT p.id INTO v_id FROM public.pedidos_link p
     WHERE p.url_alvo = v_url AND p.status = 'pronto' AND p.link IS NOT NULL
       AND p.criado_em > now() - interval '1 hour'
       AND (p.analise->>'completa') = 'true' AND (p.analise->>'final') = 'true'
       AND (p.analise->>'versaoExtensao') = (SELECT valor FROM public.sinc_config WHERE chave = 'versao_extensao')
     ORDER BY p.id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT p.id INTO v_id FROM public.pedidos_link p
   WHERE p.url_alvo = v_url AND p.status IN ('pendente', 'processando')
     AND p.criado_em > now() - interval '5 minutes'
   ORDER BY p.id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF public.pedidos_no_limite() THEN RAISE EXCEPTION 'fila cheia'; END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site') RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.pedidos_pendentes_v2(p_token text)
 RETURNS TABLE(id bigint, cupom_id bigint, vendedor text, url_alvo text, origem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT q.id, q.cupom_id, q.vendedor, q.url_alvo, coalesce(pl.origem, '')
    FROM public.pedidos_pendentes(p_token) q
    JOIN public.pedidos_link pl ON pl.id = q.id;
END
$function$;
revoke all on function public.pedidos_pendentes_v2(text) from public;
grant execute on function public.pedidos_pendentes_v2(text) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.clientes_esperando(p_token text)
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
           WHERE status = 'pendente' AND coalesce(origem, '') <> 'teste'
             AND criado_em > now() - interval '3 days');
END $function$;
revoke all on function public.clientes_esperando(text) from public;
grant execute on function public.clientes_esperando(text) to anon, authenticated;
