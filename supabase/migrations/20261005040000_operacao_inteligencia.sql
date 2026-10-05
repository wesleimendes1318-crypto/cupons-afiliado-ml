-- OPERACAO DE INTELIGENCIA (Weslei, 05/10): registros persistentes da rotina
-- de mercado, medicao do site e publicacoes do canal. So o servidor (service
-- role) le e grava, exceto registrar_evento (publica, sem identificacao).

-- Sinais externos coletados (API oficial do Mercado Livre e feeds publicos).
CREATE TABLE IF NOT EXISTS public.mercado_sinais (
  id bigserial PRIMARY KEY,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  fonte text NOT NULL,            -- ml_trends | ml_mais_vendidos | google_trends
  categoria_id text,
  categoria_nome text,
  posicao integer,
  termo text,                     -- palavra-chave (tendencia) ou nome do produto
  produto_id text,                -- id do catalogo/anuncio (mais vendidos)
  url text,
  extra jsonb
);
CREATE INDEX IF NOT EXISTS mercado_sinais_coleta ON public.mercado_sinais (fonte, coletado_em DESC);
ALTER TABLE public.mercado_sinais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mercado_sinais FROM anon, authenticated;

-- Cada execucao da rotina (coleta, preparo, publicacao): rastreavel.
CREATE TABLE IF NOT EXISTS public.operacao_execucoes (
  id bigserial PRIMARY KEY,
  tarefa text NOT NULL,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  ok boolean,
  resumo jsonb,
  erro text
);
CREATE INDEX IF NOT EXISTS operacao_execucoes_tarefa ON public.operacao_execucoes (tarefa, inicio DESC);
ALTER TABLE public.operacao_execucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operacao_execucoes FROM anon, authenticated;

-- Publicacoes no canal (substitui a lista em sinc_config para deduplicar).
CREATE TABLE IF NOT EXISTS public.canal_publicacoes (
  id bigserial PRIMARY KEY,
  publicado_em timestamptz NOT NULL DEFAULT now(),
  chave text NOT NULL,            -- url do anuncio comparado | link de afiliado
  pedido_id bigint,
  tipo text,                      -- mesmo | parecido
  titulo text,
  preco numeric,
  economia_produto numeric,
  link text,
  message_id bigint,
  criterios text                  -- versao das regras usadas na escolha
);
CREATE INDEX IF NOT EXISTS canal_publicacoes_chave ON public.canal_publicacoes (chave, publicado_em DESC);
ALTER TABLE public.canal_publicacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canal_publicacoes FROM anon, authenticated;

-- Membros do canal por dia (Bot API getChatMemberCount).
CREATE TABLE IF NOT EXISTS public.canal_metricas (
  dia date PRIMARY KEY,
  membros integer,
  medido_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.canal_metricas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canal_metricas FROM anon, authenticated;

-- Cliques medidos no site (so com consentimento de analise, decidido no
-- navegador). Sem IP, sem id de visitante, sem cookie.
CREATE TABLE IF NOT EXISTS public.eventos_site (
  id bigserial PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,             -- clique_afiliado | clique_telegram
  origem text,                    -- resultado | vitrine | topo | home | ...
  destino text,                   -- canal | bot | loja
  pedido_id bigint,
  pagina text
);
CREATE INDEX IF NOT EXISTS eventos_site_dia ON public.eventos_site (criado_em DESC);
ALTER TABLE public.eventos_site ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eventos_site FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_evento(
  p_tipo text, p_origem text DEFAULT NULL, p_destino text DEFAULT NULL,
  p_pedido bigint DEFAULT NULL, p_pagina text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_tipo NOT IN ('clique_afiliado', 'clique_telegram') THEN RETURN false; END IF;
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

-- Liga/desliga da operacao (pausa administrativa) e segredo das chamadas
-- agendadas (gerado aqui; nunca sai do servidor).
INSERT INTO public.sinc_config (chave, valor) VALUES ('operacao_pausada', 'false')
ON CONFLICT (chave) DO NOTHING;
INSERT INTO public.sinc_config (chave, valor)
VALUES ('cron_segredo', md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text))
ON CONFLICT (chave) DO NOTHING;

-- Painel simples (leitura pelo servidor/consultas administrativas).
CREATE OR REPLACE VIEW public.painel_operacao AS
SELECT d.dia,
  (SELECT count(*) FROM public.pedidos_link p WHERE p.origem = 'site'
     AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS pedidos_site,
  (SELECT count(DISTINCT split_part(p.url_alvo, '?', 1)) FROM public.pedidos_link p WHERE p.origem = 'site'
     AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS produtos_site,
  (SELECT count(*) FROM public.pedidos_link p WHERE p.origem = 'site' AND p.status = 'pronto'
     AND jsonb_array_length(coalesce(p.analise->'outrasLojas', '[]')) > 0
     AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS com_mais_barata,
  (SELECT count(*) FROM public.eventos_site e WHERE e.tipo = 'clique_afiliado'
     AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS cliques_afiliado,
  (SELECT count(*) FROM public.eventos_site e WHERE e.tipo = 'clique_telegram'
     AND (e.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS cliques_telegram,
  (SELECT count(*) FROM public.canal_publicacoes c
     WHERE (c.publicado_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS publicacoes_canal,
  (SELECT m.membros FROM public.canal_metricas m WHERE m.dia = d.dia) AS membros_canal,
  (SELECT count(*) FROM public.telegram_chats t
     WHERE (t.primeiro_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS conversas_bot_novas
FROM (SELECT generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 29,
                             (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day')::date AS dia) d;
REVOKE ALL ON public.painel_operacao FROM anon, authenticated;
