# Estratégia sazonal 2026 (Dia das Crianças, Black Friday, Natal)

Pedido do Weslei (05/10): "use estratégias sazonais, em breve haverá Natal".
Calendário no código: `src/lib/sazonal.ts` (datas no horário de Brasília).
A temporada só muda PRIORIDADE e rótulo; as regras de economia (>= R$ 30 no
produto), qualidade equivalente, frete e link de afiliado continuam iguais.
Nada de desconto inventado nem prazo de entrega prometido.

| Temporada | Janela | Data | Categorias extras na coleta | Foco |
|---|---|---|---|---|
| 🧸 Dia das Crianças | 28/09 – 12/10 | 12/10 | Brinquedos e Hobbies (MLB1132) | Brinquedos, jogos, consoles |
| 🖤 Black Friday | 01/11 – 30/11 | 27/11 | Eletrônicos (MLB1000), Informática (MLB1648) | Eletrônicos e eletrodomésticos de ticket alto |
| 🎄 Natal | 15/11 – 24/12 | 25/12 | Brinquedos (MLB1132), Eletrônicos (MLB1000) | Presentes: brinquedos, perfumes/kits de beleza, fones, relógios, esporte |

## O que muda automaticamente

1. **Coleta de mercado (07:33):** durante a temporada, até 2 categorias a
   mais (termos em alta e mais vendidos), marcadas com `extra.temporada`.
2. **Preparo (07:41 e 17:41):** produto que combina com a temporada ganha
   50% a mais na nota para ser comparado de novo primeiro.
3. **Garimpo do canal (08:47 e 18:47):** mesma prioridade; o post ganha a
   linha "🧸 Para o Dia das Crianças" / "🖤 Black Friday: preço conferido" /
   "🎄 Ideia de presente de Natal".
4. **Vitrine do site:** seção da temporada (2 a 5 produtos já comparados que
   combinam com a data, maior economia primeiro).
5. **Acompanhar preço:** até 60 dias antes da Black Friday, o convite diz
   "Black Friday em N dias? Eu acompanho o preço até lá e você vê se o
   desconto é de verdade". No Natal e no Dia das Crianças, "Presente de ...?
   Eu acompanho o preço e mostro quando cair".

## Táticas por fase (hipóteses a medir)

- **Até 12/10 — Dia das Crianças:** garimpo de brinquedos já comparados e
  dos mais vendidos de Brinquedos. Medir: posts com o rótulo x cliques.
- **Outubro — pré-Black Friday:** o diferencial do site é o histórico de
  preço ("Acompanhar preço"). Convidar a acompanhar AGORA para provar, na
  Black Friday, se o desconto é real. Guia a escrever: "Como saber se o
  desconto da Black Friday é de verdade" (com exemplos reais do histórico).
- **Novembro — Black Friday:** priorizar eletrônicos e eletrodomésticos de
  ticket alto (onde a economia passa de R$ 30 com mais frequência; ver
  relatório de 05/10). Canal: 2 posts por rodada continuam o limite.
- **15/11 a 24/12 — Natal:** presentes por faixa de preço (até R$ 100, até
  R$ 300) só com produtos realmente comparados. Guia a escrever: "Presentes
  de Natal: o mesmo produto mais barato em outra loja" (dados reais).

## Medição

Rótulo da temporada nos destaques do garimpo (`temporada` em
operacao_execucoes.resumo), cliques em eventos_site (só com consentimento),
membros do canal em canal_metricas. Revisar no relatório semanal.
