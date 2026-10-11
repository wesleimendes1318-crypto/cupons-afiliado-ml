-- GARIMPO NO PLAYER DE ORIGEM (Weslei, 11/10, prompt mestre): link da Amazon
-- garimpa na Amazon, link da Shopee na Shopee; link de loja sem afiliação
-- (Magalu, KaBuM!...) garimpa no campeão do segmento (Amazon ou Shopee; o
-- Mercado Livre é a busca do catálogo, no servidor). Os outros players
-- ficam sob demanda (um toque).
--
-- O site pede (pedir_garimpo, só leitura do resultado com a chave) e a
-- extensão atende com a sessão (garimpos_pendentes / gravar_garimpo): lê o
-- produto de origem, busca no player, confere pela foto no servidor e grava
-- só ofertas com o link de afiliado do Weslei (Amazon com a tag; Shopee pelo
-- painel). Mesmo freio da extensão: com a pausa remota, a fila devolve vazio.

create table if not exists public.garimpos (
  id bigserial primary key,
  chave uuid not null default gen_random_uuid(),
  player text not null check (player in ('amazon', 'shopee')),
  origem text not null check (origem in ('amazon', 'shopee', 'outro')),
  url text not null check (url ~* '^https://' and length(url) <= 2000),
  id_origem text check (id_origem is null or length(id_origem) <= 40),
  termo text not null check (length(termo) between 3 and 200),
  loja_origem text check (loja_origem is null or length(loja_origem) <= 60),
  preco_origem numeric check (preco_origem is null or (preco_origem > 0 and preco_origem < 1000000)),
  imagem_origem text check (imagem_origem is null or (imagem_origem ~* '^https://' and length(imagem_origem) <= 600)),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'pronto', 'falhou')),
  resultado jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);
create index if not exists garimpos_fila on public.garimpos (status, criado_em);
create index if not exists garimpos_repetido on public.garimpos (player, url, criado_em desc);
alter table public.garimpos enable row level security;
revoke all on public.garimpos from anon, authenticated;

-- Pedido do site. Mesmo link e player nas últimas 6 h (pronto) ou na fila
-- volta o mesmo pedido; até 30 novos a cada 10 min no site todo.
create or replace function public.pedir_garimpo(
  p_player text, p_origem text, p_url text, p_termo text,
  p_id_origem text default null, p_loja text default null,
  p_preco numeric default null, p_imagem text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := split_part(trim(coalesce(p_url, '')), '#', 1);
  v_termo text := left(regexp_replace(trim(coalesce(p_termo, '')), '\s+', ' ', 'g'), 200);
  v_ligado boolean;
  r record;
begin
  if p_player not in ('amazon', 'shopee') or p_origem not in ('amazon', 'shopee', 'outro') then
    return jsonb_build_object('ok', false, 'motivo', 'player');
  end if;
  if v_url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)' or length(v_url) > 2000 or length(v_termo) < 3 then
    return jsonb_build_object('ok', false, 'motivo', 'link');
  end if;
  v_ligado := coalesce((select valor from public.sinc_config
                         where chave = 'multiloja_' || p_player), 'true') <> 'false';
  if not v_ligado then
    return jsonb_build_object('ok', false, 'motivo', 'desligado');
  end if;
  select id, chave, status into r from public.garimpos
   where player = p_player and url = v_url
     and ((status = 'pronto' and criado_em > now() - interval '6 hours')
          or (status in ('pendente', 'processando') and criado_em > now() - interval '15 minutes'))
   order by id desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'id', r.id, 'chave', r.chave, 'estado', r.status);
  end if;
  if (select count(*) from public.garimpos where criado_em > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  insert into public.garimpos (player, origem, url, id_origem, termo, loja_origem, preco_origem, imagem_origem)
  values (p_player, p_origem, v_url,
          nullif(left(regexp_replace(coalesce(p_id_origem, ''), '[^A-Za-z0-9.]', '', 'g'), 40), ''),
          v_termo,
          nullif(left(trim(coalesce(p_loja, '')), 60), ''),
          case when p_preco > 0 and p_preco < 1000000 then round(p_preco, 2) end,
          case when p_imagem ~* '^https://' and length(p_imagem) <= 600 then p_imagem end)
  returning id, chave into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'chave', r.chave, 'estado', 'pendente');
end
$$;
revoke all on function public.pedir_garimpo(text, text, text, text, text, text, numeric, text) from public;
grant execute on function public.pedir_garimpo(text, text, text, text, text, text, numeric, text) to anon, authenticated;

create or replace function public.ver_garimpo(p_id bigint, p_chave uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', g.id, 'player', g.player, 'origem', g.origem, 'status', g.status,
           'resultado', g.resultado, 'criado_em', g.criado_em, 'concluido_em', g.concluido_em,
           'parado', g.status in ('pendente', 'processando') and g.criado_em < now() - interval '8 minutes')
    from public.garimpos g
   where g.id = p_id and g.chave = p_chave
$$;
revoke all on function public.ver_garimpo(bigint, uuid) from public;
grant execute on function public.ver_garimpo(bigint, uuid) to anon, authenticated;

-- Fila da extensão: até 2 por vez, marca o início; travado há 8 min volta.
create or replace function public.garimpos_pendentes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if public.extensao_pausada() then return '[]'::jsonb; end if;
  with escolhidos as (
    select g.id from public.garimpos g
     where g.criado_em > now() - interval '30 minutes'
       and (g.status = 'pendente'
            or (g.status = 'processando' and g.iniciado_em < now() - interval '8 minutes'))
     order by g.criado_em
     limit 2
     for update skip locked
  ), marcados as (
    update public.garimpos g
       set status = 'processando', iniciado_em = now()
      from escolhidos e
     where g.id = e.id
    returning g.id, g.player, g.origem, g.url, g.id_origem, g.termo, g.loja_origem,
              g.preco_origem, g.imagem_origem
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb) into v from marcados m;
  return v;
end
$$;
revoke all on function public.garimpos_pendentes(text) from public;
grant execute on function public.garimpos_pendentes(text) to anon, authenticated;

-- Resultado da extensão. Só link de afiliado do próprio player entra (a
-- tela confere de novo).
create or replace function public.gravar_garimpo(p_token text, p_id bigint, p_resultado jsonb, p_erro text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  update public.garimpos
     set status = case when p_resultado is null then 'falhou' else 'pronto' end,
         resultado = case when jsonb_typeof(p_resultado) = 'object' then p_resultado end,
         erro = left(p_erro, 300),
         concluido_em = now()
   where id = p_id;
end
$$;
revoke all on function public.gravar_garimpo(text, bigint, jsonb, text) from public;
grant execute on function public.gravar_garimpo(text, bigint, jsonb, text) to anon, authenticated;
