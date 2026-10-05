-- Remocao de post do canal (05/10): registro de quando e por que, e o
-- caminho permitido na funcao das chamadas (so sob pedido, nao agendado).
ALTER TABLE public.canal_publicacoes ADD COLUMN IF NOT EXISTS removida_em timestamptz;
ALTER TABLE public.canal_publicacoes ADD COLUMN IF NOT EXISTS removida_motivo text;

CREATE OR REPLACE FUNCTION public.disparar_operacao(p_caminho text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'cron-garimpo', 'cron-garimpo?simular=1')
     AND p_caminho !~ '^operacao\?tarefa=remover&publicacao=[0-9]{1,9}$' THEN
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
