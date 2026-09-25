-- Vitrine organizada pelas categorias do proprio site e com o codigo de cupom
-- ja gerado da loja (quando existir), pronto para copiar.
CREATE OR REPLACE FUNCTION public.categoria_do_site(p_categoria text, p_titulo text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE
    WHEN coalesce(p_categoria,'') ~* 'celular|telefon' THEN 'celulares'
    WHEN coalesce(p_categoria,'') ~* 'inform[aá]tica|computa' THEN 'informatica'
    WHEN coalesce(p_categoria,'') ~* 've[ií]culo|autope|acess[oó]rios para ve' THEN 'automotivo'
    WHEN coalesce(p_categoria,'') ~* 'beleza|cuidado pessoal' THEN 'beleza'
    WHEN coalesce(p_categoria,'') ~* 'cal[cç]ados|roupas|bolsas|joias|rel[oó]gios' THEN 'moda'
    WHEN coalesce(p_categoria,'') ~* 'eletr[oô]nicos|[aá]udio|games|c[aâ]meras|televis' THEN 'eletronicos'
    WHEN coalesce(p_categoria,'') ~* 'casa|m[oó]veis|decora|eletrodom|ferramenta|constru|jardim|limpeza' THEN 'casa'
    WHEN coalesce(p_titulo,'') ~* '(capinha|\mcapa\M.*(motorola|samsung|iphone|xiaomi|galaxy|redmi|edge|moto g)|smartphone|celular|pel[ií]cula|starlink)' THEN 'celulares'
    WHEN coalesce(p_titulo,'') ~* '(monitor|notebook|teclado|mouse|\mssd\M|roteador|impressora|pendrive|webcam)' THEN 'informatica'
    WHEN coalesce(p_titulo,'') ~* '(\mpneus?\M|automotiv|veicular|carro|motocicleta|\mmoto\M|farol|retrovisor|freio)' THEN 'automotivo'
    WHEN coalesce(p_titulo,'') ~* '(shampoo|condicionador|capilar|s[eé]runs?|hidratante|perfum|maquiagem|demaquilante|antirrugas|creme|protetor solar|esmalte|wella|oil reflections|alfaparf|tratamento c)' THEN 'beleza'
    WHEN coalesce(p_titulo,'') ~* '(t[eê]nis|camiseta|camisa|vestido|\mbolsa\M|sapato|sand[aá]lia|rel[oó]gio|jaqueta|cal[cç]a)' THEN 'moda'
    WHEN coalesce(p_titulo,'') ~* '(\mtv\M|televis|\mfone|caixa de som|smartwatch|c[aâ]mera|console|videogame|headset)' THEN 'eletronicos'
    WHEN coalesce(p_titulo,'') ~* '(travesseiro|colch|escorredor|cozinha|panela|toalha|\mcama\M|sof[aá]|\mmesa\M|cadeira|organizador|sapateira|arara|antimofo|desumidificador|[aá]gua perfumada|banco|lou[cç]a|limpeza|c[aâ]nfora|tira manchas|percarbonato|desempenadeira|ferramenta)' THEN 'casa'
    ELSE 'outros'
  END;
$f$;

DROP FUNCTION IF EXISTS public.vitrine(integer);
CREATE FUNCTION public.vitrine(p_limite integer DEFAULT 60)
 RETURNS TABLE(chave text, titulo text, imagem text, categoria text, categoria_site text, loja text, preco numeric,
               url_produto text, link text, melhor_loja text, melhor_preco numeric, melhor_link text,
               economia numeric, lojas_comparadas integer, vezes integer, visto_em timestamptz,
               cupom_codigo text, cupom_desconto text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT pv.chave, pv.titulo, pv.imagem, pv.categoria, public.categoria_do_site(pv.categoria, pv.titulo),
         pv.loja, pv.preco, pv.url_produto, pv.link, pv.melhor_loja, pv.melhor_preco, pv.melhor_link,
         pv.economia, pv.lojas_comparadas, pv.vezes, pv.visto_em, cup.codigo_cupom, cup.desconto
    FROM public.produtos_vistos pv
    LEFT JOIN LATERAL (
      SELECT c.codigo_cupom, c.desconto
        FROM public.cupons c
       WHERE c.codigo_cupom IS NOT NULL
         AND public.normalizar_nome(c.vendedor) = public.normalizar_nome(
               CASE WHEN coalesce(pv.economia, 0) > 0 AND pv.melhor_loja IS NOT NULL THEN pv.melhor_loja ELSE pv.loja END)
         AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
         AND c.qualidade IS DISTINCT FROM 'armadilha'
       ORDER BY c.valor DESC NULLS LAST
       LIMIT 1
    ) cup ON true
   WHERE pv.visto_em > now() - interval '30 days'
     AND public.produto_permitido(pv.titulo || ' ' || coalesce(pv.categoria, ''))
   ORDER BY pv.visto_em DESC
   LIMIT greatest(1, least(coalesce(p_limite, 60), 120));
$f$;
GRANT EXECUTE ON FUNCTION public.vitrine(integer) TO anon, authenticated, service_role;

-- Fotos dos produtos que entraram na vitrine antes da extensao ler a foto:
-- a extensao pega poucos por rodada e completa.
CREATE OR REPLACE FUNCTION public.vitrine_sem_foto(p_token text, p_limite integer DEFAULT 5)
 RETURNS TABLE(chave text, url_produto text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  RETURN QUERY SELECT pv.chave, pv.url_produto FROM public.produtos_vistos pv
   WHERE pv.imagem IS NULL AND pv.url_produto IS NOT NULL AND pv.visto_em > now() - interval '30 days'
   ORDER BY pv.vezes DESC, pv.visto_em DESC
   LIMIT greatest(1, least(coalesce(p_limite, 5), 10));
END $f$;
GRANT EXECUTE ON FUNCTION public.vitrine_sem_foto(text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.vitrine_completar(p_token text, p_chave text, p_imagem text, p_categoria text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  UPDATE public.produtos_vistos
     SET imagem = coalesce(CASE WHEN p_imagem ~* '^https://[a-z0-9.-]*mlstatic\.com/' THEN p_imagem END, imagem, ''),
         categoria = coalesce(categoria, nullif(p_categoria, ''))
   WHERE chave = p_chave;
END $f$;
GRANT EXECUTE ON FUNCTION public.vitrine_completar(text, text, text, text) TO anon, authenticated, service_role;
