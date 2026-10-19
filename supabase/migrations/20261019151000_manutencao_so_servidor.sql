-- Agente Segurança (19/10): funções de manutenção que GRAVAM estavam
-- abertas para quem visita o site (anon), sem a senha da extensão (regra de
-- 27/09). Nem o site nem a extensão as chamam; limpar_vencidos roda pelo
-- pg_cron como postgres. expirar_pedidos marcava como falhou qualquer pedido
-- pendente há mais de 2 h, a pedido de qualquer visitante.
revoke execute on function public.expirar_pedidos() from public, anon, authenticated;
revoke execute on function public.limpar_vencidos() from public, anon, authenticated;
grant execute on function public.expirar_pedidos() to service_role;
grant execute on function public.limpar_vencidos() to service_role;
