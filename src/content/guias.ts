/* Guias escritos à mão. Conteúdo editorial próprio. Primeiro os de
   comparação de preço (função atual do site); os de cupom ficam depois
   (cupons em segundo plano desde 25/09). Nada de texto inflado para SEO — cada
   guia responde uma dúvida concreta de quem está prestes a comprar. */

export type Bloco =
  | { tipo: "p"; texto: string }
  | { tipo: "h2"; texto: string }
  | { tipo: "h3"; texto: string }
  | { tipo: "tabela"; legenda: string; colunas: string[]; linhas: string[][] }
  | { tipo: "chamada"; texto: string; botao: string; para: "/" | "/meus-precos" }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "destaque"; titulo: string; texto: string }
  | { tipo: "conta"; titulo: string; linhas: { rotulo: string; valor: string }[]; nota?: string };

export type Guia = {
  slug: string;
  titulo: string;
  resumo: string;
  tempo: string;
  atualizacao: string;
  /** First commit date of the guide (git log -S slug), DD/MM/AAAA. */
  publicado?: string;
  /** Meta description (140-155 chars). Falls back to resumo. */
  descricao?: string;
  /** Parent category slug (src/content/categorias.ts) for breadcrumb and hub links. */
  categoria?: string;
  /** Sibling guides shown first in "Continue lendo". */
  relacionados?: string[];
  /** "Resumo em 30 segundos": only real, dated findings (13/11/2026). */
  resumo30?: { rotulo: string; texto: string }[];
  /** Date the prices in the guide were captured, shown as "Última verificação de preços". */
  verificado?: string;
  blocos: Bloco[];
  perguntas: { pergunta: string; resposta: string }[];
};

export const GUIAS: Guia[] = [
  {
    slug: "como-comparar-o-preco-do-mesmo-produto",
    titulo: "Como comparar o preço do mesmo produto em outras lojas",
    resumo:
      "O mesmo produto costuma ser vendido por várias lojas com preços diferentes. Veja como achar e ler essa comparação.",
    tempo: "3 min de leitura",
    atualizacao: "27/09/2026",
    publicado: "25/09/2026",
    descricao:
      "O mesmo produto aparece em várias lojas com preços diferentes. Veja como comparar, ler a tabela e quanto se economizou em exemplos reais e datados.",
    relacionados: ["mesmo-produto-ou-parecido", "o-que-conferir-antes-de-pagar"],
    blocos: [
      {
        tipo: "p",
        texto:
          "Um mesmo produto, da mesma marca e do mesmo modelo, costuma ser anunciado por várias lojas ao mesmo tempo. O preço muda de uma para outra, e a diferença pode passar de dezenas de reais. O anúncio que aparece primeiro para você nem sempre é o mais barato.",
      },
      { tipo: "h2", texto: "Como usar o comparador" },
      {
        tipo: "passos",
        itens: [
          "Abra o anúncio do produto que você quer comprar e copie o endereço (o link).",
          "Cole o link na caixa da página inicial e toque em Comparar preços.",
          "Em menos de dois minutos aparece a tabela com todas as lojas que vendem o mesmo produto dentro do Mercado Livre, do mais barato ao mais caro, com a loja oficial marcada quando houver.",
          "Escolha a loja e compre pelo botão, direto no site oficial, com pagamento protegido.",
        ],
      },
      { tipo: "h2", texto: "Como ler o resultado" },
      {
        tipo: "lista",
        itens: [
          "Verde com o selo Mais barato: a loja com o menor preço entre as que vendem o mesmo produto.",
          "Vermelho: quanto você pagaria a mais em cada uma das outras lojas.",
          "Âmbar: o anúncio que você colou, quando ele não é o mais barato.",
          "Parecidos: aparecem numa lista separada, com o aviso do que muda. Não são o mesmo produto.",
        ],
      },
      { tipo: "h2", texto: "Exemplos reais" },
      {
        tipo: "conta",
        titulo: "Pista de dinossauro com 279 peças (comparado em 25/09/2026)",
        linhas: [
          { rotulo: "Anúncio colado", valor: "R$ 119,60" },
          { rotulo: "Mesmo produto em outra loja", valor: "R$ 113,00" },
          { rotulo: "Diferença", valor: "R$ 6,60 a menos (5,5%)" },
        ],
        nota: "Mesma pista, mesma quantidade de peças e mesmos carrinhos: só mudava a loja.",
      },
      {
        tipo: "conta",
        titulo: "Kit shampoo e condicionador Siàge Nutri Diamond (25/09/2026)",
        linhas: [
          { rotulo: "Lojas mais baratas", valor: "R$ 78,00" },
          { rotulo: "Outras lojas", valor: "R$ 89,90 · R$ 98,90 · R$ 99,90" },
          { rotulo: "Da mais barata à mais cara", valor: "R$ 21,90 de diferença" },
        ],
        nota: "O mesmo kit, no mesmo dia. Quem comprasse na loja mais cara pagaria 28% a mais.",
      },
      {
        tipo: "conta",
        titulo: "Disco de freio traseiro Honda NX 400 Falcon (25/09/2026)",
        linhas: [
          { rotulo: "Anúncio colado", valor: "R$ 42,92" },
          { rotulo: "Outras lojas", valor: "R$ 45,31 · R$ 47,69" },
          { rotulo: "Resultado", valor: "o anúncio colado já era o mais barato" },
        ],
        nota: "Comparar também serve para confirmar que você já está no melhor preço.",
      },
      {
        tipo: "destaque",
        titulo: "O preço é o de quando comparei",
        texto:
          "Preço, estoque e frete mudam ao longo do dia. Confira o valor final na página da loja antes de pagar.",
      },
    ],
    perguntas: [
      {
        pergunta: "E se não aparecer nenhuma outra loja?",
        resposta:
          "Quer dizer que nenhuma outra loja vende este mesmo produto por menos, ou que só encontrei anúncios diferentes. O anúncio que você colou aparece como melhor opção, com o botão de compra.",
      },
      {
        pergunta: "Pago mais caro comprando pelo botão do site?",
        resposta:
          "Não. O preço é o mesmo da loja. O site recebe uma comissão do programa de afiliados, nunca de quem compra.",
      },
    ],
  },
  {
    slug: "geladeira-frost-free-500l-comparativo",
    titulo: "Geladeira Frost Free 500 L: como comparar lojas e economizar até R$ 800",
    resumo:
      "Comparação real entre lojas do mesmo modelo de 500 litros (Branca e Black Inox): diferença de até R$ 799 entre lojas e o peso do frete no preço final.",
    tempo: "4 min de leitura",
    atualizacao: "05/10/2026",
    publicado: "05/10/2026",
    descricao:
      "Comparação real do mesmo modelo de geladeira Frost Free 500 L em seis lojas: até R$ 799 de diferença e quando o frete pago ainda compensa no custo final.",
    categoria: "eletrodomesticos",
    relacionados: ["como-comparar-o-preco-do-mesmo-produto", "o-que-conferir-antes-de-pagar"],
    blocos: [
      {
        tipo: "p",
        texto:
          "Geladeira é a compra em que a diferença entre lojas mais pesa no bolso. O mesmo modelo, da mesma marca, aparece em várias lojas com preços que mudam centenas de reais. E, por ser um produto grande, o frete pode virar a conta de cabeça para baixo.",
      },
      { tipo: "h2", texto: "Exemplo medido: o mesmo modelo, Branca (02/10/2026)" },
      {
        tipo: "conta",
        titulo:
          "Geladeira Frost Free Inverse 500 L, Branca, mesmo modelo, frete para Mogi das Cruzes (SP)",
        linhas: [
          { rotulo: "Loja mais barata (frete grátis)", valor: "R$ 4.049,00" },
          { rotulo: "Loja mais cara com frete grátis", valor: "R$ 4.848,39" },
          { rotulo: "Diferença no mesmo produto", valor: "R$ 799,39" },
        ],
        nota: "Seis lojas comparadas. Uma loja oficial anunciava por R$ 4.537,90, mas o frete para o CEP era de R$ 457,94: no total, ficava mais cara que a de frete grátis.",
      },
      { tipo: "h2", texto: "Exemplo medido: Black Inox (05/10/2026)" },
      {
        tipo: "conta",
        titulo: "Geladeira Frost Free Inverse 500 L, Black Inox, mesmo modelo",
        linhas: [
          { rotulo: "Anúncio comparado (frete grátis)", valor: "R$ 4.799,00" },
          { rotulo: "Loja oficial, produto", valor: "R$ 4.350,44" },
          { rotulo: "Loja oficial, frete para o CEP", valor: "R$ 33,00" },
          { rotulo: "Loja oficial, custo final", valor: "R$ 4.383,44" },
          { rotulo: "Economia no custo final", valor: "R$ 415,56" },
        ],
        nota: "Aqui o frete pago compensou: mesmo pagando o frete, o custo final ficou menor. Em outra loja do mesmo dia, o frete era de R$ 677,35.",
      },
      {
        tipo: "destaque",
        titulo: "Cor também é outro produto",
        texto:
          "No mesmo dia, a versão Branca custava cerca de R$ 1.000 a menos que a Black Inox. Não é o mesmo produto: muda o acabamento. Por isso ela aparece separada, como parecido, com o aviso do que muda.",
      },
      { tipo: "h2", texto: "Passo a passo antes de fechar" },
      {
        tipo: "passos",
        itens: [
          "Confira o código do modelo no título ou nas características. Uma letra muda a cor ou o acabamento (por exemplo, final B, E ou K no mesmo modelo).",
          "Confira a voltagem: 110 V ou 220 V. Geladeira na voltagem errada precisa de transformador ou não funciona.",
          "Confira a capacidade em litros nas características, não só no título.",
          "Informe o seu CEP: o frete de um produto grande muda muito de uma cidade para outra.",
          "Compare pelo custo final (produto mais frete) e veja se a loja é oficial.",
        ],
      },
      { tipo: "h2", texto: "Como o comparador ajuda" },
      {
        tipo: "lista",
        itens: [
          "Mostra as lojas que vendem o mesmo modelo, do mais barato ao mais caro, com a loja oficial marcada.",
          "Calcula o frete para o seu CEP e recomenda pelo custo final. Quando o valor do frete não é conhecido, a loja com frete pago não passa na frente.",
          "Separa os parecidos (outra cor, outra capacidade) e diz o que muda.",
        ],
      },
    ],
    perguntas: [
      {
        pergunta: "Vale pagar frete se o produto é mais barato?",
        resposta:
          "Vale quando o custo final (produto mais frete) fica menor. No exemplo de 05/10/2026, a loja com frete de R$ 33 saiu R$ 415,56 mais barata no total.",
      },
      {
        pergunta: "Branca e Black Inox são o mesmo produto?",
        resposta:
          "Não. O modelo muda pelo acabamento, e o preço também. O comparador mostra a outra cor como parecido, com o aviso do que muda.",
      },
      {
        pergunta: "O preço do guia ainda vale?",
        resposta:
          "Não necessariamente. Os valores são de 02/10 e 05/10/2026. Cole o link do anúncio para ver a comparação de agora.",
      },
    ],
  },
  {
    slug: "mesmo-produto-ou-parecido",
    titulo: "Mesmo produto ou só parecido? Como diferenciar",
    resumo:
      "Foto diferente não quer dizer produto diferente, e título igual não quer dizer produto igual. O que realmente conta.",
    tempo: "4 min de leitura",
    atualizacao: "27/09/2026",
    publicado: "25/09/2026",
    descricao:
      "Foto diferente não quer dizer produto diferente, e título igual não garante produto igual. Veja como conferir modelo, versão e quantidade antes de comprar.",
    relacionados: ["como-comparar-o-preco-do-mesmo-produto", "o-que-conferir-antes-de-pagar"],
    blocos: [
      {
        tipo: "p",
        texto:
          "Comparar preço só faz sentido entre produtos iguais. Um anúncio parecido, mais barato, pode ser de outra marca, de outro modelo ou vir com menos unidades, e aí a economia é ilusão.",
      },
      { tipo: "h2", texto: "O que precisa ser igual" },
      {
        tipo: "lista",
        itens: [
          "Marca e modelo.",
          "Cor e acabamento do próprio produto (uma capinha transparente com borda preta não é a mesma que uma toda transparente).",
          "Tamanho, volume ou capacidade.",
          "Compatibilidade: modelo do celular, voltagem, medida.",
          "Quantidade: um kit com 30 unidades não é igual a um com 20.",
          "O que vem junto: película, cabo ou brinde mudam o que você está comprando.",
        ],
      },
      { tipo: "h2", texto: "O que não conta" },
      {
        tipo: "p",
        texto:
          "Cada loja faz a própria foto. Fundo, ângulo, iluminação, montagem e textos na imagem mudam de anúncio para anúncio sem que o produto mude. Um detalhe que só não aparece na foto não é, sozinho, sinal de produto diferente.",
      },
      {
        tipo: "destaque",
        titulo: "Como o site confere",
        texto:
          "Cada anúncio encontrado é comparado com o que você colou pela foto, descrição e características (marca, modelo, cor, tamanho, voltagem, condição). Todo resultado igual passa por uma segunda conferência. Só entra na tabela de lojas o que é o mesmo produto. O que é apenas parecido aparece separado, com a descrição do que muda.",
      },
      { tipo: "h2", texto: "Exemplos reais" },
      {
        tipo: "conta",
        titulo: "Capinha para Motorola Edge 70 (25/09/2026)",
        linhas: [
          { rotulo: "Anúncio colado", valor: "acrílico transparente com borda preta" },
          { rotulo: "Capinha slim toda transparente", valor: "parecida: muda a borda" },
          {
            rotulo: "Capinha para Edge 70 Fusion ou Edge 70 Pro",
            valor: "diferente: outro celular",
          },
        ],
        nota: 'O título das três dizia "capinha anti-impacto Edge 70". Só a foto e o modelo mostravam a diferença.',
      },
      {
        tipo: "conta",
        titulo: "Kit de cabides de madeira (25/09/2026)",
        linhas: [
          { rotulo: "Anúncio colado: 30 cabides de uma marca", valor: "R$ 116,10 (R$ 3,87 cada)" },
          { rotulo: "30 cabides de outra marca", valor: "R$ 110,48: parecido, muda a marca" },
          { rotulo: "Kit com 20 cabides", valor: "R$ 148,80 (R$ 7,44 cada): outra quantidade" },
        ],
        nota: "Com quantidade diferente, compare o preço por unidade, não o preço do anúncio.",
      },
    ],
    perguntas: [
      {
        pergunta: "Vale a pena comprar um parecido mais barato?",
        resposta:
          "Pode valer, desde que você leia o que muda. Outra marca ou outro acabamento podem não fazer diferença para você; outro modelo de celular ou outra voltagem fazem.",
      },
      {
        pergunta: "O título igual garante que é o mesmo produto?",
        resposta:
          "Não. Muitos anúncios copiam títulos de outros. Confira marca, modelo, quantidade e o que vem junto.",
      },
    ],
  },
  {
    slug: "o-que-conferir-antes-de-pagar",
    titulo: "O que conferir antes de pagar no anúncio mais barato",
    resumo:
      "Achou o mesmo produto mais barato? Cinco verificações rápidas para a economia não virar dor de cabeça.",
    tempo: "3 min de leitura",
    atualizacao: "25/09/2026",
    publicado: "25/09/2026",
    descricao:
      "Achou o mesmo produto mais barato? Frete, prazo, loja, versão e pagamento: as verificações antes de pagar e quando um preço baixo demais é um alerta.",
    relacionados: ["mesmo-produto-ou-parecido", "como-comparar-o-preco-do-mesmo-produto"],
    blocos: [
      {
        tipo: "p",
        texto:
          "A diferença de preço entre lojas é real, mas o preço do produto não é o único custo. Antes de finalizar, confira o que pode mudar a conta.",
      },
      { tipo: "h2", texto: "As verificações" },
      {
        tipo: "passos",
        itens: [
          "Frete: some ao preço. Um produto R$ 10 mais barato com R$ 20 de frete sai mais caro.",
          "Prazo de entrega: se você precisa logo, compare também quando chega.",
          "Reputação da loja: veja as avaliações e o histórico de vendas do vendedor.",
          "Versão certa: confira de novo modelo, voltagem, tamanho e quantidade na página do anúncio.",
          "Pagamento no site oficial: pague sempre dentro da loja, nunca por transferência ou link enviado por mensagem.",
        ],
      },
      { tipo: "h2", texto: "Quando o preço baixo demais é um alerta" },
      {
        tipo: "p",
        texto:
          "Resposta curta: quando o mesmo produto aparece 30% ou mais abaixo do que cobram as lojas oficiais, trate a diferença como um sinal para conferir, não como uma vitória. Nas comparações que eu guardei, as diferenças comuns são bem menores: a mediana foi de 13,6% do preço do anúncio colado.",
      },
      {
        tipo: "conta",
        titulo: "Três casos reais em que o mais barato pedia cuidado",
        linhas: [
          {
            rotulo: "Console Nintendo Switch 2, modelo nacional (02/11/2026)",
            valor: "R$ 4.299,00 na loja oficial · a partir de R$ 2.906,32 em outras",
          },
          {
            rotulo: "Lava e seca Midea 11 kg Titanium (04/11/2026)",
            valor: "R$ 3.399,90 na oficial mais barata · R$ 1.860,00 numa loja sem selo",
          },
          {
            rotulo: "Perfume Egeo Vanilla Vibe 90 mL (12/11/2026)",
            valor: "R$ 329,90 no anúncio colado · R$ 160,00 na oferta mais baixa",
          },
        ],
        nota: "Não quer dizer que essas ofertas eram golpe. Quer dizer que a diferença era grande demais para comprar sem olhar a loja, a versão e a garantia.",
      },
      {
        tipo: "lista",
        itens: [
          "Veja se a versão é a mesma: modelo nacional ou importado, voltagem e o que vem na caixa.",
          "Abra a reputação do vendedor e o número de vendas. Loja nova com preço muito baixo pede mais cuidado.",
          "Procure a garantia e a nota fiscal na descrição. Sem as duas, o barato pode sair caro num defeito.",
          "Se a diferença for pequena, a loja oficial costuma valer os poucos reais a mais.",
        ],
      },
      {
        tipo: "destaque",
        titulo: "Na dúvida, fique com o que você colou",
        texto:
          "O anúncio que você colou também tem o botão de compra segura. Economizar pouco com uma loja que você não confia não compensa.",
      },
    ],
    perguntas: [
      {
        pergunta: "O preço da tabela é garantido?",
        resposta:
          "Não. É o preço lido no momento da comparação. A loja pode mudar o preço ou o estoque a qualquer hora.",
      },
      {
        pergunta: "Tenho direito de devolver?",
        resposta:
          "Compras feitas pela internet têm direito de arrependimento em até sete dias a partir do recebimento, previsto no Código de Defesa do Consumidor.",
      },
    ],
  },
  {
    slug: "como-calcular-a-economia-real-de-um-cupom",
    titulo: "Cupom no Mercado Livre: como calcular a economia real",
    resumo:
      "Teto, valor mínimo, frete e as pegadinhas que fazem um cupom de 40% valer 5%. A conta completa, os limites e quando não vale a pena usar.",
    descricao:
      "Como calcular quanto um cupom desconta de verdade: teto, valor mínimo, frete, qual de dois cupons rende mais e quando trocar de loja não compensa.",
    tempo: "7 min de leitura",
    atualizacao: "13/11/2026",
    publicado: "23/09/2026",
    relacionados: [
      "como-saber-se-um-desconto-e-realmente-vantajoso",
      "o-que-conferir-antes-de-pagar",
    ],
    resumo30: [
      {
        rotulo: "A conta",
        texto:
          "Desconto real = o menor valor entre compra × percentual e o teto. Abaixo do mínimo, é zero.",
      },
      {
        rotulo: "A pegadinha",
        texto: "Um cupom de 40% com teto de R$ 5 dá 5% numa compra de R$ 100.",
      },
      {
        rotulo: "Antes do cupom",
        texto:
          "Compare o produto: em 46% das 1.285 comparações que fiz, outra loja já vendia o mesmo item mais barato.",
      },
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          "Eu já vi muita gente escolher o cupom pelo número grande e pagar mais caro no fim. O percentual anunciado é uma promessa com condições. O que cai no seu carrinho depende de três números em letra pequena: o percentual, o teto e o valor mínimo de compra.",
      },
      { tipo: "h2", texto: "Quanto um cupom desconta de verdade?" },
      {
        tipo: "p",
        texto:
          "Multiplique o valor da compra pelo percentual. Se o resultado passar do teto, o desconto é o teto. Se a compra ficar abaixo do mínimo, o desconto é zero. Esse valor em reais, dividido pela compra, é o percentual efetivo: o único número que dá para comparar entre cupons.",
      },
      {
        tipo: "conta",
        titulo: "Exemplo: cupom de 40%, teto de R$ 5, mínimo de R$ 20",
        linhas: [
          { rotulo: "Compra de R$ 100", valor: "40% seriam R$ 40, mas o teto corta em R$ 5" },
          { rotulo: "Desconto real", valor: "R$ 5" },
          { rotulo: "Percentual efetivo", valor: "5%, não 40%" },
        ],
        nota: "É por isso que um cupom de 40% pode valer menos que um de 10% sem teto.",
      },
      { tipo: "h2", texto: "Em que valor o cupom para de crescer?" },
      {
        tipo: "p",
        texto:
          "Todo cupom com teto tem um ponto de virada: o teto dividido pelo percentual. Acima dele, o desconto em reais fica parado. No exemplo acima, R$ 5 ÷ 0,40 = R$ 12,50. Qualquer compra maior que isso recebe sempre os mesmos R$ 5, seja de R$ 50 ou de R$ 3.000.",
      },
      {
        tipo: "p",
        texto:
          "Em compras caras, como eletrodomésticos e celulares, o teto é atingido quase sempre. Ali o cupom vira um abatimento fixo, e quem decide o negócio é o preço do produto.",
      },
      { tipo: "h2", texto: "Qual de dois cupons rende mais?" },
      {
        tipo: "p",
        texto:
          "Depende de quanto você vai gastar. Um cupom de percentual alto com teto ganha em compras pequenas; um de percentual baixo sem teto ganha em compras grandes. Faça a conta em reais para o seu valor de compra, não para o percentual anunciado.",
      },
      {
        tipo: "tabela",
        legenda: "Cupom A: 50% com teto de R$ 10 · Cupom B: 12% sem teto (exemplo de cálculo)",
        colunas: ["Valor da compra", "Cupom A", "Cupom B", "Rende mais"],
        linhas: [
          ["R$ 60", "R$ 10,00", "R$ 7,20", "A"],
          ["R$ 100", "R$ 10,00", "R$ 12,00", "B"],
          ["R$ 200", "R$ 10,00", "R$ 24,00", "B"],
          ["R$ 500", "R$ 10,00", "R$ 60,00", "B"],
        ],
      },
      {
        tipo: "destaque",
        titulo: "O ponto em que B passa A",
        texto:
          "R$ 10 ÷ 0,12 = R$ 83,33. Acima desse valor de compra, o cupom de 12% rende mais que o de 50%.",
      },
      { tipo: "h2", texto: "Por que o cupom é recusado no carrinho?" },
      {
        tipo: "p",
        texto:
          "Quase sempre por um destes limites: a compra não chegou ao mínimo, o orçamento da campanha acabou, o produto é de outro vendedor ou o cupom já foi usado. Cupom é uma campanha com orçamento e regras, não um desconto livre.",
      },
      { tipo: "h3", texto: "Teto de desconto" },
      {
        tipo: "p",
        texto:
          "É o máximo em reais que o cupom abate. Cupons sem teto existem, costumam ter percentual baixo e são justamente os que mais valem em compras caras.",
      },
      { tipo: "h3", texto: "Valor mínimo de compra" },
      {
        tipo: "p",
        texto:
          "Abaixo dele o código não é aceito. É o limite que mais empurra a gastar sem precisar: só vale chegar nele com um item que você já ia comprar.",
      },
      { tipo: "h3", texto: "Validade e orçamento da campanha" },
      {
        tipo: "p",
        texto:
          "A validade é o prazo máximo, não uma garantia. Quando o orçamento reservado acaba, o cupom para de funcionar mesmo dentro do prazo. É a causa mais comum de um código que funcionava ontem ser recusado hoje.",
      },
      { tipo: "h3", texto: "Restrição de vendedor ou categoria" },
      {
        tipo: "p",
        texto:
          "Cupom de vendedor vale só nos produtos dele. O mesmo produto comprado de outro anunciante não recebe o desconto, ainda que seja idêntico.",
      },
      { tipo: "h2", texto: "O frete pode apagar a economia do cupom?" },
      {
        tipo: "p",
        texto:
          "Pode, e é o erro mais caro que eu vejo. Em geral o cupom abate só o valor dos produtos, não o frete. Compare sempre o custo final: produto, menos cupom, mais frete para o seu CEP.",
      },
      {
        tipo: "conta",
        titulo: "Exemplo de cálculo: cupom de R$ 10 numa loja com frete pago",
        linhas: [
          { rotulo: "Loja 1: R$ 120 − cupom R$ 10 + frete R$ 18", valor: "R$ 128" },
          { rotulo: "Loja 2: R$ 122, sem cupom, frete grátis", valor: "R$ 122" },
          { rotulo: "Melhor escolha", valor: "Loja 2, R$ 6 mais barata" },
        ],
        nota: "O cupom chamava atenção, mas o frete virou a conta. O comparador mostra o frete em linha própria por esse motivo.",
      },
      { tipo: "h2", texto: "Como aplicar o cupom sem perder o desconto" },
      {
        tipo: "passos",
        itens: [
          "Copie o código antes de sair da página onde ele está.",
          "Abra o produto e confira se o vendedor é o mesmo do cupom.",
          "Coloque no carrinho e veja se a compra atinge o valor mínimo.",
          "No carrinho ou na tela de pagamento, cole o código no campo de cupom.",
          "Confira se o total caiu e se o abatimento bate com a sua conta.",
          "Só então conclua o pedido. Se o total não mudou, o desconto não foi aplicado.",
        ],
      },
      {
        tipo: "lista",
        itens: [
          "Erro comum: digitar o código à mão e trocar uma letra parecida.",
          "Erro comum: trocar o produto do carrinho depois de aplicar o cupom.",
          "Erro comum: fechar pela compra rápida, que às vezes pula o campo de cupom.",
        ],
      },
      { tipo: "h2", texto: "Quando não vale a pena usar o cupom" },
      {
        tipo: "p",
        texto:
          "Nem todo cupom é economia. Gastar R$ 30 a mais para chegar ao mínimo e ganhar R$ 5 é prejuízo. Trocar uma loja oficial, com garantia clara, por um vendedor sem histórico para economizar poucos reais também não compensa. E um cupom sobre um preço inflado só devolve parte do que foi aumentado.",
      },
      {
        tipo: "chamada",
        texto:
          "Antes de procurar cupom, veja se o mesmo produto já está mais barato em outra loja. Você cola o link e compra no Mercado Livre, com pagamento protegido.",
        botao: "Comparar o preço agora",
        para: "/",
      },
    ],
    perguntas: [
      {
        pergunta: "O desconto do cupom incide sobre o frete?",
        resposta:
          "Em geral não. A maior parte dos cupons abate só o valor dos produtos. Confira no carrinho, porque a regra varia por campanha.",
      },
      {
        pergunta: "Posso somar dois cupons na mesma compra?",
        resposta:
          "Normalmente não: a maioria das lojas aceita um cupom por pedido. Escolha o de maior desconto em reais para o seu valor de compra.",
      },
      {
        pergunta: "Dá para aplicar o cupom depois de finalizar o pedido?",
        resposta:
          "Não. O desconto precisa estar aplicado antes da confirmação. Depois, só cancelando e refazendo a compra, se a loja permitir.",
      },
      {
        pergunta: "Vale dividir o pedido para usar o cupom duas vezes?",
        resposta:
          "Raramente. Muitas campanhas limitam o uso por pessoa, e dividir costuma multiplicar o frete.",
      },
    ],
  },
  {
    slug: "como-saber-se-um-desconto-e-realmente-vantajoso",
    titulo: "Desconto real ou metade do dobro? Como saber se a oferta vale",
    resumo:
      "O preço riscado nem sempre existiu. O que os preços que acompanhei mostram, as verificações antes de pagar e os sinais de uma oferta falsa.",
    descricao:
      "Como saber se um desconto é real antes da Black Friday: o que mostram 88 preços acompanhados por semanas, os sinais de oferta falsa e o que conferir.",
    tempo: "7 min de leitura",
    atualizacao: "13/11/2026",
    publicado: "23/09/2026",
    relacionados: ["o-que-conferir-antes-de-pagar", "como-calcular-a-economia-real-de-um-cupom"],
    resumo30: [
      {
        rotulo: "O teste",
        texto:
          "Compare o preço final de hoje do mesmo produto em outras lojas. Ignore o valor riscado.",
      },
      {
        rotulo: "O que os dados mostram",
        texto:
          "De 88 preços que acompanhei por mais de uma semana, 2 em cada 10 terminaram mais caros.",
      },
      {
        rotulo: "O alerta",
        texto: "Preço 30% ou mais abaixo das lojas oficiais pede conferência da loja e da versão.",
      },
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          '"Metade do dobro" é o desconto sobre um preço que subiu pouco antes. O percentual é verdadeiro na etiqueta, mas a economia não existe. Desconto é sempre relativo a um preço de referência: se a referência foi inventada, o desconto também foi.',
      },
      { tipo: "h2", texto: "Como saber em um minuto se o desconto é real?" },
      {
        tipo: "p",
        texto:
          "Compare o preço final de hoje, com frete, do mesmo produto em outras lojas. Se ele está no nível das outras ou abaixo, o desconto é real. Se o valor riscado é a única referência, você não sabe. Foi por isso que eu criei o comparador: ele faz essa conferência loja por loja.",
      },
      { tipo: "h2", texto: "O que os preços que acompanhei mostram" },
      {
        tipo: "p",
        texto:
          "Entre 18/10 e 13/11/2026 acompanhei 88 produtos que tiveram o preço lido pelo menos três vezes, com mais de sete dias entre a primeira e a última leitura. Os preços se mexem nos dois sentidos, o que derruba a ideia de que esperar sempre compensa.",
      },
      {
        tipo: "tabela",
        legenda: "88 preços acompanhados por mais de 7 dias, 18/10 a 13/11/2026",
        colunas: ["O que aconteceu", "Parte dos produtos"],
        linhas: [
          ["Variou mais de 5% em algum momento", "39%"],
          ["Terminou mais caro do que começou (mais de 2%)", "20%"],
          ["Terminou mais barato do que começou (mais de 2%)", "23%"],
          ["Variação mediana entre o menor e o maior preço", "1,1%"],
        ],
      },
      {
        tipo: "p",
        texto:
          "A maior parte dos preços quase não se mexe. Quando se mexe, sobe tanto quanto desce. Um desconto que aparece logo depois de uma alta é exatamente o caso da metade do dobro.",
      },
      { tipo: "h2", texto: "Quanto o mesmo produto muda de uma loja para outra?" },
      {
        tipo: "p",
        texto:
          "Bem mais do que muda no tempo. Em 46% das 1.285 comparações feitas aqui entre 18/10 e 13/11/2026, outra loja vendia o mesmo produto mais barato que o anúncio colado. A diferença em percentual é maior nos itens baratos; em reais, nos caros.",
      },
      {
        tipo: "tabela",
        legenda: "1.285 comparações com duas lojas ou mais, 18/10 a 13/11/2026",
        colunas: [
          "Preço do anúncio",
          "Comparações",
          "Com o mesmo produto mais barato",
          "Economia mediana",
        ],
        linhas: [
          ["Até R$ 100", "509", "39%", "R$ 8,31 (18,3%)"],
          ["R$ 100 a R$ 300", "352", "53%", "R$ 20,42 (12,5%)"],
          ["R$ 300 a R$ 1.000", "237", "52%", "R$ 61,51 (10,9%)"],
          ["Acima de R$ 1.000", "187", "47%", "R$ 173,44 (9,5%)"],
        ],
      },
      { tipo: "h2", texto: "Cinco verificações antes de pagar" },
      {
        tipo: "passos",
        itens: [
          "Olhe o preço final, não o percentual: produto, mais frete, menos desconto.",
          'Desconfie do preço "de": compare com o que outras lojas cobram hoje pelo mesmo item.',
          "Compare o mesmo produto. Modelo, capacidade, voltagem, cor e versão mudam o preço.",
          "Some o frete. Um item R$ 15 mais barato com frete R$ 25 mais caro é um item mais caro.",
          "Veja o vendedor: reputação, vendas e avaliações dizem mais que o desconto.",
        ],
      },
      { tipo: "h2", texto: "Quais são os sinais de uma oferta falsa?" },
      {
        tipo: "p",
        texto:
          "Preço muito abaixo de todas as outras lojas do mesmo item, vendedor sem histórico e pedido para pagar fora da plataforma são os três sinais mais fortes. Um deles sozinho pede conferência; dois juntos, distância.",
      },
      {
        tipo: "lista",
        itens: [
          "Anúncio com poucas vendas, sem avaliações e vendedor recém-criado.",
          "Fotos genéricas do fabricante, sem foto real do produto.",
          "Título que não bate com a descrição: capacidade, modelo ou quantidade diferentes.",
          "Contagem regressiva que reinicia ao recarregar a página.",
          "Cupom que pede cadastro em outro site, dados bancários ou pagamento antecipado.",
        ],
      },
      {
        tipo: "destaque",
        titulo: "Nunca pague fora da loja",
        texto:
          "Transferência, Pix ou link enviado por mensagem tiram de você a proteção da plataforma. Compra feita dentro do Mercado Livre tem registro, garantia e canal de reclamação.",
      },
      { tipo: "h2", texto: "Quando um desconto grande é legítimo" },
      {
        tipo: "p",
        texto:
          "Fim de linha, sobra de estoque, troca de modelo e disputa entre vendedores geram descontos de verdade. O desconto grande não é o problema; o problema é não conferir a loja e a versão. Se tudo bate, aproveite.",
      },
      { tipo: "h2", texto: "Black Friday: comprar agora ou esperar?" },
      {
        tipo: "p",
        texto:
          "Se você precisa do produto e o preço de hoje já está no nível das outras lojas, comprar agora é razoável: pelos preços que acompanhei, esperar não garante queda. Se não tem pressa, acompanhe o preço por alguns dias para ter a sua própria referência antes de 27/11.",
      },
      {
        tipo: "chamada",
        texto:
          "Cole o link do produto e eu aviso quando o preço cair. A compra continua no Mercado Livre, com pagamento protegido.",
        botao: "Acompanhar um preço",
        para: "/meus-precos",
      },
      { tipo: "h2", texto: "Se algo der errado depois da compra" },
      {
        tipo: "p",
        texto:
          "Compras pela internet têm direito de arrependimento em até sete dias a partir do recebimento, previsto no Código de Defesa do Consumidor. Guarde os comprovantes e use primeiro os canais oficiais da loja.",
      },
    ],
    perguntas: [
      {
        pergunta: "Como saber se o desconto anunciado é real?",
        resposta:
          "Compare com o preço que outras lojas cobram hoje pelo mesmo produto, com frete, em vez de confiar no valor riscado.",
      },
      {
        pergunta: "Vale esperar a Black Friday para comprar?",
        resposta:
          "Não necessariamente. Dos 88 preços que acompanhei por mais de uma semana, 20% subiram e 23% caíram. Acompanhar o seu produto dá uma referência melhor que a data.",
      },
      {
        pergunta: "Desconto grande é sinal de produto ruim?",
        resposta:
          "Não. Fim de linha e sobra de estoque geram descontos legítimos. Confira a reputação da loja, a versão do produto e a garantia.",
      },
      {
        pergunta: "Cupom que pede dados pessoais para liberar é confiável?",
        resposta:
          "Não. Cupom legítimo é um código aplicado no carrinho da própria loja, sem cadastro em outro site nem pagamento antecipado.",
      },
    ],
  },
];

/** Thin coupon guides merged into the two pillars on 13/11/2026 (301). */
export const GUIAS_REDIRECIONADOS: Record<string, string> = {
  "como-funcionam-os-limites-dos-cupons": "como-calcular-a-economia-real-de-um-cupom",
  "como-usar-um-cupom-passo-a-passo": "como-calcular-a-economia-real-de-um-cupom",
  "como-comparar-cupons-para-a-mesma-compra": "como-calcular-a-economia-real-de-um-cupom",
  "como-evitar-ofertas-falsas": "como-saber-se-um-desconto-e-realmente-vantajoso",
};

export function buscarGuia(slug: string) {
  return GUIAS.find((guia) => guia.slug === slug);
}
