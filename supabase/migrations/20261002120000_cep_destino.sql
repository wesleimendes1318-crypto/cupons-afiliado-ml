-- CEP AUTOMATICO (Weslei, 02/10): o pedido guarda o CEP de destino do
-- cliente, para o frete ser simulado para ele (pela API oficial, no
-- servidor; a extensao nunca muda endereco nem CEP da conta de afiliado).
-- So acrescenta: coluna nova e uma versao de pedir_comparacao com p_cep. A
-- versao de 2 argumentos continua igual (site e extensao antigos seguem).

ALTER TABLE public.pedidos_link ADD COLUMN IF NOT EXISTS cep_destino varchar(9);

CREATE OR REPLACE FUNCTION public.pedir_comparacao(p_url text, p_nova boolean, p_cep text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_cep text; v_atual text; v_status text;
BEGIN
  v_cep := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
  v_cep := CASE WHEN length(v_cep) = 8 THEN substr(v_cep, 1, 5) || '-' || substr(v_cep, 6, 3) END;
  v_id := public.pedir_link_base(p_url, NOT coalesce(p_nova, false));
  SELECT cep_destino, status INTO v_atual, v_status FROM public.pedidos_link WHERE id = v_id;
  -- Comparacao pronta feita para OUTRO CEP: o frete muda, compara de novo.
  IF v_cep IS NOT NULL AND v_atual IS NOT NULL AND v_atual <> v_cep THEN
    v_id := public.pedir_link_base(p_url, false);
    SELECT cep_destino, status INTO v_atual, v_status FROM public.pedidos_link WHERE id = v_id;
  END IF;
  -- So grava o CEP em pedido que ainda vai ser comparado (nunca carimba um
  -- resultado pronto que foi feito sem ele).
  IF v_cep IS NOT NULL AND v_atual IS NULL AND v_status IN ('pendente', 'processando') THEN
    UPDATE public.pedidos_link SET cep_destino = v_cep WHERE id = v_id;
  END IF;
  RETURN (SELECT jsonb_build_object('id', id, 'chave', chave) FROM public.pedidos_link WHERE id = v_id);
END $function$;

REVOKE ALL ON FUNCTION public.pedir_comparacao(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedir_comparacao(text, boolean, text) TO anon, authenticated, service_role;
