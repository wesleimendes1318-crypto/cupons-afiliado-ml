-- 24/11/2026 audit: consultar_pedido(p_id) was callable by anon with sequential
-- ids and returned analise.cepDestino (113 customer CEPs). The site and the
-- extension use ver_pedido(p_id, p_chave) instead; nothing calls this one.
-- Additive: only the grant changes, signature and body stay.
revoke execute on function public.consultar_pedido(bigint) from public, anon, authenticated;
grant execute on function public.consultar_pedido(bigint) to service_role;
