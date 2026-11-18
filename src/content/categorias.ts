/* Categorias com conteúdo editorial próprio.

   Regra que este arquivo aplica: uma categoria só vira página indexável se
   alguém escreveu orientação real sobre ela. Categoria que existe apenas
   como rótulo no banco não ganha página — é assim que se evita encher o site
   de páginas rasas. */

export type Categoria = {
  slug: string;
  nome: string;
  /** Chamada da página (09/10): o que o site faz nesta categoria, sem
      promessa de cupom nem de preço. */
  chamada: string;
  /** Termos usados na base de cupons que pertencem a esta categoria.
      Este e os três campos abaixo são do conteúdo antigo e não aparecem na
      página; os departamentos de 18/11 vêm sem eles. */
  termos?: string[];
  resumo?: string;
  atualizacao?: string;
  introducao?: string[];
  comoAvaliar: string[];
  cuidados: string[];
  perguntas: { pergunta: string; resposta: string }[];
};

export const CATEGORIAS: Categoria[] = [
  {
    slug: "eletronicos",
    nome: "Eletrônicos",
    chamada:
      "Fones, caixas de som, TVs e games: eu procuro o mesmo produto em outras lojas e mostro do mais barato ao mais caro, conferido pela foto.",
    termos: ["eletronicos", "eletrônicos", "eletro", "audio", "áudio", "tv", "games"],
    resumo:
      "Fones, caixas de som, televisores e acessórios: onde o cupom costuma render pouco e o preço base decide.",
    atualizacao: "23/09/2026",
    introducao: [
      "Eletrônico é a categoria com maior diferença entre desconto anunciado e desconto recebido. Como o tíquete médio é alto, o teto do cupom é atingido quase sempre — um cupom de 30% com teto de R$ 20 rende os mesmos R$ 20 num fone de R$ 200 ou num televisor de R$ 3.000.",
      "Na prática, em compras acima de algumas centenas de reais o cupom vira um abatimento fixo. Quem decide o negócio é o preço do anúncio, não o percentual estampado.",
    ],
    comoAvaliar: [
      "Compare o preço do mesmo modelo entre vendedores antes de olhar qualquer cupom.",
      "Confira o modelo exato: versão, capacidade, cor e ano mudam o preço e são fáceis de confundir.",
      "Prefira cupons sem teto quando a compra passa de algumas centenas de reais.",
      "Verifique se o item tem garantia nacional e se a nota fiscal é emitida.",
      "Some o frete: em itens grandes ele muda a conta por completo.",
    ],
    cuidados: [
      "Acessório barato costuma ter cupom generoso em percentual e mínimo de compra alto, o que empurra você a comprar mais do que precisa.",
      "Produto importado pode ter prazo longo e tributação na entrada; o desconto não compensa uma surpresa dessas.",
      "Desconfie de preço muito abaixo da média do mercado em anúncios sem histórico de vendas.",
    ],
    perguntas: [
      {
        pergunta: "Cupom de percentual alto vale a pena em eletrônico?",
        resposta:
          "Só se não tiver teto. Com teto, o abatimento trava em poucos reais e um cupom pequeno sem limite costuma render mais.",
      },
      {
        pergunta: "Vale esperar datas de promoção?",
        resposta:
          "Em eletrônicos a variação de preço é grande ao longo do ano. Acompanhar o preço por alguns dias dá uma referência melhor do que confiar no valor riscado.",
      },
    ],
  },
  {
    slug: "celulares",
    nome: "Celulares e acessórios",
    chamada:
      "Celulares, capas, carregadores e películas: o mesmo modelo em outras lojas, com versão e compatibilidade conferidas nos dois anúncios.",
    termos: ["celular", "celulares", "smartphone", "telefonia", "capinha"],
    resumo:
      "Aparelhos, capas, carregadores e fones: onde vale separar o cupom do aparelho do cupom do acessório.",
    atualizacao: "23/09/2026",
    introducao: [
      "Em celulares há dois mundos. No aparelho, de valor alto, quase todo cupom bate no teto e o desconto vira um valor fixo pequeno diante do preço. Nos acessórios, de valor baixo, o cupom chega a representar uma fatia real da compra — quando você atinge o valor mínimo sem comprar supérfluos.",
    ],
    comoAvaliar: [
      "Confirme a versão do aparelho: memória, cor, faixa de frequência e se é a versão vendida no Brasil.",
      "Verifique se o vendedor é loja oficial ou revendedor e qual é a garantia oferecida.",
      "Em acessórios, calcule o desconto real antes de juntar itens só para alcançar o mínimo.",
      "Compare o preço à vista com o parcelado: juros embutidos apagam qualquer cupom.",
    ],
    cuidados: [
      "Aparelho com preço muito abaixo do mercado pode ser recondicionado, vitrine ou de outra região — leia a descrição inteira.",
      "Capas e películas anunciadas como universais frequentemente não servem no modelo indicado.",
      "Carregador sem certificação é risco real de dano ao aparelho, não economia.",
    ],
    perguntas: [
      {
        pergunta: "Cupom se aplica em celular parcelado?",
        resposta:
          "O desconto incide sobre o valor do produto; o parcelamento é aplicado depois. Compare sempre o total final, com juros, e não a parcela.",
      },
      {
        pergunta: "Vale comprar acessório junto para bater o mínimo?",
        resposta:
          "Só se for algo que você compraria de qualquer forma. Gastar R$ 40 a mais para ganhar R$ 10 de desconto é prejuízo.",
      },
    ],
  },
  {
    slug: "informatica",
    nome: "Informática",
    chamada:
      "Notebooks, monitores, periféricos e cadeiras: o mesmo produto entre lojas, com o frete em linha própria e a loja oficial quando houver.",
    termos: ["informatica", "informática", "notebook", "computador", "pc", "periferico"],
    resumo:
      "Notebooks, periféricos e componentes: especificação errada custa mais caro que qualquer desconto perdido.",
    atualizacao: "23/09/2026",
    introducao: [
      "Informática é a categoria em que o detalhe técnico decide. Dois anúncios com o mesmo título podem ter processadores, memórias e telas diferentes — e a versão mais barata quase sempre é a inferior. Antes de olhar cupom, confirme a ficha técnica.",
    ],
    comoAvaliar: [
      "Compare processador, memória, armazenamento e tela, não só o nome do modelo.",
      "Confira se o equipamento vem com sistema operacional instalado e licenciado.",
      "Em componentes, verifique compatibilidade com o que você já tem antes de comprar.",
      "Prefira vendedores com histórico em eletrônicos e política clara de troca por defeito.",
    ],
    cuidados: [
      "Notebook com preço destoante costuma ter memória ou armazenamento muito abaixo do padrão.",
      "Periférico genérico sem marca identificada dificulta garantia e reposição.",
      "Kit montado por terceiros pode não ter garantia individual das peças.",
    ],
    perguntas: [
      {
        pergunta: "Cupom em notebook costuma valer muito?",
        resposta:
          "Raramente em termos proporcionais: com teto, o abatimento vira um valor fixo diante de um preço alto. Vale mais negociar preço e frete do que caçar percentual.",
      },
      {
        pergunta: "Vale comprar periférico e notebook no mesmo pedido?",
        resposta:
          "Se for do mesmo vendedor e você já precisava dos dois, sim: o valor mínimo é atingido naturalmente e o frete pode ser único.",
      },
    ],
  },
  {
    slug: "casa",
    nome: "Casa e utilidades",
    chamada:
      "Cozinha, utilidades e decoração: o mesmo produto em outras lojas, do mais barato ao mais caro, com o frete em linha própria.",
    termos: [
      "casa",
      "cozinha",
      "moveis",
      "móveis",
      "decoracao",
      "decoração",
      "utilidades",
      "ferramentas",
    ],
    resumo:
      "Itens de casa têm tíquete variado e frete pesado: é onde mais vale conferir a entrega antes do desconto.",
    atualizacao: "23/09/2026",
    introducao: [
      "Aqui convivem a panela de R$ 40 e o sofá de R$ 2.000. Nos itens baratos, o cupom com teto rende bem; nos móveis, o frete e o prazo pesam mais do que qualquer desconto. É também a categoria em que a dimensão do produto engana com mais frequência.",
    ],
    comoAvaliar: [
      "Leia as medidas em centímetros e compare com o espaço real onde o item vai ficar.",
      "Confira material e capacidade, não só a foto.",
      "Simule o frete para o seu CEP antes de decidir: em móveis ele muda tudo.",
      "Verifique se a montagem está inclusa e se há prazo de entrega estimado.",
    ],
    cuidados: [
      "Foto ambientada faz item pequeno parecer grande — confie nas medidas.",
      "Conjunto anunciado por preço baixo às vezes traz só uma peça; confira a quantidade na descrição.",
      "Móvel volumoso tem devolução trabalhosa; leia a política antes de comprar.",
    ],
    perguntas: [
      {
        pergunta: "Cupom cobre o frete?",
        resposta:
          "Em geral não: o percentual costuma incidir só sobre os produtos. Em itens grandes, isso faz diferença considerável.",
      },
      {
        pergunta: "Compensa juntar itens de casa para bater o mínimo?",
        resposta:
          "Costuma compensar mais do que em outras categorias, porque são itens de reposição frequente — desde que sejam coisas que você realmente vai usar.",
      },
    ],
  },
  {
    slug: "moda",
    nome: "Moda e calçados",
    chamada:
      "Roupas, calçados e bolsas: o mesmo modelo e a mesma cor em outras lojas; o que muda aparece separado, em Parecidos.",
    termos: [
      "moda",
      "roupa",
      "roupas",
      "calcado",
      "calçado",
      "tenis",
      "tênis",
      "bolsa",
      "acessorios",
    ],
    resumo:
      "Tíquete baixo e troca frequente: a categoria em que o cupom com teto mais rende, e onde o tamanho é o risco.",
    atualizacao: "23/09/2026",
    introducao: [
      "Moda é onde o cupom brilha: com compras de valor menor, o teto raramente é atingido e o percentual se realiza quase por inteiro. Em compensação, é a categoria com maior índice de troca — e troca mal resolvida custa mais que o desconto ganho.",
    ],
    comoAvaliar: [
      "Procure a tabela de medidas do anúncio em vez de confiar no número do manequim.",
      "Leia avaliações que mencionem se o item veste maior ou menor.",
      "Confira a composição do tecido e as instruções de lavagem.",
      "Verifique a política de troca por tamanho e quem paga o frete de devolução.",
    ],
    cuidados: [
      "Foto de catálogo pode não representar a cor real; avaliações com foto ajudam.",
      "Kit com várias peças por preço muito baixo costuma ter tecido de qualidade inferior.",
      "Réplicas se disfarçam de originais em anúncios sem marca declarada.",
    ],
    perguntas: [
      {
        pergunta: "Cupom vale mais em moda?",
        resposta:
          "Em termos proporcionais, sim. Como as compras costumam ficar abaixo do ponto em que o teto trava, boa parte do percentual anunciado se realiza.",
      },
      {
        pergunta: "Posso trocar um item comprado com cupom?",
        resposta:
          "A troca segue a política da loja e o Código de Defesa do Consumidor. O cupom não restringe esse direito, mas o valor devolvido é o efetivamente pago.",
      },
    ],
  },
  {
    slug: "beleza",
    nome: "Beleza e cuidados pessoais",
    chamada:
      "Perfumes, maquiagem e cuidados: o mesmo volume e a mesma versão em outras lojas, com a loja oficial quando houver.",
    termos: ["beleza", "cosmetico", "cosmético", "perfume", "cabelo", "skincare", "saude", "saúde"],
    resumo:
      "Produtos de reposição constante, onde validade, procedência e volume importam mais que o percentual.",
    atualizacao: "23/09/2026",
    introducao: [
      "É uma categoria de recompra: shampoo, creme e perfume acabam. Isso torna o valor mínimo do cupom mais fácil de atingir sem desperdício. Em troca, exige atenção redobrada a validade, lacre e procedência.",
    ],
    comoAvaliar: [
      "Compare o preço por mililitro ou grama, não por embalagem.",
      "Verifique a validade informada e se o produto vem lacrado.",
      "Confira se há registro sanitário quando aplicável ao tipo de produto.",
      "Prefira vendedores com avaliações recentes na mesma categoria.",
    ],
    cuidados: [
      "Perfume com preço muito abaixo do mercado é o campeão de falsificação; desconfie.",
      "Tamanho miniatura anunciado com foto do frasco grande é um erro comum de leitura.",
      "Produto perto do vencimento às vezes explica o desconto — o que pode ser aceitável, desde que declarado.",
    ],
    perguntas: [
      {
        pergunta: "Vale comprar em quantidade para usar o cupom?",
        resposta:
          "Em itens de uso contínuo e validade longa, costuma valer. Em cosméticos abertos, a validade após o uso é curta e o estoque pode se perder.",
      },
      {
        pergunta: "Como reconhecer produto original?",
        resposta:
          "Lacre íntegro, rótulo em português, registro quando exigido e vendedor com histórico. Preço muito fora da média é o principal sinal de alerta.",
      },
    ],
  },
  {
    slug: "automotivo",
    nome: "Automotivo",
    chamada:
      "Peças e acessórios: só indico o mesmo item, com a compatibilidade do veículo conferida nos dois anúncios.",
    termos: ["automotivo", "carro", "moto", "pneu", "acessorios automotivos", "auto"],
    resumo:
      "Peças e acessórios em que compatibilidade com o veículo vale mais que qualquer desconto.",
    atualizacao: "23/09/2026",
    introducao: [
      "No automotivo, comprar a peça errada é o prejuízo mais comum — e nenhum cupom cobre isso. Ano, modelo, motorização e versão mudam a peça. Confirmar a compatibilidade antes é a etapa que realmente economiza dinheiro.",
    ],
    comoAvaliar: [
      "Confira ano, modelo, motorização e versão do veículo na descrição do anúncio.",
      "Quando existir, use o código da peça original como referência de busca.",
      "Verifique se a peça é original, paralela ou similar, e qual é a garantia.",
      "Em pneus, confira medida, índice de carga e velocidade, além da data de fabricação.",
    ],
    cuidados: [
      "Foto genérica não confirma compatibilidade; a lista de aplicação é o que vale.",
      "Item de segurança (freio, suspensão, pneu) não é lugar para economizar em procedência.",
      "Instalação costuma não estar inclusa e pode custar mais que a peça.",
    ],
    perguntas: [
      {
        pergunta: "Posso devolver peça comprada errada?",
        resposta:
          "Compras pela internet têm direito de arrependimento em até sete dias do recebimento. Peça já instalada, porém, costuma perder a possibilidade de devolução.",
      },
      {
        pergunta: "Cupom costuma render em pneu?",
        resposta:
          "Como o valor é alto, o teto trava rápido. Vale mais comparar o preço do jogo completo e o custo de instalação entre vendedores.",
      },
    ],
  },
  {
    slug: "brinquedos",
    nome: "Brinquedos",
    chamada:
      "O mesmo brinquedo em outras lojas, do mais barato ao mais caro, com a faixa etária indicada no anúncio.",
    termos: ["brinquedos", "brinquedo", "infantil", "jogos", "bonecas", "lego"],
    resumo:
      "Brinquedos e presentes infantis: o mesmo brinquedo mais barato em outra loja, com idade indicada e segurança conferidas.",
    atualizacao: "05/10/2026",
    introducao: [
      "Brinquedo é a categoria em que o mesmo produto aparece com mais preços diferentes perto do Dia das Crianças e do Natal. Comparar o mesmo item, com a mesma quantidade de peças e a mesma versão, é o que garante a economia de verdade.",
    ],
    comoAvaliar: [
      "Confira a idade indicada na embalagem e no anúncio.",
      "Em blocos de montar, compare o número de peças e o código do conjunto.",
      "Em brinquedos elétricos (motos, carrinhos e karts infantis), confira a voltagem da bateria (6 V, 12 V), o peso máximo e o tempo de recarga.",
      "Procure o selo do Inmetro no anúncio ou na foto da embalagem.",
    ],
    cuidados: [
      "Peças pequenas não são indicadas para menores de 3 anos.",
      'Réplica ou versão "compatível" não é o mesmo produto da marca.',
      "Veja o prazo de entrega antes da data do presente.",
    ],
    perguntas: [
      {
        pergunta: "Moto elétrica infantil é brinquedo ou veículo?",
        resposta:
          "É brinquedo: aqui ela fica em Brinquedos, separada das peças e acessórios de carro e moto, que ficam em Automotivo.",
      },
      {
        pergunta: "Vale comprar brinquedo com antecedência?",
        resposta:
          "Perto do Dia das Crianças e do Natal a procura sobe. Comparar e comprar antes ajuda a fugir de estoque baixo e de prazo de entrega apertado.",
      },
    ],
  },
  {
    slug: "eletrodomesticos",
    nome: "Eletrodomésticos",
    chamada:
      "Air fryer, aspirador, ventilador e cafeteira: o mesmo modelo e a mesma voltagem em outras lojas, do mais barato ao mais caro, com o frete à parte.",
    termos: [
      "eletrodomesticos",
      "eletrodomésticos",
      "eletroportateis",
      "eletroportáteis",
      "cozinha",
    ],
    resumo: "Aparelho de uso diário: voltagem, potência e capacidade decidem tanto quanto o preço.",
    atualizacao: "09/10/2026",
    introducao: [
      "Eletrodoméstico é compra de anos. O mesmo modelo aparece em dezenas de lojas, muitas vezes com diferença grande de preço e de frete. O que mais engana é a voltagem: 127 V e 220 V são produtos diferentes, e o anúncio mais barato pode ser justamente o da voltagem que não serve na sua casa.",
    ],
    comoAvaliar: [
      "Confira a voltagem (127 V, 220 V ou bivolt) antes de qualquer outra coisa.",
      "Compare potência e capacidade (watts, litros) entre o anúncio e o modelo que você quer.",
      "Prefira loja oficial ou vendedor com reputação alta em aparelhos caros.",
      "Simule o frete para o seu CEP: em itens grandes ele muda o preço final.",
    ],
    cuidados: [
      "Aparelho sem nota fiscal ou sem garantia do fabricante costuma sair mais barato por um motivo.",
      "Modelo parecido de outra linha pode ter menos potência ou acessórios; leia o que vem na caixa.",
      "Usado, recondicionado ou de vitrine aparece com desconto alto; o site separa esses casos.",
    ],
    perguntas: [
      {
        pergunta: "Como sei se é a mesma voltagem?",
        resposta:
          "A voltagem aparece no título ou nas características do anúncio. Na comparação, voltagem diferente nunca é tratada como o mesmo produto.",
      },
      {
        pergunta: "Vale comprar o mais barato?",
        resposta:
          "Vale quando é o mesmo modelo, na mesma voltagem, com vendedor confiável e o frete conferido para o seu CEP. É isso que a comparação mostra lado a lado.",
      },
    ],
  },
  {
    slug: "ferramentas",
    nome: "Ferramentas e EPI",
    chamada:
      "Furadeiras, parafusadeiras, kits de ferramentas e equipamentos de proteção: o mesmo produto em outras lojas, do mais barato ao mais caro, conferido pela foto.",
    termos: [
      "ferramentas",
      "ferramenta",
      "epi",
      "seguranca",
      "segurança",
      "construcao",
      "construção",
    ],
    resumo:
      "Ferramenta boa dura anos; o que muda o preço é bateria, potência, acessórios e garantia.",
    atualizacao: "09/10/2026",
    introducao: [
      "Em ferramentas, dois anúncios com a mesma foto podem vender coisas diferentes: com ou sem bateria, com uma ou duas baterias, com ou sem maleta. Em EPI, o que importa é o certificado de aprovação (CA) e o tamanho certo. Por isso a comparação separa o mesmo produto dos parecidos e diz o que muda.",
    ],
    comoAvaliar: [
      "Confira se a bateria e o carregador estão inclusos e quantos vêm no kit.",
      "Compare potência, voltagem e torque, não só a foto.",
      "Em EPI, procure o número do CA no anúncio e confira o tamanho.",
      "Prefira loja oficial da marca em ferramentas de valor alto.",
    ],
    cuidados: [
      "Kit anunciado com preço baixo às vezes vem sem bateria; leia o que vem na caixa.",
      "Ferramenta sem garantia do fabricante ou sem nota fiscal costuma ter procedência duvidosa.",
      "Desconfie de marca famosa com preço muito abaixo das outras lojas: confira o vendedor.",
    ],
    perguntas: [
      {
        pergunta: "Ferramenta sem bateria entra como o mesmo produto?",
        resposta:
          "Não. Na comparação, vir sem bateria, carregador ou acessório é diferença: o anúncio vai para Parecidos, com o que muda escrito.",
      },
      {
        pergunta: "O site indica EPI sem CA?",
        resposta:
          "O site mostra o que o anúncio informa. Antes de comprar EPI para trabalho, confira o número do CA na descrição do anúncio.",
      },
    ],
  },
  {
    slug: "moveis",
    nome: "Móveis",
    chamada:
      "Sofás, racks, guarda-roupas e cadeiras: o mesmo móvel em outras lojas, do mais barato ao mais caro, com as medidas e o frete conferidos.",
    comoAvaliar: [
      "Meça o vão onde o móvel vai ficar e compare com largura, altura e profundidade do anúncio.",
      "Meça também portas, corredores e elevador por onde a caixa ou o móvel montado precisa passar.",
      "Leia se o móvel chega montado ou desmontado e se a montagem está incluída no preço.",
      "Compare o material da estrutura e do tampo (MDF, MDP, madeira maciça), não só a foto.",
      "Em cadeiras e poltronas, confira o peso máximo suportado informado pelo fabricante.",
      "Simule o frete para o seu CEP: móvel grande costuma ter frete alto e prazo mais longo.",
    ],
    cuidados: [
      "A foto do anúncio quase sempre mostra o móvel decorado; confira o que vem de fato na caixa.",
      "Cor de madeira e de tecido varia entre a foto e o produto; leia o nome exato do acabamento.",
      "Ao receber, abra e confira as peças antes de assinar: avaria no transporte é mais fácil de reclamar na hora.",
      "Guarde a caixa e o manual até terminar a montagem, para o caso de faltar parafuso ou peça.",
      "Móvel com medida diferente, mesmo parecido, não é o mesmo produto e não deve ser comparado como igual.",
    ],
    perguntas: [
      {
        pergunta: "Como saber se o móvel cabe no meu espaço?",
        resposta:
          "Meça o vão e deixe uma folga para abrir portas e gavetas. Depois compare com as medidas do anúncio, que costumam estar nas características ou na descrição. Se o anúncio não informa as medidas, pergunte ao vendedor antes de comprar.",
      },
      {
        pergunta: "Vale pagar pela montagem?",
        resposta:
          "Em guarda-roupa, cozinha e móveis com muitas peças, a montagem profissional evita peça empenada e porta desalinhada. Some o valor da montagem ao preço antes de comparar com um anúncio que já a inclui.",
      },
      {
        pergunta: "O que fazer se o móvel chegar avariado?",
        resposta:
          "Fotografe a caixa e as peças antes de montar e registre a reclamação pelo próprio pedido. Não monte a peça danificada: isso pode atrapalhar a troca.",
      },
    ],
  },
  {
    slug: "saude",
    nome: "Saúde e bem-estar",
    chamada:
      "Termômetros, medidores de pressão, suplementos e itens de cuidado: o mesmo produto em outras lojas, do mais barato ao mais caro, conferido pela foto.",
    comoAvaliar: [
      "Procure o registro ou a notificação na Anvisa no anúncio ou na foto da embalagem.",
      "Confira a data de validade informada pelo vendedor antes de comprar, principalmente em suplementos.",
      "Em suplementos, compare a quantidade por porção e o número de porções da embalagem, não só o tamanho do pote.",
      "Em aparelhos como medidor de pressão e termômetro, confira se o modelo tem certificação do Inmetro.",
      "Prefira loja oficial da marca ou farmácia com reputação alta em produtos que você vai ingerir.",
    ],
    cuidados: [
      "Embalagem sem lacre, com lacre rompido ou rótulo em outra língua é motivo para não comprar.",
      "Preço muito abaixo das outras lojas em suplemento de marca conhecida pode indicar produto falsificado ou perto de vencer.",
      "Produto que promete curar doença ou emagrecer sem esforço não tem respaldo e não deveria estar à venda assim.",
      "Medicamento e item que exige receita não se compra por anúncio; procure uma farmácia.",
      "Ao receber, confira lote e validade na embalagem e compare com o que o anúncio informou.",
    ],
    perguntas: [
      {
        pergunta: "Como saber se o suplemento é original?",
        resposta:
          "Compre de loja oficial ou de vendedor com reputação alta e confira lacre, lote e validade ao receber. Desconfie de preço muito abaixo das outras lojas para a mesma marca e o mesmo tamanho.",
      },
      {
        pergunta: "Onde vejo o registro na Anvisa?",
        resposta:
          "O número costuma estar no rótulo e, em muitos anúncios, na descrição ou nas fotos da embalagem. Com ele, dá para consultar o produto no site da própria Anvisa.",
      },
      {
        pergunta: "Pote maior é sempre mais vantajoso?",
        resposta:
          "Só se você consumir tudo antes da validade. Divida o preço pelo número de porções para comparar potes de tamanhos diferentes.",
      },
    ],
  },
  {
    slug: "pet",
    nome: "Pet shop",
    chamada:
      "Ração, petiscos, areia, caminhas e brinquedos: o mesmo produto e o mesmo tamanho de pacote em outras lojas, do mais barato ao mais caro, com o frete à parte.",
    comoAvaliar: [
      "Confira se a ração é indicada para o porte e a idade do seu animal: filhote, adulto ou idoso, porte pequeno, médio ou grande.",
      "Compare o peso do pacote e calcule o preço por quilo antes de escolher o mais barato.",
      "Veja a data de validade informada no anúncio e quanto tempo o pacote vai durar na sua casa.",
      "Simule o frete para o seu CEP: pacote pesado de ração ou areia costuma ter frete alto.",
      "Em coleiras, roupas e caminhas, meça o animal e compare com a tabela de tamanhos do anúncio.",
    ],
    cuidados: [
      "Troca de ração deve ser gradual; comprar outra marca só pelo preço pode causar problema digestivo no animal.",
      "Pacote grande aberto perde qualidade com o tempo; guarde bem fechado e longe da umidade.",
      "Antipulgas e vermífugos têm dose pelo peso do animal; confira a faixa de peso da embalagem.",
      "Ao receber, confira se o pacote não chegou furado ou amassado e se a validade bate com o anúncio.",
      "Pacote com outro peso não é o mesmo produto: compare sempre o mesmo tamanho ou o preço por quilo.",
    ],
    perguntas: [
      {
        pergunta: "Pacote grande de ração compensa?",
        resposta:
          "Compensa quando o preço por quilo é menor e o animal consome tudo dentro da validade, com o pacote bem guardado. Para animal pequeno, um pacote enorme pode perder o sabor antes de acabar.",
      },
      {
        pergunta: "Por que o frete da ração é tão caro?",
        resposta:
          "O frete pesa conforme o peso e o tamanho da embalagem, e ração e areia são pesadas. Por isso vale comparar o preço final com o frete, não só o preço do pacote.",
      },
      {
        pergunta: "Como escolher o tamanho da coleira ou da roupa?",
        resposta:
          "Meça o pescoço, o peito e o comprimento do animal com uma fita métrica e compare com a tabela do anúncio. Entre dois tamanhos, o maior costuma ser mais confortável.",
      },
    ],
  },
  {
    slug: "esportes",
    nome: "Esportes e lazer",
    chamada:
      "Bicicletas, halteres, esteiras, tênis e itens de camping: o mesmo produto em outras lojas, do mais barato ao mais caro, com tamanho e frete conferidos.",
    comoAvaliar: [
      "Em bicicleta, confira o tamanho do quadro e do aro indicados para a sua altura.",
      "Em esteira, banco e barra, compare o peso máximo do usuário informado pelo fabricante.",
      "Meça o espaço livre em casa antes de comprar equipamento de academia, com folga para usar e guardar.",
      "Em halteres e anilhas, compare o peso de cada peça e o material, não só o preço do conjunto.",
      "Em roupas e calçados esportivos, use a tabela de medidas da marca e não o tamanho que você costuma usar.",
      "Simule o frete para o seu CEP: equipamento pesado ou volumoso muda o preço final.",
    ],
    cuidados: [
      "Equipamento usado acima do peso suportado desgasta rápido e pode quebrar durante o uso.",
      "Esteira e bicicleta ergométrica elétricas têm voltagem; confira antes de comprar.",
      "Bicicleta pode chegar parcialmente desmontada e precisar de regulagem; leia o que vem na caixa.",
      "Barraca, colchão inflável e saco de dormir têm capacidade de pessoas e temperatura indicadas; confira para o seu uso.",
      "Conjunto com outro peso ou outra quantidade de peças não é o mesmo produto, mesmo com a foto parecida.",
    ],
    perguntas: [
      {
        pergunta: "Como escolher o tamanho da bicicleta?",
        resposta:
          "O fabricante indica o tamanho do quadro pela altura de quem vai pedalar, e essa tabela costuma estar no anúncio. Quadro errado cansa e machuca; na dúvida, pergunte ao vendedor informando sua altura.",
      },
      {
        pergunta: "Quanto espaço preciso para uma esteira?",
        resposta:
          "Além das medidas da esteira, deixe espaço livre atrás e dos lados por segurança. Se o espaço é pequeno, procure modelos dobráveis e confira a medida dobrada no anúncio.",
      },
      {
        pergunta: "Peso máximo do usuário importa mesmo?",
        resposta:
          "Importa. Ele define o limite seguro do motor, da estrutura e da lona. Escolha um modelo com folga acima do seu peso para o equipamento durar mais.",
      },
    ],
  },
  {
    slug: "bebes",
    nome: "Bebês e maternidade",
    chamada:
      "Carrinhos, cadeirinhas, berços, mamadeiras e fraldas: o mesmo produto em outras lojas, do mais barato ao mais caro, com a faixa etária indicada no anúncio.",
    comoAvaliar: [
      "Confira a faixa etária e o peso indicados para o bebê em carrinhos, cadeirinhas, andadores e brinquedos.",
      "Procure o selo do Inmetro no anúncio ou na foto da embalagem em carrinho, berço, cadeirinha, chupeta e mamadeira.",
      "Em cadeirinha de carro, confira o grupo de peso e o tipo de fixação compatível com o seu carro.",
      "Em berço e cercadinho, compare as medidas com o colchão que você já tem ou vai comprar.",
      "Em fraldas, compare o preço por unidade dentro do mesmo tamanho, não o preço do pacote.",
    ],
    cuidados: [
      "Produto infantil sem certificação do Inmetro não segue a norma de segurança obrigatória; não vale a economia.",
      "Cadeirinha usada ou de procedência desconhecida pode ter sofrido batida que não aparece por fora.",
      "Peças pequenas e cordões soltos são risco de engasgo e estrangulamento; leia a idade mínima indicada.",
      "Bebê cresce rápido: pacote grande de fralda ou roupa de um tamanho só pode sobrar.",
      "Ao receber, confira se o produto tem manual em português e etiqueta com dados do fabricante ou importador.",
    ],
    perguntas: [
      {
        pergunta: "Por que o selo do Inmetro é tão importante em produtos para bebê?",
        resposta:
          "Para vários itens infantis, como carrinho, berço, cadeirinha de carro, chupeta e mamadeira, a certificação é obrigatória e confirma que o produto passou nos testes da norma de segurança. Sem o selo, não há garantia de que o produto foi testado.",
      },
      {
        pergunta: "Como escolher a cadeirinha de carro certa?",
        resposta:
          "Escolha pelo peso e pela idade do bebê, que definem o grupo da cadeirinha, e confira se o tipo de fixação serve no seu carro. Prefira produto novo, com selo do Inmetro e manual em português.",
      },
      {
        pergunta: "Vale comprar fralda em pacote grande?",
        resposta:
          "Vale quando o preço por unidade é menor e o bebê ainda vai usar aquele tamanho por um tempo. Perto da troca de tamanho, pacotes menores evitam sobra.",
      },
    ],
  },
  {
    slug: "mercado",
    nome: "Mercado e alimentos",
    chamada:
      "Café, bebidas, alimentos e itens de despensa: o mesmo produto e o mesmo tamanho em outras lojas, do mais barato ao mais caro, com o frete em linha própria.",
    comoAvaliar: [
      "Calcule o preço por quilo ou por litro para comparar embalagens de tamanhos diferentes.",
      "Confira a data de validade informada pelo vendedor, principalmente em compra de caixa fechada.",
      "Some o frete: em item barato ele pode custar mais que a diferença de preço entre as lojas.",
      "Em kits e caixas, confira quantas unidades vêm e o tamanho de cada uma.",
      "Leia se o produto é a versão tradicional, zero açúcar, sem lactose ou outra variação: o preço muda.",
    ],
    cuidados: [
      "Caixa grande só compensa se você consumir tudo antes de vencer.",
      "Produto perto da validade às vezes aparece com preço baixo; leia a descrição antes de comprar.",
      "Bebida e alimento chegam amassados ou vazando com alguma frequência; confira a embalagem ao receber.",
      "Pacote com outro peso ou outro volume não é o mesmo produto, mesmo com a mesma marca e a mesma foto.",
    ],
    perguntas: [
      {
        pergunta: "Vale comprar mercado pela internet?",
        resposta:
          "Vale em itens que não estragam rápido e quando o preço final, já com o frete, fica abaixo do que você paga perto de casa. Em item barato e avulso, o frete costuma apagar a vantagem.",
      },
      {
        pergunta: "Como comparar embalagens de tamanhos diferentes?",
        resposta:
          "Divida o preço pelo peso ou pelo volume para chegar ao preço por quilo ou por litro. A embalagem maior nem sempre é a mais barata por quilo.",
      },
      {
        pergunta: "E se o produto chegar perto de vencer?",
        resposta:
          "Confira a validade assim que receber. Se estiver diferente do que o anúncio informou, registre a reclamação pelo próprio pedido.",
      },
    ],
  },
  {
    slug: "papelaria",
    nome: "Papelaria e escritório",
    chamada:
      "Cadernos, papel sulfite, canetas, mochilas e material de escritório: o mesmo produto e a mesma quantidade em outras lojas, do mais barato ao mais caro.",
    comoAvaliar: [
      "Confira quantas unidades ou folhas vêm no pacote e calcule o preço por unidade.",
      "Em papel, compare a gramatura (g/m²) e o tamanho da folha: papel mais grosso custa mais e serve para outro uso.",
      "Em cadernos, compare o número de matérias, de folhas e o tipo de capa, não só a foto.",
      "Em canetas e marcadores, confira a espessura da ponta e as cores incluídas no conjunto.",
      "Em refil, cartucho e toner, confira o modelo exato da impressora compatível.",
      "Some o frete: em compra pequena de papelaria ele pode pesar mais que o próprio produto.",
    ],
    cuidados: [
      "Pacote com foto de várias unidades pode vender só uma; leia a quantidade no título e na descrição.",
      "Cartucho e toner compatíveis custam menos que os originais, mas não são o mesmo produto.",
      "Lista de material escolar costuma pedir marca ou especificação; confira antes de trocar pelo mais barato.",
      "Caixa de papel é pesada; confira se chegou sem umidade e sem folhas amassadas.",
      "Pacote com outra quantidade ou outra gramatura não é o mesmo produto, mesmo com a mesma marca.",
    ],
    perguntas: [
      {
        pergunta: "O que é gramatura do papel?",
        resposta:
          "É o peso do papel por metro quadrado, indicado em g/m². Quanto maior, mais grosso e firme o papel. Para imprimir no dia a dia, o papel sulfite comum resolve; para capa e convite, procure gramatura mais alta.",
      },
      {
        pergunta: "Cartucho compatível vale a pena?",
        resposta:
          "Pode valer pelo preço, mas confira se o modelo é compatível com a sua impressora e a reputação do vendedor. Na comparação, compatível e original não são tratados como o mesmo produto.",
      },
      {
        pergunta: "Como comparar pacotes de quantidades diferentes?",
        resposta:
          "Divida o preço pelo número de unidades ou de folhas. Assim fica claro se o pacote maior é de fato mais barato por unidade.",
      },
    ],
  },
];

export function buscarCategoria(slug: string) {
  return CATEGORIAS.find((categoria) => categoria.slug === slug);
}
