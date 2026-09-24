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

### v1.39.0 - etiquetas de volta, pagina da loja e comparacao de lojas

- **Etiquetas**: a criacao do codigo manda o `x-csrf-token` (sem ele o Mercado
  Livre passou a responder 403 depois do captcha de 23/09), recarrega a aba do
  gerador uma vez quando o token vence e tenta um sufixo alternativo se o texto
  ja existir. O resultado de cada rodada fica no banco em `sinc_config`,
  chave `etiqueta_ultima`. Captcha lendo anuncio nao segura mais a janela de
  etiquetas.
- **Pagina da loja**: o botao do cupom no site pede a pagina da loja
  (`pedir_loja`). A extensao abre um anuncio do vendedor (pela lista da
  campanha), le o endereco da loja, confere que tem produto e grava em
  `link_loja`. Uma vez por loja; vale para todos os cupons dela.
- **Mesmo produto em outra loja**: a comparacao nunca achava nada porque o
  titulo perdia os espacos antes de ser comparado. Corrigido em
  `comparador.js`, com testes (`node --test extensao/testes/comparador.test.mjs`).
  Agora devolve ate 2 lojas (mais barata, ou com cupom quando a loja do cliente
  nao tem), cada uma com link de afiliado.

### v1.40.0 - resolver a verificacao na mao

Quando o Mercado Livre pede captcha, o popup mostra a pausa e dois botoes:
**1. Resolver verificacao** abre a pagina exata do desafio; assim que ela sai do
captcha a pausa cai sozinha e a fila anda na hora. **2. Ja resolvi, liberar**
solta a pausa manualmente. A extensao continua sem tentar resolver captcha.

### v1.41.0 - aviso na hora quando o Mercado Livre pede verificacao

- "!" vermelho no icone enquanto houver pausa;
- notificacao do Chrome no computador: clicar abre a pagina da verificacao;
- opcional, no celular: app gratuito **ntfy**. Assine um topico com nome dificil
  de adivinhar e cole o mesmo nome em Opcoes > "Aviso no celular".
Resolvida a verificacao, a pausa cai sozinha e o aviso some.

### v1.42.0 - menos leitura automatica, menos captcha

O captcha de 23/09 travou etiqueta, pagina da loja e comparacao por horas. A
leitura que mais provoca isso e a marcacao de cupons numa busca do Mercado
Livre: eram 14 anuncios lidos em paralelo, sem pausa. Agora sao 3 por vez com
pausa, e nada e lido enquanto a leitura estiver em pausa de seguranca. Os tetos
diarios de fundo cairam (vitrines 250 -> 100, lojas 200 -> 60): tarefa de fundo
e melhoria, cliente esperando na tela e venda.

### v1.43.0 - no maximo um download da lista a cada 3 horas

O banco registrou 67 downloads completos da lista de cupons em 22/09 e 41 em
23/09 (cada um ~665 chamadas ao hub). Agora: 2 paginas por vez com pausa, e
nenhum download novo antes de 3 horas do ultimo - nem ao recarregar a
extensao, nem clicando Atualizar/Sincronizar.

### v1.44.0 - cadastro de tudo que e gerado (tabela `geracoes`)

Antes de criar qualquer coisa no Mercado Livre (link de afiliado, etiqueta,
link de vitrine), a extensao consulta o cadastro no banco:
- ja existe: reaproveita e nao chama o Mercado Livre;
- etiqueta com tentativa anterior sem resposta: NAO tenta de novo (codigo e
  permanente); conferir em "Administrar etiquetas";
- teto do dia (`limites`: gerar_link_por_dia, gerar_etiqueta_por_dia,
  gerar_link_vitrine_por_dia) ou `pausa_geral = 1`: nao cria nada;
- banco fora do ar: nao cria (na duvida, nao gera).
Precisa da migracao `supabase/migrations/20260924010000_cadastro_de_geracoes.sql`
aplicada no banco ANTES de instalar.

### v1.45.0 - uma carga de cupons por dia

A lista de cupons (os que entram e os que saem) carrega 1 vez por dia, a partir
das 10:00 de Brasilia. Com o computador desligado nessa hora, carrega assim que
ligar, ate as 21:00. Etiquetas deixam de ser criadas em lote: so quando um
cliente pede no site.

### v1.46.0 - comparacao de lojas pela API oficial, fora da sua conta

A busca do mesmo produto em outras lojas agora e feita pelo SERVIDOR do site
(`/api/public/mesmo-produto`), com a API oficial do Mercado Livre e cache de 6
horas por produto. A extensao nao le pagina nenhuma para comparar: so gera o
link de afiliado das ate 2 opcoes escolhidas (passando pelo cadastro).
A leitura de paginas com a sua sessao ficou como reserva DESLIGADA
(`LEITURA_RESERVA_POR_DIA = 0`).
Requer, nos Secrets do Lovable, as credenciais de um aplicativo criado em
developers.mercadolivre.com.br: `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e, se
necessario, `ML_REFRESH_TOKEN`.

### v1.47.0 - comparacao so pelo que a API oficial permite

Medido com a conta do Weslei em 24/09/2026: `/products/{catalogo}/items`
responde (outras lojas do mesmo produto); `/items/{id}` de outra conta e
`/sites/MLB/search` respondem 403. A comparacao automatica vale para produto
de CATALOGO. A extensao manda ao servidor o catalogo, o preco e a loja que ja
leu na pagina colada pelo cliente.

### v1.48.0 - link de compartilhamento de afiliado (meli.la que abre o perfil)

O meli.la do "Compartilhar" de afiliado abre o perfil social com o produto em
destaque. A extensao agora procura esse produto no endereco (inclusive em
parametro codificado) ou na pagina, SO quando ele aparece sem ambiguidade, e
segue para o anuncio. Sem certeza, pede o link do produto. E nenhum link e
gerado quando o anuncio nao foi lido (antes, devolvia o proprio meli.la colado,
que podia ser de outro afiliado).

### v1.49.0 - comparacao tambem para anuncio fora do catalogo

Para anuncio /up/MLBU... ou produto.mercadolivre.com.br/MLB-..., o servidor
tenta achar o produto de catalogo correspondente pela API oficial:
`/user-products/{id}` (ligacao direta) e `/products/search` (busca no catalogo
pelo nome do anuncio). Achando, compara as lojas desse produto. Quando o
catalogo foi achado pelo nome, o site avisa o cliente que e um palpite forte.
A resposta de cada endereco fica gravada em `comparacoes.resposta.trilha`.

### v1.50.0 - comparacao pela identidade do produto, qualquer que seja o link

O produto e identificado pelo que ele E, nao pelo tipo de link colado. A
extensao le na pagina do anuncio (a que o cliente pediu) o codigo de barras
(GTIN/EAN, com digito verificador conferido), a marca, o modelo e o catalogo
citado. O servidor procura, pela API oficial, na ordem: catalogo do link,
catalogo ligado ao produto do vendedor, catalogo da pagina (so se a lista de
ofertas contem o proprio anuncio), codigo de barras, marca+modelo e titulo.
Os tres primeiros e o codigo de barras sao exatos; marca+modelo e titulo sao
avisados ao cliente como palpite forte.
