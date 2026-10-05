-- Agente de brinquedos (05/10): 09:17, 12:17, 15:17, 18:17 e 21:17 (Brasília).
select cron.schedule('operacao-brinquedos', '17 12,15,18,21,0 * * *',
  $$SELECT public.disparar_operacao('operacao?tarefa=brinquedos');$$);
