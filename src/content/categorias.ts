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
  /** Termos usados na base de cupons que pertencem a esta categoria. */
  termos: string[];
  resumo: string;
  atualizacao: string;
  introducao: string[];
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
      "Air fryer, liquidificador, aspirador, ventilador e cafeteira: o mesmo modelo e a mesma voltagem em outras lojas, do mais barato ao mais caro, com o frete em linha própria.",
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
];

export function buscarCategoria(slug: string) {
  return CATEGORIAS.find((categoria) => categoria.slug === slug);
}
