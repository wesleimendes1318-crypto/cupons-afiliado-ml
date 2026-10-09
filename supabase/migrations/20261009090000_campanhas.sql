-- GESTÃO AUTÔNOMA DE CAMPANHAS E VITRINES (Weslei, 09/10). Aditiva.
-- Campanha = uma vitrine com início e fim de verdade (calendário, categoria
-- em alta pela API oficial, recomendados do hub). Os produtos de cada uma
-- são escolhidos pelo agente (src/lib/agente-campanhas.ts) com os filtros
-- de sempre + vendedor confiável; o site só lê campanha ATIVA e dentro do
-- prazo (campanhas_ativas / campanha_publica). Expiração em camadas: tarefa
-- de hora em hora, filtro em toda leitura e revalidação no navegador.
-- Métricas (impressões, cliques) só para o servidor; nada de comissão.

-- Chave da vitrine a partir do endereço do pedido (a mesma conta do
-- gatilho atualizar_produto_visto).
CREATE OR REPLACE FUNCTION public.chave_do_url(u text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(coalesce(
    substring(u from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(u from '(?i)/p/(MLB[0-9]+)'),
    substring(u from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(u from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(u, '?', 1))))
$$;

-- Verdadeiro para true, objeto/texto preenchido (o selo vem em formatos
-- diferentes conforme a versão da extensão).
CREATE OR REPLACE FUNCTION public.jsonb_sim(j jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE jsonb_typeof(j)
    WHEN 'boolean' THEN j::text = 'true'
    WHEN 'object' THEN j <> '{}'::jsonb
    WHEN 'string' THEN (j #>> '{}') NOT IN ('', 'false', '0')
    ELSE false END
$$;

CREATE TABLE IF NOT EXISTS public.campanhas (
  id bigserial PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,22}$'),
  nome text NOT NULL,
  beneficio_texto text,
  regras_resumo text,
  tema_visual text,
  -- Origem da demanda: calendario | tendencia | hub | manual
  fonte text NOT NULL,
  -- sazonal | em_alta | mais_vendidos | desconto
  demanda_tipo text,
  -- Seleção dos produtos: temporada de src/lib/sazonal.ts, categoria do
  -- site (vitrine.categoria_site) ou itens do hub.
  temporada text,
  categoria_site text,
  -- Vitrine regional: UFs onde aparece (nulo = Brasil todo).
  ufs text[],
  inicia_em timestamptz NOT NULL,
  termina_em timestamptz NOT NULL,
  -- Até quando os produtos valem sem nova conferência do agente.
  revalidar_ate timestamptz,
  status text NOT NULL DEFAULT 'descoberta'
    CHECK (status IN ('descoberta', 'ativa', 'pausada', 'expirada', 'arquivada')),
  -- Link de afiliado da página da campanha (só meli.la).
  link_afiliado_campanha text
    CHECK (link_afiliado_campanha IS NULL OR link_afiliado_campanha ~ '^https://meli\.la/[A-Za-z0-9]+$'),
  coletado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (termina_em > inicia_em)
);
CREATE INDEX IF NOT EXISTS campanhas_status_fim ON public.campanhas (status, termina_em);
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campanhas FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campanha_produtos (
  campanha_id bigint NOT NULL REFERENCES public.campanhas (id) ON DELETE CASCADE,
  chave text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  -- mesmo | parecido | menor (a oferta mostrada no cartão)
  tipo text NOT NULL CHECK (tipo IN ('mesmo', 'parecido', 'menor')),
  titulo text,
  preco numeric NOT NULL,
  preco_antes numeric NOT NULL,
  economia numeric NOT NULL,
  -- Preço promocional e cupom só quando lidos na campanha oficial (nunca
  -- inventados; por enquanto ficam vazios).
  preco_promocional numeric,
  cupom text,
  loja text,
  link text NOT NULL CHECK (link ~ '^https://meli\.la/[A-Za-z0-9]+$'),
  lojas integer,
  loja_oficial boolean NOT NULL DEFAULT false,
  mercado_lider text,
  conferido_em timestamptz NOT NULL,
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campanha_id, chave)
);
ALTER TABLE public.campanha_produtos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campanha_produtos FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campanha_metricas (
  campanha_id bigint NOT NULL REFERENCES public.campanhas (id) ON DELETE CASCADE,
  dia date NOT NULL,
  impressoes integer NOT NULL DEFAULT 0,
  cliques integer NOT NULL DEFAULT 0,
  -- Conversões: sem acesso ao relatório de vendas por API; fica vazio
  -- (painel de afiliados do Mercado Livre, só do Weslei).
  conversoes integer,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campanha_id, dia)
);
ALTER TABLE public.campanha_metricas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campanha_metricas FROM anon, authenticated;

CREATE OR REPLACE VIEW public.campanha_metricas_painel AS
SELECT c.slug, m.dia, m.impressoes, m.cliques,
       CASE WHEN m.impressoes > 0 THEN round(100.0 * m.cliques / m.impressoes, 1) END AS ctr_pct,
       m.conversoes
  FROM public.campanha_metricas m JOIN public.campanhas c ON c.id = m.campanha_id;
REVOKE ALL ON public.campanha_metricas_painel FROM anon, authenticated;

-- Confiabilidade do vendedor da oferta de cada produto da vitrine, pela
-- última comparação pronta (30 dias): loja oficial e MercadoLíder da melhor
-- loja do mesmo produto, da alternativa e do anúncio colado. Só servidor.
CREATE OR REPLACE FUNCTION public.confiabilidade_da_vitrine(p_chaves text[])
RETURNS TABLE (
  chave text, pedido_id bigint, conferido_em timestamptz, categoria text,
  melhor_oficial boolean, melhor_lider text, alt_oficial boolean, alt_lider text,
  colado_oficial boolean, colado_condicao text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ult AS (
    SELECT DISTINCT ON (k.chave) k.chave, p.id, coalesce(p.atendido_em, p.criado_em) AS em,
           p.analise AS a, p.link
      FROM public.pedidos_link p
      CROSS JOIN LATERAL (SELECT public.chave_do_url(p.url_alvo) AS chave) k
     WHERE p.status = 'pronto' AND p.criado_em > now() - interval '30 days'
       AND k.chave = ANY (p_chaves)
     ORDER BY k.chave, coalesce(p.atendido_em, p.criado_em) DESC
  )
  SELECT u.chave, u.id, u.em, u.a->>'categoria',
         public.jsonb_sim(m.o->'lojaOficial'), nullif(m.o->>'mercadoLider', ''),
         public.jsonb_sim(par.o->'lojaOficial'), nullif(par.o->>'mercadoLider', ''),
         public.jsonb_sim(u.a->'lojaOficial'), u.a->>'condicao'
    FROM ult u
    LEFT JOIN public.produtos_vistos pv ON pv.chave = u.chave
    LEFT JOIN LATERAL (
      SELECT o FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(u.a->'outrasLojas') = 'array' THEN u.a->'outrasLojas' ELSE '[]'::jsonb END)
             WITH ORDINALITY AS t(o, n)
       WHERE coalesce(o->>'link', '') <> '' AND o->>'link' <> u.link
         AND NOT public.jsonb_sim(o->'semAfiliado') AND NOT public.jsonb_sim(o->'mesmaPagina')
       ORDER BY n LIMIT 1) m ON true
    LEFT JOIN LATERAL (
      SELECT o FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(u.a->'parecidos') = 'array' THEN u.a->'parecidos' ELSE '[]'::jsonb END) AS t(o)
       WHERE pv.alt_link IS NOT NULL AND o->>'link' = pv.alt_link
       LIMIT 1) par ON true
$$;
REVOKE ALL ON FUNCTION public.confiabilidade_da_vitrine(text[]) FROM PUBLIC, anon, authenticated;

-- Produtos de uma campanha para a tela: só link meli.la e conferido nos
-- últimos 7 dias (nada de oferta zumbi).
CREATE OR REPLACE FUNCTION public.produtos_da_campanha(p_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'chave', cp.chave, 'titulo', coalesce(cp.titulo, pv.titulo), 'imagem', pv.imagem,
           'tipo', cp.tipo, 'preco', cp.preco, 'antes', cp.preco_antes, 'economia', cp.economia,
           'loja', cp.loja, 'link', cp.link, 'lojas', cp.lojas, 'url_produto', pv.url_produto,
           'conferido_em', cp.conferido_em, 'loja_oficial', cp.loja_oficial,
           'mercado_lider', cp.mercado_lider) ORDER BY cp.ordem), '[]'::jsonb)
    FROM public.campanha_produtos cp
    LEFT JOIN public.produtos_vistos pv ON pv.chave = cp.chave
   WHERE cp.campanha_id = p_id
     AND cp.link ~ '^https://meli\.la/[A-Za-z0-9]+$'
     AND cp.conferido_em > now() - interval '7 days'
$$;
REVOKE ALL ON FUNCTION public.produtos_da_campanha(bigint) FROM PUBLIC, anon, authenticated;

-- Leitura pública: campanhas ATIVAS e dentro do prazo (toda consulta
-- filtra status e termina_em, mesmo antes da tarefa de expiração rodar).
CREATE OR REPLACE FUNCTION public.campanhas_ativas(p_uf text DEFAULT NULL)
RETURNS TABLE (
  slug text, nome text, beneficio_texto text, regras_resumo text, tema_visual text,
  temporada text, inicia_em timestamptz, termina_em timestamptz, fonte text,
  demanda_tipo text, nacional boolean, link_afiliado_campanha text, produtos jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.slug, c.nome, c.beneficio_texto, c.regras_resumo, c.tema_visual, c.temporada,
         c.inicia_em, c.termina_em, c.fonte, c.demanda_tipo, c.ufs IS NULL,
         c.link_afiliado_campanha, public.produtos_da_campanha(c.id)
    FROM public.campanhas c
   WHERE c.status = 'ativa' AND c.inicia_em <= now() AND c.termina_em > now()
     AND (c.ufs IS NULL OR (p_uf IS NOT NULL AND upper(p_uf) = ANY (c.ufs)))
   ORDER BY c.termina_em
$$;
REVOKE ALL ON FUNCTION public.campanhas_ativas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campanhas_ativas(text) TO anon, authenticated;

-- Página de uma campanha: ativa (com produtos), encerrada (sem produtos,
-- a tela diz "Esta campanha encerrou recentemente") ou futura. Campanha
-- ainda em descoberta não aparece.
CREATE OR REPLACE FUNCTION public.campanha_publica(p_slug text)
RETURNS TABLE (
  slug text, nome text, beneficio_texto text, regras_resumo text, tema_visual text,
  temporada text, inicia_em timestamptz, termina_em timestamptz, estado text, produtos jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.slug, c.nome, c.beneficio_texto, c.regras_resumo, c.tema_visual, c.temporada,
         c.inicia_em, c.termina_em, e.estado,
         CASE WHEN e.estado = 'ativa' THEN public.produtos_da_campanha(c.id) ELSE '[]'::jsonb END
    FROM public.campanhas c
    CROSS JOIN LATERAL (SELECT CASE
      WHEN c.termina_em <= now() OR c.status IN ('expirada', 'arquivada') THEN 'encerrada'
      WHEN c.status = 'ativa' AND c.inicia_em <= now() THEN 'ativa'
      WHEN c.inicia_em > now() THEN 'futura'
      ELSE 'pausada' END AS estado) e
   WHERE c.slug = lower(p_slug) AND c.status <> 'descoberta'
$$;
REVOKE ALL ON FUNCTION public.campanha_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campanha_publica(text) TO anon, authenticated;

-- Camada 1 da expiração: de hora em hora (e o agente chama também).
CREATE OR REPLACE FUNCTION public.expirar_campanhas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n1 integer; n2 integer;
BEGIN
  UPDATE public.campanhas SET status = 'expirada', atualizado_em = now()
   WHERE status IN ('descoberta', 'ativa', 'pausada') AND termina_em <= now();
  GET DIAGNOSTICS n1 = ROW_COUNT;
  UPDATE public.campanhas SET status = 'arquivada', atualizado_em = now()
   WHERE status = 'expirada' AND termina_em < now() - interval '30 days';
  GET DIAGNOSTICS n2 = ROW_COUNT;
  RETURN n1 + n2;
END;
$$;
REVOKE ALL ON FUNCTION public.expirar_campanhas() FROM PUBLIC, anon, authenticated;

-- Impressão de campanha (seção vista na tela), com o mesmo consentimento
-- dos cliques. Origem = campanha_<slug com _>.
CREATE OR REPLACE FUNCTION public.registrar_evento(
  p_tipo text, p_origem text DEFAULT NULL, p_destino text DEFAULT NULL,
  p_pedido bigint DEFAULT NULL, p_pagina text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_tipo NOT IN ('clique_afiliado', 'clique_telegram', 'impressao_campanha') THEN RETURN false; END IF;
  -- Freio contra enxurrada: no maximo 300 eventos por minuto no site todo.
  IF (SELECT count(*) FROM public.eventos_site WHERE criado_em > now() - interval '1 minute') >= 300 THEN
    RETURN false;
  END IF;
  INSERT INTO public.eventos_site (tipo, origem, destino, pedido_id, pagina)
  VALUES (p_tipo, left(nullif(regexp_replace(coalesce(p_origem, ''), '[^a-z0-9_]', '', 'g'), ''), 32),
          left(nullif(regexp_replace(coalesce(p_destino, ''), '[^a-z0-9_]', '', 'g'), ''), 32),
          p_pedido, left(p_pagina, 120));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_evento(text, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento(text, text, text, bigint, text) TO anon, authenticated;

-- Consolida impressões e cliques do dia (Brasília) por campanha.
CREATE OR REPLACE FUNCTION public.consolidar_metricas_campanhas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.campanha_metricas (campanha_id, dia, impressoes, cliques, atualizado_em)
  SELECT c.id, (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date,
         count(*) FILTER (WHERE e.tipo = 'impressao_campanha'),
         count(*) FILTER (WHERE e.tipo = 'clique_afiliado'), now()
    FROM public.eventos_site e
    JOIN public.campanhas c ON e.origem = left('campanha_' || replace(c.slug, '-', '_'), 32)
   WHERE e.criado_em > now() - interval '2 days'
   GROUP BY 1, 2
  ON CONFLICT (campanha_id, dia) DO UPDATE
    SET impressoes = excluded.impressoes, cliques = excluded.cliques, atualizado_em = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.consolidar_metricas_campanhas() FROM PUBLIC, anon, authenticated;

-- Tarefa do agente na lista de caminhos permitidos.
CREATE OR REPLACE FUNCTION public.disparar_operacao(p_caminho text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'operacao?tarefa=alertas',
                       'operacao?tarefa=campanhas', 'cron-garimpo', 'cron-garimpo?simular=1')
     AND p_caminho !~ '^operacao\?tarefa=remover&publicacao=[0-9]{1,9}$'
     AND p_caminho !~ '^operacao\?tarefa=sazonal(&temporada=(criancas|black_friday|natal))?(&max=[0-9]{1,2})?$'
     AND p_caminho !~ '^operacao\?tarefa=brinquedos(&alvo=(em_alta|bebe|3a5|6a8|9a12|doacao))?$'
     AND p_caminho !~ '^operacao\?tarefa=arte&tema=(criancas|natal|black_friday|tecnologia|casa|beleza|neutro)(&forcar=1)?$' THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
END; $function$;
REVOKE ALL ON FUNCTION public.disparar_operacao(text) FROM PUBLIC, anon, authenticated;

-- Agenda: expiração + métricas de hora em hora; agente de campanhas às
-- 07:15 e 17:15 de Brasília (depois da busca sazonal, antes do preparo).
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('campanhas-expirar', 'operacao-campanhas');
END $$;
SELECT cron.schedule('campanhas-expirar', '7 * * * *',
  $$SELECT public.expirar_campanhas(); SELECT public.consolidar_metricas_campanhas();$$);
SELECT cron.schedule('operacao-campanhas', '15 10,20 * * *',
  $$SELECT public.disparar_operacao('operacao?tarefa=campanhas');$$);
