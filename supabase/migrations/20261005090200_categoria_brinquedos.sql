-- BRINQUEDOS x AUTOMOTIVO (Weslei, 05/10: "diferencie automotivo de
-- brinquedos, cuidado para nao categorizar incorretamente"). A "Mini Moto
-- Eletrica Infantil" e o "Carrinho de controle remoto" (categoria Brinquedos
-- e Hobbies) caiam em automotivo pelo titulo. Agora: categoria do Mercado Livre
-- de brinquedos/bebes decide primeiro; no titulo, sinal infantil (infantil,
-- brinquedo, 6V/12V, controle remoto, boneca, lego...) vem antes da regra de
-- automotivo. Categoria nova "brinquedos" (pagina /categorias/brinquedos).
CREATE OR REPLACE FUNCTION public.categoria_do_site(p_categoria text, p_titulo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
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
