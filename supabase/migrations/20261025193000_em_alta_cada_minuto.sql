-- 25/10 (Weslei: "quero pronto hoje"): agente em_alta a cada minuto para
-- chegar a 240 por categoria; a fila de comparação fica em 1 a cada 15 min
-- (src/lib/em-alta-catalogo.ts).
SELECT cron.alter_job(jobid, schedule => '* * * * *')
  FROM cron.job WHERE jobname = 'operacao-em-alta';
