# Regras do projeto (Weslei Mendes, melhorescolha.io)

Leia também AGENTS.md (nunca force-push nem reescrever histórico publicado).

## Produto
- O site é um COMPARADOR de preços do Mercado Livre. Por enquanto só Mercado Livre.
- Todo link colado precisa ser comparado com o MESMO produto em outras lojas.
- Só mostrar outra loja quando a Gemini confirmou pela foto que é o mesmo produto.
  Produto parecido apresentado como igual é o pior erro possível.
  - Todo "igual" passa por DUAS conferências (a segunda foto com foto, de
    preferência por outro modelo) e qualquer diferença listada reprova.
  - Gemma (mesma chave) quando a Gemini não der (cota, fora do ar, tempo),
    sempre com confiança mínima de 90 (autorizado pelo Weslei em 25/09). Na
    SEGUNDA conferência ele sai JUNTO desde o início (2 modelos de uma vez),
    antes do mesmo modelo da primeira (Weslei, 28/09: "lembre de usar o
    Gemma"). Fotos vão em JPEG (o Gemma não respondia com webp: em 4 dias, 1
    tentativa e erro 500). Cota diária esgotada fica na tabela ia_cotas até
    08:00 UTC, para todas as instâncias do servidor.
  - A foto não precisa ser idêntica (cada vendedor faz a sua): conta o PRODUTO.
    Diferença é o que contradiz o original (marca, cor/borda, modelo, tamanho,
    quantidade, acessório junto), não fundo/ângulo/montagem.
  - Contradição é o que os DOIS anúncios dizem de forma diferente. Nome de
    linha/abreviação que só um título tem não reprova ("Basic 3s" x "Woven 3
    Listras", mesma foto oficial: a loja R$ 83 mais barata tinha ido para
    Parecidos, 27/09). Roupa: peças, cor de cada parte, listras/estampa, logo,
    gola/capuz/zíper, modelagem, gênero; tecido só se os dois informam; tamanho
    da grade não conta. A IA diz mesma_foto e semelhança (0-100). Reprovado com
    a MESMA foto é revisto na segunda conferência (outro modelo) e só vira
    igual com igual + mesma foto + confiança >= 90. Vereditos guardados antes
    de 28/09 00:00 UTC não valem.
  - Regra por categoria (REGRA_CATEGORIAS, servidor e extensão iguais,
    27/09): NUNCA diferença = loja, frete, garantia da loja, palavras de venda,
    sinônimos, embalagem nova, lote/validade, foto de caixa, variação à escolha
    que inclui a do original. SEMPRE diferença = condição (usado,
    recondicionado, vitrine, sem caixa, tester), réplica/compatível, outra
    marca, kit x unidade. Em cada categoria só conta o que os dois informam e
    difere (voltagem, capacidade, compatibilidade do veículo, lado, volume,
    concentração do perfume, tom, sabor, peso do pet, tamanho da fralda,
    plataforma do jogo, edição do livro...). Item único: só o mesmo item.
  - A conferência recebe a categoria (breadcrumb) e a ficha do original
    (tipo, condição, características lidas na página). Condição diferente
    (usado, recondicionado, vitrine...) nunca é igual: pelo título (servidor)
    e pela página de cada loja (item_condition, extensão) vai para Parecidos.
  - MELHOR ALTERNATIVA (Weslei, 28/09: conjunto Woven da loja oficial adidas,
    "opção de melhor benefício para o cliente"): um parecido MAIS BARATO que o
    melhor preço do mesmo produto (>= R$ 2), muito parecido (semelhança >= 85
    ou mesma foto) e sem frete pago ganha cartão próprio abaixo da Melhor
    opção, com 🔥, botão animado e os motivos conferidos: "Mais completo"
    (vantagem que a conferência aponta), "Custo reduzido" (calculado) e "Loja
    oficial da marca" (só com selo confirmado). Sempre com "Não é idêntico ao
    anúncio que você colou. Muda: ...". Nunca vai para a tabela do mesmo produto.
    Mais barato porque vem MENOS (quantidade, kit x unidade, tamanho, volume,
    sem acessório) ou para outro uso/condição NÃO é alternativa (28/09: "10
    cabides" x 30, "1un" x 3 pipetas): lista MUDA_NAO_E_ALTERNATIVA no site =
    muda_nao_e_alternativa() no banco. Na vitrine o produto com alternativa
    ganha o selo "Até R$ X de desconto" (contra o preço do anúncio colado).
  - Parecidos em ordem de semelhança (mesma foto, semelhança, preço), com o
    aviso "Mesma foto do anúncio colado" quando for o caso.
  - "Parecidos" (mesmo tipo e compatibilidade, muda marca/detalhe) aparecem
    SEPARADOS, com aviso "não é o mesmo produto" e o que muda, cada um com o
    link de afiliado (Weslei, 25/09).
  - O Adapta One não oferece API das IAs (central de ajuda deles): não serve
    para o comparador.
- Todo link de compra precisa ser o link de afiliado do Weslei. SEMPRE devolver o
  link de afiliado dele, inclusive do anúncio que o cliente colou; se a geração
  falhar, tentar de novo e oferecer o botão que gera o link no clique.
- Sempre mostrar a "Melhor opção", mesmo quando é o próprio anúncio colado.
- Mostrar TODAS as lojas comparadas (tabela zebrada), cada uma com o link de
  afiliado próprio (gerado pelo endereço do anúncio da loja, não da ficha).
- A consulta do cliente deve terminar em até 1 minuto (meta interna). Para o
  público o texto é "em menos de 2 minutos" (Weslei, 27/09: não prometer 1
  minuto; medido 24–27/09 nos pedidos do site com tempo registrado: 89 de 91
  com o 1º resultado em menos de 2 min, metade em até 32 s). Previsões de tempo na tela vêm de medição real (função
  tempo_estimado), nunca inventadas.

- Frete conta: loja com frete PAGO nunca vira "mais barata"/recomendação
  (R$ 57 + R$ 32,99 de frete saía mais caro que R$ 86,90 com frete grátis).
  Na tabela aparece "Frete grátis" ou "Sem frete grátis".
  Frete é o que o COMPRADOR paga (26/09): free_shipping/has_free_shipping
  false só diz que o vendedor não banca. Fonte certa: shipping.cost da lista
  oficial de ofertas (0 = grátis, > 0 = pago; Baba Black R$ 57 cost 44,92) e o
  texto "grátis" no cartão da busca. Sem isso, "não sei" (a tela não afirma).
  Nunca deduzir pela regra geral de R$ 19 (errou no Baba Black).
- Mesma loja do link colado entra na comparação só com OUTRO anúncio dela
  mais barato ("Mesma loja, outro anúncio"; Camelo R$ 78,54 x R$ 86,90).
- UMA recomendação só: é sempre a mesma linha que leva o selo "Mais barato"
  na tabela (Advocate, 26/09: tabela e recomendação apontavam lojas diferentes).
- SEMPRE o link de afiliado do Weslei em todo botão (26/09: "foi para isso
  que eu criei o site"). Nunca endereço sem afiliado.
- Anúncio que o programa recusa ("URL not allowed", erro 111): pela ficha o
  gerador devolve o mesmo link do anúncio colado (um link por ficha), que abre
  na oferta principal (medido em 26/09, Advocate). A extensão tenta a forma
  MLB-...-_JM; não dando, a loja fica na tabela com o link da ficha e o aviso
  "escolha esta loja em Outras opções de compra" (semAfiliado), e a
  recomendação é a mais barata com link PRÓPRIO e frete grátis (Weslei, 26/09).
  O cadastro não chama o gerador de novo para anúncio recusado há menos de 24 h.
- Loja oficial (Weslei, 27/09: a mais barata do agasalho era a loja oficial
  da adidas): selo "Loja oficial" na tabela, no anúncio colado e na
  recomendação ("Vendido pela loja oficial X"). Fonte: official_store_id da
  lista oficial de ofertas e, na página do anúncio, o evento do vendedor
  ("seller_name"... "official_store_id"; sem o campo = loja comum). Em empate
  de preço (< R$ 0,50) a oficial vem primeiro.
- À vista x parcelado (Weslei, 28/09): o preço da página (meta itemprop) é
  o do Pix quando há desconto no Pix. A extensão lê do evento do PRÓPRIO
  anúncio (precosDoItem) o cheio, o Pix e o parcelamento, e o site mostra
  "no Pix · ou R$ X em Nx" onde souber (colado, tabela, parecidos,
  alternativa). Sem a informação, não afirma.
- Parecidos: menor diferença primeiro (semelhança >= 85 na frente; dentro do
  grupo, a menor diferença de preço). Mesma foto em variante (armazenamento,
  cor, tamanho, voltagem) não gera o aviso de "foto de outro produto".
- Economia sempre contra o preço que a página mostra ao cliente (a API pode
  trazer outro: Advocate R$ 169,90 na API x R$ 147,81 na página).
- Busca dos links SEM teto diário (o teto era dos cupons). Fica só o freio de
  captcha/tráfego suspeito e o ritmo de um pedido por vez.

- Link repetido (mesmo link, análise completa há menos de 1 h) volta na hora
  (pedir_link). A bateria de testes usa pedir_link_novo, que sempre busca.

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
  escolher" (/api/public/ajudar-escolher: pesa valor, frete, loja oficial,
  características, vantagens e diferenças; uma análise por pedido guardada em
  ajuda_escolha). A resposta SEMPRE traz o botão com o link de afiliado; só
  entram opções com link próprio. Parecido só é escolhido se for mais barato
  que o melhor mesmo produto, sem frete pago e sem "vem menos". Sem modelo, a
  escolha é calculada. GPT (chave da OpenAI nos Secrets, OPENAI_API_KEY ou
  variações; modelo em OPENAI_MODEL) responde primeiro, Gemini/Gemma de
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

## Conta e segurança
- Proteger a conta de afiliado: sem rajadas de leitura; freio em captcha.
- Sem janela anônima (Weslei, 26/09): toda leitura é logada, com freio em
  captcha/"tráfego suspeito" e um pedido por vez.
- Não trocar a Gemini pela "Lovable AI" (plano sem crédito: responde 402).
- Nunca pedir nem colocar chaves no código ou no chat (vão nos Secrets do Lovable).
- Banco (27/09): função que GRAVA e é pública exige a senha da extensão
  (p_token) ou fica só para o banco. O site pede com pedir_comparacao /
  pedir_link_da_loja (limite: 15 pedidos novos/min, 150/h) e lê o resultado com
  ver_pedido(id, chave). A vitrine é gravada só pelo gatilho do banco.
  Ver o que os outros pesquisaram é PÚBLICO de propósito (Weslei, 27/09):
  vitrine e consultar_pedido abertos para leitura, SEM prazo (toda pesquisa
  fica registrada). A tela mostra "Comparado há X" SEMPRE com o botão
  "Atualizar comparação" (compara de novo na hora); passada 1 hora, o texto pede
  para atualizar antes de comprar. Proteger só a GRAVAÇÃO.

## Garantia (obrigatório a cada versão)
- O cliente SEMPRE recebe: produto, preço, o link de afiliado e a comparação
  possível. Cada etapa tem plano B: leitura do código da página → aba logada →
  leitura da TELA (preço/loja/título/foto como a pessoa vê).
  Nunca tela vazia: sem dado, o site mostra o que tem com o botão do link.
- Conferência em lotes de até 4 em paralelo; lote que falha (cota, tempo) não
  derruba os outros. Cota gratuita da Gemini: 2.5-flash e flash-latest têm 20
  pedidos/dia (28/09); o flash-lite segura o dia a dia.
- GARIMPO DE VERDADE (Weslei, 27/09: "sempre a melhor opção de verdade, esse
  é meu diferencial"): a conferência pela foto olha 12 anúncios (lotes de 4 em
  paralelo no servidor), escolhidos por escolherParaConferir: PRIMEIRO os mais
  baratos que o colado (achados da busca nas lojas oficiais na frente, depois
  título mais parecido), com 4 vagas para os mais caros (tabela). Buscas
  extras: só entre lojas oficiais (urlDeBusca + "_Loja_all") e pelo menor
  preço na faixa do produto ("_OrderId_PRICE_PriceRange_min-max", 28/09). Dos aprovados, os 5
  mais baratos são abertos: até 5 lojas do mesmo produto na tabela. Caso real:
  agasalho "Basic 3s" x "Woven 3 Listras" da adidas oficial, R$ 83 mais
  barato, sumia em metade das consultas por título pouco parecido.
- Produtos relacionados da página colada (carrosséis do Mercado Livre) viram
  mais uma fonte de candidatos (relacionadosDaPagina), com a mesma conferência
  pela foto: só entram na tabela se forem o mesmo produto (Weslei, 27/09:
  "somente quando for útil de verdade").
- Anúncio colado que se contradiz (foto de um produto, texto de outro; caso da
  SHOPMASP: foto do conjunto Woven, descrição "malha macia" do Basic 3S
  tricot): o site avisa "a foto e o texto não batem, confirme com o vendedor"
  (original_contradiz da conferência) ou, sem isso, "a foto deste anúncio é a
  mesma de outro produto (...)" quando um parecido tem a MESMA foto.
  Nunca escolher sozinho um dos dois.
- SEMPRE indicar a loja (Weslei, 28/09: "máxima transparência"): tabela,
  recomendação, Melhor alternativa e Parecidos mostram "Vendido por X" (os 5
  parecidos mais próximos têm a página lida). Selos do Mercado Livre quando
  houver: "Loja oficial" e "MercadoLíder Platinum/Gold" (power_seller_status
  do evento do PRÓPRIO anúncio, só se o nome do vendedor do evento bater com
  a loja lida).
- Selo "Loja oficial" IGUAL ao do Mercado Livre. Vem da lista oficial de
  ofertas (API, official_store_id) e dos anúncios achados na busca com o
  filtro "Lojas oficiais" (_Loja_all; conferido em 28/09, pedido 461: veio a
  adidas e nenhum anúncio da SHOPMASP). A leitura pela página está DESLIGADA
  (28/09: a SHOPMASP saiu como oficial duas vezes, mesmo lendo só o evento do
  próprio anúncio); a extensão guarda amostras ("loja-oficial-amostra") para
  acertar a leitura antes de religar. Selo errado é pior que nenhum.
- A busca em outras lojas roda SEMPRE (catálogo oficial + Google/busca), e os
  resultados são juntados. Nunca pular a busca porque o catálogo já achou algo.
- SEMPRE comparação com outras lojas para qualquer produto (Weslei, 26/09):
  as vagas da conferência pela foto que sobram vão para os outros anúncios da
  mesma busca na faixa de preço (Itan MLG-202: só o próprio anúncio passava
  no filtro de título). Sai o mesmo produto (tabela) ou "Parecidos".
- Não desapontar o cliente enquanto não achar opção mais barata ou a análise
  não estiver completa: o resultado sai em até 1 minuto com o link, e a
  comparação incompleta (busca falhou, IA fora do ar, loja sem link) é refeita
  pela "segunda volta" da extensão (até 2 vezes), atualizando a tela sozinha.
  Nunca frase de "não consegui comparar" / "tente de novo" no resultado.
- Antes de publicar a extensão: ferramentas/verificar-extensao.sh (sintaxe,
  variável sem definição/import, testes). Um import esquecido na 1.97 derrubou
  a comparação inteira e "node --check" não pega isso.
- Antes de dizer ao Weslei que está pronto: rodar ferramentas/bateria-de-testes.sql
  (capinha, travesseiro, Eudora, disco de freio, monitor em página de oferta,
  pista dinossauro) na versão nova e conferir todas as metas. Falhou alguma:
  corrigir e rodar de novo. Só então avisar.

## Publicação
- Branch claude/ml-etiquetas-cupons-k6tgkj e main recebem o mesmo commit.
- Depois do push: esperar list_edits "completed" e chamar deploy_project.
  Sem o deploy_project o site continua na versão anterior (28/09: a vitrine
  ficou sem o selo novo e parecia que a melhoria tinha sumido).
- Mudança na extensão sobe a versão em extensao/manifest.json; o Weslei
  atualiza rodando ferramentas/ATUALIZAR-EXTENSAO.bat.
