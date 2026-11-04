# visual-e-texto (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Copy, brand, Apple-style visual, mobile width/zoom, home, photos, navigation, desktop, liquid glass.

## Texto e visual
- Botão de compra NUNCA leva o nome da loja: usar texto de compra segura
  ("Comprar com segurança"). Sempre oferecer compartilhar no WhatsApp.
- Nunca parecer ferramenta DO Mercado Livre (Weslei, 27/09): o site compara os
  produtos que estão lá. Título: "Melhor Escolha: compare preços de produtos
  vendidos no Mercado Livre" (não "comparador de preços do Mercado Livre").
- MENSAGEM ÚNICA do site (Weslei, 27/09: "todo site precisa estar coeso"):
  "Cole o link do produto. Eu mostro o mesmo produto em outras lojas dentro do
  Mercado Livre, do mais barato ao mais caro e com a loja oficial (quando
  houver). Confiro pela foto, descrição e características para encontrar o
  mesmo produto. Parecidos aparecem separados, com a descrição do que muda."
  Topo, perguntas, Sobre, guias, divulgação, rodapé e títulos de busca dizem
  isso. Comissão: "do programa de afiliados" (não "do vendedor").
- "Mercado Livre" só de forma DESCRITIVA e com moderação (Weslei, 26/09, para
  a busca no Google), sempre com o
  aviso de site independente, sem vínculo. Nunca logo, cores ou visual da marca,
  nem em botão de compra.
- Melhor escolha em destaque (Weslei, 27/09): 🔥 em movimento no selo da
  tabela e na recomendação; o botão da recomendação com animação que passa
  SEGURANÇA (Weslei, 27/09): brilho verde que respira devagar + reflexo de luz
  de vez em quando + escudo ✓, nada de pulsar (animate-fogo,
  animate-botao-destaque; desligam com prefers-reduced-motion).
- "Ver detalhes do produto": características, destaques e descrição lidos no
  anúncio colado, fechados num botão (não poluir a tela). Vale para TODOS os
  produtos encontrados (Weslei, 28/09): a extensão lê os detalhes nas páginas
  das lojas e dos parecidos que já abre (a loja sai na hora; a leitura segue
  em segundo plano, lerParcial com aoTerminar). Loja do mesmo produto sem
  detalhes próprios mostra a ficha do colado com o aviso de onde veio.
- "Ficou em dúvida?" (Weslei, 28/09): "Comparar lado a lado" (preço, frete,
  loja, mesmo/parecido, características; em amarelo o que muda) e "Me ajude a
  escolher" (/api/public/ajudar-escolher: olha as FOTOS (até 7), descrição,
  características, preço no Pix e parcelado, custo por unidade, frete, loja
  oficial, vantagens e diferenças; objetivo: o mais próximo do colado pelo
  melhor custo-benefício; uma análise por pedido guardada em
  ajuda_escolha). A resposta SEMPRE traz o botão com o link de afiliado; só
  entram opções com link próprio. COERÊNCIA (Weslei, 02/10, pedido 550: a
  tela destacava a alternativa de R$ 4.223 e a análise indicava o anúncio de
  R$ 5.051,58): a escolha é SEMPRE a da tela (decisaoDaTela, mesma regra da
  Melhor alternativa): a Melhor alternativa quando há, senão o melhor preço do
  mesmo produto; o resumo cita o que muda e a opção exata. O modelo só
  escreve os pontos (e o resumo quando escolheu a mesma). Sem modelo, a
  escolha é calculada.
- O QUE MUDA PELA FICHA (02/10, pedido 550): campos decisivos que os dois
  anúncios informam com valores diferentes (modelo, capacidade, voltagem,
  armazenamento, RAM, tela, volume, peso, unidades, potência) entram no
  "Muda" (mudaCompleta, src/lib/ficha.ts) e tiram o achismo da conferência
  ("não informa", "pode indicar"). Só acrescenta diferença; a conferência
  continua reprovando toda diferença listada, até a especulativa.
- O QUE MUDA PARA VOCÊ (Weslei, 02/10: "indicar como muda para o cliente,
  não somente a diferença técnica"): Parecidos e Melhor alternativa mostram
  cada diferença como "Campo: o seu X → este Y" + o que significa na compra
  (src/lib/diferencas.ts: regra fixa por tipo ou conta com os dois números,
  ex. "Cabe 53 L a menos que o seu"; nunca inventa vantagem), mais preço por
  unidade (só com quantidade diferente), frete pago e "✓ Igual ao seu" (o que
  as duas fichas confirmam). Nas características, em amarelo o que difere do
  colado (compararFichas). A conferência escreve cada diferença como
  "Campo: original -> candidato" (servidor e extensão). Cartão do parecido:
  cabeçalho (foto, título, loja, selos) → preço e diferença → o que muda →
  "Ver características" e "Comprar com segurança".
- VISUAL ESTILO APPLE (Weslei, 03/10): fundo cinza-claro #f5f5f7 e cartões
  brancos (tokens em src/styles.css), fonte do sistema (SF Pro), raios
  amplos (rounded-3xl nos cartões principais), sombra leve, azul #0071e3.
  No celular: barra fixa translúcida no topo ao rolar pelo resultado
  (BarraFixa: foto, nome curto, melhor preço, frete em linha própria e
  pílula "Comprar com segurança" só com link de afiliado; sem link, sem
  botão); Parecidos em carrossel horizontal com snap, seletor em círculos
  com a foto de cada um e indicador em pílula (no PC continua a lista).
- COMPARAR COM O SEU (Weslei, 03/10: "comparar cada produto encontrado com
  o original e resumir para o uso do cliente"): em cada Parecido e na Melhor
  alternativa, botão "Comparar com o seu" abre o lado a lado (preço, frete em
  linha própria, loja e as características que os dois informam, diferentes
  em amarelo; linhasLadoALado) e "Em resumo:" (resumoParaCliente,
  src/lib/diferencas.ts: preço no produto, frete em frase própria, o que
  muda e uma orientação fixa por tipo; nunca inventa). Cartão da Melhor
  alternativa de cima para baixo: selo, "R$ X a menos" grande, produto e
  preço, motivos com ✓, o que muda, botão, características.
- Tabela: preço abaixo de 70% da mediana das lojas ganha o aviso "Preço muito
  abaixo das outras lojas: confira o vendedor antes de comprar". GPT (chave da OpenAI nos Secrets, OPENAI_API_KEY ou
  variações, inclusive CHAT_GPT_API_KEY, a usada pelo Weslei; modelo em OPENAI_MODEL) responde primeiro, Gemini/Gemma de
  reserva; a conferência pela foto continua na Gemini. Última falha do GPT em
  sinc_config.gpt_diagnostico.
- Textos curtos. Não prometer cupom. Sempre mostrar foto do produto.
- Não citar IA/inteligência artificial nos textos do site nem nos guias
  (monetização: diretrizes do Google Ads e do programa de afiliados).
- Guias com exemplos REAIS (dados medidos nos pedidos, com data), sem nome de
  vendedor.
- Vídeo "Como funciona" (27/09): comercial de 28 s junto da caixa do link.
  1º acesso toca sozinho (mudo, com "Ativar som"); depois vira botão. UM
  exemplo só no vídeo (kit com 2 óleos capilares, 25/09: R$ 428,90 → R$ 291,95,
  "R$ 136,95 a menos") para não misturar preços. No vídeo (Weslei, 27/09):
  sem citar cupom, sem citar Mercado Livre, "em menos de 2 minutos", sem marca
  do produto e link ilustrativo em example.com (domínio reservado). Frete:
  "Frete pago não passa na frente / Frete grátis conta a favor" (vale em todo
  caso do código). Mesmo estilo e trilha; só os exemplos mudam.
  Fonte em ferramentas/video/ (comercial.html, trilha.py); arquivos em
  public/video/ (WebM + MP4, 720p).

## Marca e app (05/10)
- Logo: M branco com selo verde ✓ em degradê roxo/azul. Ícones gerados do
  arquivo enviado pelo Weslei: public/favicon.ico (16/32/48), favicon.png,
  apple-touch-icon.png (180), icon-192/512, icon-maskable-512, logo.png e
  extensao/icones/icone16-128. Logo no topo (link para /) e no rodapé.
- Convite para instalar (InstalarApp, home com a caixa parada):
  beforeinstallprompt no Android/Chrome (um toque) e instrução do Safari no
  iPhone; some no modo app ou dispensado (localStorage, só conveniência).
- App instalável: public/manifest.json (start_url /?origem=pwa, standalone,
  theme #0071e3) com share_target GET (title/text/url -> link): o site pega o
  1º endereço do Mercado Livre em link, text ou title e compara sozinho.

## Largura e zoom no celular (18/10)
- Weslei, 18/10 (print do iPhone: o site na metade esquerda da tela):
  "Ajuste o redimensionamento e zoom em todas as versões". Causa: os
  textos só para leitor de tela (sr-only) dos cartões dentro dos carrosséis
  com rolagem lateral ficavam na posição de origem e, sem pai posicionado,
  escapavam do corte (página de 2.224 px num celular de 390 px; o navegador
  diminuía o zoom para caber). src/styles.css: .sr-only com top/left 0 e
  html/body com overflow-x: clip (não quebra o sticky). Cabeçalho: o campo
  "Cole o link de outro produto" só a partir de 1024 px (no tablet vazava
  para 899 px) e, em 320 px, o botão do Telegram só com o ícone. Em tela de
  toque todo campo de texto tem 16 px (o iPhone dá zoom sozinho em campo
  menor); o campo principal diz "Cole o link aqui" para caber numa linha.
  Medido com Playwright em 320, 360, 390, 430, 768, 1024 e 1440 px na home,
  /brinquedos, /natal, /dia-das-criancas, categorias, /meus-precos,
  /telegram, /sobre, /guias e no resultado da comparação: largura certa em
  todas. Ao mexer em carrossel ou cartão, medir de novo
  (documentElement.scrollWidth = largura da tela).

## Foto livre e menos informação de cara (18/10)
- Weslei, 18/10: "Faça o enquadramento ficar melhor ajustado e não
  competindo com a foto. Ainda aplique melhorias que deixem o usuário menos
  confuso com tanta informação. A ideia é mostrar as principais
  diferenças, mas que mais detalhes sejam consultados" e o título "O mesmo
  produto. Uma melhor escolha." (era "Uma escolha melhor").
- NADA POR CIMA DA FOTO nos cartões (vitrine, campanhas, brinquedos, mais
  vendidos): quadro branco de proporção fixa (4/3; 160 px de altura na
  vitrine do PC) com a foto inteira (object-contain). O selo do preço/
  classificação fica na linha logo abaixo da foto, em altura fixa (os
  títulos alinham); "Muito bem avaliado" e "Entre os mais vendidos" vão
  junto das estrelas. Tocar na foto abre "Ver fotos e detalhes"
  (VerDetalhesVitrine com gatilho); no pé, "Comprar com segurança" e uma
  linha discreta com "Detalhes" (e "Atualizar preço" na vitrine).
- Vitrine: a Alternativa parecida mostra só o preço e "Não é idêntico.
  Muda: ..."; loja, avaliações e vantagens abrem em "Mais".
- Topo do PC (DestaqueHeroRotativo): a imagem num quadro de cantos
  arredondados, inteira e sem nada por cima; rótulo, pontos e "Compare com
  clareza" (3 itens em linha) ficam ABAIXO dela.
- Resultado: Parecidos e Melhor alternativa mostram a qualidade em uma
  linha e até 3 diferenças em etiquetas (PrincipaisDiferencas: "Campo:
  valor deste"; vermelho com ✗ = desvantagem, primeiro). O que cada uma
  significa, o bloco de desvantagens, o lado a lado (já aberto),
  características e "faz sentido para você?" ficam em "Ver análise
  completa" (AnaliseCompleta). Sem a etiqueta repetida "Mais barato que o
  seu" (a diferença já aparece no preço).
- Tabela de lojas no celular: duas colunas (sem a foto, o botão embaixo do
  preço); o nome da loja saía uma letra por linha. Barra de compra do
  celular: o preço nunca fica por baixo do botão.
- Painel "Ver fotos e detalhes": a foto num quadro branco, com setas e
  contador ("1 de 5") ABAIXO dela; sem a miniatura repetida no cabeçalho.
  Destaques à vista (até 5); características e descrição abrem nos botões.
- "Minha recomendação": a foto ao lado de quem vende, quanto a menos e as
  estrelas (não mais sozinha numa linha). Campanhas no celular: o texto
  começa depois da faixa da arte. Botões flutuantes "Início"/topo só com os
  ícones no celular.
- COLADO x SUGESTÕES (Weslei, 23/10: "tem que ficar muito claro o que é o
  produto que o cliente colou e quais são as sugestões"): no resultado, o
  anúncio colado fica num quadro cinza com o rótulo "O produto que você
  colou" (largura inteira no PC) e logo abaixo o título "Minhas sugestões"
  (TituloSugestoes) antes de recomendação, alternativa, tabela e
  Parecidos. Pílula "Seu produto" na BarraDeSecoes; a Melhor opção que é o
  próprio colado diz "É o próprio anúncio que você colou."; na tabela, a
  linha "Anúncio colado" com "você colou".
- Milhar com ponto ("12.000 BTUs") é lido inteiro em src/lib/diferencas.ts
  (saía "Cabe 3 BTUS a menos"); "Cabe" só para L, mL e kg (testes em
  tests/diferencas.test.ts).

- Revisão do celular (31/10, 360/390/430 px, resultado medido com o pedido
  1001232): placeholder do campo principal no celular "Link ou nome do
  produto" (o antigo quebrava em 2 linhas e cortava ao lado do "Colar");
  "Atualizar comparação" só com "comparação" a partir de 390 px (em 360
  saía do quadro); coluna do preço da lista de lojas com 7,5rem no celular
  (nomes como "RSG ECOMMERCE" quebravam no meio); painéis e diálogos em dvh
  (vh do iPhone passa da tela com a barra do Safari); aviso de cookies com
  folga da barra do iPhone (safe-area); alvos de toque de 32-36 px nos links
  do rodapé, departamentos e sugestões da busca guiada; teclado com "Buscar"
  (enterKeyHint) nos dois campos de busca.

## Home nova e rodapé (home-v2, 06/10)
- Cabeçalho único em todas as páginas (CabecalhoSite, fora de /login e
  /admin): logo, Meus preços, Guias, Sobre e a pílula "Ofertas no Telegram".
- Home: topo em degradê (--gradiente-conteudo, azul -> lilás) com "O mesmo
  produto. Uma escolha melhor.", a caixa do link sobreposta, "Serviço
  gratuito..." e, com a caixa parada, os 3 passos e "Explore por categoria"
  (Tecnologia, Casa e cozinha, Beleza, Moda, Brinquedos; fotos em
  public/home/). No PC a arte do topo (hero-fones.webp) com o cartão
  "Compare com clareza".
- Rodapé (RodapeInstitucional): faixa do Telegram, marca "Compare antes.
  Escolha melhor.", colunas Explore / Institucional / Sua privacidade,
  quadro "Transparência em cada escolha" (links de afiliado, site
  independente, preços mudam, marcas dos titulares).
- ARTES NAS CATEGORIAS E VITRINES (Weslei, 09/10, tarde: "ajuste as
  vitrines e categorias, inclua as artes. cuidado com todo design"; substitui
  o "sem arte nas categorias" da manhã). Pacote ME-Imagens (sem logos; 50
  artes com área livre à esquerda e objetos à direita; nada de preço, data
  ou cupom na imagem). Catálogo em src/lib/artes.ts (public/artes/<id>.webp
  1600 px e -m.webp 960 px, foco por arte); Celulares e Automotivo usam as
  do acervo original (sem texto). Não usar "Festival de cupons", "Ofertas
  relâmpago" nem a pasta 03-historico-nao-publicar.
  - BannerArte: PC com a arte inteira e o texto na área livre sobre véu em
    degradê (escuro no modo escuro); celular com a arte em faixa no topo e o
    texto abaixo (nunca texto sobre foto em tela pequena).
  - /categorias/<slug>: banner + produtos já comparados da categoria
    (Vitrine categoriaFixa, mesmas regras da home) + "Antes de comprar"
    e perguntas, sem o texto antigo de cupom; título "<Categoria>: compare
    antes de comprar". /categorias, "Explore por categoria" (home) e
    "Outras categorias": CartaoCategoria com a miniatura da arte.
  - /brinquedos: banner com a arte de brinquedos.
  - Vitrines de campanha: Tecnologia (home office), Casa (cozinha), Beleza
    (penteadeira) e a neutra (escolhas que cabem no bolso) usam as artes
    (imagem.foco); Crianças, Natal e Black Friday seguem com o estúdio.
- TOPO ROTATIVO E CARTÕES (Weslei, 09/10, "animações e vitrine rotativa no
  hero"): DestaqueHeroRotativo (só PC) no lugar da arte fixa: institucional
  (fones), Tecnologia, Casa, Beleza e Brinquedos (artes de src/lib/artes.ts)
  e, se houver, UMA oferta de campanha ativa conferida < 24 h com meli.la
  (ehLinkDeCompra; sem link, não entra). Troca a cada 7 s com fade de 500 ms;
  pausa no mouse, toque, foco, aba oculta e botão; pontos acessíveis; itens
  ocultos com inert. Cartão "Compare com clareza" e textos fixos; só a
  imagem flutua 4 px em 6 s (hero-flutua). prefers-reduced-motion: sem
  troca automática nem flutuação. Cartões (CartaoOferta, Vitrine,
  Brinquedos, Mais vendidos): aproximação de 1,03x no mouse
  (motion-safe), caixa da foto com altura fixa e overflow-hidden. Segunda
  foto real só nos "Mais vendidos agora" (em_alta_catalogo.imagem2, leitura
  em_alta_da_categoria_v2): crossfade no mouse e no toque na foto. A rota
  /api/public/fotos não é chamada no mouse (divide o limite por pessoa com a
  busca guiada e o "Me ajude a escolher").
- AJUSTES DO MODELO FINAL (09/10, home-v2-final-sem-marcas): caixa do link
  DENTRO do topo, à esquerda, abaixo do título; "Serviço gratuito..." logo
  abaixo dela; arte e "Compare com clareza" à direita; passos numa faixa
  branca logo abaixo do topo; atalhos "Buscas recentes" em pílulas lilás.
  Com resultado, o topo encolhe (uma coluna, sem arte) e o degradê fica só
  atrás do título; a caixa do link não muda de lugar na árvore.
- Peça no lugar do aparelho (07/10, ajuste do Weslei em RE_PECA_PARTE,
  servidor e extensão 1.155.0): a regra olha o COMEÇO do título (peça como
  produto principal, inclusive "Kit 2 tampas", "1 un carcaça").

## Fotos nítidas (09/10)
- Weslei, 09/10: "melhore a qualidade das fotos!". src/lib/foto.ts: o
  mlstatic tem cada foto em -O (até 500 px, o que estava em tudo),
  D_NQ_NP_2X_…-V (até 640 px) e -F (a original, até 1200 px); conferido em
  13 fotos da vitrine, as três existem. Cartões (vitrine, campanhas,
  brinquedos, mais vendidos, busca guiada, parecido no celular): 640 px com
  srcSet da original; vistas grandes (galeria "Ver fotos", destaque do topo,
  pedestais das campanhas): a original. Falhou a versão maior, o <img> volta
  para o endereço gravado (voltarAoOriginal). Canal/Facebook: -F.jpg.
- Artes: public/artes reexportadas do pacote original (1672 px WebP 90 e
  -m 1280 px WebP 86; srcSetArte no topo rotativo), estúdios das campanhas
  no tamanho do recorte original (~1040 px, WebP 88) e logo.png em 192 px
  (vinha 96 px e aparecia ampliado no celular). Medição antes (09/10,
  Playwright): fotos de produto não ficavam ampliadas; artes e estúdios
  ficavam 1,4x a 2x ampliados.

## Navegação, aberturas e reenquadramento (23/10)
- Weslei, 23/10: "invista na melhoria de navegação, detalhes, aberturas,
  precisa ser profissional e bem completo, além do reenquadramento deixando
  a visualização mais organizada".
- ABERTURA ÚNICA (src/components/Abertura.tsx: Abertura, useAbertura,
  BotaoAbertura, RegiaoAbertura): seta que gira, área que cresce com
  animação (grid 0fr -> 1fr), aria-expanded/aria-controls, Esc fecha e
  devolve o foco, conteúdo aberto abaixo da tela vem para a vista, monta só
  na 1ª abertura. Usada em "Ver detalhes do produto/características",
  "Ver análise completa", "Comparar com o seu", detalhes de cada loja e
  "Ficou em dúvida?". <details> nativos (perguntas, "O link não abriu?",
  prazo, garimpo) com a classe abertura-nativa (seta e abertura suave).
- PAINÉIS (<dialog class="painel">: avaliações, fotos e detalhes): entram
  com leve subida; no celular viram folha que sobe do pé, com alça; a
  página atrás não rola.
- RESULTADO NO PC (lg): colado e "Minhas sugestões" em largura inteira;
  abaixo, a DECISÃO à esquerda (prazo + recomendação/Melhor opção, fixa ao
  rolar com a variante painel-fixo = lg e altura >= 700 px) e as provas à
  direita (Melhor alternativa, lojas, Parecidos); depois uma faixa de ações
  (acompanhar, compartilhar com "Copiar", "Ficou em dúvida?" com o lado a
  lado mais largo) e, no fim, os 3 marketplaces. Entre 640 e 1023 px, uma
  coluna. "Minhas sugestões" resume os números medidos ("Achei o mesmo
  produto em N outras lojas e M parecidos. A melhor economia é de R$ X no
  mesmo produto"/"no custo final, já com o frete").
- LOJAS: lista (não tabela) com nome, selos, estrelas e frete à esquerda,
  preço e diferença à direita, botão "Comprar" com escudo em TODAS as
  linhas (também o que gera o link no clique; "Abrir" saiu); Pix x
  parcelado em linha inteira no celular; "Menor preço | Mais bem
  avaliadas" quando 2+ lojas têm nota (o selo e a recomendação não mudam).
- Recomendação: a economia é a manchete ("R$ X a menos"), depois de onde
  vem e "Vendido por" (nome longo quebra a linha; antes vazava no celular
  e sobre "Vendedor" nos 3 marketplaces).
- Cabeçalho: "Categorias" (PC a partir de 1280 px; no celular na linha de
  links). Barra de seções na ordem em que as seções aparecem na tela, com
  as pontas do trilho esmaecidas no celular. Celular: sem a trilha
  "Início › Comparação" (estado e "Atualizar comparação" numa linha); em
  320 px a barra de compra diz "Comprar".
- Medido com Playwright (pedidos reais 1000184 e 1000213) em 320, 390,
  768, 1024, 1366 e 1440 px: largura certa em todas.

## Navegação soft (10/10)
- Weslei, 10/10: "atue como especialista de design UX e UI, deixe a
  navegação soft" (canvas claude.ai/artifact/XZDdoFRbkAGaofGojMfGoy) e
  "publique as atualizações de design".
- Cabeçalho (CabecalhoSite) FIXO em vidro (56 px no celular, 60 no PC, linha
  fina); na tela inicial, com o campo do link fora da tela, aparece "Cole o
  link de outro produto" + "Comparar" (PC; dispara comparar-link) ou o ícone
  do link de 44 px (celular, leva ao campo). Os links das páginas no celular
  ficam numa linha própria abaixo, que rola com a página. O botão flutuante
  "Colar link" saiu.
- Resultado: BarraDeSecoes (src/components/BarraDeSecoes.tsx) fixa abaixo
  do cabeçalho, pílulas Resumo · Lojas N · Alternativas N · 3 marketplaces ·
  Dúvidas (só as que existem; ids secao-*, scroll-mt-36); a ativa acompanha
  a rolagem (seção na linha de leitura de 140 px; no fim da página, a mais
  baixa visível; trava 0,9 s depois do toque); no celular o trilho rola na
  horizontal. Trilha "Início › Comparação" + "Comparado há X" com ponto de
  estado e "Atualizar comparação" (IdadeDaComparacao).
- Celular: a barra de compra (BarraFixa) fica EMBAIXO, em vidro ("Melhor
  opção", preço, frete em linha própria, "Comprar com segurança" verde);
  Início/topo sobem junto (--folga-compra).
- Movimento: html com rolagem suave e scroll-padding-top 72 px; com
  "reduzir movimento", instantânea; transições de 150-300 ms com
  cubic-bezier(.2,.8,.2,1); foco visível azul de 2 px. O topo da home usa
  overflow-clip (hidden quebrava o sticky).
- Mantido da regra de sempre: a tabela continua mostrando TODAS as lojas (o
  "Ver as outras N lojas" do desenho não foi aplicado).

## Versão para computador (25/10)
- Weslei, 25/10: "invista na versao web". Só PC (lg/xl); o celular não muda.
- Resultado: as pílulas da barra de seções nunca encolhem (a última, "3
  marketplaces", saía cortada em 1440 px) e o CEP usa o resto da linha; no
  PC o CEP padrão mostra só "Frete para: ... · Informar meu CEP" (o "padrão,
  informe o seu" fica no celular).
- Ctrl+V / Cmd+V em qualquer lugar da página (fora de um campo) com um link
  dispara comparar-link (BuscaPorLink); dica no title do botão "Colar".
- Cabeçalho em 1024 px: links sem quebra de linha e o campo do topo encolhe
  (min-w-0) para o botão do Telegram não vazar.
- Home a partir de 1280 px: "Acompanhar preço" e o convite do Telegram lado a
  lado (uma faixa a menos).
- Em aberto com o Weslei: vídeo "Como funciona" dentro do cartão do link no
  PC (autoplay pedido em 27/09) e o segundo botão de compra na recomendação.

## Vidro líquido nas barras e botões (31/10)
- Weslei, 31/10: "instala o expo-glass-effect e põe o vidro só nas barras e
  botões do meu site". O expo-glass-effect é só do app nativo (Expo/iOS) e
  não roda no site: NÃO instalar. O mesmo visual sai em CSS, nas utilidades
  vidro-barra e vidro-botao (src/styles.css): fundo translúcido + blur e
  saturação, sólido sem suporte a backdrop-filter ou com "reduzir
  transparência" (01/11: 62% com brilho em degradê no alto; 80% quase não
  aparecia). Escrever só backdrop-filter (o Lightning CSS põe o
  -webkit-; escrever os dois fazia sumir o sem prefixo).
- vidro-barra: cabeçalho, barra de seções, abas de baixo, barras de compra
  do celular, barra de filtros e de cupons selecionados. vidro-botao:
  pílula flutuante Início/topo, "Ofertas no Telegram" do cabeçalho e as
  variantes outline/secondary do Button; 01/11: chips da busca guiada,
  câmera, "Atualizar comparação", secundários do garimpo e setas das fotos.
  O vidro só aparece onde algo colorido passa por trás. Cartões, conteúdo e botões de
  compra (verde/azul sólidos) NÃO levam vidro.
- Link colado (31/10, "converta links afiliados de terceiros para o meu"):
  soAfiliado(link, colado) nunca devolve como link de compra o meli.la que
  o cliente colou; o botão gera o DELE no clique. Complementa a extensão
  1.170.0 (resolverEncurtado antes de gerar, PR #51).
