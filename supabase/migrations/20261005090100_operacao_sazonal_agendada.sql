-- AUTONOMIA SAZONAL (Weslei, 05/10: "essas estrategias devem fazer parte da
-- autonomia do agente"): busca sazonal 2x por dia, antes do preparo (07:41 e
-- 17:41) e do garimpo (08:47 e 18:47) de Brasilia, para o canal e a vitrine
-- terem achados conferidos ha menos de 3 h. 07:05 e 17:05 em Brasilia = 10:05
-- e 20:05 UTC. Ate 15 produtos por vez (a extensao compara um por vez, com o
-- freio de captcha de sempre). Pausa: sinc_config.operacao_pausada = 'true'.
SELECT cron.schedule('operacao-sazonal', '5 10,20 * * *', $$SELECT public.disparar_operacao('operacao?tarefa=sazonal&max=15');$$);
