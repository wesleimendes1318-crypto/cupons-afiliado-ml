-- Vitrine: cada produto que alguem comparou no site vira um item da vitrine,
-- com foto, categoria, loja, preco visto e a melhor opcao encontrada. So o
-- que foi pesquisado de verdade (nada de varrer catalogo). Sem dado de quem
-- pesquisou. Preco sempre com a data em que foi visto.
CREATE TABLE IF NOT EXISTS public.produtos_vistos (
  chave text PRIMARY KEY,
  titulo text NOT NULL,
  imagem text,
  categoria text,
  loja text,
  preco numeric,
  url_produto text,
  link text,
  melhor_loja text,
  melhor_preco numeric,
  melhor_link text,
  economia numeric,
  lojas_comparadas integer,
  vezes integer NOT NULL DEFAULT 1,
  primeiro_em timestamptz NOT NULL DEFAULT now(),
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos_vistos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.precos_vistos (
  id bigserial PRIMARY KEY,
  chave text NOT NULL,
  loja text,
  preco numeric NOT NULL,
  visto_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS precos_vistos_chave ON public.precos_vistos (chave, visto_em DESC);
ALTER TABLE public.precos_vistos ENABLE ROW LEVEL SECURITY;

-- Categorias que o Google AdSense nao aceita na mesma pagina de anuncio:
-- ficam fora da vitrine mesmo que alguem pesquise.
CREATE OR REPLACE FUNCTION public.produto_permitido(p_texto text)
 RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(p_texto, '') !~* '(sexual|er[oó]tic|vibrador|masturba|lubrificante [ií]ntimo|preservativo|lingerie sensual|fantasia er|\marmas?\M|muni[cç][aã]o|pistola|rev[oó]lver|espingarda|carabina|airsoft|\mairgun|soco ingl[eê]s|cigarr|\mvape|pod descart|narguil|tabaco|\mfumo\M|seda para|rem[eé]dio|medicament|anabolizante|esteroide|cerveja|vodka|whisky|u[ií]sque|\mgin\M|cacha[cç]a|bebida alco|cannabis|canabidiol|\mcbd\M|maconha|aposta|cassino)';
$f$;

CREATE OR REPLACE FUNCTION public.registrar_produto_visto(p public.pedidos_link)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  a jsonb := p.analise;
  v_chave text;
  v_titulo text := nullif(trim(a->>'titulo'), '');
  v_preco numeric := nullif(a->>'preco', '')::numeric;
  v_melhor jsonb := CASE WHEN jsonb_typeof(a->'outrasLojas') = 'array' THEN a->'outrasLojas'->0 END;
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
  v_economia := CASE WHEN v_melhor IS NOT NULL THEN nullif(v_melhor->>'ganho', '')::numeric END;

  INSERT INTO public.produtos_vistos AS pv
    (chave, titulo, imagem, categoria, loja, preco, url_produto, link,
     melhor_loja, melhor_preco, melhor_link, economia, lojas_comparadas, visto_em)
  VALUES
    (v_chave, v_titulo, a->>'imagem', a->>'categoria', a->>'vendedor', v_preco, p.url_alvo, p.link,
     v_melhor->>'vendedor', nullif(v_melhor->>'final', '')::numeric, v_melhor->>'link',
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
END $f$;

CREATE OR REPLACE FUNCTION public.pedido_para_vitrine()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS DISTINCT FROM 'pronto') THEN
    BEGIN
      PERFORM public.registrar_produto_visto(NEW);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- a vitrine nunca pode derrubar o atendimento
    END;
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS pedido_para_vitrine ON public.pedidos_link;
CREATE TRIGGER pedido_para_vitrine AFTER UPDATE ON public.pedidos_link
  FOR EACH ROW EXECUTE FUNCTION public.pedido_para_vitrine();

-- Leitura publica da vitrine (ultimos 30 dias, so o permitido).
CREATE OR REPLACE FUNCTION public.vitrine(p_limite integer DEFAULT 60)
 RETURNS TABLE(chave text, titulo text, imagem text, categoria text, loja text, preco numeric,
               url_produto text, link text, melhor_loja text, melhor_preco numeric, melhor_link text,
               economia numeric, lojas_comparadas integer, vezes integer, visto_em timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT chave, titulo, imagem, categoria, loja, preco, url_produto, link, melhor_loja, melhor_preco,
         melhor_link, economia, lojas_comparadas, vezes, visto_em
    FROM public.produtos_vistos
   WHERE visto_em > now() - interval '30 days'
     AND public.produto_permitido(titulo || ' ' || coalesce(categoria, ''))
   ORDER BY visto_em DESC
   LIMIT greatest(1, least(coalesce(p_limite, 60), 120));
$f$;
GRANT EXECUTE ON FUNCTION public.vitrine(integer) TO anon, authenticated, service_role;
