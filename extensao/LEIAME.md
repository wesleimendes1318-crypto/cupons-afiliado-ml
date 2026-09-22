# Cupons Afiliado ML

Extensão de Chrome que cruza, em tempo real, os anúncios que você está vendo com o índice
completo de cupons de afiliado da sua conta do Mercado Livre.

## Instalação (5 minutos, uma vez só)

1. Baixe a pasta `cupons-afiliado-ml` inteira para o seu computador
2. Abra o Chrome e vá em `chrome://extensions`
3. Ligue o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação** e escolha a pasta `cupons-afiliado-ml`
5. Fixe a extensão na barra (ícone de peça de quebra-cabeça → alfinete)

Pronto. Não tem chave de API para colar, nem agora nem nunca.

## Como usar

**Na busca do Mercado Livre**
Pesquise qualquer produto normalmente. A extensão resolve o vendedor de cada anúncio e:

- contorna de verde e coloca uma etiqueta nos anúncios de vendedor **com cupom**
- deixa esmaecidos os anúncios sem cupom
- mostra no rodapé: "3 de 48 anúncios são de vendedor com cupom"

É exatamente a pergunta que você fez: qual loja vende este produto **e** tem parceria de cupom.

**Na página de um produto**
Aparece um selo no canto inferior direito dizendo se aquele vendedor tem cupom, qual o desconto,
o orçamento restante e a validade. Some sozinho depois de 9 segundos, clique para reabrir.

**No ícone da extensão**
Busca livre no índice completo dos mais de 9.300 cupons: filtro por vendedor, por tipo de
desconto, valor mínimo, ordenação e exportação CSV.

## Como ele se mantém atualizado

- Índice completo baixado direto de `/affiliate-program/api/affiliates/coupons`, usando o seu
  próprio login (cookie de sessão). É a mesma chamada que a página faz, na mesma velocidade.
- Revalidação automática a cada 3 horas, mais um botão **Atualizar** para forçar na hora.
- O vendedor de cada anúncio fica em cache por 7 dias, então buscas repetidas ficam instantâneas.

## Por que extensão e não uma página HTML

Testado e confirmado: qualquer página fora do domínio do Mercado Livre é bloqueada por CORS ao
tentar ler a API de cupons ou as páginas de anúncio. Extensão é o único formato que o navegador
autoriza a usar a sua sessão logada. Não é preferência, é limite do navegador.

## Por que não usa API de IA

O trabalho aqui é cruzar dois conjuntos de nomes e comparar preços. Isso é determinístico: um
modelo de linguagem só acrescentaria custo por requisição, chave para gerenciar e chance de erro
inventado. Zero benefício. Se depois você quiser gerar descrição de post ou legenda de venda
a partir do produto, aí sim faz sentido plugar uma IA, e dá para acrescentar.

## Limites honestos

- A extensão lê o vendedor a partir do HTML da página do anúncio. Se o Mercado Livre mudar o
  layout, a leitura pode falhar. Nesse caso o anúncio aparece como "sem cupom" sem garantia.
  Sempre confirme no selo da página do produto antes de divulgar.
- Cupom é campanha do vendedor: ele pode encerrar ou esgotar o orçamento a qualquer momento.
- O índice mostra o cupom existente, não garante que ele cubra o produto específico. Confira as
  condições do cupom antes de prometer desconto para o comprador.

Verificado em 20/09/2026, com 9.307 cupons carregados em 32 segundos.

---

## v1.4 - aba "Link do cliente"

O cliente manda um link de anuncio. Voce cola na primeira aba e a extensao devolve
o MESMO produto com o seu link de afiliado, mais o cupom da loja se existir um que
valha a pena.

O que acontece quando voce clica em "Gerar meu link":

1. **Limpa a URL.** Tudo depois do `#` cai fora (nunca chega no servidor mesmo) e os
   parametros de rastreio de navegacao tambem. Ficam so `searchVariation`,
   `variation` e `quantity`, que mudam o que o cliente vai ver.
2. **Resolve encurtado.** Se o cliente mandou um `meli.la` de OUTRO afiliado, a
   extensao abre ate o anuncio original e regera no seu nome. Essa abertura e feita
   sem mandar o seu cookie, para nao registrar o clique na conta de quem criou
   aquele link.
3. **Identifica a loja** lendo so o comeco do HTML do anuncio, em streaming.
4. **Confere o cupom de verdade.** Busca as condicoes daquele cupom especifico
   (teto de desconto e compra minima) e calcula a economia real para o preco daquele
   produto. Cupom com teto baixo aparece marcado em vermelho e nao entra na mensagem
   pronta.
5. **Gera o link** no endpoint oficial do gerador de links, com a etiqueta
   `wesleimendes`.
6. **Se a loja nao tem cupom util**, procura o mesmo produto em lojas que tenham,
   e voce decide qual link gerar.

Precisa estar logado na sua conta de afiliado no mesmo navegador. E de onde vem a
sessao: nenhum servidor consegue fazer esse login sozinho.

### v1.4.1 - correcao do gerador de links

A primeira versao chamava o endpoint errado e sem autenticacao de formulario.
O contrato real, capturado da propria pagina do gerador:

```
POST /affiliate-program/api/v2/affiliates/createLink
     accept: application/json
     content-type: application/json
     x-csrf-token: <meta name="csrf-token" da pagina /afiliados/linkbuilder>
     corpo: {"urls": ["<url do anuncio>"], "tag": "wesleimendes"}
```

A resposta traz o link curto e tambem o **codigo de busca** (ex: `TG04KN-2TC8`),
que a pessoa pode colar direto no buscador do Mercado Livre quando o link nao
abre no aplicativo. A extensao agora entrega os dois.

O token do formulario e buscado da pagina do gerador com a sua sessao e fica
guardado por 15 minutos. Se o Mercado Livre recusar, a extensao busca um token
novo e tenta mais uma vez antes de desistir.

Gerar o link do mesmo produto duas vezes devolve sempre o mesmo `meli.la`,
entao nao existe risco de encher a conta de links repetidos.

### v1.4.2 - o POST precisa sair de dentro do site

A v1.4.1 ainda falhava com "recusou mesmo com token novo". A causa nao era o
token nem o tipo de link: o Mercado Livre valida a ORIGEM do POST. Saindo do
service worker da extensao, o navegador manda `Origin: chrome-extension://...`,
e esse cabecalho nao pode ser alterado por codigo. O site recusa.

Confirmado por teste: a mesma chamada, com o mesmo corpo, feita de dentro de uma
aba do Mercado Livre devolve 200. Inclusive para link de catalogo (`/up/MLBU...`).

Agora a extensao abre (ou reaproveita) uma aba do gerador em segundo plano e roda
a chamada la dentro, no contexto da pagina. Origem, Referer e token do formulario
ficam todos legitimos, igual a clicar no botao do site. Se a aba foi aberta pela
extensao, ela e fechada depois, inclusive quando da erro.

Por isso a v1.4.2 pede duas permissoes novas: `scripting` e `tabs`.

### v1.5.0 - a extensao atende pedidos do site

O site nao consegue, e nunca vai conseguir, gerar link de afiliado sozinho:
falta a sessao do Mercado Livre, e o POST precisa nascer dentro de uma pagina
do proprio site deles. Entao o trabalho foi dividido:

```
visitante cola o link no site
        -> site grava um pedido no banco (pedir_link)
        -> ESTA EXTENSAO, no seu navegador, pega o pedido (pedidos_pendentes)
           resolve vendedor, titulo, preco, acha o cupom, confere o teto real
           e gera o SEU link
        -> devolve tudo para o banco (atender_pedido)
        -> site mostra para o visitante
```

A extensao verifica a fila a cada minuto, e tambem assim que o navegador abre.
Enquanto o seu navegador estiver fechado, os pedidos ficam esperando, e depois
de 15 minutos o proprio banco marca como nao atendido. E por isso que vale a
pena deixar a extensao rodando num computador que fica ligado.

Precisa do token de sincronia preenchido nas opcoes da extensao.
