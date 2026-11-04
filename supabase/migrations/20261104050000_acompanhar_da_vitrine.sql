-- ACOMPANHAR PREÇO NOS CARTÕES (Weslei, 04/11): vitrine, campanhas,
-- brinquedos e mais vendidos ganham "Acompanhar". O cartão manda só a
-- chave; título, foto, preço e LINK saem do banco (produtos_vistos ou
-- em_alta_catalogo), nunca do navegador (regra nº 1: link só meli.la do
-- Weslei; sem ele, Meus preços mostra "Comparar preço"). Só aditivo.
create or replace function public.acompanhar_da_vitrine(
  p_chave text, p_navegador uuid, p_alvo numeric default null, p_avisar_email boolean default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_url text; v_titulo text; v_imagem text; v_loja text; v_link text; v_preco numeric;
  v_chave text;
  v_uid uuid := auth.uid();
begin
  if coalesce((select valor from sinc_config where chave = 'monitor_ativo'), 'false') <> 'true' then
    raise exception 'acompanhamento desligado';
  end if;
  if p_navegador is null then raise exception 'navegador ausente'; end if;
  select pv.url_produto, pv.titulo, pv.imagem, pv.loja, pv.link, pv.preco
    into v_url, v_titulo, v_imagem, v_loja, v_link, v_preco
    from produtos_vistos pv where pv.chave = p_chave;
  if v_url is null then
    select e.url, e.nome, e.imagem, null, null, e.preco
      into v_url, v_titulo, v_imagem, v_loja, v_link, v_preco
      from em_alta_catalogo e where e.produto = p_chave
     order by e.atualizado_em desc limit 1;
  end if;
  if v_url is null or v_titulo is null then raise exception 'comparacao nao encontrada'; end if;
  if v_link is not null and v_link !~ '^https://meli\.la/[A-Za-z0-9]+$' then v_link := null; end if;
  v_chave := chave_do_produto(v_url);
  select id into v_id from monitor_precos where chave = v_chave;
  if v_id is null then
    if (select count(*) from monitor_precos where ativo) >= 200 then
      raise exception 'limite do teste atingido';
    end if;
    insert into monitor_precos (chave, url, titulo, imagem, loja, link, preco_inicial, preco_atual,
                                menor_preco, menor_em, maior_preco, ultima_leitura, proxima_leitura)
    values (v_chave, v_url, v_titulo, v_imagem, v_loja, v_link, v_preco, v_preco,
            v_preco, now(), v_preco, now(), now() + interval '30 minutes')
    returning id into v_id;
  else
    update monitor_precos set ativo = true, link = coalesce(link, v_link) where id = v_id;
  end if;
  if v_uid is not null and exists (select 1 from monitor_seguidores where monitor_id = v_id and usuario_id = v_uid) then
    update monitor_seguidores set preco_alvo = p_alvo, avisar_email = coalesce(p_avisar_email, avisar_email)
     where monitor_id = v_id and usuario_id = v_uid;
    return v_id;
  end if;
  if (select count(*) from monitor_seguidores s where seguidor_visivel(s, p_navegador)) >= 20 then
    raise exception 'limite de 20 produtos acompanhados';
  end if;
  insert into monitor_seguidores (monitor_id, navegador, preco_alvo, preco_ao_seguir, usuario_id, avisar_email)
  values (v_id, p_navegador, p_alvo, (select preco_atual from monitor_precos where id = v_id), v_uid,
          v_uid is not null and coalesce(p_avisar_email, false))
  on conflict (monitor_id, navegador) do update
    set preco_alvo = excluded.preco_alvo,
        usuario_id = coalesce(monitor_seguidores.usuario_id, excluded.usuario_id),
        avisar_email = case when excluded.usuario_id is null then monitor_seguidores.avisar_email
                            else coalesce(p_avisar_email, monitor_seguidores.avisar_email) end
    where monitor_seguidores.usuario_id is null or monitor_seguidores.usuario_id = excluded.usuario_id;
  return v_id;
end $$;

grant execute on function public.acompanhar_da_vitrine(text, uuid, numeric, boolean) to anon, authenticated;
