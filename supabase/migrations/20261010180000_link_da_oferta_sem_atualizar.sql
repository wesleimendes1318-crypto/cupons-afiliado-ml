-- PREÇO = LINK SEM ATUALIZAR A EXTENSÃO (Weslei, 10/10: "Eu não consigo
-- atualizar a extensão agora"). A 1.165.0 gera o link do anúncio colado pela
-- canônica (ficha /p/MLB... sem o anúncio) e a trava de 20261010170000
-- descartava o link: o cliente ficava com o "gerar no clique".
--
-- Toda geração passa por reservar_geracao ANTES de chamar o gerador. Quando
-- a chave é a ficha e o pedido em andamento aponta um anúncio dela:
--   - link do anúncio já conhecido (geracoes ou reparo) -> 'existe' com ele
--     (sai na hora, sem chamar o gerador);
--   - senão -> 'ficha' (recusa). A 1.165.0 cai na 2ª tentativa, que gera
--     pelo endereço do anúncio (enderecoDoAnuncio, produto.../MLB-...).
-- Página de catálogo pura (sem anúncio) segue como sempre.
--
-- Também: a trava nunca troca um link bom por um da ficha (mantém o antigo;
-- ou usa o link do anúncio já conhecido), registra o anúncio na fila do reparo, e o reparo roda na 1.165.0 devagar
-- (1 por vez, só sem cliente nos últimos 15 min). Pedido recente que ganha o
-- link de volta entra na vitrine.

-- Link de afiliado já gerado pelo endereço do PRÓPRIO anúncio (registro do
-- gerador ou reparo). Nunca o da ficha.
create or replace function public.link_do_anuncio(p_item text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select gg.resultado from public.geracoes gg
      where gg.tipo = 'link' and gg.status = 'ok' and gg.resultado ~ '^https://meli\.la/[A-Za-z0-9]+$'
        and gg.chave !~* '/p/MLB[0-9]+' and public.anuncio_do_endereco(gg.chave) = p_item
        and not exists (select 1 from public.geracoes f
                         where f.tipo = 'link' and f.resultado = gg.resultado and f.chave ~* '/p/MLB[0-9]+')
      order by gg.atualizado_em desc limit 1),
    (select l.link_novo from public.links_a_refazer l
      where l.item = p_item and l.link_novo ~ '^https://meli\.la/[A-Za-z0-9]+$'))
$$;
revoke all on function public.link_do_anuncio(text) from public, anon, authenticated;

create or replace function public.reservar_geracao(p_token text, p_tipo text, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  g public.geracoes%ROWTYPE;
  v_pausa int; v_teto int; v_hoje int; v_inicio timestamptz;
  v_cat text; v_item text; v_link text;
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF p_tipo NOT IN ('link', 'etiqueta', 'link_vitrine') OR coalesce(btrim(p_chave), '') = '' THEN
    RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'pedido invalido');
  END IF;
  -- Ficha do catálogo com um anúncio definido no pedido em andamento (10/10).
  IF p_tipo = 'link' AND p_chave ~* '/p/MLB[0-9]+' AND public.anuncio_do_endereco(p_chave) IS NULL THEN
    v_cat := upper(substring(p_chave from '(?i)/p/(MLB[0-9]+)'));
    SELECT public.anuncio_do_endereco(pl.url_alvo) INTO v_item
      FROM public.pedidos_link pl
     WHERE pl.status = 'processando' AND pl.vendedor IS DISTINCT FROM '(so link)'
       AND (pl.url_alvo ~* ('/p/' || v_cat || '([^0-9]|$)')
            -- endereço do anúncio cuja canônica é a ficha
            OR pl.url_alvo !~* '/p/MLB[0-9]+')
       AND public.anuncio_do_endereco(pl.url_alvo) IS NOT NULL
     ORDER BY pl.processando_em DESC NULLS LAST
     LIMIT 1;
    IF v_item IS NOT NULL THEN
      v_link := public.link_do_anuncio(v_item);
      IF v_link IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'existe', 'resultado', v_link,
          'meta', jsonb_build_object('url', 'https://produto.mercadolivre.com.br/' || replace(v_item, 'MLB', 'MLB-')));
      END IF;
      RETURN jsonb_build_object('status', 'ficha',
        'motivo', 'endereco da ficha do catalogo: o link sai do endereco do anuncio ' || v_item);
    END IF;
  END IF;
  SELECT * INTO g FROM public.geracoes WHERE tipo = p_tipo AND chave = p_chave FOR UPDATE;
  IF FOUND AND g.status = 'ok' THEN
    RETURN jsonb_build_object('status', 'existe', 'resultado', g.resultado, 'meta', g.meta);
  END IF;
  -- Anuncio recusado pelo programa de afiliados (erro 111) ha menos de 24 h:
  -- nao chama o gerador de novo (a resposta seria a mesma).
  IF FOUND AND g.status = 'erro' AND g.erro ILIKE '%not allowed%'
     AND g.atualizado_em > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('status', 'recusado',
      'motivo', 'URL not allowed in affiliates program (erro 111, recusado nas ultimas 24 h)');
  END IF;
  IF FOUND AND g.status = 'pendente' THEN
    IF p_tipo = 'etiqueta' THEN
      RETURN jsonb_build_object('status', 'bloqueado',
        'motivo', 'tentativa anterior sem resposta: conferir em Administrar etiquetas');
    END IF;
    IF g.atualizado_em > now() - interval '2 minutes' THEN
      RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'geracao em andamento');
    END IF;
  END IF;
  SELECT valor INTO v_pausa FROM public.limites WHERE chave = 'pausa_geral';
  IF coalesce(v_pausa, 0) = 1 THEN
    RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'pausa geral ligada');
  END IF;
  SELECT valor INTO v_teto FROM public.limites WHERE chave = 'gerar_' || p_tipo || '_por_dia';
  v_inicio := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  SELECT count(*) INTO v_hoje FROM public.geracoes
   WHERE tipo = p_tipo AND criado_em >= v_inicio AND status IN ('ok', 'pendente');
  IF v_teto IS NOT NULL AND v_hoje >= v_teto THEN
    RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'teto do dia atingido (' || v_teto || ')');
  END IF;
  INSERT INTO public.geracoes (tipo, chave, status)
  VALUES (p_tipo, p_chave, 'pendente')
  ON CONFLICT (tipo, chave) DO UPDATE
     SET status = 'pendente', erro = NULL, tentativas = public.geracoes.tentativas + 1,
         atualizado_em = now();
  RETURN jsonb_build_object('status', 'reservado');
END $function$;

-- Trava: link bom nunca é trocado pelo da ficha; o anúncio entra no reparo.
create or replace function public.pedido_link_da_oferta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
begin
  if new.link is not null
     and (tg_op = 'INSERT' or new.link is distinct from old.link)
     and public.link_da_ficha(new.link, new.url_alvo) then
    new.analise := case when jsonb_typeof(new.analise) = 'object' then new.analise else '{}'::jsonb end
                   || jsonb_build_object('linkDaFichaDescartado', true);
    v_item := public.anuncio_do_endereco(new.url_alvo);
    if tg_op = 'UPDATE' and old.link is not null and not public.link_da_ficha(old.link, new.url_alvo) then
      new.link := old.link;
    elsif public.link_do_anuncio(v_item) is not null then
      new.link := public.link_do_anuncio(v_item);
    else
      new.link := null;
      if v_item ~ '^MLB[0-9]{6,}$' and new.vendedor is distinct from '(so link)' then
        insert into public.links_a_refazer (item, url_oferta, prioridade)
        values (v_item, 'https://produto.mercadolivre.com.br/' || replace(v_item, 'MLB', 'MLB-'),
                case when coalesce(new.origem, '') = 'teste' then 1 else 4 end)
        on conflict (item) do update
          set prioridade = greatest(public.links_a_refazer.prioridade, excluded.prioridade),
              feito_em = null, tentativas = least(public.links_a_refazer.tentativas, 2);
      end if;
    end if;
  end if;
  return new;
end
$$;

-- Reparo: gerador rápido (extensão 1.165.5+ ou os últimos reparos em < 20 s;
-- medido em 10/10 15:50: 2 s na 1.165.0) até 3 por vez, cliente nos últimos
-- 10 min segura; gerador lento (30-45 s por link) 1 por vez e só sem cliente
-- nos últimos 15 min.
create or replace function public.refazer_links_fila(p_max integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int[];
  v_rapida boolean;
  v_lento numeric;
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
  -- Gerador rápido: extensão 1.165.5+ ou os últimos reparos saíram em < 20 s.
  select percentile_cont(0.5) within group (order by s) into v_lento
    from (select extract(epoch from p.atendido_em - p.criado_em) s
            from public.links_a_refazer l join public.pedidos_link p on p.id = l.pedido_id
           where p.status = 'pronto' and p.atendido_em is not null
           order by p.atendido_em desc limit 3) t;
  v_rapida := (v_ver is not null and v_ver >= array[1, 165, 5]) or coalesce(v_lento, 999) < 20;
  v_max := case when v_rapida then p_max else 1 end;
  if exists (select 1 from public.pedidos_link
              where coalesce(origem, '') <> 'teste'
                and (status in ('pendente', 'processando')
                     or criado_em > now() - case when v_rapida then interval '10 minutes' else interval '15 minutes' end)) then
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

-- Link novo: volta a cada lugar; pedido recente sem vitrine mais nova entra
-- na vitrine (ela só registra pedido com link).
create or replace function public.link_refeito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
  p public.pedidos_link%rowtype;
begin
  select item into v_item from public.links_a_refazer where pedido_id = new.id and feito_em is null;
  if v_item is null then return new; end if;
  if new.status = 'pronto' and new.link ~ '^https://meli\.la/[A-Za-z0-9]+$' then
    if exists (select 1 from public.geracoes g
                where g.tipo = 'link' and g.resultado = new.link and g.chave ~* '/p/MLB[0-9]+') then
      update public.links_a_refazer set erro = 'mesmo link da ficha' where item = v_item;
      return new;
    end if;
    update public.links_a_refazer set link_novo = new.link, feito_em = now(), erro = null where item = v_item;
    for p in
      update public.pedidos_link
         set link = new.link
       where vendedor is distinct from '(so link)' and link is null and status = 'pronto'
         -- sem depender da marca: a extensão regrava a análise depois (1222)
         and public.anuncio_do_endereco(url_alvo) = v_item
      returning *
    loop
      if p.status = 'pronto' and coalesce(p.atendido_em, p.criado_em) > now() - interval '3 days'
         and not exists (select 1 from public.produtos_vistos v
                          where v.url_produto = p.url_alvo
                            and v.visto_em > coalesce(p.atendido_em, p.criado_em)) then
        begin
          perform public.registrar_produto_visto(p);
        exception when others then
          null;
        end;
      end if;
    end loop;
    update public.produtos_vistos
       set link = new.link
     where link is null
       and (chave = v_item or public.anuncio_do_endereco(url_produto) = v_item);
    update public.monitor_precos
       set link = new.link
     where link is null and public.anuncio_do_endereco(url) = v_item;
  elsif new.status = 'falhou' or (new.status = 'pronto' and new.link is null) then
    update public.links_a_refazer
       set erro = left(coalesce(new.erro, new.status), 200)
     where item = v_item;
  end if;
  return new;
end
$$;

-- Pedidos sem link dos últimos 2 dias (o descarte da trava ou geração que
-- falhou; a marca some quando a extensão regrava a análise): cliente 4,
-- interno 1.
insert into public.links_a_refazer (item, url_oferta, prioridade)
select public.anuncio_do_endereco(p.url_alvo),
       'https://produto.mercadolivre.com.br/' || replace(public.anuncio_do_endereco(p.url_alvo), 'MLB', 'MLB-'),
       max(case when coalesce(p.origem, '') = 'teste' then 1 else 4 end)
  from public.pedidos_link p
 where p.link is null and p.status = 'pronto' and p.vendedor is distinct from '(so link)'
   and p.criado_em > now() - interval '2 days'
   and public.anuncio_do_endereco(p.url_alvo) ~ '^MLB[0-9]{6,}$'
 group by 1
on conflict (item) do update
  set prioridade = greatest(public.links_a_refazer.prioridade, excluded.prioridade);
