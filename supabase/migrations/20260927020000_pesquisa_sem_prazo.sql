-- Toda pesquisa fica registrada e visivel, sem prazo (Weslei, 27/09). O site
-- mostra ha quanto tempo foi comparado e pede para atualizar quando passa de
-- 1 hora. So leitura.
DROP FUNCTION IF EXISTS public.consultar_pedido(bigint);
CREATE FUNCTION public.consultar_pedido(p_id bigint)
 RETURNS TABLE(status text, link text, codigo text, erro text, analise jsonb, comparado_em timestamptz)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT p.status, p.link, p.codigo, p.erro, p.analise, coalesce(p.atendido_em, p.criado_em)
    FROM public.pedidos_link p WHERE p.id = p_id;
$function$;
GRANT EXECUTE ON FUNCTION public.consultar_pedido(bigint) TO anon, authenticated;
DROP FUNCTION IF EXISTS public.ver_pedido(bigint, uuid);
CREATE FUNCTION public.ver_pedido(p_id bigint, p_chave uuid)
 RETURNS TABLE(status text, link text, codigo text, erro text, analise jsonb, comparado_em timestamptz)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT p.status, p.link, p.codigo, p.erro, p.analise, coalesce(p.atendido_em, p.criado_em)
    FROM public.pedidos_link p WHERE p.id = p_id AND p.chave = p_chave;
$f$;
GRANT EXECUTE ON FUNCTION public.ver_pedido(bigint, uuid) TO anon, authenticated;

-- "Atualizar comparacao" sempre na tela (Weslei, 27/09): pedir_comparacao com
-- p_nova = true compara de novo mesmo com resultado recente (sem duplicar o
-- mesmo link que ja esta na fila). Mesmo limite de pedidos.
CREATE OR REPLACE FUNCTION public.pedir_link_base(p_url text, p_reusar boolean)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  ELSE
    SELECT p.id INTO v_id FROM public.pedidos_link p
     WHERE p.url_alvo = v_url AND p.status IN ('pendente', 'processando')
       AND p.criado_em > now() - interval '5 minutes'
     ORDER BY p.id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  IF public.pedidos_no_limite() THEN RAISE EXCEPTION 'fila cheia'; END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site') RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.pedir_link_base(text, boolean) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.pedir_link(p_url text)
 RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT public.pedir_link_base(p_url, true);
$f$;
DROP FUNCTION IF EXISTS public.pedir_comparacao(text);
CREATE FUNCTION public.pedir_comparacao(p_url text, p_nova boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_id bigint;
BEGIN
  v_id := public.pedir_link_base(p_url, NOT coalesce(p_nova, false));
  RETURN (SELECT jsonb_build_object('id', id, 'chave', chave) FROM public.pedidos_link WHERE id = v_id);
END $f$;
GRANT EXECUTE ON FUNCTION public.pedir_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_comparacao(text, boolean) TO anon, authenticated;
