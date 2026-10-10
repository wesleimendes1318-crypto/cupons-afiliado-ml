-- PREÇO MOSTRADO = PREÇO QUE O LINK ABRE (Weslei, 10/10: "o preço indicado
-- foi de R$ 8. Ao acessar o link, subiu para R$ 13. Isso não pode ocorrer
-- jamais, em nenhum player").
--
-- Pedido 1215 (busca por foto, pó facial banana): o anúncio lido era
-- MLB5141126371 a R$ 8, mas o link de afiliado foi gerado pela canônica da
-- página, /p/MLB23095587, SEM o anúncio. O link da ficha abre a oferta
-- destacada do catálogo (outra loja, R$ 13 com frete grátis) e o gerador
-- devolve o mesmo link para todas as ofertas da ficha (medido em 24/09).
-- Em 30 dias: 519 pedidos com anúncio definido receberam o link da ficha.
--
-- 1. anuncio_do_endereco / link_da_ficha: o registro do gerador (geracoes)
--    diz de que endereço saiu cada link.
-- 2. Trava (gatilho pedido_link_da_oferta): link da ficha num pedido que
--    aponta um anúncio é descartado na gravação; o site gera o link do
--    anúncio no clique (VerNaLoja). Vale para a extensão antiga (1.165.0).
-- 3. Limpeza: o mesmo nos pedidos, na vitrine e no "Acompanhar preço"; a
--    oferta de campanha com esse link sai da campanha.
--    Aplicado em 10/10: 541 pedidos, 343 cartões da vitrine, 47 ofertas de
--    campanha e 1 acompanhamento; 350 anúncios na fila do reparo.
-- 4. Reparo: links_a_refazer + pg_cron links-refazer põem na fila, aos
--    poucos e só sem cliente esperando, um pedido "(so link)" com o endereço
--    do próprio anúncio; o gatilho link_refeito devolve o link novo a cada
--    lugar de onde o antigo saiu.

create or replace function public.anuncio_do_endereco(p_url text)
returns text
language sql
immutable
as $$
  select 'MLB' || coalesce(
    substring(coalesce(p_url, '') from '(?i)item_id(?:%3A|:)MLB-?([0-9]{6,})'),
    substring(coalesce(p_url, '') from '(?i)[?&#]wid=MLB-?([0-9]{6,})'),
    case when coalesce(p_url, '') ~* '^https?://[a-z0-9.-]*mercadoli[vb]re\.com(\.br)?/'
         then substring(p_url from '(?i)/MLB-([0-9]{6,})') end
  )
$$;

-- true: o link saiu de uma ficha de catálogo (/p/MLB...) e nunca do endereço
-- do anúncio que o pedido aponta. Sem anúncio no endereço: false (a página
-- de catálogo pura mostra a oferta destacada, a mesma que o link abre).
create or replace function public.link_da_ficha(p_link text, p_url text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_link is not null
     and public.anuncio_do_endereco(p_url) is not null
     and exists (
       select 1 from public.geracoes g
        where g.tipo = 'link' and g.resultado = p_link and g.chave ~* '/p/MLB[0-9]+')
     and not exists (
       select 1 from public.geracoes g
        where g.tipo = 'link' and g.resultado = p_link and g.chave !~* '/p/MLB[0-9]+'
          and public.anuncio_do_endereco(g.chave) = public.anuncio_do_endereco(p_url))
$$;
revoke all on function public.link_da_ficha(text, text) from public, anon, authenticated;

create or replace function public.pedido_link_da_oferta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.link is not null
     and (tg_op = 'INSERT' or new.link is distinct from old.link)
     and public.link_da_ficha(new.link, new.url_alvo) then
    new.analise := case when jsonb_typeof(new.analise) = 'object' then new.analise else '{}'::jsonb end
                   || jsonb_build_object('linkDaFichaDescartado', true);
    new.link := null;
  end if;
  return new;
end
$$;

drop trigger if exists pedido_link_da_oferta on public.pedidos_link;
create trigger pedido_link_da_oferta
  before insert or update of link on public.pedidos_link
  for each row execute function public.pedido_link_da_oferta();

create table if not exists public.links_a_refazer (
  item text primary key check (item ~ '^MLB[0-9]{6,}$'),
  url_oferta text not null,
  prioridade integer not null default 0,
  pedido_id bigint,
  tentativas integer not null default 0,
  link_novo text,
  erro text,
  criado_em timestamptz not null default now(),
  enfileirado_em timestamptz,
  feito_em timestamptz
);
alter table public.links_a_refazer enable row level security;
revoke all on public.links_a_refazer from anon, authenticated;

-- Itens afetados, com prioridade: campanha 3, vitrine e acompanhar 2,
-- pedido da última semana 1, o resto 0.
with afetados as (
  select public.anuncio_do_endereco(p.url_alvo) as item,
         case when p.criado_em > now() - interval '7 days' then 1 else 0 end as prio
    from public.pedidos_link p
   where p.link is not null and public.link_da_ficha(p.link, p.url_alvo)
  union all
  select coalesce(public.anuncio_do_endereco(v.url_produto),
                  case when v.chave ~ '^MLB[0-9]{6,}$' then v.chave end), 2
    from public.produtos_vistos v
   where v.link is not null
     and public.link_da_ficha(v.link, coalesce(v.url_produto,
           'https://produto.mercadolivre.com.br/' || replace(v.chave, 'MLB', 'MLB-')))
  union all
  select c.chave, 3
    from public.campanha_produtos c
   where c.link is not null and c.chave ~ '^MLB[0-9]{6,}$'
     and public.link_da_ficha(c.link, 'https://produto.mercadolivre.com.br/' || replace(c.chave, 'MLB', 'MLB-'))
  union all
  select public.anuncio_do_endereco(m.url), 2
    from public.monitor_precos m
   where m.link is not null and public.link_da_ficha(m.link, m.url)
)
insert into public.links_a_refazer (item, url_oferta, prioridade)
select item, 'https://produto.mercadolivre.com.br/' || replace(item, 'MLB', 'MLB-'), max(prio)
  from afetados
 where item ~ '^MLB[0-9]{6,}$'
 group by item
on conflict (item) do update set prioridade = greatest(public.links_a_refazer.prioridade, excluded.prioridade);

-- Limpeza: sem o link da ficha, o botão gera o link do anúncio no clique.
update public.pedidos_link p
   set link = null,
       analise = case when jsonb_typeof(p.analise) = 'object' then p.analise else '{}'::jsonb end
                 || jsonb_build_object('linkDaFichaDescartado', true)
 where p.link is not null and public.link_da_ficha(p.link, p.url_alvo);

update public.produtos_vistos v
   set link = null
 where v.link is not null
   and public.link_da_ficha(v.link, coalesce(v.url_produto,
         'https://produto.mercadolivre.com.br/' || replace(v.chave, 'MLB', 'MLB-')));

-- campanha_produtos.link é obrigatório: a oferta sai da campanha e a
-- curadoria (07:15 e 17:15) a traz de volta com o link refeito.
delete from public.campanha_produtos c
 where c.chave ~ '^MLB[0-9]{6,}$'
   and public.link_da_ficha(c.link, 'https://produto.mercadolivre.com.br/' || replace(c.chave, 'MLB', 'MLB-'));

update public.monitor_precos m
   set link = null
 where m.link is not null and public.link_da_ficha(m.link, m.url);

-- Fila do reparo: até 3 abertos, só com a extensão do gerador rápido
-- (1.165.5+; antes cada link levava 30-45 s) e sem cliente esperando.
create or replace function public.refazer_links_fila(p_max integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int[];
  v_abertos int;
  v_n int := 0;
  v_id bigint;
  r record;
begin
  begin
    v_ver := string_to_array((select valor from public.sinc_config where chave = 'versao_extensao'), '.')::int[];
  exception when others then
    return 0;
  end;
  if v_ver is null or v_ver < array[1, 165, 5] then return 0; end if;
  if exists (select 1 from public.pedidos_link
              where origem = 'site' and status in ('pendente', 'processando')
                and criado_em > now() - interval '10 minutes') then
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
     limit greatest(0, p_max - v_abertos)
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

-- Link novo do anúncio: volta a cada lugar de onde o da ficha saiu.
create or replace function public.link_refeito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
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
    update public.pedidos_link
       set link = new.link
     where vendedor is distinct from '(so link)' and link is null
       and coalesce((analise->>'linkDaFichaDescartado')::boolean, false)
       and public.anuncio_do_endereco(url_alvo) = v_item;
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

drop trigger if exists link_refeito on public.pedidos_link;
create trigger link_refeito
  after update of status, link on public.pedidos_link
  for each row when (new.vendedor = '(so link)')
  execute function public.link_refeito();

select cron.schedule('links-refazer', '*/10 * * * *', $$select public.refazer_links_fila();$$);
