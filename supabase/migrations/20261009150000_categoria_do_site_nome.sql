-- Categoria certa na vitrine (Weslei, 09/10: "está colocando produtos em
-- categorias incorretas"). A árvore do Mercado Livre põe guarda-chuva e
-- leque em Moda, panos em Acessórios para Veículos, papel higiênico e
-- percarbonato em Beleza, gift card em Informática e fralda em Bebês
-- (que o site lia como Brinquedos). Estes casos agora são decididos pelo
-- NOME antes da árvore; o resto da função continua igual
-- (src/lib/categoria-em-alta.ts usa as mesmas regras nos Mais vendidos).
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
    WHEN coalesce(p_titulo,'') ~* '(guarda[- ]?chuvas?|\msombrinhas?\M|\mleques?\M|lancheira|bolsa (iso)?t[eé]rmica|\mmarmitas?\M|papel higi[eê]nico|percarbonato|tira manchas|lava roupas|\mpanos?\M|\mventilador|lumin[aá]ria|\mabajur\M)' THEN 'casa'
    WHEN coalesce(p_titulo,'') ~* '(\mpresilhas?\M|\mxuxinhas?\M|piranhas? (de|para) cabelo)' THEN 'beleza'
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
    WHEN coalesce(p_categoria,'') ~* 'casa|m[oó]veis|decora|eletrodom|ferramenta|constru|jardim|limpeza' THEN 'casa'
    WHEN coalesce(p_titulo,'') ~* '(infantil|brinquedo|\mkids?\M|crian[cç]a|\mlego\M|boneca|pel[uú]cia|hot ?wheels|baby alive|barbie|playmobil|beyblade|squishy|quebra-?cabe[cç]a|controle remoto|\m(6|12) ?v\M.*(moto|carro|carrinho|kart|quadriciclo)|(moto|carro|carrinho|kart|quadriciclo).*\m(6|12) ?v\M)' THEN 'brinquedos'
    WHEN coalesce(p_titulo,'') ~* '(capinha|\mcapa\M.*(motorola|samsung|iphone|xiaomi|galaxy|redmi|edge|moto g)|smartphone|celular|pel[ií]cula|starlink)' THEN 'celulares'
    WHEN coalesce(p_titulo,'') ~* '(monitor|notebook|teclado|mouse|\mssd\M|roteador|impressora|pendrive|webcam)' THEN 'informatica'
    WHEN coalesce(p_titulo,'') ~* '(\mpneus?\M|automotiv|veicular|carro|motocicleta|\mmoto\M|farol|retrovisor|freio)' THEN 'automotivo'
    WHEN coalesce(p_titulo,'') ~* '(shampoo|condicionador|capilar|s[eé]runs?|hidratante|perfum|maquiagem|demaquilante|antirrugas|creme|protetor solar|esmalte|wella|oil reflections|alfaparf|tratamento c)' THEN 'beleza'
    WHEN coalesce(p_titulo,'') ~* '(t[eê]nis|camiseta|camisa|vestido|\mbolsa\M|sapato|sand[aá]lia|rel[oó]gio|jaqueta|cal[cç]a)' THEN 'moda'
    WHEN coalesce(p_titulo,'') ~* '(\mtv\M|televis|\mfone|caixa de som|smartwatch|c[aâ]mera|console|videogame|headset)' THEN 'eletronicos'
    WHEN coalesce(p_titulo,'') ~* '(travesseiro|colch|escorredor|cozinha|panela|toalha|\mcama\M|sof[aá]|\mmesa\M|cadeira|organizador|sapateira|arara|antimofo|desumidificador|[aá]gua perfumada|banco|lou[cç]a|limpeza|c[aâ]nfora|tira manchas|percarbonato|desempenadeira|ferramenta)' THEN 'casa'
    ELSE 'outros'
  END;
$function$;
