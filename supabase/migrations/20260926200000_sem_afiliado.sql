-- 1.107.0: a extensao marca o anuncio recusado pelo programa de afiliados
-- (semAfiliado, erro 111). SEMPRE o link de afiliado do Weslei (26/09): a
-- vitrine mostra como melhor oferta a mais barata com link PROPRIO (nem
-- semAfiliado, nem o mesmo link do anuncio colado). Desfaz a 20260926190000,
-- que levava o botao a um endereco sem afiliado.
-- O cadastro nao chama o gerador de novo para anuncio recusado ha menos de 24 h.
CREATE OR REPLACE FUNCTION public.registrar_produto_visto(p pedidos_link)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a jsonb := p.analise;
  v_chave text;
  v_titulo text := nullif(trim(a->>'titulo'), '');
  v_preco numeric := nullif(a->>'preco', '')::numeric;
  v_melhor jsonb;
  v_melhor_link text;
  v_economia numeric;
BEGIN
  IF p.status <> 'pronto' OR p.link IS NULL OR v_titulo IS NULL OR p.vendedor = '(so link)' THEN RETURN; END IF;
  IF NOT public.produto_permitido(v_titulo || ' ' || coalesce(a->>'categoria', '')) THEN RETURN; END IF;
  v_chave := upper(coalesce(
    substring(p.url_alvo from '(?i)item_id(?:%3A|:)(MLB[0-9]{6,})'),
    substring(p.url_alvo from '(?i)/p/(MLB[0-9]+)'),
    substring(p.url_alvo from '(?i)/up/(MLBU[0-9]+)'),
    replace(substring(p.url_alvo from '(?i)MLB-[0-9]{6,}'), '-', ''),
    md5(split_part(p.url_alvo, '?', 1))));
  IF jsonb_typeof(a->'outrasLojas') = 'array' THEN
    SELECT o INTO v_melhor
      FROM jsonb_array_elements(a->'outrasLojas') WITH ORDINALITY AS t(o, n)
     WHERE coalesce(o->>'link', '') <> '' AND o->>'link' <> p.link
       AND coalesce((o->>'semAfiliado')::boolean, false) = false
       AND coalesce((o->>'mesmaPagina')::boolean, false) = false
     ORDER BY n LIMIT 1;
  END IF;
  v_melhor_link := v_melhor->>'link';
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;

  INSERT INTO public.produtos_vistos AS pv
    (chave, titulo, imagem, categoria, loja, preco, url_produto, link,
     melhor_loja, melhor_preco, melhor_link, economia, lojas_comparadas, visto_em)
  VALUES
    (v_chave, v_titulo, a->>'imagem', a->>'categoria', a->>'vendedor', v_preco, p.url_alvo, p.link,
     v_melhor->>'vendedor', nullif(v_melhor->>'final', '')::numeric, v_melhor_link,
     CASE WHEN v_economia > 0 THEN v_economia END,
     coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'referencias') = 'array' THEN a->'referencias' END), 0)
       + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas' END), 0),
     coalesce(p.atendido_em, now()))
  ON CONFLICT (chave) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    imagem = coalesce(EXCLUDED.imagem, pv.imagem),
    categoria = coalesce(EXCLUDED.categoria, pv.categoria),
    loja = EXCLUDED.loja, preco = EXCLUDED.preco, url_produto = EXCLUDED.url_produto, link = EXCLUDED.link,
    melhor_loja = EXCLUDED.melhor_loja, melhor_preco = EXCLUDED.melhor_preco, melhor_link = EXCLUDED.melhor_link,
    economia = EXCLUDED.economia, lojas_comparadas = EXCLUDED.lojas_comparadas,
    vezes = pv.vezes + 1, visto_em = EXCLUDED.visto_em;

  IF v_preco IS NOT NULL THEN
    INSERT INTO public.precos_vistos (chave, loja, preco, visto_em)
    VALUES (v_chave, a->>'vendedor', v_preco, coalesce(p.atendido_em, now()));
  END IF;
END $function$;

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

-- Links de produto SEM teto diario (Weslei, 25/09: o teto era dos cupons).
-- Ficam o freio de captcha/trafego suspeito e o ritmo de um pedido por vez.
DELETE FROM public.limites WHERE chave = 'gerar_link_por_dia';

-- Cartoes da vitrine cuja melhor oferta nao era link proprio de afiliado
-- (link da ficha igual ao do anuncio colado, ou endereco sem afiliado):
-- recalcula pela regra acima, com o pedido mais recente do mesmo link.
UPDATE public.produtos_vistos pv
   SET melhor_loja = m.o->>'vendedor',
       melhor_preco = nullif(m.o->>'final', '')::numeric,
       melhor_link = m.o->>'link',
       economia = CASE WHEN pv.preco - nullif(m.o->>'final', '')::numeric > 0
                       THEN pv.preco - nullif(m.o->>'final', '')::numeric END
  FROM (SELECT DISTINCT ON (p.url_alvo) p.url_alvo, p.link,
               (SELECT o FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.analise->'outrasLojas') = 'array'
                                                        THEN p.analise->'outrasLojas' ELSE '[]'::jsonb END)
                                WITH ORDINALITY AS t(o, n)
                 WHERE coalesce(o->>'link', '') <> '' AND o->>'link' <> p.link
                   AND coalesce((o->>'semAfiliado')::boolean, false) = false
                   AND coalesce((o->>'mesmaPagina')::boolean, false) = false
                 ORDER BY n LIMIT 1) AS o
          FROM public.pedidos_link p
         WHERE p.status = 'pronto'
         ORDER BY p.url_alvo, p.id DESC) m
 WHERE m.url_alvo = pv.url_produto AND m.link = pv.link
   AND (pv.melhor_link = pv.link OR pv.melhor_link NOT LIKE 'https://meli.la/%');

-- Advocate (26/09): a economia da analise saiu contra o preco da API
-- (R$ 169,90), nao contra o da pagina (R$ 147,81). Corrigido no servidor
-- (mesmo-produto.ts usa o preco lido na pagina); aqui, o cartao ja gravado.
UPDATE public.produtos_vistos SET economia = 2.91
 WHERE chave = 'MLB5134275082' AND melhor_preco = 144.9 AND preco = 147.81;
