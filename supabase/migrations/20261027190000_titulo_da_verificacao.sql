-- Título da PÁGINA DE VERIFICAÇÃO do Mercado Livre (27/10): "Por segurança,
-- complete esta etapa" entrou como nome de produto colado e foi parar na
-- vitrine (24 produtos). produto_permitido é a trava da gravação
-- (registrar_produto_visto) e da leitura (vitrine e demais): com o título do
-- muro, o produto não entra nem aparece. Nenhum dado é apagado ou alterado.
-- Mesma regra de src/lib/titulo-desafio.ts e extensao/comparador.js.
CREATE OR REPLACE FUNCTION public.produto_permitido(p_texto text)
 RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(p_texto, '') !~* '(sexual|er[oó]tic|vibrador|masturba|lubrificante [ií]ntimo|preservativo|lingerie sensual|fantasia er|\marmas?\M|muni[cç][aã]o|pistola|rev[oó]lver|espingarda|carabina|airsoft|\mairgun|soco ingl[eê]s|cigarr|\mvape|pod descart|narguil|tabaco|\mfumo\M|seda para|rem[eé]dio|medicament|anabolizante|esteroide|cerveja|vodka|whisky|u[ií]sque|\mgin\M|cacha[cç]a|bebida alco|cannabis|canabidiol|\mcbd\M|maconha|aposta|cassino)'
     AND coalesce(p_texto, '') !~* '^\s*(por seguran.a,? complete esta etapa|confirme que voc. n.o . um rob.|verifica..o de seguran.a|robot check|just a moment|attention required|access denied|acesso negado)';
$f$;
