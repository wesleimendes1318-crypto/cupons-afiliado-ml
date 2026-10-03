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
    oficial da marca" (só com selo confirmado). Fica LOGO ACIMA dos Parecidos
    (Weslei, 03/10; no PC na coluna da tabela, no celular depois da Melhor
    opção e antes dos Parecidos). Sempre com "Não é idêntico ao
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
- Liga/desliga: sinc_config.monitor_ativo. Tabelas monitor_precos e
  monitor_seguidores (só funções security definer; leitura pelo navegador).

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
  M-Vave).
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
