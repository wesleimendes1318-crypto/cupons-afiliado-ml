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

## Marca e app (05/10)
- Logo: M branco com selo verde ✓ em degradê roxo/azul. Ícones gerados do
  arquivo enviado pelo Weslei: public/favicon.ico (16/32/48), favicon.png,
  apple-touch-icon.png (180), icon-192/512, icon-maskable-512, logo.png e
  extensao/icones/icone16-128. Logo no topo (link para /) e no rodapé.
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
  ?simular=1 só lista. Remover post: /api/public/operacao?tarefa=remover&
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
- Nichos do 1º ciclo (CATEGORIAS_FOCO, src/lib/inteligencia.ts):
  Eletrodomésticos, Beleza e Cuidado Pessoal, Casa/Decoração, Acessórios
  para Veículos (dados de 21/09-04/10: Beleza 4/5 produtos com o mesmo mais
  barato; Eletrodomésticos ticket médio R$ 2.434). Hipótese, revisar
  semanalmente com mercado_sinais x pedidos.
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
  site, bot ou canal.

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
