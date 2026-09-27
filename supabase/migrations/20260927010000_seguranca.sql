-- SEGURANCA (Weslei, 27/09: "maxima seguranca, mas que funcione como hoje").
-- Nada muda para quem usa o site normalmente.

-- A. Vitrine: so o proprio banco grava (gatilho pedido_para_vitrine, que roda
--    como dono). Visitante nao chama mais registrar_produto_visto direto (dava
--    para injetar produto falso com link de outra pessoa). A leitura (vitrine())
--    continua aberta.
REVOKE EXECUTE ON FUNCTION public.registrar_produto_visto(public.pedidos_link) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pedido_para_vitrine() FROM PUBLIC, anon, authenticated;

-- B. Link de afiliado de cupom: ninguem usa esta funcao; aberta, deixava gravar
--    o link de outro afiliado num cupom sem link.
REVOKE EXECUTE ON FUNCTION public.salvar_link_loja(bigint, text) FROM PUBLIC, anon, authenticated;

-- D. Codigo aleatorio por pedido: o resultado so e lido com ele (antes bastava
--    o numero sequencial).
ALTER TABLE public.pedidos_link ADD COLUMN IF NOT EXISTS chave uuid NOT NULL DEFAULT gen_random_uuid();

-- C. Limite de pedidos NOVOS (link repetido continua voltando na hora):
--    15 por minuto e 150 por hora, no site todo. Protege a conta do Mercado
--    Livre de uma enxurrada de leituras (pico real: 7 por minuto).
CREATE OR REPLACE FUNCTION public.pedidos_no_limite()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT (SELECT count(*) FROM public.pedidos_link WHERE origem = 'site' AND criado_em > now() - interval '1 minute') >= 15
      OR (SELECT count(*) FROM public.pedidos_link WHERE origem = 'site' AND criado_em > now() - interval '1 hour') >= 150;
$f$;
REVOKE EXECUTE ON FUNCTION public.pedidos_no_limite() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedir_link(p_url text)
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

  SELECT p.id INTO v_id
    FROM public.pedidos_link p
   WHERE p.url_alvo = v_url
     AND p.status = 'pronto'
     AND p.link IS NOT NULL
     AND p.criado_em > now() - interval '1 hour'
     AND (p.analise->>'completa') = 'true'
     AND (p.analise->>'final') = 'true'
     AND (p.analise->>'versaoExtensao') = (SELECT valor FROM public.sinc_config WHERE chave = 'versao_extensao')
   ORDER BY p.id DESC
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF public.pedidos_no_limite() THEN
    RAISE EXCEPTION 'fila cheia';
  END IF;

  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.pedir_link_loja(p_url text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text;
BEGIN
  v_url := split_part(coalesce(p_url, ''), '#', 1);
  IF length(v_url) > 2000
     OR v_url !~* '^https://(www|produto)\.mercadolivre\.com\.br/' OR v_url !~* '(/p/MLB[0-9]+|/up/MLBU[0-9]+|MLB-?[0-9]{6,})' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;
  SELECT id INTO v_id FROM public.pedidos_link
   WHERE vendedor = '(so link)' AND url_alvo = v_url AND criado_em > now() - interval '1 hour'
     AND status IN ('pendente', 'processando', 'pronto')
   ORDER BY id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF (SELECT count(*) FROM public.pedidos_link
       WHERE vendedor = '(so link)' AND criado_em > now() - interval '1 day') >= 300
     OR public.pedidos_no_limite() THEN
    RAISE EXCEPTION 'fila cheia';
  END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(so link)', v_url, 'pendente', 'site')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- Versoes que o site usa: devolvem numero E chave.
CREATE OR REPLACE FUNCTION public.pedir_comparacao(p_url text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_id bigint;
BEGIN
  v_id := public.pedir_link(p_url);
  RETURN (SELECT jsonb_build_object('id', id, 'chave', chave) FROM public.pedidos_link WHERE id = v_id);
END $f$;

CREATE OR REPLACE FUNCTION public.pedir_link_da_loja(p_url text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_id bigint;
BEGIN
  v_id := public.pedir_link_loja(p_url);
  RETURN (SELECT jsonb_build_object('id', id, 'chave', chave) FROM public.pedidos_link WHERE id = v_id);
END $f$;

CREATE OR REPLACE FUNCTION public.ver_pedido(p_id bigint, p_chave uuid)
 RETURNS TABLE(status text, link text, codigo text, erro text, analise jsonb)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT p.status, p.link, p.codigo, p.erro, p.analise
    FROM public.pedidos_link p
   WHERE p.id = p_id AND p.chave = p_chave AND p.criado_em > now() - interval '2 hours';
$f$;

GRANT EXECUTE ON FUNCTION public.pedir_comparacao(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_link_da_loja(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ver_pedido(bigint, uuid) TO anon, authenticated;

-- As versoes antigas (so numero) deixam de ser publicas. Revogadas no fim da
-- publicacao do site novo (migracao seguinte), para nao derrubar quem estiver
-- com a pagina aberta durante a troca.

-- Pedidos de cupom: no maximo 30 lojas pedidas em 10 minutos.
CREATE OR REPLACE FUNCTION public.pedir_loja(p_cupom_id bigint)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_loja text;
BEGIN
  SELECT link_loja INTO v_loja FROM public.cupons WHERE id = p_cupom_id;
  IF NOT FOUND THEN RETURN 'inexistente'; END IF;
  IF v_loja IS NOT NULL THEN RETURN v_loja; END IF;
  IF (SELECT count(*) FROM public.cupons WHERE loja_pedida_em > now() - interval '10 minutes') >= 30 THEN
    RETURN 'pausado';
  END IF;
  UPDATE public.cupons SET loja_pedida_em = now()
   WHERE id = p_cupom_id
     AND (loja_pedida_em IS NULL OR loja_pedida_em < now() - interval '2 minutes');
  RETURN 'pedido';
END $function$;

-- Depois da publicacao do site novo: as versoes antigas (so numero) deixam de
-- ser publicas. A bateria de testes usa pedir_link_novo (sem acesso publico).
REVOKE EXECUTE ON FUNCTION public.pedir_link(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pedir_link_loja(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consultar_pedido(bigint) FROM PUBLIC, anon, authenticated;
