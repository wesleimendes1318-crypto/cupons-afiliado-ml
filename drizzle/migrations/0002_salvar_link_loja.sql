create or replace function public.salvar_link_loja(p_cupom_id bigint, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_link !~ '^https://(meli\.la|[a-z0-9.-]*mercadolivre\.com\.br)/' then
    raise exception 'link invalido';
  end if;
  update public.cupons
     set link_afiliado = p_link
   where id = p_cupom_id
     and (link_afiliado is null or btrim(link_afiliado) = '');
end;
$$;

grant execute on function public.salvar_link_loja(bigint, text) to anon, authenticated;