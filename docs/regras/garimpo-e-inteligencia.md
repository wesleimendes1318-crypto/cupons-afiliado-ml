# garimpo-e-inteligencia (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Anonymous profile, sourcing (garimpo), intelligence operation, multi-player sourcing.

## Perfil anônimo e garimpo (05/10)
- PERFIL DE INTERESSE (src/lib/perfil-visitante.ts): só no navegador
  (localStorage "melhorescolha_perfil"), só com consentimento de análise
  (sem ele não lê nem grava; recusar apaga). Guarda só contagem por tipo de
  produto (categoria do anúncio primeiro, depois o título), preço médio e se
  escolheu frete grátis; nada pessoal. Uma vez por pedido.
- Vitrine: em "Pesquisados agora" o tipo mais comparado (>= 2 comparações)
  sobe, e em "Todas" aparece "Do seu interesse" (até 5, maior economia) com
  "Limpar histórico de interesses".
- "Continuar de onde parou": atalhos das últimas comparações do aparelho
  (me_historico_v1) abaixo do campo do link, com a caixa parada.
- /api/public/cron-garimpo (x-cron-secret: sinc_config.cron_segredo,
  CRON_SECRET ou o token do bot): mesma decisão da tela (opcoesDaAnalise +
  decisaoDaTela), economia >= R$ 30 no produto, link meli.la, frete grátis
  ou com valor conhecido, sem peça no lugar do aparelho nem alternativa que
  "vem menos", só produto da vitrine, e SÓ comparação feita nas últimas 3 h
  (mais velha = rascunho). Até 2 por chamada, cada achado 1 vez em 7 dias
  (tabela canal_publicacoes, com message_id e versão dos critérios);
  resposta ambígua do Telegram conta como publicada (não repete às cegas).
  ?simular=1 só lista. PREÇO MUITO ABAIXO (09/10, posts 29 e 30: Malbec
  R$ 200 x R$ 361/R$ 379 e aspirador R$ 50 x R$ 120/R$ 227, contas novas sem
  selo): mesmo produto abaixo de 70% da mediana das lojas (3+ preços) não vai
  ao canal, salvo loja oficial (src/lib/preco-suspeito.ts, a mesma conta do
  aviso da tabela do site; garimpo-v5). Remover post: /api/public/operacao?tarefa=remover&
  publicacao=<id> (só sob pedido; canal_publicacoes.removida_em/motivo).

## Operação de inteligência (05/10)
- ROTINA NO BANCO (pg_cron + pg_net, disparar_operacao; horários de
  Brasília): 07:33 /api/public/operacao?tarefa=mercado (API oficial do
  Mercado Livre /trends/MLB, /trends/MLB/{cat}, /highlights/MLB/category
  /{cat} + nome pelo /products, Google Trends RSS BR; mede membros do canal
  por getChatMemberCount -> mercado_sinais, canal_metricas); 07:41 e 17:41
  ?tarefa=preparar (pedir_link_novo das 2 maiores economias dos últimos 7
  dias ainda não publicadas); 08:47 e 18:47 garimpo. Cada execução em
  operacao_execucoes. PAUSA: sinc_config.operacao_pausada = 'true'.
- ESTRATÉGIA SAZONAL (Weslei, 05/10: "use estratégias sazonais, em breve
  haverá Natal"; src/lib/sazonal.ts, docs/inteligencia/sazonal-2026.md):
  Dia das Crianças (28/09-12/10), Black Friday (01-30/11, dia 27/11) e Natal
  (15/11-24/12). Na temporada: coleta com até 2 categorias a mais, preparo e
  garimpo com 50% a mais na nota para o que combina com a data, rótulo no
  post do canal, seção da temporada na vitrine (2 a 5 já comparados) e
  convite do "Acompanhar preço" (até 60 dias antes da Black Friday: "veja se
  o desconto é de verdade"). Só prioridade e rótulo: as regras de economia,
  qualidade, frete e afiliado não mudam; nada de desconto ou prazo inventado.
  SEÇÕES SAZONAIS (Weslei, 05/10: "sessões prioritárias... encantar...
  design profissional"): VitrineSazonal acima da vitrine geral, uma seção
  por temporada em destaque (em andamento ou que começa em até 45 dias:
  "Antes da Black Friday", "Presente de Natal antecipado"), tema próprio
  (sazonal.ts, tema), contagem de dias, 2 a 10 produtos já comparados com
  desconto real (mesmo produto ou alternativa da vitrine), botão de compra
  só com meli.la e comparação < 24 h (senão "Ver o preço de agora").
  BLACK FRIDAY SEM OFERTA ANTECIPADA (Weslei, 05/10: "as lojas ainda não
  entraram na mesma campanha"; Natal e Dia das Crianças são diferentes,
  "antecedência indica economia"): antes de 01/11 a Black Friday aparece só
  como cartão de contagem ("Faltam N dias", 27/11), sem produtos, sem busca
  sazonal, sem prioridade e sem rótulo no canal (ofertasAntecipadas,
  temporadasComOfertas). Cartões: foto em altura fixa (h-32/h-36), economia
  mínima de R$ 15 e 5%, ou R$ 30 ou mais, para entrar na seção.
  DESCONTO REAL (régua única, src/lib/regra-economia.ts, Weslei 05/10):
  R$ 30 ou mais no produto, OU exceção para produto barato: R$ 10 e 20% do
  anúncio comparado. Vale para canal, preparo e vitrine sazonal.
  JÁ É O MENOR PREÇO (Weslei, 05/10: "pode aproveitar os anúncios que já são
  a melhor escolha... alimentar minhas vitrines com múltiplas estratégias";
  "pode ser produtos já no menor preço"): produtos_vistos.segunda_preco/
  segunda_loja/lojas_mais_caras (marcar_menor_preco no gatilho da vitrine),
  leitura pública vitrine_menor_preco. Vitrine: anúncio mais barato contra
  >= 2 lojas conferidas, com a diferença para a 2ª loja como ela é
  (menorPrecoVale). Canal: só com desconto real contra a 2ª loja
  (menorPrecoDoColado, tipo "menor": "Já é o menor preço: conferido contra N
  lojas").
  DESIGN DAS CAMPANHAS (Weslei, 05/10: "personalidade, símbolos bem
  desenhados, artes encantadoras, animações sutis"): tema completo por
  campanha em sazonal.ts (fundo, texto, textoSuave, destaque, sobreDestaque,
  realce, rotulo com contraste AA, superficie, borda, brilho, decoracao);
  fotos reais dos produtos (VitrineDeFotos; ver VISUAL CLEAN; as
  ilustrações e a decoração de fundo saíram em 05/10).
  Movimento: campanha-entra/flutua/balanca/cintila (styles.css), poucas
  repetições, só transform/opacity, desligado com prefers-reduced-motion.
  Estados: ativa/antecipada com ofertas (SecaoCampanha, grade completada
  pelo convite "Cole o link" quando há menos de 5), sem achados
  (CartaoCampanhaCompacta), futura sem oferta antecipada (contagem) e
  encerrada (página). Cartão padronizado (CartaoOferta): foto em área fixa,
  selo de economia, classificação "Mesmo produto"/"Parecido"/"Menor preço",
  preço comparado riscado, loja, botão no pé. Botão do Telegram com ícone no
  tema (BotaoTelegram). Páginas /natal e /dia-das-criancas (PaginaTemporada,
  sitemap, rodapé, og:image em public/sazonal/*.jpg sem contagem).
  AUTONOMIA: pg_cron operacao-sazonal 07:05 e 17:05 (Brasília), antes do
  preparo e do garimpo.
  BUSCA SAZONAL: operacao?tarefa=sazonal[&temporada=][&max=] põe na fila os
  produtos do catálogo oficial (/products/search) das buscas da temporada,
  1 por busca, até 15 por chamada, com o anúncio da 1ª oferta da lista
  oficial no endereço (pdp_filters=item_id): a página de catálogo pura é
  recusada pelo gerador de links (erro 111) e produto sem oferta ativa
  (/items 404) é pulado.
- SEM GEMINI = SÓ O GEMMA 26B (05/10, diagnóstico ?diag=1 em
  /api/public/conferir-produto, só com o token da extensão): gemma-4-31b-it
  dá erro 500 com foto e passa de 30 s com texto; gemma-4-26b-a4b-it
  respondeu com foto em 6,2 s, e em 1,3 s com thinkingConfig.thinkingLevel
  "minimal" (o Gemma 4 vem com raciocínio ligado; thinkingBudget e "low"
  dão 400). Todo Gemma vai com o raciocínio no mínimo (servidor e extensão
  1.153.0). Com a cota diária da Gemini esgotada, a conferência usa só o
  26b, até 9 candidatos em lotes de 3, prazo de 20 s
  (antes: 4 por lote em 12,6 s, nada respondia e a comparação saía sem
  parecidos). Extensão 1.151.0: a geração dos links da tabela olha a fila a
  cada link (pedido 747 esperou 56 s).
- Nichos do 1º ciclo (CATEGORIAS_FOCO, src/lib/inteligencia.ts):
  Eletrodomésticos, Beleza e Cuidado Pessoal, Casa/Decoração, Acessórios
  para Veículos (dados de 21/09-04/10: Beleza 4/5 produtos com o mesmo mais
  barato; Eletrodomésticos ticket médio R$ 2.434). Hipótese, revisar
  semanalmente com mercado_sinais x pedidos.
  05/10: + Segurança Laboral (MLB270252) e Ferramentas (MLB263532),
  conferidos na API (os códigos do pedido original eram de Ferramentas e
  Agro); nomes por categoria 3 -> 2 para caber no limite de chamadas.
- MEDIÇÃO: cliques em meli.la e t.me contados em eventos_site
  (registrar_evento) só com consentimento de análise, sem IP/cookie/id;
  origem pelo data-origem, pedido pelo data-pedido. Clique não é venda.
  Início da medição: 05/10/2026. Painel: view painel_operacao (30 dias).
- VITRINE E SEGUNDA VOLTA (05/10): o gatilho pedido_para_vitrine também
  atualiza a linha da vitrine quando a análise de um pedido já pronto muda
  (atualizar_produto_visto: melhor loja, alternativa e links da segunda
  volta, sem contar visita nem preço de novo). Antes, a alternativa da
  geladeira (pedido 622) aparecia na tela e nunca na vitrine.
- Sem Google Analytics (VITE_GA_ID não definido) e sem acesso ao Search
  Console nem ao relatório de comissões por API: vendas e comissões só pelo
  painel de afiliados do Mercado Livre.

## Garimpo no player de origem e campeão do nicho (11/10)
- PROMPT MESTRE do Weslei (11/10): garimpo no MESMO player do link primeiro
  (Amazon -> Amazon, Shopee -> Shopee, Mercado Livre -> Mercado Livre); link
  de loja sem afiliação começa no campeão do segmento; os outros players
  sob demanda ("Comparar também em ..."); identidade exata (bug de 11/10:
  bebedouro pet da Amazon virou "fonte de agua pet bivolt" e voltou uma
  fonte decorativa de Buda).
- CAMPEÃO (src/lib/campeao-segmento.ts, determinarCampeaoDoSegmento, testes
  em tests/campeao-segmento.test.ts): livros/Kindle e eletrônicos/
  informática/Alexa -> Amazon; autopeças/pneus/ferramentas pesadas, linha
  branca, beleza/perfumaria/moda -> Mercado Livre; acessório barato
  (< R$ 50 ou preço desconhecido), bijuteria, utilidades leves, papelaria ->
  Shopee; resto -> Mercado Livre. Ordem: livro, autopeça, linha branca,
  beleza/moda, acessório barato, eletrônico. Só título, categoria lida e
  preço lido. Amazon/Shopee de segmento em que o Mercado Livre é campeão de
  verdade (não o "geral") também abrem a busca no Mercado Livre sozinhas.
- IDENTIFICAÇÃO (/api/public/identificar-link): de loja sem afiliação lê na
  página o preço (JSON-LD offers / product:price:amount), a foto (og:image,
  só de servidores de imagem conhecidos, RE_FOTO_PERMITIDA em
  src/lib/conferir-produto.ts) e a categoria (JSON-LD/breadcrumb), e devolve
  campeao. Sem o dado, vazio (a tela diz "não consegui ler").
- BUSCA NO MERCADO LIVRE do mesmo produto (buscarMesmoProduto,
  /api/public/buscar modo "produto"): sem interpretar a frase, título limpo
  (src/lib/termo-busca.ts: sem Frete Grátis, Promoção, Bivolt, 110/220v,
  Envio Imediato, SKU, código de rastreio), e só entra produto do MESMO
  domínio que a API oficial prevê para o título (/sites/MLB/
  domain_discovery/search; conferido em 11/10: bebedouro ->
  MLB-CAT_AND_DOG_DRINKERS_AND_FEEDERS, a fonte de Buda é
  MLB-TABLETOP_WATER_FOUNTAINS e sai). Sem previsão, o tipo do produto tem
  de estar no nome (nomeTemOTipo). A conferência pela foto (servidor e
  extensão) ganhou "OUTRO TIPO OU OUTRO USO NUNCA é igual nem parecido".
  Produto do catálogo sem oferta destacada (/products/{id}/items "No
  winners found", comum em autopeças: pastilha Gol G5 em 11/10) entra sem
  preço, com "Vendido por várias lojas" e só "Comparar preço" (sem botão de
  compra direto, que cairia no erro 111 da ficha pura) e não vai para a fila
  da vitrine. Loja sem afiliação: o título da página manda sobre o nome do
  endereço (nome, preço e foto do mesmo anúncio).
- GARIMPO NA AMAZON/SHOPEE (extensão 1.166.0, extensao/garimpo.js; banco
  20261011010000_garimpo_no_player.sql): o site pede (pedir_garimpo; mesmo
  link e player volta o mesmo pedido; 30 novos a cada 10 min) e acompanha
  (ver_garimpo com a chave); a extensão atende (garimpos_pendentes, 2 por
  vez, pausa remota respeitada; gravar_garimpo): busca no player pelo termo
  limpo, acha o produto de origem na busca (mesmo ASIN / item) ou na página
  /dp/ da Amazon (produtoAmazonDoHtml), escolhe até 5 candidatos e confere
  pela foto no servidor depois das conferências do Mercado Livre. Sem foto
  da origem: só "Encontrado pela busca" (nunca "mesmo produto"). Links:
  Amazon com a tag, Shopee pelo painel; o produto de origem também volta com
  o link do Weslei. Diagnóstico: diagnosticos tipo 'garimpo'.
- TELA (LinkDeOutraLoja + GarimpoNoPlayer + src/lib/garimpo-cliente.ts com
  limparGarimpo, a trava final): Amazon mostra o produto exato com a tag
  desde já; "Na Amazon/Na Shopee" com o seu link, o mais barato do mesmo
  produto ("R$ X a menos no produto"), parecidos com o que muda, qualidade
  e desvantagens, e os encontrados pela busca separados; loja sem
  afiliação: "Preço visto na <loja>: R$ X" x "Melhor opção do mesmo produto
  no <campeão>: R$ Y"; Mercado Livre com o cabeçalho honesto (ver
  "Redesign premium do garimpo multi-player"). Garimpo que não responde em
  6 min: "Tentar de novo" e, na Amazon, "Conferir na loja" (busca com a
  tag).
- Validado em 11/10 com a extensão 1.166.0 (atualizou sozinha): garimpo 3,
  o bebedouro B0H34VSMNJ do bug, 31 lidos, 5 conferidos, 2 "mesmo produto"
  e 3 parecidos (voltagem/cor), em 15 s, nenhuma fonte decorativa; garimpo
  4, "Comparar também na Shopee" do mesmo link, 2 parecidos com
  s.shopee.com.br em 34 s; livro Hábitos Atômicos (garimpo 2) só com
  parecidos (caderno de atividades "qualidade inferior", kit 2 livros).
  Busca no Mercado Livre do bebedouro no ar: 7 resultados, todos
  bebedouros. KaBuM!: preço e foto lidos da página; Magalu: só o nome (a
  página não entregou preço ao servidor).

## Redesign premium do garimpo multi-player (11/10)
- PROMPT MESTRE do Weslei (11/10, dois: "redesign de experiência premium" e
  "redesign premium de UX/UI estilo Apple + correção multi-player"; o
  segundo vale nos conflitos). Bug: "Menor preço achado na busca" no Mercado
  Livre custando mais que o visto e que a Shopee; Shopee lia só 3 anúncios.
- REGRA: nunca destacar como "menor preço" o que é mais caro que a
  referência (preço do link) ou que outro player. Frete só grátis
  confirmado; diferenças reais, sempre "no produto".
- TELA (LinkDeOutraLoja; regras puras em src/lib/placar-garimpo.ts, testes
  em tests/placar-garimpo.test.ts), de cima para baixo:
  1. Cartão âncora: foto (size-16/20, object-contain), "Visto na <loja>",
     nome, "Preço de referência" e, na Amazon (tag) ou Shopee (painel), o
     "Comprar com segurança" do próprio link.
  2. Veredito (vereditoDoGarimpo): "🔥 Economize R$ X na Shopee!" (faixa
     verde, mesmo produto conferido pela foto) ou "Economize até R$ X ...
     com modelo similar." (parecido de qualidade equivalente/superior que
     não "vem menos", >= R$ 2); "Você já encontrou o melhor preço!" (faixa
     azul com escudo, só depois de conferir pela foto, dizendo quantas
     ofertas e o que ainda falta comparar); "Conferindo…" enquanto roda.
     Sem preço do link: só "Melhor preço do mesmo produto", sem economia.
     Busca sem conferência (Mercado Livre e "encontrado pela busca") nunca
     vira economia.
  3. Placar "Compare com clareza" (3 colunas no PC; trilho com snap no
     celular, rolando até o vencedor): Correspondência (O seu link / ✓
     Mesmo produto / Parecido / Opções similares / Sem modelo compatível
     nesta análise), Preço com a diferença no produto, Frete em linha
     própria e Ação (Comprar com segurança; no Mercado Livre "Comparar
     preço"; Amazon sem achado "Conferir na loja"). Vencedor com moldura
     verde, elevação e "🔥 Menor valor encontrado" / "Modelo similar mais
     barato" / "Melhor valor" (o próprio link). Player não consultado:
     cartão translúcido, valores borrados SEM número e "Ver preço" (sob
     demanda, como antes); carregando: esqueleto.
  4. Ofertas por player (GarimpoNoPlayer): selo Mesmo produto/Parecido +
     qualidade no topo; foto size-20/24, título em 2 linhas, preço
     text-lg; diferença verde só para mesmo produto ou parecido indicável;
     o que muda em CHIPS sem setas (chipsDoMuda: "🎨 Cor: Rosa/Preto",
     "📐 Formato: Redondo em cascata"; o valor do seu fica no title);
     desvantagens em bloco vermelho; "Ver análise técnica detalhada"
     recolhido; botão largo "Comprar com segurança". Ordem: mesmo produto,
     parecidos indicáveis, os outros (cada grupo do mais barato).
  5. Mercado Livre (rotuloMercadoLivre): "Menor preço no Mercado Livre:
     R$ X" SÓ quando mais barato que o visto E que os outros players; senão
     "Opções similares no Mercado Livre a partir de R$ X (+R$ Y do que você
     viu)" ou "(+R$ Y que na Shopee)" + "Não localizamos o mesmo modelo
     mais barato nesta análise."; sem resultado, "Sem modelo compatível
     nesta análise".
  6. Celular: barra de compra embaixo (vidro, foto 40 px, preço, frete em
     linha própria, pílula "Comprar com segurança"), só com link de
     afiliado (oferta do veredito ou o próprio link), depois de rolar
     passando o topo; Início/topo sobem junto (--folga-compra).
- Link de outra loja identificado conta como resultado (BuscaPorLink:
  resultadoOutraLoja): o topo da home encolhe, a caixa usa a largura toda
  e o vídeo "Como funciona" some, como na comparação de sempre.
- TERMO DE BUSCA: nos outros players (termo-busca-externa.ts = extensão
  multiloja.js) sai o ruído de venda (silencioso, econômico, promoção,
  oferta, envio rápido...) e FICAM formato, material, medidas e voltagem;
  até 8 palavras + até 3 especificações que ficaram depois (medida
  primeiro). No Mercado Livre (termo-busca.ts, buscarMesmoProduto) 6 e 4
  palavras-chave (preposição não conta) + até 2 especificações; "USB" e
  "automática" só saem depois do nome; "silencioso", "econômico" e
  "premium" saem. Testes em tests/termo-busca.test.ts.
- SHOPEE 15 A 30 (extensão 1.166.1): cartoesShopeeNaPagina rola 1000 px a
  cada leitura (de 500 ms); buscarCandidatosShopee junta as leituras pelo
  item (juntarCartoesShopee) e para com 30 com preço, ou com 15 quando a
  página acabou ou duas leituras não trouxeram nada novo (META_SHOPEE),
  dentro do prazo (10-12 s).
