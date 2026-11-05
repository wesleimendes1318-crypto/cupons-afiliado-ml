# comparacao (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Comparison engine: same-product rules, photo check, alternatives, safe recommendation, other marketplaces, reviews, delivery, fakes.

## Produto
- O site é um COMPARADOR de preços do Mercado Livre. A recomendação é sempre
  do Mercado Livre; Amazon e Shopee têm a mesma análise em seções próprias
  e entram na "Comparação final" dos 3 marketplaces, onde só disputam o
  mais barato com custo confirmado (ver "Mesma análise em cada marketplace
  e comparação final dos 3 (09/10, noite)"). SOB DEMANDA (10/10): a busca
  na Amazon e na Shopee só roda quando o cliente pede (ver "Amazon e
  Shopee sob demanda (10/10)").
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
  - PEÇA NO LUGAR DO APARELHO (30/09, pedido 535: "Carcaça ... Sa 203" de
    R$ 76,63 saiu como o mesmo controle de acesso de R$ 454,35): original que
    não é peça x candidato carcaça, tampa, moldura, frontal, display/tela
    avulsa, refil ou peça de reposição nunca é igual (RE_PECA_PARTE /
    pecaNoLugarDoAparelho, extensão e servidor iguais; "com tampa" não conta).
    Vai para Parecidos com "Apenas carcaça / peça de reposição". A regra
    também está no texto da conferência (REGRA_CATEGORIAS).
  - Ofertas lidas da própria página do anúncio (/up/) e fichas de catálogo
    achadas pelo NOME no servidor (daApi + achadoNaBusca/porNome) também
    passam pela conferência pela foto; sem conferência não entram (pedidos
    535 e 551, com a IA fora do ar). Só a lista da ficha do PRÓPRIO anúncio
    dispensa a conferência. mesmoNome (servidor) recusa ficha de peça.
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
    oficial da marca" (só com selo confirmado). Fica no TOPO da coluna da
    direita, acima da tabela e dos Parecidos (Weslei, 03/10; no celular
    depois da Melhor opção). ECONOMIA MOSTRADA (Weslei, 03/10, ajuste global
    em site, "Me ajude a escolher" e Telegram): contra o ANÚNCIO COLADO, não
    contra o total da melhor loja (geladeira: R$ 19,44 virava R$ 687,58), e
    pelo CUSTO REAL: com frete conhecido, produto + frete dos dois lados
    ("a menos no custo final, já com o frete"); sem frete conhecido, "no
    produto". A escolha da alternativa continua pela regra acima. Sempre com "Não é idêntico ao
    anúncio que você colou. Muda: ...". Nunca vai para a tabela do mesmo produto.
    Mais barato porque vem MENOS (quantidade, kit x unidade, tamanho, volume,
    sem acessório) ou para outro uso/condição NÃO é alternativa (28/09: "10
    cabides" x 30, "1un" x 3 pipetas): lista MUDA_NAO_E_ALTERNATIVA no site =
    muda_nao_e_alternativa() no banco. Quantidade diferente VALE (Weslei,
    28/09: "pode haver variação em quantidade, mas precisa analisar a
    semelhança e custo-benefício") quando os dois títulos trazem a medida e o
    preço por unidade/litro/kg sai >= 2% menor (podeSerAlternativa; cartão
    mostra "Custo-benefício: R$ X por unidade (você colou R$ Y)"), com 5
    pontos a menos na nota para a mesma quantidade vir na frente. Condição,
    compatibilidade, voltagem, réplica e "sem" nunca. A vitrine (banco)
    continua só com a mesma quantidade (o selo é desconto no total). Na vitrine o produto com alternativa
    ganha o selo "Até R$ X de desconto" (contra o preço do anúncio colado).
    Escolha entre vários: nota = semelhança + 10 x parte do título colado no
    título do parecido ("3s" = "3 listras"), depois o mais barato
    (notaDeAlternativa = alternativa_da_analise; 28/09: o Linear R$ 3,70 mais
    barato tomou o lugar do Woven, o modelo mais próximo).
  - PREMISSA DE QUALIDADE (Weslei, 05/10: "a recomendação não deve oferecer
    somente o menor valor, mas também a melhor qualidade ou equivalente do
    que foi buscado. Isso é uma premissa"; caso: projetor L018 Full HD x
    Magcubic HY300 Pro mini/720p pela metade do preço saiu como alternativa e
    no canal). Melhor alternativa (site, "Me ajude a escolher", bot, canal,
    vitrine) só com qualidade EQUIVALENTE ou SUPERIOR (src/lib/qualidade.ts,
    qualidadeDoParecido/qualidadeAceita): 1) piora objetiva veta (resolução
    nativa menor, menos brilho/capacidade/armazenamento/memória/potência/
    bateria, versão mini); 2) veredito da conferência (campo qualidade +
    qualidade_motivo no prompt do servidor e da extensão, guardado em
    ia_vereditos; parecido guardado sem qualidade é conferido de novo);
    3) só muda cor/acabamento/estampa -> equivalente; 4) senão "incerta" e
    não recomenda (continua nos Parecidos com "Qualidade não confirmada").
    Parecidos e Melhor alternativa mostram a qualidade (✓ equivalente/
    superior, ⚠ inferior, ? não confirmada); canal e bot também. Banco:
    alternativa_da_analise com a mesma premissa (sem comparar fichas).
    Nunca julgar qualidade pelo preço.
  - DESVANTAGENS (Weslei, 05/10: "precisa ter a indicação de desvantagens,
    quando houver"; "não deve analisar apenas a foto, deve pensar como um
    comprador"): a conferência (servidor e extensão) devolve "desvantagens"
    olhando foto, título, ficha e descrição (guardadas em
    ia_vereditos.desvantagens); desvantagensDoParecido (src/lib/qualidade.ts)
    junta com a piora objetiva das fichas, sem repetir assunto e sem frete
    (frete tem linha própria). Site (bloco vermelho "Desvantagens em relação
    ao seu"), bot, canal e "Me ajude a escolher" mostram. Nunca inventa.
  - APRENDER COM O CLIENTE (05/10): "Esta indicação faz sentido para você?"
    em cada Parecido e na Melhor alternativa (avaliar_indicacao, sem IP/id,
    60/min). "Não é equivalente" só rebaixa (qualidade 'incerta' no veredito
    guardado e no pedido; a vitrine se atualiza pelo gatilho); "Sim" nunca
    promove, só conta (view aprendizado_indicacoes, relatório semanal).
  - Parecidos com o aviso "Mesma foto do anúncio colado" quando for o caso
    (ordem: ver "Parecidos" em Texto e visual).
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

- Frete conta: loja com frete PAGO de valor DESCONHECIDO nunca vira "mais
  barata"/recomendação (R$ 57 + R$ 32,99 de frete saía mais caro que R$ 86,90
  com frete grátis). MELHOR ESCOLHA PELO TOTAL (Weslei, 02/10: "use a melhor
  escolha para o cliente"): com o frete para o CEP conhecido, decide produto
  + frete (geladeira: R$ 4.699,99 + R$ 33 = R$ 4.732,99 x R$ 5.051,58 com
  frete grátis -> a de R$ 4.732,99 é a recomendação, "já com o frete", e o
  card mostra produto, frete e total). Site (totalDaLoja), "Me ajude a
  escolher" (totalDaOpcao) e extensão (alts e link rápido) usam a mesma conta.
  Na tabela aparece "Frete grátis" ou "Sem frete grátis".
  NUNCA juntar valor em reais com "frete" na mesma expressão (02/10, pedido
  563: "R$ 2.706,58 a menos + frete" parecia frete de R$ 2 mil; era R$ 1,00).
  A diferença diz "a menos no produto" / "a mais no produto" / "mesmo preço
  no produto" e o frete vai em linha própria: "(frete de R$ X à parte)" ou
  "(frete à parte)"; na coluna da loja, "Frete R$ X" ou "Sem frete grátis".
  Frete é o que o COMPRADOR paga (26/09): free_shipping/has_free_shipping
  false só diz que o vendedor não banca. Fonte certa: shipping.cost da lista
  oficial de ofertas (0 = grátis, > 0 = pago; Baba Black R$ 57 cost 44,92) e o
  texto "grátis" no cartão da busca. Sem isso, "não sei" (a tela não afirma).
  Nunca deduzir pela regra geral de R$ 19 (errou no Baba Black).
- Loja do MESMO produto recusada pelo programa (semAfiliado/mesmaPagina) também
  sai da tabela (02/10, geladeira: R$ 2.345 com "escolha em Outras opções",
  mas o link da ficha abria o perfil social só com a Magalu de R$ 5.051).
  Preço que o botão não entrega não aparece.
- Parecido recusado pelo programa (semAfiliado) não aparece no site, nem
  como alternativa nem no "Me ajude a escolher" (pedido 525, 30/09: mostrava
  "R$ 205 a menos" e o botão abria o anúncio colado de R$ 954).
- CEP AUTOMÁTICO E TRANSPARENTE (Weslei, 02/10): região pelo IP
  (/api/public/regiao: request.cf/cabeçalhos cf-* da Cloudflare; CEP da
  capital quando só a UF é conhecida; nada gravado, sem IP na resposta) e
  guardada no navegador. A hospedagem não repassava a localização da
  Cloudflare (03/10, todos viam São Paulo): sem ela, cidade pelo IP
  (ipwho.is, reserva ipapi.co; IP não gravado nem devolvido) e um CEP real
  DA CIDADE pelo ViaCEP (busca "Rua", de preferência Centro). Campo "fonte"
  na resposta (hospedagem/ip/padrao). Botão "📍 Usar minha localização"
  (GPS com permissão; OpenStreetMap + ViaCEP no navegador) e o CEP digitado
  mostram bairro, cidade/UF. LOCALIZAÇÃO EXATA UMA VEZ (Weslei, 03/10): o
  navegador pede a permissão uma única vez (primeiro toque no campo do link;
  flag melhorescolha:geo-pedido) e a região exata fica guardada no navegador;
  quem já liberou tem a localização lida sozinha. Sem nada disso, referência
  nacional São Paulo
  01001-000 marcada "padrão, informe o seu" (não fica salva; 02/10). Selo
  SEMPRE visível: "📍 Frete para: Cidade/UF (CEP) · Alterar"
  com ViaCEP (src/components/CepDestino.tsx). O CEP vai no pedido
  (pedir_comparacao(p_url, p_nova, p_cep) -> pedidos_link.cep_destino; a
  versão de 2 argumentos continua). O frete para o CEP é simulado no
  SERVIDOR pela API oficial (/api/public/frete-cep ->
  /items/{id}/shipping_options?zip_code=, só leitura; conferido em 02/10:
  capinha grátis para SP, R$ 74,99 para Manaus). A extensão só manda o número
  do pedido e aplica o resultado (freteGratis, custoFrete, cepDestino): NUNCA
  muda endereço nem CEP da conta de afiliado. Frete pago continua nunca
  passando na frente; a tabela mostra "Frete R$ X" e "frete para CEP".
  Diagnóstico: sinc_config.frete_cep_ultimo e frete_cep_diag.
- Mesma loja do link colado entra na comparação só com OUTRO anúncio dela
  mais barato ("Mesma loja, outro anúncio"; Camelo R$ 78,54 x R$ 86,90).
- UMA recomendação só: é sempre a mesma linha que leva o selo "Mais barato"
  na tabela (Advocate, 26/09: tabela e recomendação apontavam lojas diferentes).
- SEMPRE o link de afiliado do Weslei em todo botão (26/09: "foi para isso
  que eu criei o site"). Nunca endereço sem afiliado.
  Trava no código (05/10, src/lib/afiliado.ts): só https://meli.la/<código>
  é link de compra; outro endereço é descartado na leitura do pedido
  (analiseSoComAfiliado) e o botão gera o link no clique (VerNaLoja). Vale
  para tela, vitrine, Meus preços, bot e "Me ajude a escolher".
- LINK NUNCA PODE PARAR (28/09, grave: das 19:36 em diante nenhum link saiu,
  "No tab with id"; a fila inteira usava uma aba só e ela sumiu). Toda chamada
  ao gerador passa por abaViva (aba morta, descartada ou fora do domínio →
  outra aba na hora, vale para o resto da fila). Link do anúncio colado: 1ª
  tentativa, 2ª com o endereço do anúncio, 3ª numa aba NOVA do gerador
  (gerarEmAbaNova). Vigia de hora em hora: pedido pronto sem link na última
  hora = alerta ao Weslei.
- Link RÁPIDO da recomendação (Weslei, 28/09; Kokeshi, pedido 506): antes de
  gravar a análise, a extensão gera o link da loja que vira a recomendação
  (mais barata que o colado, sem frete pago, inclusive da lista do catálogo)
  e da provável Melhor alternativa (linksDaRecomendacao, no máximo 2, 15 s).
  O resto da tabela e dos parecidos continua no lote depois da fila.
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
  alternativa, Melhor opção). Sem a informação, não afirma. Parcelado que sai
  MAIS CARO sempre aparece com o total e a diferença (Weslei, 02/10: "não deve
  inventar nada, sempre indique o valor parcelado se sai mais caro"):
  "parcelado: 10x de R$ 359,90 sem juros = R$ 3.599,00 (R$ 180,00 a mais)".
- Parecidos (Weslei, 28/09: "o foco está no mais semelhante com custo
  reduzido"; "assertivas em relação ao que foi buscado"): semelhança >= 85
  na frente; dentro disso, os MAIS BARATOS que o colado primeiro, do mais
  semelhante (semelhança + título) para o menos; depois os mais caros, da
  menor diferença de preço para a maior. Os menos parecidos (< 85) ficam
  recolhidos em "Ver N menos parecidos" (sem nenhum muito parecido, mostra
  todos). Mesma foto em variante (armazenamento,
  cor, tamanho, voltagem) não gera o aviso de "foto de outro produto".
- Economia sempre contra o preço que a página mostra ao cliente (a API pode
  trazer outro: Advocate R$ 169,90 na API x R$ 147,81 na página).
- "Ver detalhes do anúncio" nos cartões da vitrine geral, campanhas e
  brinquedos (DetalhesVitrine, RPC pública detalhes_da_vitrine(chave)):
  características, destaques e descrição lidos na comparação, preço com a
  data, compra só meli.la (Weslei, 05/10). Botão "Ver fotos e detalhes":
  carrossel de fotos (Weslei: "precisa dar opção de ver as fotos", "deixe
  como carrossel"; scroll-snap, setas, miniaturas e contador) com a foto do
  anúncio + a galeria do produto de catálogo (/api/public/fotos?produto=,
  API oficial /products/{id}, só endereços mlstatic, cache 6 h).
- Compartilhar a indicação: WhatsApp e Telegram lado a lado (o link de
  afiliado vai no campo url do Telegram).
- Busca dos links SEM teto diário (o teto era dos cupons). Fica só o freio de
  captcha/tráfego suspeito e o ritmo de um pedido por vez.

- Link repetido (mesmo link, análise completa há menos de 1 h) volta na hora
  (pedir_link). A bateria de testes usa pedir_link_novo, que sempre busca.

## Recomendação segura (18/10)
- Weslei, 18/10 (ar-condicionado LG, pedido 1000048: R$ 1.199 numa loja
  sem selo contra R$ 2.250 a R$ 4.800 nas outras saía como "Minha
  recomendação"): "Pode recomendar, desde que seja afiliado. Nestes casos
  considere a avaliação também. De forma geral preciso oferecer segurança
  para quem compra".
- Régua única src/lib/recomendacao-segura.ts (seguraParaRecomendar, testes
  em tests/recomendacao-segura.test.ts), na tela (candidatas do
  BuscaPorLink) e em decisaoDaTela (bot, "Me ajude a escolher", garimpo):
  - nota baixa conhecida (abaixo de 4,5) nunca vira recomendação;
  - preço muito abaixo das outras lojas (abaixo de 70% da mediana, 3 ou
    mais preços) só com o link de afiliado JÁ gerado (o programa aceitou o
    vendedor) E nota 4,5 ou mais com pelo menos 5 avaliações guardadas na
    comparação; sem nota, só loja oficial (a régua do canal).
  - A conta é pelo CUSTO para o cliente: produto + frete de valor conhecido
    (custosDoMesmoProduto; pó facial R$ 8 + R$ 9,99 de frete contra R$ 20
    com frete grátis não é "muito abaixo"). O aviso da tabela usa a mesma
    conta.
- Quem não passa continua na tabela com o aviso "Preço muito abaixo das
  outras lojas: confira o vendedor antes de comprar"; a recomendação vai
  para a próxima loja segura (selo "Melhor opção"). Quem passa ganha o
  mesmo aviso no cartão "Minha recomendação".

## Prazo de entrega: "Receber até" (06/10)
- Weslei, 06/10: "presente de aniversário ou até quando você pode receber";
  "deve implementar em todos os canais, site, telegram". Estimativa OFICIAL
  por anúncio e CEP (/items/{id}/shipping_options, só entrega no endereço):
  atende só quando a data MAIS TARDIA da faixa (offset.date) é <= a data
  escolhida; usa a opção de envio mais barata que chega (pode ser paga, e o
  total passa a contar esse frete). Sem data confirmada = fora do filtro,
  nunca "rápido". src/lib/prazo-entrega.ts (datas de Brasília, aplicarPrazo,
  dataDoTexto), src/lib/prazo-servidor.ts (cache prazo_entrega_cache 30 min,
  freio de 400 consultas novas em 5 min), /api/public/prazo-entrega
  ({pedido, cep}).
- Site (FiltroPrazo no resultado): chips Receba hoje / amanhã / Este fim de
  semana / Escolher data limite, selo "Entregas até: DD/MM/AAAA · Remover" e
  o aviso oficial textual (AVISO_PRAZO). Tabela, Melhor opção, Melhor
  alternativa e Parecidos só com o que chega; o resto recolhido ("X lojas
  mais baratas entregam após ..."), "💡 Economia vs Urgência" e, com o colado
  fora do prazo, "📦 Para receber até" com a loja que chega (só meli.la).
  Nenhuma a tempo: "Nenhuma loja confirmou entrega até esta data para seu
  CEP" e a comparação sem filtro.
- Cards (05/11, "Data de Entrega Real" spec): LinhaEntrega
  (src/components/LinhaEntrega.tsx) on CartaoBusca, CartaoEmAlta and
  CartaoBrinquedo shows the official date for the listing the buy button
  opens: "Receba hoje" / "Chega amanhã, DD/MM" (green) or "Chega até
  ter., 10/11" (blue), "Frete grátis · ..." when the fastest option is free.
  Only with a typed or device CEP (IP-approximate CEP does not promise
  dates): otherwise "Informe o CEP para ver a data de entrega" opens CepTopo
  (event "abrir-cep"). No date = "Frete e prazo no anúncio". Batched by
  src/lib/prazo-cliente.ts into /api/public/prazo-itens ({itens <= 20, cep}
  -> {prazos: {MLB: {chega_ate, tipo, custo, frete_gratis} | null}}), same
  cache and brake as prazo-entrega. Toy cards with "R$ X a menos" (other
  store's link, unknown listing) keep the shipping line only.
- Guided search: FiltroPrazo (collapsed) above the grid; cards that arrive
  after the date or have no date go to a collapsed "X opções mais baratas
  entregam após DD/MM/AAAA" block. Chip "Antes do Natal (24/12)" from 01/11
  to 24/12 (also on the comparison).
- Bot: link + "até 10/10" / "receber amanhã" / "fim de semana" + CEP no texto
  (CEP guardado em telegram_chats.cep); mensagemComPrazo com as mesmas
  regras. Extensão 1.154.0 guarda o anúncio (item) de cada loja.
- Vitrine geral (06/10, Apple Watch Series 4 "arranhado e quebrado, frete
  não é grátis"): só entra o que foi comparado de verdade (outra loja ou
  alternativa), sem sinal de usado/defeito no título e com frete grátis
  confirmado (src/lib/vitrine-recomendavel.ts).
- Botões "Início" e "Voltar ao topo" (BotoesNavegacao, canto inferior
  esquerdo, depois de rolar) em todas as páginas.

## Produto falso e categorias novas (09/10, noite)
- NÃO INDICAR PRODUTO FALSO (Weslei, 09/10): src/lib/falsificado.ts
  (pareceFalso) recusa réplica, "1:1", primeira linha, linha AAA,
  inspirado/contratipo, "similar ao original", clone e modelo famoso sem a
  marca (AirPods/i12 TWS/fone "Pro 4" sem marca conhecida, smartwatch
  "Series 10/S10/Ultra" sem Apple). Vale nos mais vendidos
  (categoriaDoMaisVendido), vitrine (recomendavel), campanhas (veto
  condicao) e canal (cron-garimpo). Testes em tests/falsificado.test.ts.
- CATEGORIAS NOVAS (em alta nos sinais de 03-09/10): Eletrodomésticos
  (MLB5726, saiu de Casa) e Ferramentas e EPI (MLB263532 + MLB270252),
  com página, conteúdo, arte e regras pelo nome (categoria-em-alta e
  categoria_do_site). Meta dos mais vendidos: 48 por categoria; página da
  categoria com até 60 em blocos de 24 ("Ver mais").
- ARTES: Eletrodomésticos gerada no Higgsfield (nano_banana_2_1, a arte da
  cozinha como referência de estilo; sem marca nem texto); Ferramentas usa
  "Mãos à obra" do acervo. FaixaArte (src/components/FaixaArte.tsx): a
  arte da categoria numa faixa sem texto, com link para a página, nas abas
  de "Mais vendidos agora" e "Produtos que já comparei" da home.

## Outros marketplaces, busca por foto e Facebook (09/10)
- PROMPT MESTRE do Weslei (09/10). Tudo ligado por Secrets (Lovable); sem a
  chave, a parte não faz nada e o Mercado Livre carrega como sempre. Toda
  chamada externa com prazo e Promise.allSettled.
- AFILIADO POR MARKETPLACE (src/lib/afiliado.ts, ehLinkDeCompra): Mercado
  Livre só meli.la; Amazon com tag=melhoresc0fff-20 ou amzn.to; Shopee
  s.shopee.com.br ou shope.ee. Outro endereço é descartado. Botão sempre
  "Comprar com segurança", sem nome da loja.
- AMAZON E SHOPEE (src/lib/coletor-multiloja.ts, src/lib/integracoes/):
  Amazon pela Creators API (a PA-API 5 foi desligada em 2026; Secrets
  AMAZON_CREATORS_CREDENTIAL_ID, AMAZON_CREATORS_CREDENTIAL_SECRET,
  AMAZON_CREATORS_VERSION, padrão 3.1), só condição Nova, Prime primeiro;
  Shopee pela Affiliate Open API (SHOPEE_AFFILIATE_APP_ID,
  SHOPEE_AFFILIATE_SECRET; comissão nunca é pedida nem mostrada). Até 4
  de cada marketplace (escolherCandidatos) passam pela conferência pela foto
  (conferirMesmoProduto, chave "amazon:<asin>"/"shopee:<id>"): igual =
  "Mesmo produto", parecido = "Parecido" com "Não é idêntico. Muda: ...",
  conferência que falha = nada entra; peça no lugar do aparelho fora.
  /api/public/multiloja ({pedido}, cache 6 h em multiloja_resultados, só
  servidor; freio de 40 novos em 5 min) alimenta ComparacaoMarketplaces
  (ver a seção da comparação final dos 3): selo neutro do marketplace (só o
  nome), "Prime", frete em linha própria. Frete da Shopee é desconhecido e
  o Prime é só para assinantes: nada disso passa na frente da
  recomendação. Bot, canal e vitrine ainda não mostram outros marketplaces.
- BUSCA POR FOTO (Weslei, 09/10): botão de câmera ao lado do campo do link
  abre "Tirar foto" (capture="environment", só em tela de toque) e "Da
  galeria" ("Escolher imagem" no PC). SEMPRE COM CONSENTIMENTO (Weslei,
  09/10): prévia + "Usar esta foto?" antes de qualquer envio; nada sai do
  aparelho sem o toque em "Usar esta foto". Foto reduzida no navegador (1024 px, JPEG 80%,
  src/lib/otimizar-imagem.ts) e enviada a /api/public/buscar-foto (6 fotos
  a cada 10 min por endereço; a foto não é guardada). src/lib/busca-foto.ts
  identifica (Cheaper Inference -> GPT -> Gemini/Gemma) e busca no catálogo
  oficial (buscarNoCatalogo). Compara sozinho só com certeza (confiança >=
  85, marca e modelo lidos e os dois no nome do 1º produto); senão "Qual
  destes é o seu?" com até 4 e "Comparar este".
- CHEAPER INFERENCE (src/lib/cheaper-inference.ts, CHEAPER_INFERENCE_API_KEY
  ou OMNI_ROUTER; modelos em CHEAPER_INFERENCE_MODEL ou pelo /models da
  conta): motor prioritário da busca guiada, do "Me ajude a escolher" e da
  busca por foto (perguntarAoLlm: metade do prazo, depois GPT, depois
  Gemini/Gemma). A conferência pela foto continua na Gemini. Última falha
  em sinc_config.cheaper_diagnostico.
- FACEBOOK (src/lib/facebook.ts, FACEBOOK_PAGE_ID e
  FACEBOOK_PAGE_ACCESS_TOKEN; FACEBOOK_GRAPH_VERSION opcional): cada post do
  canal no garimpo vai também para a página (POST /{page-id}/photos com a
  legenda do canal em texto simples). Falha nunca derruba o Telegram; o
  resultado fica em canal_publicacoes.facebook_post_id/facebook_erro/
  facebook_em. Token só no corpo do POST.
- Diagnóstico sem expor chave: GET /api/public/ajudar-escolher diz só SE
  cada integração está configurada.
- AMAZON E SHOPEE PELA EXTENSÃO (Weslei, 09/10: sem credenciais das APIs,
  "pelo MESMO mecanismo já validado do Mercado Livre"; extensão 1.157.0):
  compararOutrosMarketplaces (extensao/multiloja.js) roda em paralelo ao
  atendimento, SEM await (nunca atrasa o Mercado Livre), só em pedido de
  CLIENTE (multiloja_vale; sinc_config multiloja_amazon/multiloja_shopee =
  'false' desliga). Amazon (extensao/amazon.js): busca amazon.com.br com a
  sessão, lê os cartões do HTML (sem patrocinado, usado/recondicionado ou
  sem preço), link /dp/<ASIN>?tag=melhoresc0fff-20; verificação de robô =
  pausa de 6 h. Shopee (extensao/shopee.js): a API de busca recusa chamada
  de fora (erro 90309999), então lê a página de busca numa aba de fundo
  (sem patrocinado e sem faixa de preço por variação); link pelo "Link
  personalizado" do painel de afiliados numa aba, aceito só se for NOVO na
  tela e se abrir o MESMO produto (item no destino), cache 7 dias; login ou
  verificação = pausa de 6 h. Até 4 de cada passam pela conferência
  pela foto do servidor; grava com gravar_multiloja; o site limpa de novo
  (src/lib/multiloja-resultado.ts: link de afiliado, foto dos hosts das
  marketplaces, selo só Prime) e espera até ~1 min. Diagnóstico: diagnosticos
  tipo 'multiloja'. Amazon: os termos dos Associados pedem preço pela API
  oficial; a leitura pela sessão é decisão do Weslei (09/10).
  1º teste real (09/10, pedido 1065, Echo Dot): Amazon leu 39 cartões e
  passou 2 pela conferência (links com a tag); Shopee leu a tela mas não o
  preço ("4 na tela"). Extensão 1.159.0: o leitor da Shopee rola a página a
  cada leitura, junta o preço quebrado em linhas ("R$" / "29" / ",90") e,
  sem preço, grava uma amostra do texto do cartão no diagnóstico.

## Mesma análise em cada marketplace e comparação final dos 3 (09/10, noite)
- Weslei, 09/10: prompt "Conector Amazon (Tag melhoresc0fff-20) e Linha da
  Amazon na Tabela de Comparação" e "deve fazer a mesma analise em cada
  player e por fim comparar os 3 players".
- LINKS DA AMAZON (src/lib/afiliado.ts): gerarUrlAfiliadoAmazon(urlOuAsin)
  aceita ASIN puro (B0 + 8 ou ISBN-10) -> /dp/<ASIN>?tag=melhoresc0fff-20,
  endereço amazon.com.br com ASIN -> o mesmo /dp/ limpo, termo de busca ->
  urlBuscaAmazon (/s?k=<termo>&tag=...); endereço sem ASIN ou de outro
  domínio = null. ehLinkDeAfiliadoAmazon: amazon.com.br com UMA tag igual
  à do Weslei, ou amzn.to.
- MESMA ANÁLISE (extensão 1.160.0, extensao/multiloja.js, e servidor,
  escolherCandidatos em src/lib/coletor-multiloja.ts): de cada marketplace,
  até 4 candidatos (os 3 mais parecidos pelo título + o mais barato bem
  parecido, nota >= 0,5), sem usado/recondicionado/vitrine nem peça no
  lugar do aparelho, vão para a conferência pela foto do servidor (com a
  segunda conferência). Guarda muda, qualidade, qualidadeMotivo,
  desvantagens e mesmaFoto, e o resumo por marketplace (lidas,
  conferidas, motivo; sem a chave = não consultada). Conferência que não
  responde grava incompleto (a tela diz "Não deu para conferir pela foto
  agora"). Trava da tela (src/lib/multiloja-resultado.ts): link de
  afiliado do próprio marketplace, sem usado e sem falso (pareceFalso).
- Aviso de preço muito abaixo (a mesma conta da tabela, com os preços do
  mesmo produto nos 3 marketplaces) no vendedor da coluna.
- MODELO PELO TÍTULO (10/10, pedido 1181: "Echo Dot Max" saiu como "Cor:
  Preto -> Roxo", qualidade equivalente, contra o "Echo Dot 5ª Geração"):
  Amazon e Shopee não têm ficha, então src/lib/modelo-titulo.ts
  (diferencaDeModelo) compara versão (Max, Pro, Plus/+, Mini, Lite, Ultra,
  Slim, Kids, Note, Neo, FE) e geração dos dois títulos. Diferente: nunca
  "mesmo produto", o "Muda" ganha "Modelo: 5ª geração -> Max" e a qualidade
  julgada sem isso volta a "não confirmada" (limparResultado com o título
  do colado, na tela).
- COMPARE COM CLAREZA (Weslei, 10/10: nova tela e "exemplo de tabela
  final"; src/components/ComparacaoMarketplaces.tsx + src/lib/
  comparacao-marketplaces.ts). Fica no FIM do resultado, em largura
  inteira no PC (linha 4 da grade, abaixo das duas colunas) e logo depois
  da análise do Mercado Livre no celular. Topo: "Compare com clareza." /
  "Veja preço, frete e diferenças em cada loja." / "Sua busca: <termo
  usado nas outras lojas>", selo "Entrega: CEP X" (só com o CEP
  simulado) e "li N resultados e conferi M pela foto" de cada marketplace.
  - "Mesmo produto | N ofertas confirmadas nesta análise" (N = lojas do
    mesmo produto no Mercado Livre + mesmo produto na Amazon/Shopee):
    tabela com coluna de rótulos cinza (Correspondência, Produto, Frete,
    Total, Vendedor, Ação), uma coluna por marketplace (Mercado Livre =
    a recomendação da tela), linhas alinhadas por subgrid e a linha Total
    destacada. Correspondência: ✓ "Mesmo produto" ou – "Não localizado /
    nesta análise" (também "Não consultado", "Conferindo", "Conferência
    indisponível agora"). Ação: "Comprar com segurança ↗" (link de
    afiliado; sem link no Mercado Livre, VerNaLoja gera no clique), "Ver
    alternativa ⌄" (rola até o cartão e destaca; sem rolagem suave com
    prefers-reduced-motion) ou, na Amazon sem nada, "Conferir na loja"
    (busca com a tag). Espaço estreito (container query @2xl): um cartão
    por marketplace.
  - "Melhor escolha" (🔥, moldura verde na coluna) só com CUSTO TOTAL
    CONFIRMADO, a mesma régua nos 3 (totalConfirmado: frete grátis
    confirmado ou de valor conhecido; vale também para o Mercado Livre).
    Prime e "a confirmar" não confirmam. Empate (< R$ 0,50): Mercado Livre,
    depois loja oficial. Mais barato só no produto = "Menor preço no
    produto (frete a confirmar)". Ninguém confirmado: aviso para comparar o
    produto e conferir o frete. Diferença contra o colado: "no custo final,
    já com o frete" só com o frete dos dois lados conhecido; senão "no
    produto".
  - "Alternativas parecidas | São produtos diferentes. Confira as
    características.": cartões horizontais (2 colunas a partir de @3xl;
    empilhados no celular) com nome do marketplace, selo âmbar "Parecido"
    (semelhança >= 60 ou mesma foto) ou "Produto diferente", foto em caixa
    fixa (object-contain), título, Marca (da conferência; senão "Marca não
    informada"), o que difere (só o valor dele, "Azul/Branco · Bluetooth";
    por extenso no title), qualidade (equivalente/superior/inferior/não
    confirmada), desvantagens, preço grande, frete em linha própria e
    "Comprar com segurança ↗". Hover: elevação de 0,5 e foto 1,02x
    (motion-safe).
  - IDENTIFICAÇÃO DOS MARKETPLACES (Weslei, 10/10: "use a medida que me
    resguarde dos termos de uso de cada afiliado, mas que seja possível
    identificar o player"): só o NOME em texto e o endereço da loja
    (mercadolivre.com.br, amazon.com.br, shopee.com.br). Sem logotipo, sem
    as cores das marcas (cabeçalhos no cinza do site) e "Prime" no azul
    neutro do site; as diretrizes de marca dos Associados da Amazon só
    permitem o logotipo nos arquivos fornecidos por ela. Botão nunca "Ver
    no Mercado Livre/na Amazon/na Shopee". Rodapé: links de afiliado, frete
    depende do CEP (Amazon e Shopee: confira no anúncio), valores de
    referência e "Site independente, sem vínculo com Mercado Livre, Amazon
    ou Shopee; as marcas pertencem aos seus titulares".
  Hoje a Amazon e a Shopee nunca têm frete confirmado para o cliente (a
  leitura usa a sessão do Weslei: Prime e CEP dele), então quem confirma o
  custo é o Mercado Livre e a Amazon/Shopee mais barata aparece como
  "Menor preço no produto (frete a confirmar)".
- CLIENTE PRIMEIRO NA COTA DA CONFERÊNCIA (10/10, pedido 1110, MK235):
  com a cota diária da Gemini esgotada, só o Gemma 26b confere, e ele
  aceita 16 mil tokens de entrada por minuto (429
  GenerateContentInputTokensPerModelPerMinute). A conferência da
  Amazon/Shopee no mesmo minuto derrubou a do Mercado Livre ("servidor do
  site fora do ar") e perdeu os 3 candidatos mais parecidos. Extensão
  1.161.0: a BUSCA nas outras lojas segue em paralelo (não gasta cota), mas
  a CONFERÊNCIA delas espera as conferências do Mercado Livre em andamento
  terminarem (buscaMlComecou no início do pedido, buscaMlTerminou em
  marcar('busca') e no finally; até 2 min). Candidato sem veredito (lote
  que falhou) = uma nova tentativa depois de 60 s, de novo só com o
  Mercado Livre parado; o servidor devolve guardado o que já conferiu.
  Diagnóstico: diagnosticos tipo 'multiloja' (esperouMl, novaTentativa).
  Validado com clientes reais em 10/10: pedido 1124 (JBL Wave Beam 2) com a
  conferência do Mercado Livre completa e a nova tentativa recuperando os
  3 candidatos sem veredito. Extensão 1.162.0 (pedido 1123, bicicleta
  Caloi, saiu sem lojas nem parecidos): a segunda volta espera o tempo que
  a cota por minuto pede ("volta em 57s", até 65 s; antes eram 12 s e as 2
  tentativas extras caíam no mesmo minuto), já antes da 1ª volta
  (respiroDaCota); a conferência da Amazon/Shopee também espera a segunda
  volta do MESMO pedido (voltaMlPendente), até 3 min. O site espera a
  extensão até 6 min (ESPERA_EXTENSAO_MS) e pergunta por ~7 min.

## Amazon e Shopee sob demanda (10/10)
- Weslei, 10/10: "para não gastar muitas requisições, use essa hierarquia:
  o cliente cola o link, meu site identifica o player e faz a busca só
  nele. Deixe Amazon e Shopee disponíveis, mas com valores borrados. Caso o
  cliente queira saber nessas outras páginas, ele precisa clicar num botão.
  Então, aí sim deverá seguir com a busca do mesmo produto e qualidade nos
  demais players."
- O link colado é do Mercado Livre: a comparação roda só nele. A extensão
  (1.163.0) NÃO busca mais a Amazon e a Shopee sozinha no atendimento.
- Tela (ComparacaoMarketplaces): colunas da Amazon e da Shopee com os
  valores BORRADOS (sem número por trás) e "Ainda não comparado"; aviso
  "Quer ver na Amazon e na Shopee?" com o botão "Comparar também na Amazon
  e na Shopee" e "Ver preço" em cada coluna. O clique chama
  pedir_multiloja(p_pedido, p_chave) (só com a chave do pedido em tela; no
  site todo até 30 pedidos novos a cada 10 min; resultado de menos de 6 h
  volta como pronto) e cutuca a extensão ("pedido-novo"). Depois:
  "Conferindo... de 30 segundos a 2 minutos" (medido em 10/10: 35 s a
  2 min 22 s) e o resultado de sempre. Sem a chave (pedido aberto por outro
  caminho): "Atualize a comparação para buscar".
- Banco (20261010020000_multiloja_sob_demanda.sql): tabela
  multiloja_solicitacoes (só servidor); multiloja_pendentes(p_token) entrega
  à extensão os pedidos abertos (até 3, marca iniciado; travado há 8 min
  volta) com o anúncio colado montado da análise (título, variação, foto,
  preço, categorias, condição, ficha); multiloja_vale só libera pedido que
  o cliente pediu; gravar_multiloja fecha a solicitação.
- Rota /api/public/multiloja: sem pedido do cliente responde sobDemanda
  (semResposta quando o pedido venceu sem resultado: "Tente de novo"); com
  o pedido, aguardar até 6 min. As APIs oficiais (com credenciais) também
  só rodam com o pedido.
- Extensão: atenderMultiloja (alarme de 1 min e "atenderAgora") pega os
  pedidos e chama compararOutrosMarketplaces, uma por vez; a conferência
  continua esperando as do Mercado Livre.
- UM MARKETPLACE POR VEZ (Weslei, 23/10: "não deve pesquisar em todos de
  uma vez, mas sim no marketplace escolhido"; "melhore a animação de
  busca"): cada coluna tem o seu "Comparar aqui" e o aviso tem um botão por
  loja ("Comparar na Amazon Brasil" / "Comparar na Shopee"). Banco
  (20261023160000_multiloja_por_marketplace.sql, sem atualizar a extensão):
  pedir_multiloja(p_pedido, p_chave, p_marketplace); multiloja_solicitacoes
  com quer_*/entregue_*; multiloja_vale só libera o escolhido e ainda não
  entregue; gravar_multiloja SOMA ao resultado do outro marketplace
  (resumo com "em" por loja; conferência que falha = resumo.<mk>.incompleto
  e "Tentar de novo"); pedido do outro feito no meio da busca volta para a
  fila sozinho. Rota /api/public/multiloja devolve o que já foi comparado +
  pendentes. Tela: a coluna escolhida mostra o giro, "Buscando o mesmo
  produto · há N s · leva de 30 s a 2 min", faixa azul sob o nome e
  esqueleto com brilho onde o preço vai aparecer; as outras ficam borradas
  com o botão. Testado no banco com transação desfeita (Amazon só, Shopee
  pedida no meio, soma dos dois).
- Link colado da Amazon, da Shopee ou de outra loja: ver "Reconhecimento
  universal de links (10/10)".

## Avaliação das pessoas (10/10)
- Weslei, 10/10: "adicione a avaliação das pessoas, como mais um símbolo de
  convencimento". Fonte: o evento do PRÓPRIO anúncio na página ("reviews":
  {"count", "rate"}, só o primeiro nível; extensão 1.164.0,
  avaliacaoDoItem em extensao/comparador.js, teste com trecho real). A API
  oficial /reviews/item responde 403 para o aplicativo (testado em 10/10).
- Campo avaliacoes {nota, total} no colado (analise.avaliacoes), nas lojas
  (outrasLojas, referencias) e nos parecidos (comDetalhes, cache v4 com
  avaliacao). src/lib/avaliacoes.ts confere (0 < nota <= 5, total >= 1,
  nunca arredonda para cima) e escreve; componente Avaliacoes (★ 4,9 (5.056
  avaliações)) no colado, Minha recomendação, Melhor opção, Melhor
  alternativa, Parecidos e tabela. Bot, canal ("⭐ 4,9 de 5 (5.056
  avaliações)") e "Me ajude a escolher" (avaliacao_das_pessoas; poucas
  avaliações valem pouco) também. Loja oficial no bot passou a "✔️" para não
  confundir com a estrela. Sem o dado, nada aparece.
- VITRINES (10/10, "não encontrei no meu site"): avaliacoes_da_vitrine(
  p_chaves) (pública, só leitura, até 300) devolve a nota de cada OFERTA da
  última comparação pelo link meli.la; src/lib/avaliacoes-vitrine.ts
  (useAvaliacoesDaVitrine + ContextoAvaliacoes) põe a estrela no cartão da
  vitrine (a nota da oferta atrás do botão: melhor loja ou o colado), na
  Alternativa parecida e nos cartões das campanhas (CartaoOferta). A nota
  é a do ANÚNCIO de cada loja (o evento da página não traz a do produto);
  link de catálogo (/p/) muitas vezes vem sem nota própria. Produto só
  ganha estrela depois de comparado na 1.164.0 (em 10/10, 20 da vitrine
  entraram na fila dos agentes, fonte 'avaliacoes').
- EM TODOS E COM DETALHAMENTO (Weslei, 10/10: "precisa ter as avaliações
  em TODOS, e precisa de um espaço que abra o detalhamento das avaliações
  reais"). Extensão 1.165.0: detalheDasAvaliacoes (comparador.js, teste com
  os trechos reais dos diagnósticos) lê o bloco de opiniões da página:
  distribuição [{"value","percentage","index"}] (index 0 = 5 estrelas; só
  vale se fechar com a média, +-0,3), "rating_average_formatted", total do
  aria_label ("Avaliação 4.9 de 5. 2586 opiniões."), até 6 opiniões
  (rating, comment.content.text, date, created_date e count_likes do mesmo
  review_id), "total_opinions" e o aviso "Inclui opiniões de pessoas de
  outros países". semAvaliacoesNaPagina: "Sem avaliações ainda" só com a
  página inteira do próprio anúncio e nenhuma nota. Amostra diária em
  diagnosticos tipo 'avaliacoes-amostra'.
  - Leitura: anúncio colado e lojas (parte lida) mandam para o banco
    (gravar_avaliacoes, senha da extensão); atualizarAvaliacoes (alarme de
    1 min) lê primeiro SEM a conta (credentials omit), até 3 páginas por
    minuto, só com a extensão parada; se a página sem a conta cair na
    verificação (1.165.0 não gravou nada em 4 min), 6 h COM a conta, 1 por
    minuto e nunca com o freio puxado (1.165.1); verificação na leitura
    logada = freio de sempre + pausa de 1 h. Diagnóstico de cada rodada em
    diagnosticos tipo 'avaliacoes-leitura'. Fila
    avaliacoes_pendentes: pedido de cliente das últimas 3 h, vitrine,
    campanhas, brinquedos, mais vendidos; cada anúncio a cada 7 dias (falha
    espera 1 dia).
  - Banco (20261010150000_avaliacoes_detalhadas.sql): avaliacoes_anuncios
    (item MLB... ou MLBP... para página de catálogo sem anúncio, como o
    "pid" do próprio Mercado Livre; só servidor), avaliacoes_ofertas (mapa
    chave + link meli.la -> anúncio + nota da comparação, refeito pelo
    pg_cron avaliacoes-ofertas a cada 15 min), leituras públicas
    avaliacoes_da_vitrine_v2, avaliacoes_por_itens e detalhe_avaliacoes. A
    leitura da página vale mais que a nota da comparação; detalhamento só é
    trocado por outro detalhamento.
  - Site: LinhaAvaliacoes (src/components/Avaliacoes.tsx) em TODOS os
    cartões (vitrine e alternativa, campanhas, brinquedos, mais vendidos),
    sempre com a mesma altura: "★ 4,4 (81) Ver avaliações ›", "Sem
    avaliações ainda" ou espaço reservado (sem leitura, nada inventado). No
    resultado, a estrela vira botão quando o anúncio é conhecido (colado,
    tabela, recomendação, Melhor alternativa, Parecidos), completada pela
    leitura da página (ContextoAvaliacoesPorItem). PainelAvaliacoes: nota,
    estrelas, total, barras por estrela, aviso, "O que dizem os
    compradores" (estrelas, data, texto, "N pessoas acharam útil"),
    "Mostrando N de M comentários", "Ver todas as avaliações no anúncio"
    só com meli.la e "lidas na página do anúncio em dd/mm/aaaa". Sem
    distribuição/opiniões lidas, o painel diz que ainda não foram lidas.
