# Atualizar a consulta de cupons

## Objetivo
Substituir a tabela por cards inspirados no Mercado Livre e tornar o teto real do desconto o principal destaque, sem criar dados.

## O que será feito
- Atualizar a leitura dos cupons para incluir `compra_min`, `teto` e `qualidade`.
- Trocar a tabela por uma grade responsiva de cards: um por linha no celular e dois no desktop.
- Exibir vencimento, desconto, vendedor, link de produtos, orçamento restante e selo de qualidade.
- Destacar armadilhas com selo e borda vermelhos; destacar bons cupons com selo verde.
- Abrir as condições em um modal acessível, com resumo de compra mínima, teto e desconto real para R$ 200.
- Montar no modal o texto oficial solicitado usando exclusivamente os campos do registro.
- Adicionar abas de qualidade, teto mínimo, compra máxima aceita e ordenação por maior teto.
- Preservar busca, filtros existentes, paginação, exportação CSV, tema claro/escuro e estado vazio.
- Aplicar datas e valores no padrão brasileiro em toda a tela.

## Detalhes técnicos
- O desconto real para R$ 200 será `min(200 × percentual, teto)` quando o cupom for percentual; para cupom em reais, será `min(valor, teto)`.
- Valores ausentes serão exibidos como “Não informado”, sem estimativas.
- O modal terá fechamento por X, clique no fundo e tecla Escape, com bloqueio de rolagem da página.
- Os tipos gerados do banco serão sincronizados com as novas colunas.

## Validação
- Conferir carregamento dos 187 registros e funcionamento combinado dos filtros.
- Verificar visual e modal em desktop e celular.
- Confirmar que a tela compila sem erros e que nenhuma chave foi adicionada.
