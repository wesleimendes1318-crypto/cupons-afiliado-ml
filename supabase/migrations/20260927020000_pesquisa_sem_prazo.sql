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
