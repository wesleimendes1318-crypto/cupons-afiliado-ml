-- 26/10: as 10 categorias passaram de 200 mais vendidos à mostra (moda
-- 204, a menor). O agente volta a rodar a cada 10 min (era a cada minuto
-- só para encher as categorias).
SELECT cron.alter_job(jobid, schedule => '3-59/10 * * * *')
FROM cron.job
WHERE jobname = 'operacao-em-alta';
