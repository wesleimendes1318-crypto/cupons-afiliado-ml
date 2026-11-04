-- PAINEL DO FUNDADOR (/admin, Weslei 04/11): só a conta mestre confirmada
-- (wes_lei18@hotmail.com) lê. Toda checagem é no banco (eh_fundador), nunca
-- no navegador. Comissões e vendas do espelho de afiliado nunca saem por
-- função pública. Sem número inventado: dia sem leitura fica sem linha.

CREATE OR REPLACE FUNCTION public.eh_fundador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'wes_lei18@hotmail.com'
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.eh_fundador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_fundador() TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_metricas_diarias (
  dia date PRIMARY KEY,
  visitas integer NOT NULL DEFAULT 0,
  buscas_link integer NOT NULL DEFAULT 0,
  buscas_texto integer NOT NULL DEFAULT 0,
  comparacoes integer NOT NULL DEFAULT 0,
  cliques_ml integer NOT NULL DEFAULT 0,
  cliques_amazon integer NOT NULL DEFAULT 0,
  cliques_shopee integer NOT NULL DEFAULT 0,
  favoritados integer NOT NULL DEFAULT 0,
  alertas_ativos integer NOT NULL DEFAULT 0,
  alertas_disparados integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.afiliado_vendas_espelho (
  id bigserial PRIMARY KEY,
  data date NOT NULL,
  marketplace text NOT NULL CHECK (marketplace IN ('mercadolivre', 'amazon', 'shopee')),
  pedidos_gerados integer,
  comissao_estimada_centavos bigint,
  cliques_registrados integer,
  status text,
  produtos_vendidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data, marketplace)
);

CREATE TABLE IF NOT EXISTS public.admin_comandos_sinc (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('sincronizar_vendas_afiliado', 'auditar_links_gerador')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executando', 'concluido', 'erro')),
  etapa text,
  resultado jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);

ALTER TABLE public.admin_metricas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_vendas_espelho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_comandos_sinc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_metricas_diarias, public.afiliado_vendas_espelho, public.admin_comandos_sinc FROM anon;
DROP POLICY IF EXISTS fundador ON public.admin_metricas_diarias;
DROP POLICY IF EXISTS fundador ON public.afiliado_vendas_espelho;
DROP POLICY IF EXISTS fundador ON public.admin_comandos_sinc;
CREATE POLICY fundador ON public.admin_metricas_diarias FOR ALL TO authenticated USING (public.eh_fundador()) WITH CHECK (public.eh_fundador());
CREATE POLICY fundador ON public.afiliado_vendas_espelho FOR ALL TO authenticated USING (public.eh_fundador()) WITH CHECK (public.eh_fundador());
CREATE POLICY fundador ON public.admin_comandos_sinc FOR ALL TO authenticated USING (public.eh_fundador()) WITH CHECK (public.eh_fundador());

-- Visitas e buscas por texto passam a ser medidas (mesmo consentimento de
-- análise dos cliques, sem IP nem id). Mesma função, só mais dois tipos.
CREATE OR REPLACE FUNCTION public.registrar_evento(p_tipo text, p_origem text DEFAULT NULL::text, p_destino text DEFAULT NULL::text, p_pedido bigint DEFAULT NULL::bigint, p_pagina text DEFAULT NULL::text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tipo NOT IN ('clique_afiliado', 'clique_telegram', 'impressao_campanha', 'visita', 'busca_texto') THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.eventos_site WHERE criado_em > now() - interval '1 minute') >= 300 THEN
    RETURN false;
  END IF;
  INSERT INTO public.eventos_site (tipo, origem, destino, pedido_id, pagina)
  VALUES (p_tipo, left(nullif(regexp_replace(coalesce(p_origem, ''), '[^a-z0-9_]', '', 'g'), ''), 32),
          left(nullif(regexp_replace(coalesce(p_destino, ''), '[^a-z0-9_]', '', 'g'), ''), 32),
          p_pedido, left(p_pagina, 120));
  RETURN true;
END;
$function$;

-- Agrega os dias [p_de, hoje] a partir das tabelas que já existem.
CREATE OR REPLACE FUNCTION public.consolidar_metricas_admin(p_de date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_metricas_diarias AS m
    (dia, visitas, buscas_link, buscas_texto, comparacoes, cliques_ml, cliques_amazon, cliques_shopee,
     favoritados, alertas_ativos, alertas_disparados, atualizado_em)
  SELECT d::date,
    (SELECT count(*) FROM eventos_site e WHERE e.tipo = 'visita' AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM pedidos_link p WHERE p.origem = 'site' AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM eventos_site e WHERE e.tipo = 'busca_texto' AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM pedidos_link p WHERE p.origem = 'site' AND p.status = 'pronto' AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM eventos_site e WHERE e.tipo = 'clique_afiliado' AND coalesce(e.destino, 'loja') IN ('loja', 'mercadolivre') AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM eventos_site e WHERE e.tipo = 'clique_afiliado' AND e.destino = 'amazon' AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM eventos_site e WHERE e.tipo = 'clique_afiliado' AND e.destino = 'shopee' AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM monitor_seguidores s WHERE (s.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    (SELECT count(*) FROM monitor_telegram t WHERE t.ligado_em IS NOT NULL AND (t.ligado_em AT TIME ZONE 'America/Sao_Paulo')::date <= d),
    (SELECT count(*) FROM monitor_telegram t WHERE (t.aviso_em AT TIME ZONE 'America/Sao_Paulo')::date = d),
    now()
  FROM generate_series(p_de, (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d
  ON CONFLICT (dia) DO UPDATE SET
    visitas = EXCLUDED.visitas, buscas_link = EXCLUDED.buscas_link, buscas_texto = EXCLUDED.buscas_texto,
    comparacoes = EXCLUDED.comparacoes, cliques_ml = EXCLUDED.cliques_ml, cliques_amazon = EXCLUDED.cliques_amazon,
    cliques_shopee = EXCLUDED.cliques_shopee, favoritados = EXCLUDED.favoritados,
    alertas_ativos = EXCLUDED.alertas_ativos, alertas_disparados = EXCLUDED.alertas_disparados,
    atualizado_em = now();
$$;
REVOKE ALL ON FUNCTION public.consolidar_metricas_admin(date) FROM PUBLIC, anon, authenticated;

SELECT public.consolidar_metricas_admin(((now() AT TIME ZONE 'America/Sao_Paulo')::date - 60));

-- Tudo que o painel mostra, numa chamada. Quem não é o fundador recebe erro neutro.
CREATE OR REPLACE FUNCTION public.painel_fundador(p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dias int := least(greatest(coalesce(p_dias, 30), 1), 90);
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_de date := v_hoje - (v_dias - 1);
  v_desde timestamptz;
BEGIN
  IF NOT public.eh_fundador() THEN
    RAISE EXCEPTION 'acesso_negado' USING ERRCODE = '42501';
  END IF;
  v_desde := (v_de::timestamp AT TIME ZONE 'America/Sao_Paulo');
  PERFORM public.consolidar_metricas_admin(v_hoje - 1);

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'de', v_de, 'ate', v_hoje,
    'serie', (SELECT coalesce(jsonb_agg(to_jsonb(m) - 'atualizado_em' ORDER BY m.dia), '[]') FROM admin_metricas_diarias m WHERE m.dia BETWEEN v_de AND v_hoje),
    'vendas', (SELECT coalesce(jsonb_agg(jsonb_build_object('data', v.data, 'marketplace', v.marketplace,
                 'pedidos', v.pedidos_gerados, 'comissao_centavos', v.comissao_estimada_centavos,
                 'cliques', v.cliques_registrados, 'status', v.status, 'produtos', v.produtos_vendidos,
                 'capturado_em', v.capturado_em) ORDER BY v.data), '[]')
               FROM afiliado_vendas_espelho v WHERE v.data >= least(v_de, date_trunc('month', v_hoje)::date) - 7),
    'monitorados', (SELECT count(*) FROM monitor_precos WHERE ativo),
    'seguidores', (SELECT count(*) FROM monitor_seguidores),
    'categorias', (SELECT coalesce(jsonb_agg(c ORDER BY c.buscas DESC), '[]') FROM (
        SELECT categoria AS nome, sum(vezes)::int AS buscas FROM produtos_vistos
        WHERE visto_em >= v_desde AND categoria IS NOT NULL AND categoria <> '...'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10) c),
    'termos', (SELECT coalesce(jsonb_agg(t ORDER BY t.vezes DESC), '[]') FROM (
        SELECT lower(termo) AS termo, count(*)::int AS vezes FROM buscas_anuncios
        WHERE criado_em >= v_desde AND termo IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) t),
    'top_produtos', (SELECT coalesce(jsonb_agg(p ORDER BY p.vezes DESC), '[]') FROM (
        SELECT pv.titulo, pv.categoria, pv.preco, pv.melhor_loja, pv.melhor_preco, pv.vezes,
          (SELECT count(*) FROM eventos_site e JOIN pedidos_link pl ON pl.id = e.pedido_id
            WHERE e.tipo = 'clique_afiliado' AND e.criado_em >= v_desde AND pl.titulo = pv.titulo)::int AS cliques
        FROM produtos_vistos pv WHERE pv.visto_em >= v_desde AND pv.titulo IS NOT NULL
        ORDER BY pv.vezes DESC LIMIT 20) p),
    'gaps', (SELECT coalesce(jsonb_agg(g), '[]') FROM (
        SELECT pv.titulo, pv.categoria, pv.preco, coalesce(pv.lojas_comparadas, 0) AS lojas,
          CASE WHEN coalesce(pv.lojas_comparadas, 0) <= 1 THEN 'poucas ofertas' ELSE 'sem economia' END AS motivo
        FROM produtos_vistos pv
        WHERE pv.visto_em >= v_desde AND pv.titulo IS NOT NULL
          AND (coalesce(pv.lojas_comparadas, 0) <= 1 OR coalesce(pv.economia, 0) < 1)
        ORDER BY pv.vezes DESC LIMIT 15) g),
    'falhas_busca', (SELECT count(*) FROM pedidos_link WHERE origem = 'site' AND status = 'falhou' AND criado_em >= v_desde),
    'saude', jsonb_build_object(
      'extensao_versao', (SELECT valor FROM sinc_config WHERE chave = 'versao_extensao'),
      'extensao_visto_em', (SELECT valor FROM sinc_config WHERE chave = 'visto_em'),
      'extensao_pausada', (SELECT valor FROM sinc_config WHERE chave = 'extensao_pausada'),
      'operacao_pausada', (SELECT valor FROM sinc_config WHERE chave = 'operacao_pausada'),
      'ia_esgotadas', (SELECT coalesce(jsonb_agg(jsonb_build_object('modelo', modelo, 'ate', ate)), '[]') FROM ia_cotas WHERE ate > now()),
      'cron', (SELECT coalesce(jsonb_agg(x ORDER BY x.fim DESC), '[]') FROM (
          SELECT DISTINCT ON (tarefa) tarefa, fim, resumo FROM operacao_execucoes
          WHERE ok AND fim IS NOT NULL AND inicio > now() - interval '3 days' ORDER BY tarefa, fim DESC) x),
      'ofertas_24h', (SELECT count(*) FROM em_alta_catalogo WHERE atualizado_em > now() - interval '24 hours')
    ),
    'comando', (SELECT to_jsonb(c) FROM admin_comandos_sinc c ORDER BY id DESC LIMIT 1)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.painel_fundador(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_fundador(integer) TO authenticated;
