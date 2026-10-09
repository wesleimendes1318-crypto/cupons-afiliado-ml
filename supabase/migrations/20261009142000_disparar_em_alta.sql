-- Libera a tarefa em_alta (Mais vendidos por categoria, 09/10) na função
-- que dispara as rotinas; os demais caminhos continuam iguais.
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
     AND p_caminho !~ '^operacao\?tarefa=em_alta(&categoria=(eletronicos|celulares|informatica|casa|moda|beleza|automotivo|brinquedos))?$'
     AND p_caminho !~ '^operacao\?tarefa=arte&tema=(criancas|natal|black_friday|tecnologia|casa|beleza|neutro)(&forcar=1)?$' THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
END; $function$;
REVOKE ALL ON FUNCTION public.disparar_operacao(text) FROM PUBLIC, anon, authenticated;
