-- Vitrines em alta (Weslei, 09/10, noite): "priorizar itens que pagam
-- mais" (taxa de comissão do hub, PRIVADA, x preço ordena a fila do hub),
-- categorias próprias Eletrodomésticos e Ferramentas/EPI na vitrine e
-- no disparador do agente dos mais vendidos.
ALTER TABLE public.hub_recomendados ADD COLUMN IF NOT EXISTS comissao_pct numeric;

create or replace function public.registrar_hub(p_token text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  r record;
  v_gravados int := 0;
  v_fila int := 0;
  v_pedido bigint;
begin
  if p_token is null or p_token <> (select valor from public.sinc_config where chave = 'token') then
    raise exception 'token invalido';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then return jsonb_build_object('gravados', 0); end if;
  for r in
    select * from jsonb_to_recordset(p_itens) as x(
      item text, url text, titulo text, imagem text, preco numeric, preco_original numeric,
      desconto_pct int, mais_vendido boolean, avaliacao numeric, vendidos text, posicao int,
      comissao_pct numeric)
    limit 150
  loop
    continue when r.item is null or r.item !~ '^MLB[0-9]{6,}$' or coalesce(r.url, '') !~ '^https://(www|produto)\.mercadolivre\.com\.br/';
    insert into public.hub_recomendados as h
      (item, url, titulo, imagem, preco, preco_original, desconto_pct, mais_vendido, avaliacao, vendidos, posicao, comissao_pct, lido_em)
    values (r.item, r.url, left(r.titulo, 200), left(r.imagem, 400), r.preco, r.preco_original,
            r.desconto_pct, coalesce(r.mais_vendido, false), r.avaliacao, left(r.vendidos, 40), r.posicao,
            case when r.comissao_pct > 0 and r.comissao_pct <= 60 then r.comissao_pct end, now())
    on conflict (item) do update set
      url = excluded.url, titulo = coalesce(excluded.titulo, h.titulo), imagem = coalesce(excluded.imagem, h.imagem),
      preco = excluded.preco, preco_original = excluded.preco_original, desconto_pct = excluded.desconto_pct,
      mais_vendido = excluded.mais_vendido, avaliacao = excluded.avaliacao, vendidos = excluded.vendidos,
      posicao = excluded.posicao, comissao_pct = coalesce(excluded.comissao_pct, h.comissao_pct), lido_em = now();
    v_gravados := v_gravados + 1;
  end loop;
  -- Fila de comparação (Weslei, 09/10: "priorizar itens que pagam mais"):
  -- valor estimado da comissão (taxa x preço) primeiro; depois mais
  -- vendidos e maiores descontos. A taxa é privada: só esta função e o
  -- servidor a leem; nada público a devolve. Comissão nunca aprova
  -- produto: o site só mostra depois de comparado, pelas regras de sempre.
  for r in
    select item, url from public.hub_recomendados
     where lido_em > now() - interval '1 hour'
       and (enfileirado_em is null or enfileirado_em < now() - interval '48 hours')
       and (avaliacao is null or avaliacao >= 4.5)
     order by coalesce(comissao_pct, 0) * coalesce(preco, 0) desc, mais_vendido desc,
              coalesce(desconto_pct, 0) desc, posicao nulls last
     limit 10
  loop
    begin
      v_pedido := public.pedir_link_agente(r.url, 'hub');
      exit when v_pedido is null;
      update public.hub_recomendados set pedido_id = v_pedido, enfileirado_em = now() where item = r.item;
      v_fila := v_fila + 1;
    exception when others then
      null;
    end;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'enfileirados', v_fila);
end $f$;

CREATE OR REPLACE FUNCTION public.categoria_do_site(p_categoria text, p_titulo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_titulo,'') ~* '\mfraldas?\M' THEN 'outros'
    WHEN coalesce(p_titulo,'') ~* '(gift ?cards?|cart[aã]o (de )?presente|(nintendo|playstation|xbox|\mpsn\M|steam|razer|\mgame).*\(digital\))' THEN 'eletronicos'
    WHEN coalesce(p_titulo,'') ~* '^brinquedos?\M' THEN 'brinquedos'
    WHEN coalesce(p_titulo,'') ~* '(\mmalas?\M|\mmochilas?\M)' THEN 'moda'
    WHEN coalesce(p_titulo,'') ~* '(\mestilete\M|chaves? (de )?precis[aã]o|furadeira|parafusadeira|esmerilhadeira|\mepi\M|[oó]culos de (prote[cç][aã]o|seguran[cç]a)|luvas? (de )?seguran[cç]a|\mwago\M|termo ?retr[aá]til)' THEN 'ferramentas'
    WHEN coalesce(p_titulo,'') ~* '(guarda[- ]?chuvas?|\msombrinhas?\M|\mleques?\M|lancheira|bolsa (iso)?t[eé]rmica|\mmarmitas?\M|papel higi[eê]nico|percarbonato|tira manchas|lava roupas|\mpanos?\M|lumin[aá]ria|\mabajur\M)' THEN 'casa'
    WHEN coalesce(p_titulo,'') ~* '\mventilador' THEN 'eletrodomesticos'
    WHEN coalesce(p_titulo,'') ~* '(\mpresilhas?\M|\mxuxinhas?\M|piranhas? (de|para) cabelo|\mamarrador(es)?\M|\mtiaras?\M)' THEN 'beleza'
    WHEN coalesce(p_titulo,'') ~* '(power ?bank|carregador port[aá]til)' THEN 'celulares'
    WHEN coalesce(p_titulo,'') ~* '(\mssd\M|\mroteador)' THEN 'informatica'
    WHEN coalesce(p_titulo,'') ~* '(controles?\M.*\m(joystick|ps[1-5]|playstation|xbox|dualsense|dualshock|gamepad)\M|\mjoystick\M)' THEN 'eletronicos'
    WHEN coalesce(p_categoria,'') ~* 'brinquedo|hobbies|beb[eê]s' THEN 'brinquedos'
    WHEN coalesce(p_categoria,'') ~* 'celular|telefon' THEN 'celulares'
    WHEN coalesce(p_categoria,'') ~* 'inform[aá]tica|computa' THEN 'informatica'
    WHEN coalesce(p_categoria,'') ~* 've[ií]culo|autope|acess[oó]rios para ve' THEN 'automotivo'
    WHEN coalesce(p_categoria,'') ~* 'beleza|cuidado pessoal' THEN 'beleza'
    WHEN coalesce(p_categoria,'') ~* 'cal[cç]ados|roupas|bolsas|joias|rel[oó]gios' THEN 'moda'
    WHEN coalesce(p_categoria,'') ~* 'eletr[oô]nicos|[aá]udio|games|c[aâ]meras|televis' THEN 'eletronicos'
    WHEN coalesce(p_categoria,'') ~* 'eletrodom' THEN 'eletrodomesticos'
    WHEN coalesce(p_categoria,'') ~* 'ferramenta|seguran[cç]a (laboral|do trabalho)|constru' THEN 'ferramentas'
    WHEN coalesce(p_categoria,'') ~* 'casa|m[oó]veis|decora|jardim|limpeza' THEN 'casa'
    WHEN coalesce(p_titulo,'') ~* '(infantil|brinquedo|\mkids?\M|crian[cç]a|\mlego\M|boneca|pel[uú]cia|hot ?wheels|baby alive|barbie|playmobil|beyblade|squishy|quebra-?cabe[cç]a|controle remoto|\m(6|12) ?v\M.*(moto|carro|carrinho|kart|quadriciclo)|(moto|carro|carrinho|kart|quadriciclo).*\m(6|12) ?v\M)' THEN 'brinquedos'
    WHEN coalesce(p_titulo,'') ~* '(capinha|\mcapa\M.*(motorola|samsung|iphone|xiaomi|galaxy|redmi|edge|moto g)|smartphone|celular|pel[ií]cula|starlink)' THEN 'celulares'
    WHEN coalesce(p_titulo,'') ~* '(monitor|notebook|teclado|mouse|\mssd\M|roteador|impressora|pendrive|webcam)' THEN 'informatica'
    WHEN coalesce(p_titulo,'') ~* '(\mpneus?\M|automotiv|veicular|carro|motocicleta|\mmoto\M|farol|retrovisor|freio)' THEN 'automotivo'
    WHEN coalesce(p_titulo,'') ~* '(shampoo|condicionador|capilar|s[eé]runs?|hidratante|perfum|maquiagem|demaquilante|antirrugas|creme|protetor solar|esmalte|wella|oil reflections|alfaparf|tratamento c)' THEN 'beleza'
    WHEN coalesce(p_titulo,'') ~* '(t[eê]nis|camiseta|camisa|vestido|\mbolsa\M|sapato|sand[aá]lia|rel[oó]gio|jaqueta|cal[cç]a)' THEN 'moda'
    WHEN coalesce(p_titulo,'') ~* '(\mtv\M|televis|\mfone|caixa de som|smartwatch|c[aâ]mera|console|videogame|headset)' THEN 'eletronicos'
    WHEN coalesce(p_titulo,'') ~* '(air ?fryer|fritadeira|liquidificador|batedeira|cafeteira|micro-?ondas|geladeira|refrigerador|fog[aã]o|cooktop|lava-?lou[cç]as|m[aá]quina de lavar|aspirador|climatizador|purificador|sanduicheira|chaleira el[eé]trica|\mmixer\M|ferro de passar)' THEN 'eletrodomesticos'
    WHEN coalesce(p_titulo,'') ~* '(ferramenta|furadeira|parafusadeira|alicate|\mtrena\M|chave de fenda|esmerilhadeira|desempenadeira)' THEN 'ferramentas'
    WHEN coalesce(p_titulo,'') ~* '(travesseiro|colch|escorredor|cozinha|panela|toalha|\mcama\M|sof[aá]|\mmesa\M|cadeira|organizador|sapateira|arara|antimofo|desumidificador|[aá]gua perfumada|banco|lou[cç]a|limpeza|c[aâ]nfora|tira manchas|percarbonato|desempenadeira|ferramenta)' THEN 'casa'
    ELSE 'outros'
  END;
$function$;

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
     AND p_caminho !~ '^operacao\?tarefa=em_alta(&categoria=(eletronicos|celulares|informatica|casa|eletrodomesticos|ferramentas|moda|beleza|automotivo|brinquedos))?$'
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

