/* Guias escritos à mão. Conteúdo editorial próprio: explica como cupom
   funciona de verdade, com as contas. Nada de texto inflado para SEO — cada
   guia responde uma dúvida concreta de quem está prestes a comprar. */

export type Bloco =
  | { tipo: "p"; texto: string }
  | { tipo: "h2"; texto: string }
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
  blocos: Bloco[];
  perguntas: { pergunta: string; resposta: string }[];
};

export const GUIAS: Guia[] = [
  {
    slug: "como-calcular-a-economia-real-de-um-cupom",
    titulo: "Como calcular a economia real de um cupom",
    resumo:
      "A conta de três linhas que separa o desconto anunciado do desconto que realmente cai no seu carrinho.",
    tempo: "4 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "O número grande do cupom é uma promessa condicional. O desconto que você recebe depende de três informações que quase sempre estão escritas em letras menores: o percentual, o teto de desconto e o valor mínimo de compra.",
      },
      { tipo: "h2", texto: "As três informações que importam" },
      {
        tipo: "lista",
        itens: [
          "Percentual: quanto o cupom abate sobre o valor da compra. É o número que aparece no anúncio.",
          "Teto de desconto: o valor máximo em reais que o cupom consegue abater, por maior que seja a compra.",
          "Valor mínimo de compra: quanto você precisa gastar para o cupom sequer ser aceito.",
        ],
      },
      { tipo: "h2", texto: "A conta" },
      {
        tipo: "p",
        texto:
          "Multiplique o valor da compra pelo percentual. Se o resultado passar do teto, o desconto é o teto. Se a compra for menor que o mínimo exigido, o desconto é zero.",
      },
      {
        tipo: "conta",
        titulo: "Exemplo: cupom de 40%, teto de R$ 5, mínimo de R$ 20",
        linhas: [
          { rotulo: "Compra de R$ 100", valor: "40% seriam R$ 40, mas o teto corta em R$ 5" },
          { rotulo: "Desconto real", valor: "R$ 5" },
          { rotulo: "Percentual efetivo", valor: "5% — não 40%" },
        ],
        nota: "É por isso que um cupom de 40% pode valer menos que um de 10% sem teto.",
      },
      { tipo: "h2", texto: "O percentual efetivo" },
      {
        tipo: "p",
        texto:
          "Divida o desconto real pelo valor da compra. Esse é o único número comparável entre cupons diferentes. Comparar percentuais anunciados sem olhar o teto é comparar promessas, não descontos.",
      },
      {
        tipo: "destaque",
        titulo: "O ponto de virada",
        texto:
          "Todo cupom com teto tem um valor de compra a partir do qual ele para de crescer: teto dividido pelo percentual. No exemplo acima, R$ 5 ÷ 0,40 = R$ 12,50. Qualquer compra acima disso recebe sempre os mesmos R$ 5.",
      },
      { tipo: "h2", texto: "Cuidados na hora de decidir" },
      {
        tipo: "lista",
        itens: [
          "Não aumente a compra só para atingir o valor mínimo: gastar R$ 30 a mais para economizar R$ 5 é prejuízo.",
          "Compare o preço do produto antes do cupom. Um preço inflado anula qualquer desconto.",
          "Confira o frete: ele pode consumir a economia inteira.",
          "Confirme o desconto na tela de pagamento, antes de concluir o pedido.",
        ],
      },
    ],
    perguntas: [
      {
        pergunta: "O desconto incide sobre o frete?",
        resposta:
          "Em geral não. A maior parte dos cupons aplica o percentual apenas sobre o valor dos produtos. Confira no carrinho, porque a regra varia por campanha.",
      },
      {
        pergunta: "Posso somar dois cupons na mesma compra?",
        resposta:
          "Normalmente não. A maioria das lojas aceita um cupom por pedido. Quando há mais de um, vale escolher o de maior desconto real, não o de maior percentual anunciado.",
      },
    ],
  },
  {
    slug: "como-funcionam-os-limites-dos-cupons",
    titulo: "Como funcionam os limites dos cupons",
    resumo:
      "Teto, valor mínimo, validade, estoque e restrição de vendedor: o que cada limite significa na prática.",
    tempo: "5 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "Cupom não é desconto livre: é uma campanha com orçamento e regras. Entender cada limite evita a frustração de ver o código ser recusado no carrinho.",
      },
      { tipo: "h2", texto: "Teto de desconto" },
      {
        tipo: "p",
        texto:
          "É o valor máximo em reais que o cupom abate. Protege o vendedor de perder muito em compras grandes e é o motivo de percentuais altos renderem pouco. Cupons sem teto são raros e costumam ter percentual baixo — e são exatamente os que mais valem em compras caras.",
      },
      { tipo: "h2", texto: "Valor mínimo de compra" },
      {
        tipo: "p",
        texto:
          "Abaixo desse valor o cupom simplesmente não é aceito. É o limite que mais induz a gastos desnecessários: só faz sentido chegar nele se você já ia comprar o item extra.",
      },
      { tipo: "h2", texto: "Validade" },
      {
        tipo: "p",
        texto:
          "A data final da campanha. Passou, o código deixa de existir. Mas atenção: a validade é o prazo máximo, não uma garantia de que o cupom durará até lá.",
      },
      { tipo: "h2", texto: "Orçamento e estoque da campanha" },
      {
        tipo: "p",
        texto:
          "Toda campanha tem um valor total reservado. Quando o orçamento acaba, o cupom para de funcionar mesmo dentro da validade. É a causa mais comum de um código válido ontem ser recusado hoje.",
      },
      { tipo: "h2", texto: "Restrição de vendedor ou de categoria" },
      {
        tipo: "p",
        texto:
          "Cupom de vendedor vale só nos produtos daquele vendedor. Comprar o mesmo produto de outro anunciante invalida o desconto, ainda que o item seja idêntico.",
      },
      {
        tipo: "destaque",
        titulo: "Um cupom pode sumir sem aviso",
        texto:
          "Orçamento esgotado, suspensão pela loja ou alteração de regra pelo vendedor tiram um cupom do ar a qualquer momento. Por isso nenhuma informação de cupom deve ser tratada como garantia — sempre confirme no carrinho.",
      },
      { tipo: "h2", texto: "Por que um cupom é recusado" },
      {
        tipo: "lista",
        itens: [
          "A compra não atingiu o valor mínimo.",
          "O orçamento da campanha acabou.",
          "O produto é de outro vendedor ou de categoria excluída.",
          "O cupom já foi usado por você, quando há limite de um por pessoa.",
          "A campanha foi encerrada antes da data anunciada.",
        ],
      },
    ],
    perguntas: [
      {
        pergunta: "O cupom estava aqui e não funcionou. Por quê?",
        resposta:
          "Quase sempre porque o orçamento da campanha acabou ou o vendedor a encerrou antes do prazo. Os dados do site são uma fotografia do momento da coleta, com data indicada; a palavra final é sempre a do carrinho.",
      },
      {
        pergunta: "Cupom sem teto existe mesmo?",
        resposta:
          "Existe, e costuma ter percentual baixo. Em compras de valor alto ele rende muito mais que um cupom de percentual grande com teto baixo.",
      },
    ],
  },
  {
    slug: "como-saber-se-um-desconto-e-realmente-vantajoso",
    titulo: "Como saber se um desconto é realmente vantajoso",
    resumo:
      "Cinco verificações rápidas para diferenciar uma oferta boa de um preço inflado com etiqueta de promoção.",
    tempo: "4 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "Desconto é sempre relativo a um preço de referência. Se a referência for inventada, o desconto também é. Estas verificações levam menos de dois minutos e evitam a maior parte dos arrependimentos.",
      },
      { tipo: "h2", texto: "1. Olhe o preço final, não o percentual" },
      {
        tipo: "p",
        texto:
          "O que sai do seu bolso é produto + frete − desconto. Compare esse número entre as opções. Percentual é só um caminho até ele.",
      },
      { tipo: "h2", texto: "2. Desconfie do preço 'de'" },
      {
        tipo: "p",
        texto:
          "O valor riscado nem sempre foi praticado recentemente. Vale mais comparar com o que outros vendedores cobram hoje pelo mesmo item.",
      },
      { tipo: "h2", texto: "3. Compare o mesmo produto, não um parecido" },
      {
        tipo: "p",
        texto:
          "Modelo, capacidade, voltagem, cor e versão mudam o preço. Uma oferta imbatível costuma ser de outra versão do produto.",
      },
      { tipo: "h2", texto: "4. Some o frete antes de comemorar" },
      {
        tipo: "p",
        texto:
          "Um item R$ 15 mais barato com frete R$ 25 mais caro é um item mais caro.",
      },
      { tipo: "h2", texto: "5. Verifique o vendedor" },
      {
        tipo: "p",
        texto:
          "Reputação, tempo de mercado e avaliações do anúncio dizem mais sobre a experiência de compra do que o desconto. Problema de entrega ou de garantia custa mais caro que qualquer economia.",
      },
      {
        tipo: "destaque",
        titulo: "A pergunta que resolve",
        texto:
          "Você compraria este produto por esse preço final se não existisse cupom nenhum? Se a resposta é não, o desconto não transformou uma compra desnecessária em uma boa compra.",
      },
    ],
    perguntas: [
      {
        pergunta: "Vale esperar por uma data de promoção?",
        resposta:
          "Depende da urgência. Em datas de grande volume aparecem descontos reais e também preços ajustados para cima pouco antes. Acompanhar o preço por alguns dias dá a melhor referência.",
      },
      {
        pergunta: "Desconto grande é sinal de produto ruim?",
        resposta:
          "Não necessariamente. Fim de linha, sobra de estoque e disputa entre vendedores geram descontos legítimos. O que vale checar é a reputação do vendedor e as avaliações do anúncio.",
      },
    ],
  },
  {
    slug: "como-usar-um-cupom-passo-a-passo",
    titulo: "Como usar um cupom, passo a passo",
    resumo:
      "Do código copiado até a confirmação do desconto na tela de pagamento, sem perder a economia no caminho.",
    tempo: "3 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "Boa parte dos cupons perdidos não é recusada: é esquecida. O desconto só existe se o código estiver aplicado quando o pedido é fechado.",
      },
      { tipo: "h2", texto: "O passo a passo" },
      {
        tipo: "passos",
        itens: [
          "Copie o código do cupom antes de sair da página onde ele está.",
          "Abra o produto na loja e confira se o vendedor é o mesmo do cupom.",
          "Adicione o produto ao carrinho e verifique se a compra atinge o valor mínimo.",
          "No carrinho ou na tela de pagamento, procure o campo de cupom, código promocional ou desconto.",
          "Cole o código e confirme.",
          "Confira se o valor total caiu e se o abatimento bate com o esperado.",
          "Só então conclua o pedido.",
        ],
      },
      {
        tipo: "destaque",
        titulo: "Se o valor não mudou, não finalize",
        texto:
          "Cupom aceito sempre altera o total. Se o número continuou igual, o desconto não foi aplicado — vale revisar o vendedor, o valor mínimo e se a campanha ainda está no ar.",
      },
      { tipo: "h2", texto: "Erros comuns" },
      {
        tipo: "lista",
        itens: [
          "Digitar o código à mão e trocar uma letra por outra parecida.",
          "Aplicar o cupom e depois trocar o produto do carrinho, o que pode invalidá-lo.",
          "Fechar a compra pelo botão de compra rápida, que às vezes pula o campo de cupom.",
          "Comprar do vendedor errado quando vários anunciam o mesmo item.",
        ],
      },
    ],
    perguntas: [
      {
        pergunta: "Dá para aplicar o cupom depois de finalizar o pedido?",
        resposta:
          "Não. O desconto precisa estar aplicado antes da confirmação. Depois de fechado, só cancelando e refazendo a compra, se a loja permitir.",
      },
      {
        pergunta: "Posso usar o mesmo cupom mais de uma vez?",
        resposta:
          "Depende da campanha. Muitas limitam a um uso por pessoa. A regra aparece nas condições do próprio cupom.",
      },
    ],
  },
  {
    slug: "como-comparar-cupons-para-a-mesma-compra",
    titulo: "Como comparar cupons para a mesma compra",
    resumo:
      "Quando há mais de um cupom possível, o maior percentual quase nunca é a melhor escolha.",
    tempo: "4 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "Comparar cupons é comparar o desconto em reais que cada um produz para o seu valor de compra específico. O mesmo par de cupons pode trocar de posição dependendo de quanto você vai gastar.",
      },
      { tipo: "h2", texto: "Um exemplo que inverte" },
      {
        tipo: "conta",
        titulo: "Cupom A: 50% com teto de R$ 10 · Cupom B: 12% sem teto",
        linhas: [
          { rotulo: "Compra de R$ 60", valor: "A dá R$ 10 · B dá R$ 7,20 → vence A" },
          { rotulo: "Compra de R$ 200", valor: "A dá R$ 10 · B dá R$ 24 → vence B" },
        ],
        nota: "O cupom de 12% ganha do de 50% assim que a compra passa de R$ 83,33.",
      },
      { tipo: "h2", texto: "O método" },
      {
        tipo: "passos",
        itens: [
          "Defina o valor da compra que você realmente pretende fazer.",
          "Descarte os cupons cujo valor mínimo você não atinge sem gastar a mais.",
          "Calcule o desconto de cada cupom restante, respeitando o teto.",
          "Compare em reais e escolha o maior.",
          "Em caso de empate, prefira o de validade mais longa e vendedor melhor avaliado.",
        ],
      },
      {
        tipo: "destaque",
        titulo: "Cuidado com o mínimo",
        texto:
          "Um cupom que exige R$ 50 de compra quando você precisa de R$ 35 em produtos só compensa se os R$ 15 restantes forem de algo que você usaria de qualquer forma.",
      },
      { tipo: "h2", texto: "Quando trocar de vendedor compensa" },
      {
        tipo: "p",
        texto:
          "Se outro vendedor tem o mesmo produto com cupom melhor, compare o preço final completo: produto, frete e prazo. Economizar R$ 12 e esperar duas semanas a mais nem sempre é bom negócio.",
      },
    ],
    perguntas: [
      {
        pergunta: "Existe um cupom melhor para tudo?",
        resposta:
          "Não. A vantagem depende do valor da compra. Cupons com teto brilham em compras pequenas; cupons sem teto, em compras grandes.",
      },
      {
        pergunta: "Vale dividir o pedido para usar o cupom duas vezes?",
        resposta:
          "Raramente. Além de muitas campanhas limitarem o uso por pessoa, dividir costuma multiplicar o frete e anular a diferença.",
      },
    ],
  },
  {
    slug: "como-evitar-ofertas-falsas",
    titulo: "Como evitar ofertas falsas",
    resumo:
      "Sinais de que uma promoção não é o que parece e como se proteger antes de pagar.",
    tempo: "4 min de leitura",
    atualizacao: "23/09/2026",
    blocos: [
      {
        tipo: "p",
        texto:
          "Oferta falsa raramente é um golpe óbvio. Costuma ser um desconto sobre um preço que nunca existiu, um produto diferente do anunciado ou uma condição que só aparece no fim.",
      },
      { tipo: "h2", texto: "Sinais de alerta" },
      {
        tipo: "lista",
        itens: [
          "Preço muito abaixo de todos os outros vendedores do mesmo item.",
          "Anúncio com poucas vendas, sem avaliações e vendedor recém-criado.",
          "Fotos genéricas ou tiradas do site do fabricante, sem foto real do produto.",
          "Título que não bate com a descrição — capacidade, modelo ou quantidade diferentes.",
          "Contagem regressiva que reinicia sozinha ao recarregar a página.",
          "Pedido para fechar a compra por fora da plataforma, por aplicativo de mensagem.",
        ],
      },
      {
        tipo: "destaque",
        titulo: "Nunca pague fora da loja",
        texto:
          "Pagamento por transferência, chave de pagamento instantâneo ou link enviado em conversa privada tira de você toda a proteção da plataforma. Compra fechada dentro da loja tem registro, garantia e canal de reclamação.",
      },
      { tipo: "h2", texto: "Verificações rápidas antes de pagar" },
      {
        tipo: "passos",
        itens: [
          "Procure o mesmo produto em outros anúncios e compare o preço médio.",
          "Leia as avaliações negativas, não só a nota geral.",
          "Confira a descrição completa: modelo, quantidade, voltagem e itens inclusos.",
          "Verifique quem vende e quem entrega.",
          "Confirme o valor total com frete antes de concluir.",
        ],
      },
      { tipo: "h2", texto: "Se algo der errado" },
      {
        tipo: "p",
        texto:
          "Compras feitas na internet têm direito de arrependimento em até sete dias a partir do recebimento, previsto no Código de Defesa do Consumidor. Guarde comprovantes e use primeiro os canais oficiais da loja.",
      },
    ],
    perguntas: [
      {
        pergunta: "Cupom que pede dados pessoais para liberar é confiável?",
        resposta:
          "Não. Cupom legítimo é um código aplicado no carrinho da própria loja. Nenhum deles exige cadastro em site de terceiros, pagamento antecipado ou dados bancários.",
      },
      {
        pergunta: "Como saber se o desconto anunciado é real?",
        resposta:
          "Compare com o preço praticado hoje por outros vendedores do mesmo item, em vez de confiar no valor riscado do anúncio.",
      },
    ],
  },
];

export function buscarGuia(slug: string) {
  return GUIAS.find((guia) => guia.slug === slug);
}
