-- LISTAS DE AFILIADO NO MERCADO LIVRE (Weslei, 02/11: "preciso de um agente
-- especialista em listas de afiliados ... administrar, atualizar, criar
-- categorias, incluir produtos ... qualidade e usando dados que garantam
-- conversão, como cliques, compras com meu link e que sigam a página").
--
-- APLICAR no Supabase próprio (itgdvxvqbwjcvmglfval): SQL Editor -> colar
-- este arquivo inteiro -> Run. Pode rodar de novo sem estragar nada.
--
-- Duas partes:
--   1) CURADORIA (aqui, no banco, sem modelo de linguagem e sem crédito):
--      curar_listas_afiliado() escolhe de 50 a 100 produtos por lista temática
--      com dados reais: mais vendidos e mais buscados do catálogo oficial
--      (em_alta_catalogo), recomendados do hub de afiliados
--      (hub_recomendados; a comissão só DESEMPATA, nunca aprova), nota lida
--      na página do anúncio (avaliacoes_anuncios: 4,5 ou mais com 20 ou mais
--      avaliações; sem nota = fora), frete grátis, loja oficial e cliques no
--      link de afiliado do site (eventos_site, 30 dias). Vendas: não há API
--      de comissões; ficam de fora até existir dado real.
--   2) SINCRONIZADOR (extensão 1.174.0, sessão logada do Weslei): lê as
--      listas em myaccount.mercadolivre.com.br/bookmarks/list, cria as
--      listas do agente como Públicas, inclui o que a curadoria escolheu e
--      tira só o que o PRÓPRIO agente incluiu (nunca mexe em produto que o
--      Weslei pôs à mão nem em lista que não é do agente). listas_tarefas
--      entrega o trabalho; gravar_listas recebe o que foi lido e feito.
--
-- Liga/desliga: sinc_config.listas_ativo ('true' | 'false');
-- só ler, sem criar nem incluir: sinc_config.listas_modo = 'ler'.

create table if not exists public.listas_afiliado (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,40}$'),
  nome text not null,
  descricao text,
  categorias text[] not null default '{}',
  preco_min numeric,
  preco_max numeric,
  termos text,
  meta int not null default 80 check (meta between 10 and 100),
  ordem int not null default 0,
  ativa boolean not null default true,
  ml_lista_id text,
  ml_url text,
  publica boolean,
  qtd_no_ml int,
  lida_em timestamptz,
  curada_em timestamptz,
  criada_em timestamptz not null default now()
);
grant all on public.listas_afiliado to service_role;
alter table public.listas_afiliado enable row level security;
revoke all on public.listas_afiliado from anon, authenticated;

create table if not exists public.listas_afiliado_itens (
  lista text not null references public.listas_afiliado(slug) on delete cascade,
  item text not null check (item ~ '^MLB[0-9]{6,}$'),
  produto text,
  titulo text,
  imagem text,
  url text,
  preco numeric,
  nota numeric,
  total_avaliacoes int,
  frete_gratis boolean,
  loja_oficial boolean,
  mais_vendido boolean,
  cliques_30d int not null default 0,
  pontuacao numeric,
  posicao int,
  motivos text[],
  -- entrar: escolhido, ainda não está na lista | na_lista | sair: o agente
  -- vai tirar | fora: fora da lista | falhou: 3 tentativas sem sucesso
  estado text not null default 'entrar' check (estado in ('entrar', 'na_lista', 'sair', 'fora', 'falhou')),
  nosso boolean not null default true,
  tentativas int not null default 0,
  erro text,
  tentado_em timestamptz,
  entrou_em timestamptz,
  saiu_em timestamptz,
  curado_em timestamptz not null default now(),
  primary key (lista, item)
);
create index if not exists listas_afiliado_itens_estado on public.listas_afiliado_itens (estado, pontuacao desc);
grant all on public.listas_afiliado_itens to service_role;
alter table public.listas_afiliado_itens enable row level security;
revoke all on public.listas_afiliado_itens from anon, authenticated;

insert into public.sinc_config (chave, valor) values ('listas_ativo', 'true') on conflict (chave) do nothing;
insert into public.sinc_config (chave, valor) values ('listas_modo', 'aplicar') on conflict (chave) do nothing;

-- Listas temáticas (matriz de 02/11). Ajuste manual: update na tabela.
insert into public.listas_afiliado (slug, nome, descricao, categorias, preco_min, preco_max, termos, meta, ordem) values
  ('cozinha-eletro', 'Cozinha inteligente e eletro', 'Eletrodomésticos mais vendidos e bem avaliados: air fryer, robô aspirador, cafeteira, lava e seca.', '{eletrodomesticos}', null, null, null, 100, 1),
  ('tecnologia-home-office', 'Tecnologia e home office', 'Fones, mouses, teclados, carregadores, monitores e acessórios com nota alta de quem comprou.', '{informatica,eletronicos,celulares}', null, null, null, 100, 2),
  ('beleza-cuidados', 'Beleza, skincare e cabelos', 'Maquiagem, perfumes e linha capilar com as melhores avaliações.', '{beleza}', null, null, null, 80, 3),
  ('achadinhos-ate-100', 'Achadinhos até R$ 100', 'Utilidades práticas até R$ 100, com frete grátis e nota alta.', '{}', 5, 100, null, 100, 4),
  ('casa-organizada', 'Casa organizada', 'Organização, cama, mesa, banho e decoração bem avaliados.', '{casa}', null, null, null, 80, 5),
  ('ferramentas-oficina', 'Ferramentas e oficina', 'Furadeiras, parafusadeiras, maletas e EPI mais vendidos.', '{ferramentas}', null, null, null, 60, 6),
  ('brinquedos-educativos', 'Bebês e brinquedos', 'Brinquedos mais vendidos e bem avaliados para todas as idades.', '{brinquedos}', null, null, null, 80, 7),
  ('automotivo', 'Acessórios para o carro', 'Acessórios e cuidados para o carro com nota alta.', '{automotivo}', null, null, null, 60, 8),
  ('moda-acessorios', 'Moda e acessórios', 'Tênis, relógios, bolsas e mochilas mais vendidos.', '{moda}', null, null, null, 60, 9)
on conflict (slug) do nothing;

-- CURADORIA. Régua (sem exceção):
--   - nota lida na página do anúncio >= 4,5 com 20+ avaliações;
--   - anúncio novo (sem usado/recondicionado/vitrine/defeito no título), sem
--     réplica ou "1:1" e sem peça no lugar do aparelho;
--   - preço conhecido, lido nos últimos 3 dias (catálogo) ou 7 dias (hub);
--   - "Achadinhos" (teto de preço baixo): só com frete grátis confirmado.
-- Pontuação: qualidade (nota ponderada + volume de avaliações) > demanda
-- (mais vendido, posição na lista oficial, cliques no link de afiliado) >
-- frete grátis e loja oficial > comissão estimada (só desempata).
-- Estabilidade: quem já está na lista só sai se cair abaixo da posição
-- meta x 1,25 ou deixar de passar na régua (evita tirar e pôr todo dia).
create or replace function public.curar_listas_afiliado()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  v_resumo jsonb := '[]'::jsonb;
  v_entrar int; v_sair int; v_total int; v_cand int;
begin
  drop table if exists _listas_cand;
  create temp table _listas_cand on commit drop as
  with cat as (
    select distinct on (e.item)
           e.item, e.produto, e.nome as titulo, e.imagem, e.url, e.preco, e.frete_gratis,
           coalesce(e.loja_oficial, false) as loja_oficial,
           coalesce(e.origem, 'vendidos') = 'vendidos' as mais_vendido,
           e.categoria_site as categoria, e.posicao
      from public.em_alta_catalogo e
     where e.atualizado_em > now() - interval '3 days'
       and e.item ~ '^MLB[0-9]{6,}$' and e.preco > 0
     order by e.item, e.atualizado_em desc
  ), hub as (
    select h.item, h.titulo, h.imagem, h.url, h.preco, h.mais_vendido, h.posicao, h.comissao_pct
      from public.hub_recomendados h
     where h.lido_em > now() - interval '7 days'
       and h.item ~ '^MLB[0-9]{6,}$' and h.preco > 0
  ), base as (
    select coalesce(c.item, h.item) as item,
           c.produto,
           coalesce(c.titulo, h.titulo) as titulo,
           coalesce(c.imagem, h.imagem) as imagem,
           coalesce(c.url, h.url) as url,
           coalesce(c.preco, h.preco) as preco,
           c.frete_gratis,
           coalesce(c.loja_oficial, false) as loja_oficial,
           coalesce(c.mais_vendido, false) or coalesce(h.mais_vendido, false) as mais_vendido,
           coalesce(c.categoria, public.categoria_do_site(null, h.titulo)) as categoria,
           coalesce(c.posicao, h.posicao) as posicao,
           h.comissao_pct,
           (h.item is not null) as no_hub
      from cat c full join hub h on h.item = c.item
  ), cliques as (
    select upper(replace(substring(p.url_alvo from '(MLB-?[0-9]{6,})'), '-', '')) as item, count(*)::int as n
      from public.eventos_site ev
      join public.pedidos_link p on p.id = ev.pedido_id
     where ev.tipo = 'clique_afiliado' and ev.criado_em > now() - interval '30 days'
     group by 1
  )
  select b.*, a.nota, a.total as total_avaliacoes, coalesce(k.n, 0) as cliques_30d,
         round((
           ((a.total * a.nota + 10 * 4.5) / (a.total + 10) - 4.5) * 40
           + least(ln(1 + a.total) * 2.5, 20)
           + case when b.mais_vendido then 8 else 0 end
           + case when b.posicao is null then 0 when b.posicao <= 10 then 5 when b.posicao <= 30 then 3 else 1 end
           + least(ln(1 + coalesce(k.n, 0)) * 6, 15)
           + case when b.frete_gratis is true then 8 else 0 end
           + case when b.loja_oficial then 6 else 0 end
           + case when b.no_hub then 3 else 0 end
           + least(ln(1 + coalesce(b.comissao_pct, 0) * b.preco / 100) * 0.8, 4)
         )::numeric, 2) as pontuacao,
         array_remove(array[
           'Nota ' || replace(to_char(a.nota, 'FM0.0'), '.', ',') || ' (' || a.total || ' avaliações)',
           case when b.mais_vendido then 'Entre os mais vendidos' end,
           case when coalesce(k.n, 0) > 0 then k.n || ' cliques no link em 30 dias' end,
           case when b.frete_gratis is true then 'Frete grátis' end,
           case when b.loja_oficial then 'Loja oficial' end
         ], null) as motivos
    from base b
    join public.avaliacoes_anuncios a on a.item = b.item
    left join cliques k on k.item = b.item
   where a.nota >= 4.5 and a.total >= 20
     and coalesce(b.titulo, '') <> ''
     and b.titulo !~* '(\musad[oa]s?\M|recondicionad|seminov|\mvitrine\M|com defeito|\mquebrad|\mavariad|retirada de pe[cç]as)'
     and b.titulo !~* '(r[eé]plica|\m1:1\M|primeira linha|linha aaa|\minspirad|contratipo|similar ao original|\mclone\M)'
     and b.titulo !~* '^\s*((kit|jogo) (de )?[0-9]+\s*)?([0-9]+\s*un\.?\s*)?(carca[cç]a|tampa|moldura|frontal|display|tela (de )?(reposi|lcd|touch)|refil|pe[cç]a de reposi)';

  for l in select * from public.listas_afiliado where ativa order by ordem loop
    drop table if exists _listas_rank;
    create temp table _listas_rank on commit drop as
      select c.*, row_number() over (order by c.pontuacao desc, c.preco) as rk
        from _listas_cand c
       where (cardinality(l.categorias) = 0 or c.categoria = any(l.categorias))
         and (l.preco_min is null or c.preco >= l.preco_min)
         and (l.preco_max is null or c.preco <= l.preco_max)
         and (l.termos is null or c.titulo ~* l.termos)
         and (l.preco_max is null or l.preco_max > 150 or c.frete_gratis is true);
    select count(*) into v_cand from _listas_rank;

    -- Dados novos para quem continua.
    update public.listas_afiliado_itens i
       set produto = r.produto, titulo = left(r.titulo, 200), imagem = left(r.imagem, 400), url = r.url,
           preco = r.preco, nota = r.nota, total_avaliacoes = r.total_avaliacoes, frete_gratis = r.frete_gratis,
           loja_oficial = r.loja_oficial, mais_vendido = r.mais_vendido, cliques_30d = r.cliques_30d,
           pontuacao = r.pontuacao, posicao = r.rk, motivos = r.motivos, curado_em = now(),
           estado = case
             when i.estado = 'sair' and r.rk <= l.meta then 'na_lista'
             when i.estado = 'fora' and r.rk <= l.meta and i.nosso
                  and (i.saiu_em is null or i.saiu_em < now() - interval '14 days') then 'entrar'
             when i.estado = 'falhou' and r.rk <= l.meta and i.tentado_em < now() - interval '7 days' then 'entrar'
             else i.estado end,
           tentativas = case when i.estado = 'falhou' and i.tentado_em < now() - interval '7 days' then 0 else i.tentativas end
      from _listas_rank r
     where i.lista = l.slug and i.item = r.item;

    -- Novos escolhidos.
    insert into public.listas_afiliado_itens
      (lista, item, produto, titulo, imagem, url, preco, nota, total_avaliacoes, frete_gratis, loja_oficial,
       mais_vendido, cliques_30d, pontuacao, posicao, motivos, estado)
    select l.slug, r.item, r.produto, left(r.titulo, 200), left(r.imagem, 400), r.url, r.preco, r.nota,
           r.total_avaliacoes, r.frete_gratis, r.loja_oficial, r.mais_vendido, r.cliques_30d, r.pontuacao, r.rk,
           r.motivos, 'entrar'
      from _listas_rank r
     where r.rk <= l.meta
    on conflict (lista, item) do nothing;

    -- Saem: o que o agente incluiu e caiu abaixo de meta x 1,25 ou não
    -- passa mais na régua. Escolhido que nem entrou vira 'fora'.
    update public.listas_afiliado_itens i
       set estado = case when i.estado = 'entrar' then 'fora' else 'sair' end,
           curado_em = now(),
           erro = 'saiu da seleção (qualidade ou demanda)'
     where i.lista = l.slug and i.nosso and i.estado in ('entrar', 'na_lista')
       and not exists (
         select 1 from _listas_rank r
          where r.item = i.item
            and r.rk <= case when i.estado = 'entrar' then l.meta else ceil(l.meta * 1.25) end);

    -- Teto: nunca mais que a meta entre na_lista + entrar (os de menor
    -- pontuação esperam).
    with excesso as (
      select x.item from public.listas_afiliado_itens x
       where x.lista = l.slug and x.estado = 'entrar'
       order by x.pontuacao desc nulls last
       offset greatest(0, l.meta - (select count(*) from public.listas_afiliado_itens y
                                    where y.lista = l.slug and y.estado in ('na_lista', 'sair')))
    )
    update public.listas_afiliado_itens i set estado = 'fora', erro = 'lista cheia'
      from excesso e where i.lista = l.slug and i.item = e.item;

    select count(*) filter (where estado = 'entrar'), count(*) filter (where estado = 'sair'),
           count(*) filter (where estado in ('na_lista', 'entrar'))
      into v_entrar, v_sair, v_total
      from public.listas_afiliado_itens where lista = l.slug;
    update public.listas_afiliado set curada_em = now() where slug = l.slug;
    v_resumo := v_resumo || jsonb_build_object('lista', l.slug, 'candidatos', v_cand,
      'entrar', v_entrar, 'sair', v_sair, 'total', v_total, 'meta', l.meta);
  end loop;
  return jsonb_build_object('ok', true, 'listas', v_resumo, 'em', now());
end
$$;
revoke all on function public.curar_listas_afiliado() from public, anon, authenticated;
grant execute on function public.curar_listas_afiliado() to service_role;

-- EXTENSÃO: o trabalho da rodada. Nada com a extensão pausada ou com as
-- listas desligadas. Inclusão: maior pontuação primeiro, até p_max_entrar
-- (teto 20); saída: até p_max_sair (teto 10).
create or replace function public.listas_tarefas(p_token text, p_max_entrar int default 12, p_max_sair int default 8)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listas jsonb; v_entrar jsonb; v_sair jsonb;
  v_modo text := coalesce((select valor from public.sinc_config where chave = 'listas_modo'), 'aplicar');
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if public.extensao_pausada()
     or coalesce((select valor from public.sinc_config where chave = 'listas_ativo'), 'true') <> 'true' then
    return jsonb_build_object('ativo', false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'nome', nome, 'descricao', descricao,
           'ml_lista_id', ml_lista_id, 'ml_url', ml_url, 'publica', publica) order by lida_em nulls first, ordem), '[]'::jsonb)
    into v_listas from public.listas_afiliado where ativa;
  if v_modo = 'ler' then
    return jsonb_build_object('ativo', true, 'modo', 'ler', 'listas', v_listas, 'entrar', '[]'::jsonb, 'sair', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(s.x), '[]'::jsonb) into v_entrar from (
    select jsonb_build_object('lista', i.lista, 'item', i.item, 'url', i.url, 'titulo', i.titulo) as x
      from public.listas_afiliado_itens i
      join public.listas_afiliado l on l.slug = i.lista and l.ativa
     where i.estado = 'entrar' and i.tentativas < 3
       and (i.tentado_em is null or i.tentado_em < now() - interval '30 minutes')
     order by i.pontuacao desc nulls last
     limit least(greatest(coalesce(p_max_entrar, 12), 0), 20)) s;
  select coalesce(jsonb_agg(s.x), '[]'::jsonb) into v_sair from (
    select jsonb_build_object('lista', i.lista, 'item', i.item, 'titulo', i.titulo) as x
      from public.listas_afiliado_itens i
      join public.listas_afiliado l on l.slug = i.lista and l.ml_lista_id is not null
     where i.estado = 'sair' and i.nosso and i.tentativas < 3
       and (i.tentado_em is null or i.tentado_em < now() - interval '30 minutes')
     order by i.pontuacao nulls first
     limit least(greatest(coalesce(p_max_sair, 8), 0), 10)) s;
  return jsonb_build_object('ativo', true, 'modo', v_modo, 'listas', v_listas, 'entrar', v_entrar, 'sair', v_sair);
end
$$;
revoke all on function public.listas_tarefas(text, int, int) from public;
grant execute on function public.listas_tarefas(text, int, int) to anon, authenticated;

-- EXTENSÃO: o que leu e o que fez.
-- p_dados = {
--   listas: [{slug, ml_lista_id, ml_url, publica, qtd}],
--   lidos:  {<slug>: ["MLB...", ...]}   (itens vistos na lista do Mercado Livre)
--   acoes:  [{lista, item, acao: 'entrar'|'sair', ok, erro}]
-- }
create or replace function public.gravar_listas(p_token text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_slug text;
  v_itens text[];
  v_ok int := 0; v_falhas int := 0;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then return jsonb_build_object('ok', false); end if;

  if jsonb_typeof(p_dados->'listas') = 'array' then
    for r in select * from jsonb_to_recordset(p_dados->'listas')
               as x(slug text, ml_lista_id text, ml_url text, publica boolean, qtd int) loop
      update public.listas_afiliado
         set ml_lista_id = coalesce(nullif(left(r.ml_lista_id, 80), ''), ml_lista_id),
             ml_url = case when coalesce(r.ml_url, '') ~ '^https://([a-z]+\.)?mercadoli(vre|bre)\.com(\.br)?/' then left(r.ml_url, 400) else ml_url end,
             publica = coalesce(r.publica, publica),
             qtd_no_ml = coalesce(r.qtd, qtd_no_ml),
             lida_em = now()
       where slug = r.slug;
    end loop;
  end if;

  -- Itens vistos na lista do Mercado Livre: confirma quem entrou, registra o
  -- que o Weslei pôs à mão (nosso = false, nunca sai pelo agente) e marca o
  -- que sumiu da lista por fora (fica 14 dias sem voltar).
  if jsonb_typeof(p_dados->'lidos') = 'object' then
    for v_slug in select jsonb_object_keys(p_dados->'lidos') loop
      continue when not exists (select 1 from public.listas_afiliado where slug = v_slug);
      continue when jsonb_typeof(p_dados->'lidos'->v_slug) is distinct from 'array';
      select coalesce(array_agg(distinct upper(v)), '{}') into v_itens
        from jsonb_array_elements_text(p_dados->'lidos'->v_slug) v
       where upper(v) ~ '^MLB[0-9]{6,}$';
      update public.listas_afiliado_itens
         set estado = 'na_lista', entrou_em = coalesce(entrou_em, now()), erro = null
       where lista = v_slug and estado in ('entrar', 'falhou', 'fora') and item = any(v_itens);
      update public.listas_afiliado_itens
         set estado = 'fora', saiu_em = now(), erro = 'saiu da lista no Mercado Livre'
       where lista = v_slug and estado in ('na_lista', 'sair') and not (item = any(v_itens))
         and cardinality(v_itens) > 0;
      insert into public.listas_afiliado_itens (lista, item, estado, nosso, entrou_em)
      select v_slug, x, 'na_lista', false, now() from unnest(v_itens) x
      on conflict (lista, item) do nothing;
    end loop;
  end if;

  if jsonb_typeof(p_dados->'acoes') = 'array' then
    for r in select * from jsonb_to_recordset(p_dados->'acoes')
               as x(lista text, item text, acao text, ok boolean, erro text) limit 40 loop
      if r.ok then
        update public.listas_afiliado_itens
           set estado = case when r.acao = 'sair' then 'fora' else 'na_lista' end,
               entrou_em = case when r.acao = 'entrar' then now() else entrou_em end,
               saiu_em = case when r.acao = 'sair' then now() else saiu_em end,
               tentativas = 0, erro = null, tentado_em = now()
         where lista = r.lista and item = upper(r.item);
        v_ok := v_ok + 1;
      else
        update public.listas_afiliado_itens
           set tentativas = tentativas + 1, tentado_em = now(), erro = left(r.erro, 200),
               estado = case when tentativas + 1 >= 3 and estado = 'entrar' then 'falhou' else estado end
         where lista = r.lista and item = upper(r.item);
        v_falhas := v_falhas + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'acoes_ok', v_ok, 'falhas', v_falhas);
end
$$;
revoke all on function public.gravar_listas(text, jsonb) from public;
grant execute on function public.gravar_listas(text, jsonb) to anon, authenticated;

-- SITE (leitura pública, para um bloco futuro "Minhas listas"): só listas
-- públicas com endereço do Mercado Livre. Sem comissão, sem pontuação.
create or replace function public.listas_publicas()
returns table(slug text, nome text, descricao text, ml_url text, qtd int)
language sql
stable
security definer
set search_path = public
as $$
  select l.slug, l.nome, l.descricao, l.ml_url,
         coalesce(l.qtd_no_ml, (select count(*)::int from public.listas_afiliado_itens i
                                 where i.lista = l.slug and i.estado in ('na_lista', 'sair')))
    from public.listas_afiliado l
   where l.ativa and l.publica is true and l.ml_url is not null
   order by l.ordem;
$$;
revoke all on function public.listas_publicas() from public;
grant execute on function public.listas_publicas() to anon, authenticated;

-- Painel (só servidor).
create or replace view public.listas_afiliado_painel as
  select l.slug, l.nome, l.meta, l.publica, l.ml_lista_id is not null as criada_no_ml, l.qtd_no_ml,
         count(i.item) filter (where i.estado = 'na_lista') as na_lista,
         count(i.item) filter (where i.estado = 'entrar') as a_incluir,
         count(i.item) filter (where i.estado = 'sair') as a_tirar,
         count(i.item) filter (where i.estado = 'falhou') as falharam,
         count(i.item) filter (where not i.nosso) as postos_a_mao,
         round(avg(i.nota) filter (where i.estado = 'na_lista'), 2) as nota_media,
         sum(i.cliques_30d) filter (where i.estado = 'na_lista') as cliques_30d,
         l.curada_em, l.lida_em
    from public.listas_afiliado l
    left join public.listas_afiliado_itens i on i.lista = l.slug
   group by l.slug order by l.ordem;
revoke all on public.listas_afiliado_painel from anon, authenticated;
grant select on public.listas_afiliado_painel to service_role;

-- Curadoria 2 vezes por dia (06:35 e 18:35 de Brasília), só SQL.
select cron.unschedule(jobname) from cron.job where jobname = 'listas-curar';
select cron.schedule('listas-curar', '35 9,21 * * *', $$select public.curar_listas_afiliado();$$);
select public.curar_listas_afiliado();
