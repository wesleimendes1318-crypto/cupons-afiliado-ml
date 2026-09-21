# Cupom Afiliado ML

Crie um app web em português do Brasil chamado "Cupons Afiliado ML" para consultar cupons de afiliado do Mercado Livre.

IMPORTANTE: os dados virão de uma tabela Postgres chamada `cupons` que eu vou popular depois. Não invente dados fake, e trate o caso de tabela vazia com um estado vazio elegante.

Estrutura da tabela `cupons`:
- id (bigint, chave primária) — id do cupom
- vendedor (text) — nome da loja
- desconto (text) — ex: "40% OFF" ou "R$ 20 OFF"
- tipo (text) — "%" ou "R$"
- valor (numeric) — valor numérico do desconto
- orcamento (numeric) — orçamento restante em reais
- vence (date) — data de validade
- busca (text) — nome normalizado (minúsculo, sem acento, sem pontuação) para a busca

Tela única, sem login, com:

1. Cabeçalho amarelo (#ffe600) com o título e a data da última atualização dos dados.

2. Quatro cartões de indicadores no topo: total de cupons, vendedores distintos, maior desconto percentual, e quantos vencem em até 3 dias.

3. Campo de busca grande que filtra pela coluna `busca` conforme digita (debounce de 150ms). A busca deve normalizar o que o usuário digita da mesma forma: minúsculo, remover acentos, remover tudo que não é letra ou número. Assim "negocia tudo" encontra "NEGOCIATUDO". Aceitar vários termos separados por vírgula, funcionando como OU.

4. Filtros: tipo (todos / só % / só R$), desconto mínimo, orçamento mínimo, e ordenação (maior desconto, maior orçamento, vence antes, vendedor A-Z).

5. Tabela de resultados com colunas Desconto, Vendedor, Orçamento restante, Vence em. Paginação de 50 por página. O desconto em % aparece em verde e negrito. Quem vence em até 3 dias aparece em vermelho. O nome do vendedor é link para https://www.mercadolivre.com.br/perfil/NOME (com encodeURIComponent).

6. Botão para exportar o resultado filtrado em CSV com separador ponto e vírgula e BOM UTF-8, para abrir certo no Excel brasileiro.

7. Totalmente responsivo, funcionando bem no celular, já que vou consultar do telefone. Suporte a tema claro e escuro.

8. Rodapé curto avisando: "Fotografia dos cupons, não é tempo real. Cupom é campanha do vendedor e pode acabar antes da validade."

Visual limpo, estilo Mercado Livre (amarelo #ffe600 e azul #3483fa), tipografia legível, sem excesso de enfeite. Performance importa: a busca precisa responder instantaneamente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cupons-afiliado-ml.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3f97dce2-5c60-435b-a067-f15be15dbd4a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
