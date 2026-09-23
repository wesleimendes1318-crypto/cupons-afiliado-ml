-- Extensao 1.39.0: etiquetas voltam a funcionar e o pedido do site traz a vitrine.
-- Aplicado em producao em 23/09/2026. Idempotente (CREATE OR REPLACE).

-- 1. A extensao passa a registrar o resultado de cada rodada de etiquetas
--    ('etiqueta_ultima'), para dar para ver de fora por que um codigo nao saiu.
CREATE OR REPLACE FUNCTION public.anotar_estado_robo(p_token text, p_chave text, p_valor text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ok boolean;
BEGIN
  SELECT valor = p_token INTO v_ok FROM sinc_config WHERE chave='token';
  IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'token invalido'; END IF;
  IF p_chave NOT IN ('freio_motivo','freio_ate','visto_em','etiqueta_ultima') THEN
    RAISE EXCEPTION 'chave nao permitida: %', p_chave;
  END IF;
  INSERT INTO sinc_config(chave, valor) VALUES (p_chave, left(coalesce(p_valor,''), 400))
  ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor;
END $function$;

-- 2. Endereco da vitrine de um cupom (lista de produtos que ele cobre), lido
--    pela extensao no hub de afiliados quando alguem pede a etiqueta no site.
--    So preenche quando o cupom ainda nao tem: nunca troca endereco conferido.
CREATE OR REPLACE FUNCTION public.salvar_origem_cupom(p_token text, p_id bigint, p_url text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://lista\.mercadolivre\.com\.br/[^\s]{3,500}$' THEN
    RETURN false;
  END IF;
  UPDATE public.cupons
     SET link_origem = p_url, updated_at = now()
   WHERE id = p_id AND link_origem IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $function$;

GRANT EXECUTE ON FUNCTION public.salvar_origem_cupom(text, bigint, text) TO anon, authenticated, service_role;

-- 3. Pagina da LOJA sob demanda (pedido do Weslei, 23/09).
--    O botao do cartao tem que abrir a pagina do vendedor com todos os produtos,
--    nunca um produto nem a lista da campanha. Quando o cupom ainda nao tem
--    link_loja, o site pede; a extensao abre um anuncio do vendedor, le o
--    endereco da loja, confere que tem produto e grava em link_loja (vale para
--    todos os cupons da mesma loja, entao so acontece uma vez).
ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS loja_pedida_em timestamptz;

CREATE OR REPLACE FUNCTION public.pedir_loja(p_cupom_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_loja text;
BEGIN
  SELECT link_loja INTO v_loja FROM public.cupons WHERE id = p_cupom_id;
  IF NOT FOUND THEN RETURN 'inexistente'; END IF;
  IF v_loja IS NOT NULL THEN RETURN v_loja; END IF;
  UPDATE public.cupons SET loja_pedida_em = now()
   WHERE id = p_cupom_id
     AND (loja_pedida_em IS NULL OR loja_pedida_em < now() - interval '2 minutes');
  RETURN 'pedido';
END $function$;
GRANT EXECUTE ON FUNCTION public.pedir_loja(bigint) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lojas_pedidas(p_token text)
 RETURNS TABLE(vendedor text, seller_id text, origem text, cupom_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  -- Lojas pedidas na ultima hora e ainda sem pagina; o numero do vendedor e o
  -- link de campanha vem de QUALQUER cupom da mesma loja, nao so do pedido.
  RETURN QUERY
  WITH ped AS (
    SELECT c.vendedor AS v, max(c.loja_pedida_em) AS q, min(c.id) AS cid
      FROM public.cupons c
     WHERE c.loja_pedida_em > now() - interval '1 hour'
       AND c.link_loja IS NULL
       AND (c.vitrine_resolvida_em IS NULL OR c.vitrine_resolvida_em < c.loja_pedida_em)
     GROUP BY c.vendedor
     ORDER BY 2
     LIMIT 3
  )
  SELECT p.v,
         max(substring(c.link_origem from '(?i)_CustId_([0-9]{4,})')),
         max(c.link_origem) FILTER (WHERE c.link_origem ~* '^https://lista\.mercadolivre\.com\.br/'),
         p.cid
    FROM ped p JOIN public.cupons c ON c.vendedor = p.v
   GROUP BY p.v, p.q, p.cid
   ORDER BY p.q;
END $function$;
GRANT EXECUTE ON FUNCTION public.lojas_pedidas(text) TO anon, authenticated, service_role;

-- A fila de fundo passa a devolver tambem um link de campanha da loja: e por
-- ele que a extensao chega a um anuncio do vendedor quando nao ha _CustId_.
DROP FUNCTION IF EXISTS public.lojas_para_resolver(text, integer);
CREATE FUNCTION public.lojas_para_resolver(p_token text, p_limite integer DEFAULT 20)
 RETURNS TABLE(vendedor text, seller_id text, cupons integer, origem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ok boolean;
BEGIN
  SELECT valor = p_token INTO v_ok FROM sinc_config WHERE chave = 'token';
  IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'token invalido'; END IF;

  RETURN QUERY
  SELECT c.vendedor,
         max(substring(c.link_origem from '(?i)_CustId_([0-9]{4,})')) AS seller_id,
         count(*)::integer AS cupons,
         max(c.link_origem) FILTER (WHERE c.link_origem ~* '^https://lista\.mercadolivre\.com\.br/') AS origem
    FROM cupons c
   WHERE c.qualidade = 'bom'
     AND c.vitrine_ok IS NOT FALSE
     AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
     AND c.link_loja IS NULL
     AND (c.vitrine_resolvida_em IS NULL OR c.vitrine_resolvida_em < now() - interval '30 days')
   GROUP BY c.vendedor
   ORDER BY count(*) DESC, c.vendedor
   LIMIT greatest(1, least(coalesce(p_limite, 20), 60));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.lojas_para_resolver(text, integer) TO anon, authenticated, service_role;
