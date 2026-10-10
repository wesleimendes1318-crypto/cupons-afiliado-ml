-- Reparo do link no ritmo do gerador (Pesquisa, 10/10 19:20). Na 1.165.0 o
-- 1º link de cada lote sai em 1-2 s e os seguintes em ~50 s (a aba do gerador
-- dorme; medido 18:20-19:20): um cliente que chegasse esperava. Sem a 1.165.5:
-- 1 por vez a cada 5 min (sempre o rápido). Com a 1.165.5+: até 3. A mediana
-- dos últimos reparos enganava (o 1º de cada lote é sempre rápido) e saiu.
create or replace function public.refazer_links_fila(p_max integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int[];
  v_rapida boolean;
  v_max int;
  v_abertos int;
  v_n int := 0;
  v_id bigint;
  r record;
begin
  begin
    v_ver := string_to_array((select valor from public.sinc_config where chave = 'versao_extensao'), '.')::int[];
  exception when others then
    v_ver := null;
  end;
  v_rapida := v_ver is not null and v_ver >= array[1, 165, 5];
  v_max := case when v_rapida then p_max else 1 end;
  if exists (select 1 from public.pedidos_link
              where coalesce(origem, '') <> 'teste'
                and (status in ('pendente', 'processando') or criado_em > now() - interval '10 minutes')) then
    return 0;
  end if;
  select count(*) into v_abertos
    from public.links_a_refazer l join public.pedidos_link p on p.id = l.pedido_id
   where l.feito_em is null and p.status in ('pendente', 'processando');
  for r in
    select l.* from public.links_a_refazer l
      left join public.pedidos_link p on p.id = l.pedido_id
     where l.feito_em is null and l.tentativas < 3
       and (l.pedido_id is null
            or (l.enfileirado_em < now() - interval '30 minutes'
                and coalesce(p.status, 'falhou') not in ('pendente', 'processando')))
     order by l.prioridade desc, l.criado_em
     limit greatest(0, v_max - v_abertos)
  loop
    insert into public.pedidos_link (vendedor, url_alvo, status, origem)
    values ('(so link)', r.url_oferta, 'pendente', 'teste')
    returning id into v_id;
    update public.links_a_refazer
       set pedido_id = v_id, enfileirado_em = now(), tentativas = tentativas + 1
     where item = r.item;
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;
revoke all on function public.refazer_links_fila(integer) from public, anon, authenticated;

select cron.schedule('links-refazer', '*/5 * * * *', $$select public.refazer_links_fila();$$);
