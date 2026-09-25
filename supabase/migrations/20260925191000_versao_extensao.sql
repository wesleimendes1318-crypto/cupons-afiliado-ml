-- A extensao informa a propria versao junto com o sinal de vida: assim da para
-- conferir de longe se o notebook ja roda a versao nova antes da bateria.
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
  IF p_chave NOT IN ('freio_motivo','freio_ate','visto_em','etiqueta_ultima','versao_extensao') THEN
    RAISE EXCEPTION 'chave nao permitida: %', p_chave;
  END IF;
  INSERT INTO sinc_config(chave, valor) VALUES (p_chave, left(coalesce(p_valor,''), 400))
  ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor;
END $function$;
