# vitrines-e-campanhas (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Showcases, campaigns, art, best sellers, most wanted, guided search/categories, toys by age.

## Busca guiada e categorias (05/10)
- BUSCA GUIADA (Weslei, 05/10: "integre campos de buscas em pontos
  estratégicos... toda pesquisa ali deve ter o llm/ia como motor"): bloco
  BuscaGuiada na home (abaixo da caixa do link), em /natal e em
  /dia-das-criancas, com sugestões por contexto. /api/public/buscar: o
  modelo (GPT, reserva flash-lite/Gemma) transforma o pedido em até 3 buscas
  + faixa de preço; catálogo oficial (/products/search + /products/{id}/items,
  teto de 18 chamadas); sem oferta ativa fica de fora. Botão "Comparar preço"
  abre a comparação (nunca compra direto). Cache de 6 h (tabela
  busca_guiada). Texto público não cita IA.
- "A CADA BUSCA, SE FIZER SENTIDO, DEIXAR NA VITRINE": até 2 produtos por
  busca não comparados nos últimos 7 dias vão para pedir_link_novo, no máximo
  8 por hora no site todo (proteger a conta). Entram na vitrine só se
  passarem nas regras de sempre.
- BRINQUEDOS x AUTOMOTIVO (Weslei, 05/10): categoria "brinquedos" no site;
  categoria_do_site decide pela categoria do anúncio (Brinquedos e Hobbies)
  antes do título, e título infantil (mini moto, carrinho de controle,
  bicicleta aro 12-16) vai para brinquedos antes da regra de automotivo. Na
  temporada de Crianças, combinaComTemporada exclui peças e acessórios de
  veículo (freio, relação, capacete, bateria automotiva...).
- VISUAL CLEAN (Weslei, 05/10: "mantenha clean! a referência enviada é
  para ter referência dos produtos... devolva a identidade do site"; "está
  feio com essas artes"): a busca guiada segue o visual do site (cartão
  branco, #f5f5f7, azul #0071e3). Nas campanhas, nada de ilustração nem
  confete/neve: VitrineDeFotos (src/components/ArteSazonal.tsx) mostra as
  fotos REAIS dos 3 primeiros produtos comparados em discos brancos com
  sombra suave (o "pedestal" da referência), só no PC; no celular os
  produtos já aparecem logo abaixo. Sem produto, sem arte.
- FRETE NA VITRINE E NO CANAL (Weslei, 05/10, "Grave!!! O frete é pago!",
  Deo Malbec R$ 59,85 com frete de R$ 11,90 que a mensagem não dizia):
  frete desconhecido NÃO é grátis. Canal: só publica com frete grátis
  confirmado (garimpo-v4). Vitrine: economia do mesmo produto só com
  produtos_vistos.melhor_frete_gratis = true e "menor preço" só com
  frete_gratis = true (marcar_frete_vitrine no gatilho, leitura
  vitrine_frete, src/lib/frete-vitrine.ts). Bot: frete desconhecido sai como
  "Frete não confirmado: confira antes de comprar" (nunca some).

## Brinquedos por idade (05/10)
- Weslei, 05/10: "aumentar a lista de brinquedos, opções em alta", "faixa
  etária e recomendação", "menor ticket médio... para doação", "produtos
  que já estão no menor preço... indicar que foi o menor preço encontrado",
  "o agente pode realizar buscas diretamente na API... sem depender das
  buscas dos usuários... já com meu link afiliado".
- AGENTE (src/lib/curadoria-brinquedos.ts, operacao?tarefa=brinquedos
  [&alvo=em_alta|bebe|3a5|6a8|9a12|doacao], pg_cron): a cada execução pega o
  alvo mais desatualizado; "Em alta" = /highlights de Brinquedos (MLB1132)
  + uma subcategoria em rodízio; faixas = 3 buscas da faixa
  (src/lib/brinquedos.ts, FAIXAS). Idade pelos atributos do catálogo
  (idadeDosAtributos) quando existem; idade que não cabe vai para a faixa
  certa. Oferta NOVA mais barata da lista oficial (/products/{id}/items,
  até 50), guardando quantas ofertas viu. Fila: pedir_link_novo com
  pdp_filters=item_id, até 6 por execução, cada produto no máximo a cada
  48 h; até 24 chamadas à API por execução. Tabela
  curadoria_brinquedos_itens (só servidor).
- SITE: BrinquedosPorIdade (home, /dia-das-criancas, /natal e a página
  /brinquedos, com SSR da lista, JSON-LD CollectionPage/ItemList/FAQ e
  sitemap). Só aparece produto com comparação pronta e meli.la
  (curadoria_brinquedos). Selos: "R$ X a menos" (outra loja do mesmo
  produto com frete grátis confirmado), "Menor preço encontrado" (a mais
  barata entre N ofertas novas do catálogo e nenhuma loja mais barata na
  comparação; mostra "entre N ofertas novas deste produto") ou "Preço
  conferido". Frete sempre em linha própria (grátis / à parte / confira).
  Abas: Em alta, 0 a 2, 3 a 5, 6 a 8, 9 a 12, Doação (até R$ 30, do mais
  barato; inclui os baratos das outras faixas). Comprar só com meli.la e
  comparação < 24 h; senão "Ver o preço de agora".

## Vitrine de campanhas: sistema visual (05/10, tarde)
- Weslei, 05/10: "vitrine que identifique o tema de cada campanha e adapte
  artes, símbolos, cores e composição"; "funcionar também para outras datas,
  categorias e campanhas"; "sem informação suficiente, composição neutra e
  elegante da marca".
- src/lib/campanha-visual.ts: temas (criancas, natal, black_friday,
  tecnologia, casa, beleza, neutro) com paleta, título em duas partes,
  descrição, arte e movimento. identificarTema: tema CONFIGURADO
  (Temporada.temaVisual, ajuste manual) manda; senão conteúdo (nome e
  descrição 3 pontos, categorias 2, parte dos produtos até 4); calendário só
  soma 1 ponto ao tema da data em andamento; menos de 3 pontos ou empate =
  neutro. Uma campanha por vez (simultâneas não se misturam).
- src/components/ArteCampanha.tsx: cena vetorial própria por tema (volume
  suave, poucos elementos) e até 2 fotos REAIS em cartões brancos separados
  (sem corte, dimensões reservadas). Imagem salva por tema em
  public/campanhas/ (LEIAME.md com os links do Canva gerados em 05/10; o
  download não sai desta sessão). Entrada suave uma vez; nada contínuo;
  prefers-reduced-motion desliga.
- Cartão (CartaoOferta): foto → título → preço → classificação (Mesmo
  produto / Parecido / Melhor preço / Preço imbatível) com o dado → loja →
  "Conferido hoje" ou "Preço de dd/mm" → Comprar com segurança (meli.la) e
  "Atualizar preço". Convite "Tem um produto em mente?" do tamanho de um
  cartão (data-convite-colar). Botão flutuante some com o campo do link ou
  um convite na tela e nunca fica sobre cartão, link ou botão.
- SELOS (src/lib/selos.ts; Weslei, 05/10, "cuidado com as políticas"):
  Preço imbatível = mais barato do mesmo produto contra 3+ lojas e 2ª loja
  10%+ acima; Melhor preço = contra 2+ lojas (ou a oferta nova mais barata
  entre 2+ do catálogo sem loja mais barata); Entre os mais vendidos = lista
  oficial /highlights. Sempre com "entre N lojas consultadas" e a data.
  "% OFF" só quando houver o preço original medido (ainda não há).
- Prévia de conferência: /campanhas/previa (noindex): seções completas de
  um tema configurado, um identificado pelo conteúdo e um neutro, a contagem
  da Black Friday e as artes.

## Recomendados do hub de afiliados (05/10)
- Weslei, 05/10: "consulte os principais produtos que o próprio Mercado
  Livre recomenda" (https://www.mercadolivre.com.br/afiliados/hub). A
  página só abre logada: a extensão (1.150.0, lerHubDeAfiliados) lê uma vez
  por dia, parada e sem freio, numa aba de fundo; de cada cartão só título,
  preço, preço anterior, % OFF, "Mais vendido", nota e vendidos. "Ganhos"
  (comissão) é descartado na leitura e nunca sai do navegador. Banco:
  registrar_hub (senha da extensão) grava em hub_recomendados e põe até 6
  na fila de comparação por leitura (mais vendidos e maiores descontos;
  cada um no máximo a cada 48 h). Diagnóstico: diagnosticos tipo
  'hub-afiliados' (lidos, com preço, amostra sem comissão).

## Artes realistas e tamanhos (05/10, noite)
- Weslei, 05/10: "ajuste os tamanhos, está desordenado e estão enormes" e
  "preferência de artes mais reais, como no caso anexo" (render 3D
  fotorrealista: produtos em pedestais, cartão de comparação com ✓).
- Foto de produto SEMPRE em caixa de altura fixa com a imagem absoluta e
  object-contain (max-h-full dentro de grid não limita: as fotos reais
  estouravam o cartão). Destaque compacto (título 22/28 px, arte 190 px no
  PC e 96 px no celular), cartões menores (foto 112/128 px).
- ARTE REALISTA POR TEMA (src/lib/gerar-arte-campanha.ts): tarefa
  operacao?tarefa=arte&tema=<tema>[&forcar=1] gera UMA vez com gpt-image-1
  (chave da OpenAI dos Secrets; Gemini de imagem de reserva), sem texto,
  logotipo ou marca, salva no bucket público "campanhas" e registra em
  campanha_artes; o site lê artes_campanhas (useArteSalva) e usa o arquivo
  salvo; sem ele, a cena vetorial. Mudar o prompt = subir VERSAO_ARTE e
  gerar de novo (custo por imagem; nada é gerado por visita).
- ARTES DE ESTÚDIO (Weslei, 05/10, noite: "as artes devem ter como base
  esses exemplos! cenário que simula um estúdio, com o fundo ripado"; e "os
  textos estão excelentes"): public/campanhas/estudio-{criancas,natal,
  black_friday}.webp = a parte do estúdio das artes dele, SEM o texto
  (imagem.estudio no tema: quadro na proporção da arte, câmera lenta
  campanha-camera + reflexo campanha-reflexo, desligados com
  prefers-reduced-motion). Têm prioridade sobre a gerada e a vetorial;
  temas novos seguem o mesmo estúdio. Crianças em lilás como a arte. Textos
  das artes nos títulos: "Um mundo para brincar. / Compare. Escolha.
  Encante.", "Escolhas que viram sorrisos. / Compare antes de presentear.",
  "Compare antes. / Escolha melhor." (Sua próxima melhor escolha). Banners
  completos com texto (public/sazonal/criancas.jpg, natal.jpg,
  black-friday.jpg) só como og:image.
- CENÁRIO INTEGRADO (Weslei, 05/10: "deixar as artes mais elaboradas.
  integre melhor na vitrine. ajuste para as demais vitrines"):
  src/components/CenarioCampanha.tsx. A arte não fica num quadro: ocupa a
  lateral do destaque (PC) ou uma faixa no topo (celular) e se funde no
  fundo por máscara em degradê. Sem cartão flutuante sobre a arte (Weslei,
  05/10: "remova esses cards, estão estragando a vitrine"). Temas sem arte (tecnologia, casa, beleza, marca) usam o mesmo
  estúdio em CSS (parede ripada, arco, piso, pedestais, cartão com ✓) nas
  cores do tema, com as fotos reais nos pedestais. Vale para SecaoCampanha,
  contagem da Black Friday, /natal, /dia-das-criancas e /campanhas/previa.

## Qualidade primeiro nas vitrines (18/10)
- Weslei, 18/10: "Garanta sempre produtos com qualidade!!!!! Boas
  avaliações etc. precisa encantar quem olha".
- Régua única (src/lib/qualidade-avaliacao.ts, testes em
  tests/qualidade-avaliacao.test.ts), com a nota lida na página do anúncio
  da oferta (avaliacoes_da_vitrine_v2 / avaliacoes_por_itens):
  - nota abaixo de 4,5 ou página sem nenhuma avaliação: fora de TODA
    vitrine e do canal;
  - vitrine geral, categorias, brinquedos e campanhas (produtos já
    comparados): só com nota 4,5 ou mais já lida (passaNaQualidade exigindo
    a nota). Alternativa reprovada sai do cartão; o produto fica se a
    oferta dele passar. Leitura das notas que não trouxe nada (falha da
    rede) não esvazia a tela: aí só a nota baixa conhecida barra;
  - mais vendidos (lista oficial, lidos aos poucos pela extensão): os bem
    avaliados na frente, os ainda não lidos depois (bemAvaliadosPrimeiro);
  - campanhas no servidor (vetoDaCuradoria 'nota' + ordenarDaCuradoria:
    vendedor > nota ponderada > frescor > economia; nota ponderada = média
    bayesiana com 10 avaliações de 4,5, pontuacaoDaAvaliacao);
  - canal (garimpo-v6): nota 4,5 ou mais com pelo menos 5 avaliações; sem
    nota lida, só loja oficial (aprovadaParaCanal).
- Visual: cinco estrelas preenchidas até a nota nos cartões (LinhaAvaliacoes)
  e o selo "Muito bem avaliado" sobre a foto (SeloBemAvaliado) só com nota
  4,8 ou mais e 50 avaliações ou mais lidas. Frases nas seções: "Só entram
  produtos com nota 4,5 ou mais de quem comprou" (só quando as notas foram
  lidas) e, nos mais vendidos, "sem os que têm nota abaixo de 4,5 ou
  nenhuma avaliação". Nunca inventa nota nem selo.
- VENDEDOR RECUSADO PELO PROGRAMA (Guardião, 18/10, pedidos 1000041-44: a
  tela recomendou um guarda-roupa de R$ 400 contra R$ 929,99 e o cliente
  clicou 4 vezes; o gerador respondeu "The seller must have reputation
  yellow and up, reputation: 1_red"; o link de reserva veio vazio porque
  nenhum link sai mais da ficha). Migração 20261018170000_vendedor_recusado:
  anuncios_recusados(p_itens) (pública, só códigos; geracoes com erro de
  reputação, "URL not allowed" ou 111 nos últimos 30 dias) -> a tela
  (src/lib/anuncios-recusados.ts, semRecusados no Resultado) marca a oferta
  sem link como semAfiliado: sai da tabela e da recomendação. link_de_reserva
  cai, sem link da ficha, no link da loja mais barata com link próprio da
  comparação mais recente do MESMO produto (senão o do anúncio colado dela),
  com o aviso de que o preço pode ser diferente.

## Mais vendidos do catálogo por categoria (09/10)
- Weslei, 09/10: "um bom volume de produtos em alta para cada categoria,
  tenho poucas opções no meu site hoje"; "catálogos do mercado livre".
- AGENTE (src/lib/em-alta-catalogo.ts, operacao?tarefa=em_alta[&categoria=],
  pg_cron operacao-em-alta de hora em hora, minuto 23): uma categoria do site
  por execução, lista oficial /highlights das categorias MLB de
  CATEGORIAS_EM_ALTA; ficha /products/{id} (nome, foto, buy_box_winner) e,
  sem ela, a oferta NOVA mais barata de /products/{id}/items. Fora: usado,
  peça no lugar do aparelho, sem oferta.
  META DE 24 POR CATEGORIA (Weslei, 09/10: "pelo menos 20 anúncios em
  cada"): abaixo da meta (e sem tentativa nas últimas 2 h) vem primeiro, a
  com menos produtos na frente; depois rodízio pela tentativa mais antiga
  (operacao_execucoes), para uma categoria que não cresce não prender as
  outras. Com menos de 48 à mostra, entram as subcategorias oficiais
  (/categories/{id}, as 8 maiores de cada). Produto lido há menos de 20 h é
  pulado (a próxima execução avança). Tetos: 32 chamadas à API, 16 produtos
  e 4 na fila (pedir_link_agente) por execução, cada produto a cada 48 h.
  disparar_operacao aceita operacao?tarefa=em_alta[&categoria=].
  CATEGORIA PELO NOME (Weslei, 09/10: "está colocando produtos em
  categorias incorretas"): a lista oficial de uma categoria traz produtos
  de outras (Moda: guarda-chuva, presilha; Beleza: papel higiênico,
  fralda; Informática: gift card, power bank, controle de PS5; Celulares:
  tela de reposição). src/lib/categoria-em-alta.ts (categoriaDoMaisVendido,
  testes em tests/categoria-em-alta.test.ts) decide pelo nome, em ordem,
  acima da lista; sem regra, fica a da lista. Fora: código digital de
  valor fixo (gift card, "(Digital)", assinatura), fralda e tela/display
  de reposição. A vitrine usa categoria_do_site (banco) com os mesmos casos
  pelo nome ANTES da árvore do anúncio (guarda-chuva/leque/panos/papel
  higiênico -> casa, presilha -> beleza, mala/mochila -> moda, power bank
  -> celulares, SSD/roteador -> informática, gift card e controle de
  videogame -> eletrônicos, fralda -> outros).
  ÁRVORE E MEMÓRIA (09/10): Moda tem poucos produtos de catálogo nas
  listas de cima; o agente desce até os netos da categoria (8 filhos e 6
  netos, maiores primeiro) e guarda em em_alta_vistos (só servidor) o
  produto descartado (7 dias), a lista sem produto novo (20 h) e os filhos
  de cada categoria (7 dias), para não gastar o teto relendo. Tabela
  em_alta_catalogo (só servidor); leitura pública em_alta_por_categoria(
  p_categoria, p_por_categoria) com até 3 dias e teto POR categoria (a v2
  cortava as últimas abas da home no limite geral).
- SITE (EmAltaCatalogo): "Mais vendidos agora em <categoria>" nas páginas de
  categoria (até 36, grade de 2 colunas no celular) e "Mais vendidos agora"
  com abas na home (12 por aba, abaixo da vitrine).
  Cartão: foto, nome, "Preço de referência (dd/mm)", frete em linha própria
  (grátis só com free_shipping true; senão "confira no anúncio"), "Loja
  oficial" só com official_store_id, selo "Entre os mais vendidos" (lista
  oficial, com a data no subtítulo), "Comprar com segurança" (VerNaLoja: link
  de afiliado no clique) e "Comparar preço". Nunca desconto inventado.

## Mais desejados, 100 por categoria e Acompanhar animado (09/10, noite)
- Weslei: "adicione os itens mais desejados"; "os produtos de informática
  devem ser os mais pesquisados, também os bonitinhos"; "Avalie 100
  anúncios por categoria. Precisa ser incluído e removido sem depender de
  créditos no lovable ou Claude".
- MAIS DESEJADOS: o agente dos mais vendidos também lê a lista oficial de
  buscas em alta da categoria (/trends/MLB/{cat}, guardada 20 h em
  em_alta_vistos) e busca no catálogo até 3 termos por execução (2
  produtos por termo); em Informática, também buscas fixas de periféricos
  bonitos e coloridos (BUSCAS_CURADORIA). em_alta_catalogo.origem
  ('vendidos' | 'tendencia' | 'curadoria') e .busca; leitura pública
  em_alta_por_categoria_v3. Cartão: "Em alta nas buscas" (termo no
  title) ou "Entre os mais vendidos"; Informática mostra primeiro os mais
  buscados, depois a curadoria. Título "Mais vendidos e mais buscados".
- 100 POR CATEGORIA, SOZINHO: pg_cron operacao-em-alta a cada 30 min
  (23 e 53) chama o servidor, que só usa a API oficial do Mercado Livre
  (nada de modelo de linguagem, nada de crédito do Lovable ou do Claude).
  Meta 100, até 2 na fila de comparação por execução. INCLUSÃO pelas
  regras de sempre (categoria pelo nome, sem falso, sem peça, oferta nova,
  loja oficial primeiro); REMOÇÃO: relido e reprovado sai na hora; não
  relido some depois de 3 dias. Página da categoria mostra até 100, em
  blocos de 24.
- ACOMPANHAR ANIMADO (AnimacaoAcompanhar): ilustração sem números (linha
  do preço desce até o preço desejado, ponto acende, sino com "O preço
  caiu!"), 3 repetições e para; prefers-reduced-motion parado. Na home
  com a caixa parada (com "Ver meus preços") e no topo de /meus-precos.

## Campanhas autônomas (09/10)
- PROMPT MESTRE do Weslei (09/10): ordem de decisão regras legais/termos >
  vendedor confiável e qualidade > verdade e frescor > relevância >
  comissão > custo. Comissão nunca aprova produto nem vendedor.
- Banco (20261009090000_campanhas.sql): campanhas (slug, nome,
  beneficio_texto, regras_resumo, tema_visual, fonte calendario/tendencia/
  hub/manual, demanda_tipo, temporada, categoria_site, ufs para a vitrine
  regional, inicia_em, termina_em, revalidar_ate, status descoberta/ativa/
  pausada/expirada/arquivada, link_afiliado_campanha só meli.la),
  campanha_produtos (oferta curada com preço, economia, loja, selos e
  conferido_em) e campanha_metricas (impressões, cliques; conversões vazias:
  sem API de vendas). Tudo com RLS e só servidor; leitura pública só por
  campanhas_ativas(p_uf) e campanha_publica(slug).
- EXPIRAÇÃO EM CAMADAS: pg_cron campanhas-expirar (hora em hora, também
  consolida as métricas); toda leitura filtra status 'ativa' e termina_em >
  now(); o navegador revalida ao voltar para a aba depois de 10 min
  (useRevalidarAoVoltar, src/lib/campanhas-publicas.ts); campanha vencida
  em /campanhas/<slug> mostra "Esta campanha encerrou recentemente" (não
  404). Produto de campanha só com conferência de até 7 dias.
- AGENTE (src/lib/agente-campanhas.ts, operacao?tarefa=campanhas, pg_cron
  07:15 e 17:15 de Brasília): calendário (Dia das Crianças, Natal, Black
  Friday com as datas reais), "Mais vendidos com preço conferido" (listas
  oficiais /highlights em mercado_sinais + "Mais vendido" do hub; rolante de
  3 dias, só continua se renovada, mínimo 4) e "Mais vendidos em Casa/
  Tecnologia/Beleza" (mínimo 6). Pausa manual (status 'pausada') nunca é
  desfeita. Pede nova comparação (pedir_link_agente, teto dos agentes) dos
  produtos de campanha conferidos há mais de 48 h, até 4 por vez.
- CURADORIA (src/lib/curadoria-campanhas.ts): meli.la; sem usado/defeito;
  sem peça (RE_PECA_PARTE); desconto real ou menor preço; frete grátis
  confirmado; conferido em até 7 dias; nota >= 4,5 quando conhecida (hub);
  VENDEDOR CONFIÁVEL na oferta mostrada: loja oficial ou MercadoLíder
  (confiabilidade_da_vitrine lê os selos da última comparação; o
  MercadoLíder do próprio anúncio colado vem da extensão 1.156.0,
  analise.mercadoLider, para o "já é o menor preço"). Sem selo confirmado,
  fora. Ordem: oficial/Platinum, depois até 48 h, depois maior
  economia. 1ª execução (09/10): Dia das Crianças 9 de 37 (23 barrados por
  vendedor), Natal 6 de 45, Mais vendidos 4 de 16.
- TELA: as seções sazonais da vitrine e /natal, /dia-das-criancas usam a
  lista curada da campanha (sem leitura do banco, a conta local de sempre;
  campanha pausada/vencida no banco some). Campanha sem data de verdade
  mostra rótulo fixo ("Mais vendidos · preço conferido"), nunca contagem
  regressiva. Medição: data-origem campanha_<slug> e impressão uma vez por
  seção visível (registrar_evento 'impressao_campanha', só com
  consentimento; src/lib/medicao.ts). Painel: view campanha_metricas_painel.

## Amigo Secreto (Weslei, 05/11/2026)
- Page `/amigo-secreto`: each person's wish text becomes 2-6 themed showcases + "Ideias criativas e semelhantes" (`/api/public/amigo-secreto-interpretar`, model with 3 s limit, local reader `src/lib/amigo-secreto-parser-local.ts` as fallback). The model only writes titles and search terms, never products or prices.
- Each showcase walks its terms round-robin through `/api/public/amigo-secreto-vitrine` (same `buscaGuiada` catalog search, one term per call, own rate counter 40/min) until 50 products, then "+20 opções". One seen-Set per person: no listing repeats across that person's showcases.
- Budget is strict on real cost (`cabeNaFaixa` -> `custoTotalDaOferta`): only confirmed free shipping, international offers (tags cbt_*) excluded. Never pad the count; the counter shows the real number found.
- Cards are `CartaoBusca` (rule no. 1 via VerNaLoja on click). Heart favorites per person, saved on the device (`melhorescolha_amigo_secreto_v2`) and, signed in, in table `amigo_secreto_conta` (RLS per user; migration 20261105190000).
