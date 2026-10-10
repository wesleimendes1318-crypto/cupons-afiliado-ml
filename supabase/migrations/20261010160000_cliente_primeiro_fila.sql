-- CLIENTE PRIMEIRO NA FILA (Weslei, 10/10: "está demorando muito para
-- consultar e o usuário desiste"; pedido 1208 esperou 2 pedidos internos e a
-- tela dizia "Pronto em até 10min 05s").
--  1) tempo_estimado: só pedidos de CLIENTE (os internos entram em lote e
--     esperam na fila; com eles a previsão foi a 10 min, o real é ~45 s).
--  2) pedidos_pendentes: pedido interno UM por rodada (eram 2).
--  3) pedir_link_base: o mesmo link já na fila/andamento não duplica também
--     no uso normal (1208/1209: o mesmo link em 4 s entrou duas vezes).
--  4) pedidos_pendentes_v2 (com a origem) e clientes_esperando: a extensão
--     1.165.3 corta o pedido interno em andamento quando um cliente chega.

CREATE OR REPLACE FUNCTION public.tempo_estimado()
 RETURNS TABLE(segundos integer, amostras integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ult AS (
    SELECT extract(epoch FROM atendido_em - criado_em) AS s
      FROM public.pedidos_link
     WHERE status = 'pronto' AND atendido_em IS NOT NULL
       AND coalesce(origem, '') <> 'teste'
       AND criado_em > now() - interval '7 days'
       AND atendido_em > criado_em
     ORDER BY id DESC
     LIMIT 20
  )
  SELECT CASE WHEN count(*) >= 3 THEN ceil(percentile_cont(0.75) WITHIN GROUP (ORDER BY s))::int END,
         count(*)::int
    FROM ult;
$function$;

CREATE OR REPLACE FUNCTION public.pedidos_pendentes(p_token text)
 RETURNS TABLE(id bigint, cupom_id bigint, vendedor text, url_alvo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN QUERY
  WITH livres AS (
    SELECT p.id, coalesce(p.origem, '') = 'teste' AS interno, p.criado_em
      FROM public.pedidos_link p
     WHERE p.criado_em > now() - interval '3 days'
       AND (p.status = 'pendente'
            OR (p.status = 'processando'
                AND coalesce(p.processando_em, p.criado_em) < now() - interval '90 seconds'))
  ),
  clientes AS (
    SELECT l.id FROM livres l WHERE NOT l.interno ORDER BY l.criado_em LIMIT 12
  ),
  internos AS (
    SELECT l.id FROM livres l
     WHERE l.interno AND NOT EXISTS (SELECT 1 FROM clientes)
     ORDER BY l.criado_em LIMIT 1
  ),
  alvo AS (
    SELECT p.id FROM public.pedidos_link p
     WHERE p.id IN (SELECT c.id FROM clientes c UNION ALL SELECT i.id FROM internos i)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pedidos_link q
     SET status = 'processando', processando_em = now()
    FROM alvo
   WHERE q.id = alvo.id
  RETURNING q.id, q.cupom_id, q.vendedor, q.url_alvo;
END
$function$;

CREATE OR REPLACE FUNCTION public.pedir_link_base(p_url text, p_reusar boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint; v_url text; v_wid text;
BEGIN
  IF p_url IS NULL OR length(p_url) > 2000
     OR p_url !~* '^https?://([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(/|$)' THEN
    RAISE EXCEPTION 'link invalido';
  END IF;
  IF p_url ~* '/pagina/' OR p_url ~* '_CustId_' OR p_url ~* '/perfil/' THEN
    RAISE EXCEPTION 'link de loja nao gera link de afiliado valido';
  END IF;
  v_url := split_part(p_url, '#', 1);
  v_wid := substring(p_url from '(?i)[#&?]wid=(MLB[0-9]{6,})');
  IF v_wid IS NOT NULL AND v_url !~* 'item_id' THEN
    v_url := v_url || CASE WHEN position('?' in v_url) > 0 THEN '&' ELSE '?' END
                   || 'pdp_filters=item_id%3A' || upper(v_wid);
  END IF;
  IF p_reusar THEN
    SELECT p.id INTO v_id FROM public.pedidos_link p
     WHERE p.url_alvo = v_url AND p.status = 'pronto' AND p.link IS NOT NULL
       AND p.criado_em > now() - interval '1 hour'
       AND (p.analise->>'completa') = 'true' AND (p.analise->>'final') = 'true'
       AND (p.analise->>'versaoExtensao') = (SELECT valor FROM public.sinc_config WHERE chave = 'versao_extensao')
     ORDER BY p.id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT p.id INTO v_id FROM public.pedidos_link p
   WHERE p.url_alvo = v_url AND p.status IN ('pendente', 'processando')
     AND p.criado_em > now() - interval '5 minutes'
   ORDER BY p.id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF public.pedidos_no_limite() THEN RAISE EXCEPTION 'fila cheia'; END IF;
  INSERT INTO public.pedidos_link (vendedor, url_alvo, status, origem)
  VALUES ('(a descobrir)', v_url, 'pendente', 'site') RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.pedidos_pendentes_v2(p_token text)
 RETURNS TABLE(id bigint, cupom_id bigint, vendedor text, url_alvo text, origem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT q.id, q.cupom_id, q.vendedor, q.url_alvo, coalesce(pl.origem, '')
    FROM public.pedidos_pendentes(p_token) q
    JOIN public.pedidos_link pl ON pl.id = q.id;
END
$function$;
revoke all on function public.pedidos_pendentes_v2(text) from public;
grant execute on function public.pedidos_pendentes_v2(text) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.clientes_esperando(p_token text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN (SELECT count(*)::int FROM public.pedidos_link
           WHERE status = 'pendente' AND coalesce(origem, '') <> 'teste'
             AND criado_em > now() - interval '3 days');
END $function$;
revoke all on function public.clientes_esperando(text) from public;
grant execute on function public.clientes_esperando(text) to anon, authenticated;

-- 5) gravar_avaliacoes: opinião cujo texto é pedaço do código da página
--    (texto vazio na página; MLB3743670987) não é gravada.
create or replace function public.gravar_avaliacoes(p_token text, p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  x jsonb;
  v_item text;
  v_nota numeric;
  v_total integer;
  v_dist jsonb;
  v_coments jsonb;
  v_tc integer;
  v_aviso text;
  n integer := 0;
begin
  if p_token is null or p_token <> (select sc.valor from public.sinc_config sc where sc.chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return 0; end if;

  for x in select e from jsonb_array_elements(p_itens) e limit 20 loop
    v_item := upper(replace(coalesce(x->>'item', ''), '-', ''));
    continue when v_item !~ '^MLBP?[0-9]{6,}$';

    -- Pausa por verificação é da extensão inteira, não do anúncio.
    continue when x->>'erro' = 'verificacao';

    if coalesce((x->>'sem')::boolean, false) then
      insert into public.avaliacoes_anuncios as a (item, sem_avaliacoes, lido_em, tentado_em)
      values (v_item, true, now(), now())
      on conflict (item) do update set
        nota = null, total = null, sem_avaliacoes = true, distribuicao = null, comentarios = null,
        total_comentarios = null, aviso = null, lido_em = now(), tentado_em = now(), erro = null;
      n := n + 1;
      continue;
    end if;

    v_nota := case when (x->>'nota') ~ '^[0-9]+(\.[0-9]+)?$' then (x->>'nota')::numeric end;
    v_total := case when (x->>'total') ~ '^[0-9]{1,9}$' then (x->>'total')::integer end;
    if v_nota is null or v_nota <= 0 or v_nota > 5 or v_total is null or v_total < 1 then
      insert into public.avaliacoes_anuncios as a (item, tentado_em, erro)
      values (v_item, now(), left(coalesce(x->>'erro', 'sem nota'), 120))
      on conflict (item) do update set tentado_em = now(), erro = excluded.erro;
      continue;
    end if;
    v_nota := floor(v_nota * 10) / 10;

    -- Distribuição: as 5 estrelas, contagens inteiras.
    v_dist := null;
    if jsonb_typeof(x->'distribuicao') = 'array' then
      select jsonb_agg(jsonb_build_object('estrelas', e, 'total', t) order by e desc)
        into v_dist
        from (
          select distinct on ((d->>'estrelas')::int) (d->>'estrelas')::int as e, (d->>'total')::int as t
            from jsonb_array_elements(x->'distribuicao') d
           where (d->>'estrelas') ~ '^[1-5]$' and (d->>'total') ~ '^[0-9]{1,9}$'
        ) s;
      if v_dist is not null and jsonb_array_length(v_dist) <> 5 then v_dist := null; end if;
    end if;

    -- Opiniões: até 6, com nota de 1 a 5 e texto.
    v_coments := null;
    if jsonb_typeof(x->'comentarios') = 'array' then
      select jsonb_agg(c order by ord)
        into v_coments
        from (
          select ord, jsonb_strip_nulls(jsonb_build_object(
                   'nota', (o->>'nota')::int,
                   'texto', left(btrim(regexp_replace(o->>'texto', '[[:cntrl:]]+', ' ', 'g')), 800),
                   'data', nullif(left(btrim(coalesce(o->>'data', '')), 40), ''),
                   'criado_em', case when (o->>'criadoEm') ~ '^\d{4}-\d{2}-\d{2}$' then o->>'criadoEm' end,
                   'uteis', case when (o->>'uteis') ~ '^[0-9]{1,7}$' then (o->>'uteis')::int end)) as c
            from jsonb_array_elements(x->'comentarios') with ordinality as t(o, ord)
           where (o->>'nota') ~ '^[1-5]$' and length(btrim(coalesce(o->>'texto', ''))) >= 2
             -- Pedaço do código da página no lugar do texto (opinião vazia).
             and (o->>'texto') !~ '"\s*:\s*"|"\s*,\s*"|see_more|see_less'
           order by ord
           limit 6
        ) s;
    end if;
    v_tc := case when (x->>'totalComentarios') ~ '^[0-9]{1,9}$' then (x->>'totalComentarios')::int end;
    v_aviso := nullif(left(btrim(coalesce(x->>'aviso', '')), 140), '');

    if v_dist is not null or v_coments is not null then
      insert into public.avaliacoes_anuncios as a
        (item, nota, total, sem_avaliacoes, distribuicao, comentarios, total_comentarios, aviso, lido_em, tentado_em, erro)
      values (v_item, v_nota, v_total, false, v_dist, v_coments, v_tc, v_aviso, now(), now(), null)
      on conflict (item) do update set
        nota = excluded.nota, total = excluded.total, sem_avaliacoes = false,
        distribuicao = excluded.distribuicao, comentarios = excluded.comentarios,
        total_comentarios = excluded.total_comentarios, aviso = excluded.aviso,
        lido_em = now(), tentado_em = now(), erro = null;
    else
      -- Só nota e total: não apaga um detalhamento lido nos últimos 7 dias.
      insert into public.avaliacoes_anuncios as a (item, nota, total, sem_avaliacoes, lido_em, tentado_em)
      values (v_item, v_nota, v_total, false, now(), now())
      on conflict (item) do update set
        nota = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.nota else excluded.nota end,
        total = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.total else excluded.total end,
        sem_avaliacoes = false,
        lido_em = case when a.distribuicao is not null and a.lido_em > now() - interval '7 days' then a.lido_em else now() end,
        tentado_em = now(), erro = null;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.gravar_avaliacoes(text, jsonb) from public;
grant execute on function public.gravar_avaliacoes(text, jsonb) to anon, authenticated;
