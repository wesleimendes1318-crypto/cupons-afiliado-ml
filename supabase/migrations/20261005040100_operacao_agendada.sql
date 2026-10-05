-- ROTINA AGENDADA (Weslei, 05/10: "construa uma rotina persistente ...
-- pesquisa as 08h e revisao as 18h"). O proprio banco chama as rotas do site
-- com o segredo gerado em sinc_config.cron_segredo (nunca sai do servidor).
-- Horarios em UTC (Brasilia = UTC-3):
--   07:33 coleta de mercado e medicao do canal  (/api/public/operacao?tarefa=mercado)
--   07:41 e 17:41 preparo: compara de novo as melhores economias
--   08:47 e 18:47 garimpo: publica no canal so oferta conferida nas ultimas 3 h
-- Pausa: UPDATE sinc_config SET valor = 'true' WHERE chave = 'operacao_pausada'.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.disparar_operacao(p_caminho text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'cron-garimpo', 'cron-garimpo?simular=1') THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(
    url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.disparar_operacao(text) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobname) FROM cron.job
 WHERE jobname IN ('operacao-mercado', 'operacao-preparar', 'operacao-garimpo');
SELECT cron.schedule('operacao-mercado', '33 10 * * *', $$SELECT public.disparar_operacao('operacao?tarefa=mercado');$$);
SELECT cron.schedule('operacao-preparar', '41 10,20 * * *', $$SELECT public.disparar_operacao('operacao?tarefa=preparar');$$);
SELECT cron.schedule('operacao-garimpo', '47 11,21 * * *', $$SELECT public.disparar_operacao('cron-garimpo');$$);
