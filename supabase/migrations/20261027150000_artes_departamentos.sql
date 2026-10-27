-- 27/10: artes dos departamentos sem arte no acervo (Weslei: "deixe a
-- vitrine e as artes bonitas, com qualidade"). disparar_operacao passa a
-- aceitar operacao?tarefa=arte&departamento=<slug>[&forcar=1]; o resto da
-- lista é o mesmo de 20261027030000.
CREATE OR REPLACE FUNCTION public.disparar_operacao(p_caminho text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'operacao?tarefa=alertas',
                       'operacao?tarefa=campanhas', 'cron-garimpo', 'cron-garimpo?simular=1')
     AND p_caminho !~ '^operacao\?tarefa=remover&publicacao=[0-9]{1,9}$'
     AND p_caminho !~ '^operacao\?tarefa=sazonal(&temporada=(criancas|black_friday|natal))?(&max=[0-9]{1,2})?$'
     AND p_caminho !~ '^operacao\?tarefa=brinquedos(&alvo=(em_alta|bebe|3a5|6a8|9a12|doacao))?$'
     AND p_caminho !~ '^operacao\?tarefa=em_alta(&categoria=(eletronicos|celulares|informatica|casa|eletrodomesticos|ferramentas|moda|beleza|automotivo|brinquedos))?$'
     AND p_caminho !~ '^operacao\?tarefa=arte&tema=(criancas|natal|black_friday|tecnologia|casa|beleza|neutro)(&forcar=1)?$'
     AND p_caminho !~ '^operacao\?tarefa=arte&departamento=(moveis|saude|pet|esportes|bebes|mercado|papelaria)(&forcar=1)?$'
     AND p_caminho !~ '^operacao\?tarefa=classificar(&limite=[0-9]{1,4})?$' THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
END; $function$;
