-- Tempo REAL das consultas, para o site mostrar a contagem regressiva.
-- Nada de numero inventado: e o percentil 75 do tempo entre o pedido e a
-- resposta das ultimas 20 consultas concluidas nas ultimas 48 horas. Sem
-- medicao suficiente devolve null e o site nao mostra previsao.
CREATE OR REPLACE FUNCTION public.tempo_estimado()
RETURNS TABLE(segundos integer, amostras integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ult AS (
    SELECT extract(epoch FROM atendido_em - criado_em) AS s
      FROM public.pedidos_link
     WHERE status = 'pronto' AND atendido_em IS NOT NULL
       AND criado_em > now() - interval '48 hours'
       AND atendido_em > criado_em
     ORDER BY id DESC
     LIMIT 20
  )
  SELECT CASE WHEN count(*) >= 3 THEN ceil(percentile_cont(0.75) WITHIN GROUP (ORDER BY s))::int END,
         count(*)::int
    FROM ult;
$$;
GRANT EXECUTE ON FUNCTION public.tempo_estimado() TO anon, authenticated;
