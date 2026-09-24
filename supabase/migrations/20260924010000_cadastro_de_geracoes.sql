-- Cadastro unico de tudo que a extensao cria no Mercado Livre (24/09/2026).
--
-- Pedido do Weslei: "uma base que cadastra tudo que foi gerado, link do
-- cliente, etiquetas ja emitidas; a extensao sempre deve consultar para nao
-- gerar nada que ja foi gerado e nem infringir as regras do Mercado Livre".
--
-- Como funciona:
--   reservar_geracao  -> a extensao pergunta ANTES de criar. Respostas:
--       existe     : ja foi gerado, devolve o resultado (nao chama o ML)
--       reservado  : pode criar agora (fica 'pendente' ate concluir)
--       bloqueado  : pausa geral, teto do dia, ou tentativa anterior sem
--                    resposta (etiqueta e permanente: nao se arrisca duplicar)
--   concluir_geracao  -> grava o resultado (ok) ou o erro.
--
-- Tipos: 'link' (link de afiliado de produto, chave = URL limpa),
--        'etiqueta' (codigo do cupom, chave = id do cupom),
--        'link_vitrine' (link de afiliado da campanha, chave = id do cupom).

CREATE TABLE IF NOT EXISTS public.geracoes (
  tipo          text NOT NULL CHECK (tipo IN ('link', 'etiqueta', 'link_vitrine')),
  chave         text NOT NULL,
  status        text NOT NULL CHECK (status IN ('pendente', 'ok', 'erro')),
  resultado     text,
  meta          jsonb,
  erro          text,
  tentativas    integer NOT NULL DEFAULT 1,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, chave)
);
CREATE INDEX IF NOT EXISTS geracoes_dia ON public.geracoes (tipo, criado_em);
ALTER TABLE public.geracoes ENABLE ROW LEVEL SECURITY;  -- so as funcoes abaixo mexem

-- pausa_geral: 1 = nada novo e criado no Mercado Livre
INSERT INTO public.limites (chave, valor)
SELECT v.chave, v.valor
  FROM (VALUES ('pausa_geral', 0), ('gerar_link_por_dia', 250),
               ('gerar_link_vitrine_por_dia', 60), ('gerar_etiqueta_por_dia', 250)) AS v(chave, valor)
 WHERE NOT EXISTS (SELECT 1 FROM public.limites l WHERE l.chave = v.chave);

CREATE OR REPLACE FUNCTION public.reservar_geracao(p_token text, p_tipo text, p_chave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g public.geracoes%ROWTYPE;
  v_pausa int; v_teto int; v_hoje int; v_inicio timestamptz;
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF p_tipo NOT IN ('link', 'etiqueta', 'link_vitrine') OR coalesce(btrim(p_chave), '') = '' THEN
    RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'pedido invalido');
  END IF;

  SELECT * INTO g FROM public.geracoes WHERE tipo = p_tipo AND chave = p_chave FOR UPDATE;

  -- 1. Ja gerado: devolve, nunca gera de novo.
  IF FOUND AND g.status = 'ok' THEN
    RETURN jsonb_build_object('status', 'existe', 'resultado', g.resultado, 'meta', g.meta);
  END IF;

  -- 2. Tentativa anterior sem resposta. Etiqueta e permanente no Mercado
  --    Livre: pode ter sido criada e a resposta se perdido. Nao arrisca
  --    duplicar; fica para conferencia manual em "Administrar etiquetas".
  --    Link e seguro repetir (o ML devolve o mesmo meli.la), depois de 2 min.
  IF FOUND AND g.status = 'pendente' THEN
    IF p_tipo = 'etiqueta' THEN
      RETURN jsonb_build_object('status', 'bloqueado',
        'motivo', 'tentativa anterior sem resposta: conferir em Administrar etiquetas');
    END IF;
    IF g.atualizado_em > now() - interval '2 minutes' THEN
      RETURN jsonb_build_object('status', 'bloqueado', 'motivo', 'geracao em andamento');
    END IF;
  END IF;

  -- 3. Pausa geral e teto do dia (dia de Sao Paulo).
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

  -- 4. Reserva.
  INSERT INTO public.geracoes (tipo, chave, status)
  VALUES (p_tipo, p_chave, 'pendente')
  ON CONFLICT (tipo, chave) DO UPDATE
     SET status = 'pendente', erro = NULL, tentativas = public.geracoes.tentativas + 1,
         atualizado_em = now();
  RETURN jsonb_build_object('status', 'reservado');
END $function$;

CREATE OR REPLACE FUNCTION public.concluir_geracao(p_token text, p_tipo text, p_chave text,
                                                   p_resultado text, p_erro text, p_meta jsonb DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  IF coalesce(btrim(p_resultado), '') <> '' THEN
    INSERT INTO public.geracoes (tipo, chave, status, resultado, meta)
    VALUES (p_tipo, p_chave, 'ok', p_resultado, p_meta)
    ON CONFLICT (tipo, chave) DO UPDATE
       SET status = 'ok', resultado = excluded.resultado,
           meta = coalesce(excluded.meta, public.geracoes.meta), erro = NULL, atualizado_em = now();
  ELSE
    -- Erro com resposta clara do Mercado Livre (nada foi criado): libera para
    -- tentar outro dia. Sem resposta, a extensao simplesmente nao chama isto,
    -- e a linha fica 'pendente' (bloqueada para etiqueta).
    UPDATE public.geracoes SET status = 'erro', erro = left(p_erro, 300), atualizado_em = now()
     WHERE tipo = p_tipo AND chave = p_chave AND status <> 'ok';
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.reservar_geracao(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.concluir_geracao(text, text, text, text, text, jsonb) TO anon, authenticated, service_role;

-- Carga inicial com o que ja existe.
INSERT INTO public.geracoes (tipo, chave, status, resultado, criado_em, atualizado_em)
SELECT 'etiqueta', id::text, 'ok', codigo_cupom, coalesce(codigo_em, now()), coalesce(codigo_em, now())
  FROM public.cupons WHERE codigo_cupom IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.geracoes (tipo, chave, status, resultado, criado_em, atualizado_em)
SELECT 'link_vitrine', id::text, 'ok', link_afiliado, coalesce(link_em, now()), coalesce(link_em, now())
  FROM public.cupons WHERE link_afiliado IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.geracoes (tipo, chave, status, resultado, meta, criado_em, atualizado_em)
SELECT DISTINCT ON (split_part(url_alvo, '#', 1))
       'link', split_part(url_alvo, '#', 1), 'ok', link,
       jsonb_build_object('codigo', codigo, 'pedido', id), criado_em, coalesce(atendido_em, criado_em)
  FROM public.pedidos_link
 WHERE status = 'pronto' AND link ~ '^https://meli\.la/'
 ORDER BY split_part(url_alvo, '#', 1), criado_em DESC
ON CONFLICT DO NOTHING;
