# Regras do projeto (Weslei Mendes, melhorescolha.io)

Leia também AGENTS.md (nunca force-push nem reescrever histórico publicado).

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

## Bot do Telegram (02/10)
- /api/public/telegram-webhook: o cliente manda o link (longo ou meli.la) e
  recebe a comparação com as MESMAS regras da tela (src/lib/telegram.ts usa
  opcoesDaAnalise + decisaoDaTela): melhor preço do mesmo produto (pelo total
  com o frete conhecido), Melhor alternativa com o que muda, loja oficial,
  Pix x parcelado (src/lib/pagamento.ts, igual ao site), frete em linha
  própria e só links de afiliado. Pedido por pedir_comparacao; espera até
  ~50 s e, sem resultado, manda o link de afiliado (se já saiu) e o site
  (/?link=..., que abre a comparação sozinho).
- Token em API_TELEGRAM (Secrets). /api/public/telegram-setup registra o
  webhook com um segredo derivado do token; o webhook recusa chamada sem ele.
- PRIMEIRO ACESSO (Weslei, 02/10): boas-vindas amigáveis com o "como funciona"
  e o vídeo do site (public/video/como-funciona-v4-vertical.mp4) só na
  primeira conversa (tabela telegram_chats) e em /start ou /ajuda.
- Mensagem SEM link: o modelo entende e responde (GPT primeiro; reserva
  flash-lite/Gemma, que não disputam a cota dos modelos maiores da
  conferência), curto, sem inventar preço/loja, sem prometer cupom, sem citar
  IA e sem mandar link (resposta com link é descartada). Até 30 por conversa
  por dia; sem modelo, resposta pronta pedindo o link e como copiá-lo.

- CANAL DE OFERTAS (05/10): @melhorescolha_ofertas (Secret
  TELEGRAM_CANAL_ID); o bot @AfiliadosMELI_bot é admin do canal só com
  "Publicar mensagens". Posts do garimpo com teclado: "Comprar com segurança"
  (afiliado) e "Comparar o meu produto" (bot ?start=canal).
  POST COM FOTO (Weslei, 05/10: "melhore a mensagem, melhore a disposição
  da foto"): sendPhoto com a foto grande do produto (mlstatic -O.jpg) e
  legenda em blocos (produto; mesmo/parecido, muda, qualidade, desvantagens;
  preço, anúncio comparado riscado, economia no produto com %, frete em
  linha própria; loja e hora da conferência). Link de afiliado nos botões;
  foto recusada (ok=false) -> texto com o link e sem prévia; sem resposta
  -> não reenvia (evita post duplicado).
- CONVITE NO SITE: nomes só em src/lib/telegram-publico.ts; componente
  ConviteTelegram (pilula no topo, cartao abaixo do resultado pronto / na
  home com a caixa parada / em /meus-precos, linha no rodapé) e página
  /telegram (no rodapé e no sitemap). Nunca na BarraFixa nem carregando.
  Deep link t.me/AfiliadosMELI_bot?start=<origem>; origens válidas: topo,
  home, resultado, meus_precos, rodape, pagina_telegram, canal (gravada em
  telegram_chats.origem só no primeiro contato).

## Acompanhar preço (teste, 28/09)
- Botão "Acompanhar preço" no resultado (preço-alvo opcional) e página
  /meus-precos (aba "Meus preços" no topo, de volta em 02/10 a pedido do
  Weslei; histórico, "caiu R$ X", "chegou no seu preço", link de
  afiliado). Sem cadastro: id aleatório do navegador (lib/navegador.ts),
  limite de 20 por navegador e 200 produtos no total; aviso só no site.
- SEM SerpAPI e sem pedido de comparação (Weslei: "não gaste meus créditos da
  api do serpapi"): a extensão (monitorarPrecos) abre só a página do produto,
  no máximo 1 leitura a cada 10 min, com a extensão parada e sem freio de
  captcha. O banco (proximo_monitor/gravar_monitor) decide o intervalo: 3 h
  se mexeu ou está perto do alvo, 6 h parado, 12 h parado 3 vezes, 2 h com
  erro; pesquisa do site nas últimas 3 h conta como leitura (precos_vistos).
- AVISO NO TELEGRAM (05/10): "Avisar no Telegram" no "Acompanhar preço" e em
  /meus-precos (AvisoTelegram). alerta_telegram(navegador, monitor) só para
  quem segue o produto -> t.me/AfiliadosMELI_bot?start=alerta_<codigo>; o bot
  liga (ligar_alerta_telegram, só servidor). Gatilho monitor_para_telegram:
  preço lido no alvo (ou, sem alvo, 1% abaixo do último aviso) marca
  pendente e chama operacao?tarefa=alertas (src/lib/alertas-telegram.ts):
  mensagem com preço agora/antes, alvo, frete "confira no anúncio" em linha
  própria e botões (compra só meli.la; senão comparar no site). Tabela
  monitor_telegram (só serviço).
- Liga/desliga: sinc_config.monitor_ativo. Tabelas monitor_precos e
  monitor_seguidores (só funções security definer; leitura pelo navegador).

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

## Correções graves de 05/10 (tarde)
- APELIDO DA CONTA NUNCA É LOJA (pedido 716, "Vendido por WESLEI.MENDES"
  num parecido): a leitura logada de anúncio pausado pegava o "nickname" de
  quem está logado. Extensão 1.149.0: nomesDoHtml descarta o apelido da
  conta (APELIDOS_DA_CONTA) e só usa "nickname" quando a página tem o bloco
  do vendedor (seller_link); cache v4. Site: afiliado.ts (nomeDeLojaValido)
  apaga esse nome na leitura do pedido.
- ANÚNCIO INDISPONÍVEL/PAUSADO NÃO APARECE (pedido 716: "Este produto está
  indisponível no momento"): resolverVendedorAgora marca
  indisponivelPorItem (RE_INDISPONIVEL); a loja sai da tabela e o parecido
  sai da lista (diag.parecidosIndisponiveis).
- BOTÃO DIRETO SEMPRE (Weslei, 05/10: "não tem o botão de consultar os
  produtos diretamente... eu não vendo nada"): vitrine geral, campanhas e
  brinquedos mostram "Comprar com segurança" com o link de afiliado sempre
  que houver (preço de quando foi comparado, com a data), e "Atualizar
  preço" como ação secundária. Busca guiada: "Comprar com segurança" gera o
  link de afiliado no clique (VerNaLoja / pedir_link_da_loja) e "Comparar
  preço" fica secundário. Substitui o "UM botão só" de 02/10.
- Botão flutuante "Colar link do produto": círculo compacto que só aparece
  com o campo do link fora da tela (não cobre cartões). "O que muda" quebra
  linha em valores longos.
- Comissão ("Ganhos", "Ganhos extras" do hub de afiliados) NUNCA aparece no
  site, bot ou canal. PRIORIDADE POR COMISSÃO (Weslei, 09/10, noite: "melhor taxa
  de comissão vs valor do produto - priorizar itens que pagam mais"): a
  extensão 1.158.0 lê só a TAXA (%) do cartão do hub e manda só ao banco
  (registrar_hub, senha da extensão; hub_recomendados.comissao_pct, tabela
  sem acesso público); a fila do hub vai por taxa x preço, depois mais
  vendido e desconto, até 10 por leitura (lê até 120 cartões), só com nota
  >= 4,5 quando conhecida. Comissão só ORDENA: nunca aprova produto,
  vendedor nem preço. QUALIDADE PRIMEIRO (Weslei, 09/10: "considere sempre
  a qualidade, deve devolver o melhor produto para o cliente sentir
  segurança e voltar a comprar"): entre ofertas do mesmo produto, a loja
  oficial vem antes da mais barata quando não há a oferta destacada do
  catálogo.

## Equipe de agentes (05/10)
- Weslei, 05/10: "desenvolva agentes pertinentes, que cuidem de TUDO" e
  "mantenha o site totalmente funcionando, validado e com segurança do que é
  mostrado". Papéis, horários e regras em docs/agentes.md (Guardião a cada
  2 h, Pesquisa e oportunidades, Manutenção e configuração, Segurança, Marca/
  layout/melhorias, Dados semanal). Base do Guardião: função
  auditoria_exibicao(p_horas) no banco (só serviço). Problema novo que ela não
  pega vira regra nova na função.

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

## Cliente primeiro e teto dos agentes (05/10, noite)
- Medido em 05/10: 120 comparações dos agentes x 3 de clientes em 24 h; a
  cota gratuita da Gemini (flash-lite 500/dia, 2.5-flash 20/dia) acabou e
  as comparações seguintes saíram só com o link (sem lojas nem parecidos).
- pedidos_pendentes entrega SEMPRE os pedidos de cliente primeiro; pedido
  interno (origem 'teste') só quando não há cliente esperando, 2 por vez.
- Agentes (sazonal, preparar, brinquedos, busca guiada, hub) enfileiram só
  por pedir_link_agente: teto diário sinc_config.agentes_teto_dia (40, dia
  de Brasília) e nada enquanto a cota do flash-lite estiver esgotada
  (ia_cotas). pedir_link_novo fica para a bateria de testes.
  05/10, noite: com o Gemma 26b conferindo, a fila dos agentes só para
  quando o flash-lite E o gemma-4-26b-a4b-it estão sem cota; teto 200/dia
  (Weslei: "pelo menos 20 itens em cada vitrine sazonal"). Buscas sazonais:
  42 por temporada (Crianças e Natal), termos ampliados (nerf, uno, pokémon,
  boneco, drone; echo dot, air fryer, nespresso, secador, maquiagem,
  havaianas, panelas, taças, nintendo, ps5...), até 24 cartões por seção
  numa FILEIRA com rolagem lateral e setas (Weslei: "as vitrines estão muito
  grande"; GradeOfertas fileira; cartão 206 px no PC, 64% no celular) e
  destaque mais baixo (230 px no PC, faixa de 128 px no celular). A página
  da temporada (/natal, /dia-das-criancas) continua com a grade completa.

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
  "somente quando for útil de verdade"). SUGESTÕES DO MERCADO LIVRE (Weslei,
  03/10, Akai MPK Mini R$ 568 x M-Vave SMK-25 R$ 339,69 em "Quem viu este
  produto também comprou"): até 3 das vagas dos mais baratos na conferência
  são dos relacionados (do mais barato), porque as cópias do próprio anúncio
  ocupavam todas; nos Parecidos, além dos 5 mais semelhantes, até 2
  sugeridos mais baratos que o colado (sugerido: true), à vista (não
  recolhidos) e com o selo "Sugerido na página do anúncio". Diagnóstico:
  leitura.relacionadosVistos (título | preço). Conferido no pedido 607: o
  M-Vave SMK-25 (R$ 382,10) entrou na conferência. Diferença só de marca e
  modelo (semelhança >= 60) conta como parecido mesmo com parecido=false da
  conferência (soMarcaEModelo; nunca vira igual). As 2 vagas extras não
  repetem marca já listada (sugeridosExtras; pedido 613: três AMW tiravam o
  M-Vave). Cartão do carrossel sem foto (carregamento preguiçoso)
  pega a foto no polycard do mesmo anúncio nos dados da página (pedido 619:
  o M-Vave saiu "sem foto" e ficou fora; diagnóstico relacionadosDiag.semFoto
  e fotoPelosDados). A API oficial não serve de reserva (/items dá 403).
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
  (capinha, Eudora, disco de freio, monitor em página de oferta,
  pista dinossauro) na versão nova e conferir todas as metas. Falhou alguma:
  corrigir e rodar de novo. Só então avisar.

## Publicação
- Branch claude/ml-etiquetas-cupons-k6tgkj e main recebem o mesmo commit.
- Depois do push: esperar list_edits "completed" e chamar deploy_project.
  Sem o deploy_project o site continua na versão anterior (28/09: a vitrine
  ficou sem o selo novo e parecia que a melhoria tinha sumido).
- Mudança na extensão sobe a versão em extensao/manifest.json; o Weslei
  atualiza rodando ferramentas/ATUALIZAR-EXTENSAO.bat.

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
- Bot: link + "até 10/10" / "receber amanhã" / "fim de semana" + CEP no texto
  (CEP guardado em telegram_chats.cep); mensagemComPrazo com as mesmas
  regras. Extensão 1.154.0 guarda o anúncio (item) de cada loja.
- Vitrine geral (06/10, Apple Watch Series 4 "arranhado e quebrado, frete
  não é grátis"): só entra o que foi comparado de verdade (outra loja ou
  alternativa), sem sinal de usado/defeito no título e com frete grátis
  confirmado (src/lib/vitrine-recomendavel.ts).
- Botões "Início" e "Voltar ao topo" (BotoesNavegacao, canto inferior
  esquerdo, depois de rolar) em todas as páginas.

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
- Link colado da Amazon, da Shopee ou de outra loja: ver "Reconhecimento
  universal de links (10/10)".

## Reconhecimento universal de links (10/10)
- Weslei, 10/10: "preciso que ele aceite qualquer link e identifique o
  produto... caso seja um link de um player que não estou afiliado,
  identifique o produto e busque no mercado livre". Link nunca vira "link
  inválido".
- src/lib/analisar-link.ts (analisarLink -> AnaliseLink {origem:
  mercadolivre | amazon | shopee | outro_player | invalido, urlLimpa,
  identificador, termoIdentificado, nomeLoja, encurtado}): só o texto, sem
  rede. Nome do endereço como a loja escreveu (decodificado, hífen ->
  espaço, sem código/SKU/rastreio: MLB-, -i.loja.item, -p-, -g-, _JM, SKU
  longo); sem nome no endereço, o texto em volta (título que o app manda,
  sem "Confira este produto", preço nem "na Amazon"). Testes:
  tests/analisar-link.test.ts (os 6 casos do pedido + extras).
- /api/public/identificar-link (src/lib/identificar-link.ts): resolve
  encurtado (amzn.to, a.co, shope.ee, s.shopee.com.br, AliExpress, bit.ly)
  só pelos redirecionamentos, sem abrir a página; loja conhecida sem nome no
  endereço: lê só o título (og:title/<title>, 400 KB, 4,5 s); página de
  verificação não vale (a Amazon devolve "Amazon.com.br" de robô). Só host
  público com nome. Nada guardado. Encurtado que era do Mercado Livre segue
  a comparação de sempre.
- Tela (LinkDeOutraLoja, no lugar do erro): "Loja do link: X" e "Produto
  identificado: Nome". Outra loja (Magalu, KaBuM!, Casas Bahia, Americanas,
  Shein, AliExpress, Temu...): a busca no Mercado Livre começa sozinha
  ("Buscando o melhor preço para você no Mercado Livre..."), cartões da
  busca guiada (ResultadosDaBusca, buscarProdutos em
  src/lib/busca-guiada-cliente.ts) com "Comprar com segurança" (meli.la no
  clique) e "Comparar preço". Amazon: "Comprar com segurança" do produto
  exato (gerarUrlAfiliadoAmazon, tag do Weslei) + "Buscar o mesmo produto"
  sob demanda. Shopee: o nome + busca sob demanda (link de afiliado da
  Shopee só pela extensão). Texto sem link: aviso amigável + "Buscar
  “nome”". Sem nome: campo "Qual é o produto?".
- ?link= (bot e app instalado) aceita qualquer link; o texto todo vai junto.
- Bot: link de outra loja -> mensagemOutraLoja/tecladoOutraLoja
  (src/lib/telegram.ts): loja, produto identificado, "Comprar com
  segurança" (só Amazon com a tag) e "Buscar o mesmo produto" (site).
- Ainda não existe: o garimpo DENTRO da Amazon/Shopee a partir de um link
  delas (procurar o mesmo produto mais barato na própria loja); precisa de
  um pedido próprio na extensão. Hoje: produto exato com afiliado + busca no
  Mercado Livre.

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

## Shorts no YouTube (10/10)
- Weslei, 10/10: "PROMPT MESTRE: AUTOMAÇÃO DE SHORTS ULTRA-REALISTAS".
  Pacote Python scripts/automacao_shorts/ (roda no computador do Weslei;
  LEIAME.md com a instalação): radar_produtos (campanhas_ativas, só
  "mesmo"/"menor", preço conferido < 24 h, sem repetir em 14 dias, regras
  de falso/usado/peça/desconto real portadas em regras.py), gerador_roteiro
  (gancho, valor, comparação, CTA, loop; nenhum valor em reais além dos 3
  conferidos; nada de "testei"/"neste vídeo"; frete em frase própria;
  polimento opcional só se passar na validação; SEO com título <= 70 e
  #Shorts, 3-4 hashtags, 8-12 tags sem "review"/"unboxing"),
  higgsfield_video (API oficial api.higgsfield.ai, imagem->vídeo da foto
  real, estúdio clean por padrão), voz_narracao (ElevenLabs com tempos;
  reserva OpenAI TTS), editor_video (ffmpeg/imageio-ffmpeg, 1080x1920,
  legendas ASS, cartão de preço com o comparado riscado, loop pelo 1º
  quadro), youtube_publisher (OAuth persistente em credenciais/, fora do
  git; cota local; containsSyntheticMedia = true; comentário com o link).
- Limites: a API não fixa comentário (fixar no Studio); link em Shorts não
  é clicável; privado por padrão (SHORTS_PRIVACIDADE).
