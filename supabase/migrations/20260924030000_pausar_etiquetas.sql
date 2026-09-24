-- 24/09/2026: o Mercado Livre respondeu 403 (pagina de erro) a 6 tentativas
-- seguidas de criar etiqueta, e o menu de cupons sumiu do portal do afiliado.
-- Etiquetas pausadas: teto do dia = 0 (o cadastro bloqueia a extensao) e o
-- site deixa de registrar pedido de codigo. Para voltar: valor > 0.
UPDATE public.limites SET valor = 0 WHERE chave = 'gerar_etiqueta_por_dia';

CREATE OR REPLACE FUNCTION public.pedir_etiqueta(p_cupom_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_codigo text; v_ok boolean; v_teto int;
BEGIN
  SELECT c.codigo_cupom,
         (c.qualidade = 'bom'
          AND (c.vence IS NULL OR c.vence > current_date + 2)
          AND c.codigo_tentativas < 2)
    INTO v_codigo, v_ok FROM public.cupons c WHERE c.id = p_cupom_id;
  IF NOT FOUND THEN RETURN 'inexistente'; END IF;
  IF v_codigo IS NOT NULL THEN RETURN v_codigo; END IF;
  SELECT valor INTO v_teto FROM public.limites WHERE chave = 'gerar_etiqueta_por_dia';
  IF v_teto IS NOT NULL AND v_teto <= 0 THEN RETURN 'pausado'; END IF;
  IF NOT v_ok THEN RETURN 'nao_elegivel'; END IF;
  UPDATE public.cupons SET codigo_pedido_em = now()
   WHERE id = p_cupom_id AND codigo_pedido_em IS NULL;
  RETURN 'pedido';
END $function$;

UPDATE public.cupons SET codigo_pedido_em = NULL WHERE codigo_pedido_em IS NOT NULL AND codigo_cupom IS NULL;
