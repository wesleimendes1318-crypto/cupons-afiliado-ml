# Verificação de build e publicação (nenhum código alterado)

## Resultado
- Build: nenhum erro registrado. O código atual (f43f8e4 + c90973a "Work in progress") não contém mais `escolhido=` em lugar nenhum.
- Site no ar: testei agora (24/09, 13:4x UTC) a rota `/api/public/mesmo-produto` em cupons-afiliado-ml.lovable.app e a trilha já sai no formato novo: `titulo 200 resultados=10 aceitos=... escolhidos=MLB20271308,...`. Ou seja, a versão publicada já tem o código novo de `src/lib/mesmo-produto.ts` (a partir de 4a7f20e).
- O hash exato do commit publicado não é exposto pelas ferramentas; pelo comportamento, é f43f8e4 ou posterior.

## Provável motivo de ainda ver "escolhido="
- Comparações gravadas por 6 horas na tabela `comparacoes` (cache): resultados antigos com `procurou: true` voltam com `cache: true` e a trilha velha até expirar.
- Ou a extensão/aba mostrando resposta anterior.

## Observação sobre o teste
O produto de catálogo foi escolhido pelo nome e pegou capas de outros modelos (iPhone 14, Moto E22...), e sem o preço do anúncio a comparação parou em "não consegui o preço do anúncio". Isso é regra de comparação, não build — só corrijo se você pedir.

## Próximo passo (opcional, só com sua aprovação)
Limpar o cache de comparações antigas para que todas as respostas saiam com a trilha nova.
