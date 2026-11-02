# Investigação completa + layout limpo (melhorescolha.io)

Objetivo: site leve, claro e que converte, com a garantia de que toda compra termina no link de afiliado do Weslei e que a indicação é sempre o mesmo produto (ou qualidade igual/superior) com menor custo final (produto + frete).

## Fase 1 — Auditoria real (sem mudar nada)
Medir antes de mexer, para não gastar esforço no lugar errado.
- Abrir o site em celular (390 px) e PC (1440 px): home, resultado de uma comparação real, link da Amazon/Shopee, busca por texto, categoria, /brinquedos, /natal, /meus-precos. Captura de tela de cada uma.
- Contar em cada tela: quantos blocos, botões e cores competem; o que aparece antes da primeira dobra.
- Rodar todos os testes do projeto e o Guardião (auditoria de exibição).
- Varredura do link de afiliado: todo botão "Comprar com segurança" em todas as telas precisa levar a meli.la / Amazon com a tag / Shopee afiliado, ou gerar no clique. Qualquer exceção vira correção prioritária.
- Conferir as regras centrais com casos reais: frete pago desconhecido nunca vence; "menor preço" nunca é mais caro que o original; parecido de qualidade inferior nunca vira recomendação.
- Entrega: relatório curto com a lista de problemas por gravidade (grave = perde link/indica errado; médio = confuso; leve = estético).

## Fase 2 — Correções de funcionamento (graves primeiro)
- Tudo que a auditoria achar que quebra o link de afiliado ou a indicação correta.
- Um teste novo para cada regra corrigida, para não voltar.

## Fase 3 — Layout leve (inspiração: Apple, Google Shopping, apps de comparação)
Princípio: uma decisão por tela, detalhes sob demanda.

Home (hoje ~10 seções empilhadas):
```text
Topo: título + caixa do link/busca (só isso acima da dobra no celular)
3 passos (animação já pedida)
1 vitrine principal com abas (Para você · Mais vendidos · Temporada)
Categorias em grade compacta
Faixa única: Acompanhar preço + Telegram
Rodapé
```
Recomendações personalizadas, sazonal e mais vendidos viram abas de uma vitrine só, não blocos separados.

Resultado da comparação:
```text
1. Seu produto (compacto) -> 2. Veredito grande: "R$ X a menos, já com frete" + botão
3. Por que é a melhor (3 linhas com check)
4. Outras lojas (lista) | Parecidos (carrossel) -- abrem em "Ver mais"
5. 3 marketplaces sob demanda
```
- Menos bordas e selos: no máximo 2 selos por cartão; cores só para dinheiro (verde) e alerta (vermelho/âmbar).
- Números sempre na mesma posição e tamanho; frete sempre em linha própria.
- Movimento sutil: entrada suave das seções, troca de abas deslizando, "Ver mais" expandindo; tudo desligado em "reduzir movimento".
- Cartão de produto único em todo o site (vitrine, busca, categoria, parecidos) com foto que abre o carrossel.

## Fase 4 — Validação final
- Repetir as capturas da Fase 1 (antes x depois) em 320/390/768/1024/1440 px; largura sem vazamento.
- Testes todos verdes; varredura de afiliado repetida: zero botão sem link dele.
- Bateria de testes reais (capinha, Eudora, disco de freio, pista dinossauro).

## Detalhes técnicos
- BuscaPorLink.tsx (6.8k linhas) e index.tsx (3.7k) serão divididos em partes menores por seção (Veredito, ListaLojas, Parecidos, HomeVitrine) sem mudar regras: as regras continuam em src/lib (decisaoDaTela, recomendacao-segura, afiliado, qualidade).
- Teste novo de afiliado: percorre os componentes de compra e falha se algum href não passar em ehLinkDeCompra.
- Playwright para medir scrollWidth e contar elementos acima da dobra.
- Nada no banco do Lovable (regra de 23/10); só leitura no Supabase próprio, se necessário.

Ordem de execução: 1 → 2 → 3 → 4. Fase 3 pode ser feita em duas entregas (Resultado primeiro, Home depois) para você ver a mudança mais cedo.
