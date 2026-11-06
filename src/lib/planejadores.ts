/* LIFE-EVENT PLANNERS (Weslei, 06/11/2026): /planejadores/<slug>. A curated
   checklist per moment (first one: casa nova) in 3 phases; each item opens
   real catalog offers (same search as Amigo Secreto, nothing invented) and
   the person picks one product per item. Items marked "Pedir de presente"
   go to the existing public list /lista/<id> (listas_compartilhadas), which
   already buys through Weslei's link (rule no. 1) and lets guests mark a
   gift without editing the list. State lives on this device only.
   No price estimates: totals only add prices of products actually chosen. */
import { lerLista, type ItemDesejo } from "@/lib/lista-desejos";
import type { Resultado } from "@/lib/busca-guiada-cliente";
import { funcionaEm, voltagemDoTexto } from "@/lib/voltagem";

export type Fase = 1 | 2 | 3;
export type ItemPlano = {
  id: string;
  nome: string;
  fase: Fase;
  /** Catalog search terms (2-5 words each). */
  termos: string[];
  /** Plugged appliance: offers that do not work on the chosen voltage are hidden. */
  eletrico?: boolean;
  /** Cheap and easy to forget ("Fáceis de esquecer" tab). */
  esquecido?: boolean;
  dica?: string;
};
export type Planejador = {
  slug: string;
  titulo: string;
  emoji: string;
  resumo: string;
  ocasiao: string;
  /** What each phase means for this moment (falls back to FASES). */
  fases?: Partial<Record<Fase, string>>;
  /** Date question and how the countdown names the day. */
  data?: { pergunta: string; evento: string };
  itens: ItemPlano[];
};

export const FASES: Record<Fase, { rotulo: string; curto: string; cor: string; texto: string }> = {
  1: {
    rotulo: "Essencial",
    curto: "Primeiros dias",
    cor: "#ff3b30",
    texto: "Para dormir, cozinhar e tomar banho desde o primeiro dia.",
  },
  2: {
    rotulo: "Conforto e rotina",
    curto: "Primeiro mês",
    cor: "#ff9f0a",
    texto: "Deixa o dia a dia mais fácil depois que a casa já funciona.",
  },
  3: {
    rotulo: "Pode esperar",
    curto: "Com calma",
    cor: "#34c759",
    texto: "Decoração e upgrades para quando sobrar orçamento.",
  },
};

const CASA_NOVA: Planejador = {
  slug: "casa-nova",
  data: { pergunta: "Quando é a mudança?", evento: "a mudança" },
  titulo: "Casa nova",
  emoji: "🏠",
  resumo: "Do colchão às lâmpadas: o que comprar primeiro e o que pode esperar.",
  ocasiao: "Casa Nova",
  itens: [
    {
      id: "colchao",
      nome: "Colchão",
      fase: 1,
      termos: ["colchao casal", "colchao de molas casal"],
    },
    { id: "lencol", nome: "Jogo de lençol", fase: 1, termos: ["jogo de lencol casal"] },
    { id: "travesseiro", nome: "Travesseiros", fase: 1, termos: ["travesseiro"] },
    { id: "toalhas", nome: "Toalhas de banho", fase: 1, termos: ["jogo de toalhas banho"] },
    {
      id: "geladeira",
      nome: "Geladeira",
      fase: 1,
      termos: ["geladeira frost free", "geladeira duplex"],
      eletrico: true,
    },
    {
      id: "fogao",
      nome: "Fogão",
      fase: 1,
      termos: ["fogao 4 bocas"],
      eletrico: true,
      dica: "Confira se a casa tem ponto de gás encanado ou de botijão.",
    },
    {
      id: "chuveiro",
      nome: "Chuveiro elétrico",
      fase: 1,
      termos: ["chuveiro eletrico"],
      eletrico: true,
      dica: "Confira a voltagem da tomada do banheiro antes de comprar.",
    },
    { id: "panelas", nome: "Jogo de panelas", fase: 1, termos: ["jogo de panelas antiaderente"] },
    {
      id: "pratos",
      nome: "Pratos e copos",
      fase: 1,
      termos: ["aparelho de jantar", "jogo de copos vidro"],
    },
    { id: "talheres", nome: "Talheres", fase: 1, termos: ["faqueiro inox"] },
    {
      id: "utensilios",
      nome: "Utensílios de cozinha",
      fase: 1,
      termos: ["kit utensilios cozinha silicone", "tabua de corte"],
      esquecido: true,
    },
    {
      id: "lampadas",
      nome: "Lâmpadas",
      fase: 1,
      termos: ["lampada led bulbo"],
      esquecido: true,
      dica: "Muitos imóveis são entregues sem lâmpada.",
    },
    {
      id: "extensao",
      nome: "Extensão e filtro de linha",
      fase: 1,
      termos: ["filtro de linha", "extensao eletrica"],
      esquecido: true,
    },
    {
      id: "ferramentas",
      nome: "Kit de ferramentas",
      fase: 1,
      termos: ["kit ferramentas basico", "parafusadeira"],
      esquecido: true,
      dica: "Para montar móveis e pendurar cortinas.",
    },
    {
      id: "limpeza",
      nome: "Vassoura, rodo e pá",
      fase: 1,
      termos: ["kit vassoura rodo pa"],
      esquecido: true,
    },
    { id: "mop", nome: "Balde com mop", fase: 1, termos: ["mop giratorio balde"], esquecido: true },
    {
      id: "lixeira",
      nome: "Lixeiras",
      fase: 1,
      termos: ["lixeira cozinha pedal", "lixeira banheiro"],
      esquecido: true,
    },
    {
      id: "varal",
      nome: "Varal",
      fase: 1,
      termos: ["varal de chao", "varal de teto"],
      esquecido: true,
    },
    {
      id: "lavar",
      nome: "Máquina de lavar",
      fase: 2,
      termos: ["maquina de lavar roupa", "lava e seca"],
      eletrico: true,
    },
    { id: "microondas", nome: "Micro-ondas", fase: 2, termos: ["micro-ondas"], eletrico: true },
    { id: "airfryer", nome: "Air fryer", fase: 2, termos: ["air fryer"], eletrico: true },
    {
      id: "liquidificador",
      nome: "Liquidificador",
      fase: 2,
      termos: ["liquidificador"],
      eletrico: true,
    },
    { id: "cafeteira", nome: "Cafeteira", fase: 2, termos: ["cafeteira eletrica"], eletrico: true },
    {
      id: "ferro",
      nome: "Ferro de passar",
      fase: 2,
      termos: ["ferro de passar roupa"],
      eletrico: true,
    },
    {
      id: "aspirador",
      nome: "Aspirador de pó",
      fase: 2,
      termos: ["aspirador de po vertical", "aspirador de po"],
      eletrico: true,
    },
    {
      id: "ventilador",
      nome: "Ventilador",
      fase: 2,
      termos: ["ventilador de coluna", "ventilador de mesa"],
      eletrico: true,
    },
    { id: "sofa", nome: "Sofá", fase: 2, termos: ["sofa 3 lugares", "sofa retratil"] },
    { id: "guarda-roupa", nome: "Guarda-roupa", fase: 2, termos: ["guarda roupa casal"] },
    { id: "mesa", nome: "Mesa com cadeiras", fase: 2, termos: ["conjunto mesa 4 cadeiras"] },
    {
      id: "cortina",
      nome: "Cortinas",
      fase: 2,
      termos: ["cortina blackout", "varao para cortina"],
    },
    {
      id: "cortina-box",
      nome: "Cortina para box ou tapete de banheiro",
      fase: 2,
      termos: ["tapete banheiro antiderrapante", "cortina para box"],
      esquecido: true,
    },
    { id: "cabides", nome: "Cabides", fase: 2, termos: ["kit cabides"], esquecido: true },
    {
      id: "potes",
      nome: "Potes para mantimentos",
      fase: 2,
      termos: ["potes hermeticos mantimentos"],
      esquecido: true,
    },
    { id: "tv", nome: "Smart TV", fase: 3, termos: ["smart tv 50", "smart tv 43"], eletrico: true },
    {
      id: "rack",
      nome: "Rack ou painel para TV",
      fase: 3,
      termos: ["rack para tv", "painel para tv"],
    },
    { id: "lava-loucas", nome: "Lava-louças", fase: 3, termos: ["lava loucas"], eletrico: true },
    { id: "robo", nome: "Robô aspirador", fase: 3, termos: ["robo aspirador"], eletrico: true },
    { id: "tapete", nome: "Tapete para sala", fase: 3, termos: ["tapete sala grande"] },
    {
      id: "luminaria",
      nome: "Luminária",
      fase: 3,
      termos: ["luminaria de chao", "luminaria de mesa"],
    },
    {
      id: "quadros",
      nome: "Quadros e decoração",
      fase: 3,
      termos: ["quadros decorativos sala", "vaso decorativo"],
    },
  ],
};

const i = (
  id: string,
  nome: string,
  fase: Fase,
  termos: string[],
  extra: Partial<ItemPlano> = {},
): ItemPlano => ({ id, nome, fase, termos, ...extra });
const E = { eletrico: true } as const;
const Q = { esquecido: true } as const;

const BEBE: Planejador = {
  slug: "enxoval-bebe",
  data: { pergunta: "Qual a data prevista do parto?", evento: "o parto" },
  titulo: "Enxoval do bebê",
  emoji: "👶",
  resumo: "O que precisa estar pronto antes de o bebê chegar e o que dá para comprar depois.",
  ocasiao: "Chá de bebê",
  fases: {
    1: "Para a saída da maternidade e as primeiras semanas em casa.",
    2: "Facilita a rotina dos primeiros meses.",
    3: "Para mais tarde ou para ganhar de presente.",
  },
  itens: [
    i("berco", "Berço com colchão", 1, ["berco com colchao", "berco mini cama"]),
    i(
      "bebe-conforto",
      "Bebê conforto para o carro",
      1,
      ["bebe conforto", "cadeirinha bebe carro"],
      { dica: "Obrigatório para sair da maternidade de carro." },
    ),
    i("fraldas", "Fraldas RN e P", 1, ["fralda descartavel rn", "fralda descartavel p"]),
    i("lencos", "Lenços umedecidos", 1, ["lenco umedecido bebe"], Q),
    i("body", "Bodies e macacões", 1, ["kit body bebe", "macacao bebe"]),
    i("manta", "Mantas e cueiros", 1, ["manta bebe", "cueiro"]),
    i("banheira", "Banheira", 1, ["banheira bebe"]),
    i("toalha-capuz", "Toalha com capuz", 1, ["toalha de banho bebe capuz"], Q),
    i("trocador", "Trocador", 1, ["trocador portatil bebe"], Q),
    i("pomada", "Pomada para assaduras", 1, ["pomada assadura bebe"], Q),
    i("termometro", "Termômetro", 1, ["termometro digital bebe"], Q),
    i("cortador-unha", "Kit higiene (cortador de unha, escova)", 1, ["kit higiene bebe"], Q),
    i("bolsa", "Bolsa de maternidade", 1, ["bolsa maternidade"]),
    i("carrinho", "Carrinho de bebê", 2, ["carrinho de bebe", "carrinho travel system"]),
    i("baba", "Babá eletrônica", 2, ["baba eletronica"], E),
    i("bomba", "Bomba tira-leite", 2, ["bomba tira leite eletrica"], E),
    i("mamadeira", "Mamadeiras", 2, ["kit mamadeira"]),
    i("esterilizador", "Esterilizador", 2, ["esterilizador mamadeira"], E),
    i("canguru", "Canguru ou sling", 2, ["canguru ergonomico bebe"]),
    i("umidificador", "Umidificador de ar", 2, ["umidificador de ar"], E),
    i("comoda", "Cômoda", 3, ["comoda bebe"]),
    i("cadeira-alimentacao", "Cadeira de alimentação", 3, ["cadeira de alimentacao bebe"]),
    i("tapete", "Tapete de atividades", 3, ["tapete de atividades bebe"]),
    i("mobile", "Móbile", 3, ["mobile berco"]),
    i("luminaria-bebe", "Luz noturna", 3, ["luminaria abajur infantil"], Q),
  ],
};

const SETUP: Planejador = {
  slug: "home-office",
  titulo: "Home office",
  emoji: "💻",
  resumo: "Para trabalhar em casa com conforto, do básico ao setup completo.",
  ocasiao: "Lista de Desejos",
  fases: {
    1: "Para trabalhar sem dor nas costas a partir de amanhã.",
    2: "Mais produtividade e menos cabos pela mesa.",
    3: "Upgrade e acabamento do setup.",
  },
  itens: [
    i("cadeira", "Cadeira ergonômica", 1, ["cadeira de escritorio ergonomica"]),
    i("mesa", "Mesa", 1, ["mesa para escritorio", "escrivaninha"]),
    i("monitor", "Monitor", 1, ["monitor 24 polegadas", "monitor 27 polegadas"], E),
    i("teclado-mouse", "Teclado e mouse", 1, ["kit teclado e mouse sem fio"]),
    i("headset", "Fone com microfone", 1, ["headset com microfone"]),
    i("filtro-linha", "Filtro de linha", 1, ["filtro de linha"], { ...E, ...Q }),
    i("suporte-notebook", "Suporte para notebook", 1, ["suporte notebook ergonomico"], Q),
    i("webcam", "Webcam", 2, ["webcam full hd"]),
    i("luminaria", "Luminária de mesa", 2, ["luminaria de mesa led"], E),
    i("organizador-cabos", "Organizador de cabos", 2, ["organizador de cabos"], Q),
    i("mousepad", "Mousepad grande", 2, ["mousepad grande"], Q),
    i("apoio-pes", "Apoio para os pés", 2, ["apoio para pes ergonomico"], Q),
    i("roteador", "Roteador Wi-Fi", 2, ["roteador wifi 6"], E),
    i("braco-monitor", "Braço para monitor", 3, ["suporte articulado monitor"]),
    i("nobreak", "Nobreak", 3, ["nobreak"], E),
    i("fita-led", "Fita LED", 3, ["fita led rgb"]),
    i("cadeira-gamer", "Cadeira gamer", 3, ["cadeira gamer"]),
  ],
};

const PET: Planejador = {
  slug: "primeiro-pet",
  data: { pergunta: "Quando o pet chega?", evento: "o pet chegar" },
  titulo: "Primeiro pet",
  emoji: "🐶",
  resumo: "Tudo para receber um cachorro ou gato em casa sem esquecer o básico.",
  ocasiao: "Lista de Desejos",
  fases: {
    1: "Para o primeiro dia do pet em casa.",
    2: "Para a rotina de passeio, higiene e brincadeira.",
    3: "Conforto extra e acessórios.",
  },
  itens: [
    i("comedouro", "Comedouro e bebedouro", 1, ["comedouro pet", "bebedouro pet"]),
    i("racao", "Ração", 1, ["racao filhote", "racao gato filhote"]),
    i("cama", "Caminha", 1, ["cama pet"]),
    i("caixa-transporte", "Caixa de transporte", 1, ["caixa de transporte pet"]),
    i("coleira", "Coleira com plaquinha", 1, [
      "coleira peitoral cachorro",
      "plaquinha identificacao pet",
    ]),
    i(
      "tapete-higienico",
      "Tapete higiênico ou caixa de areia",
      1,
      ["tapete higienico cachorro", "caixa de areia gato"],
      Q,
    ),
    i("brinquedos", "Brinquedos", 2, ["brinquedo cachorro mordedor", "arranhador gato"]),
    i("escova", "Escova", 2, ["escova pet"], Q),
    i("shampoo", "Shampoo", 2, ["shampoo pet"], Q),
    i("cortador-unha", "Cortador de unhas", 2, ["cortador de unha pet"], Q),
    i("saquinhos", "Saquinhos para passeio", 2, ["saquinho coletor fezes pet"], Q),
    i("tela", "Tela de proteção para janela", 2, ["tela de protecao gato"], {
      dica: "Essencial para gatos em apartamento.",
    }),
    i("fonte", "Fonte de água", 3, ["fonte bebedouro gato"], E),
    i("comedouro-auto", "Comedouro automático", 3, ["comedouro automatico"], E),
    i("roupinha", "Roupinha", 3, ["roupa para cachorro"]),
  ],
};

const VIAGEM: Planejador = {
  slug: "viagem",
  data: { pergunta: "Quando você viaja?", evento: "a viagem" },
  titulo: "Viagem",
  emoji: "🧳",
  resumo: "Mala, acessórios e itens que fazem falta longe de casa.",
  ocasiao: "Lista de Desejos",
  fases: {
    1: "Sem isso a viagem complica.",
    2: "Mais conforto no caminho e no destino.",
    3: "Para viajar com mais estilo.",
  },
  itens: [
    i("mala", "Mala de bordo", 1, ["mala de bordo 10kg"]),
    i("mala-grande", "Mala grande", 1, ["mala de viagem grande"]),
    i("adaptador", "Adaptador de tomada universal", 1, ["adaptador tomada universal viagem"], Q),
    i("power-bank", "Carregador portátil", 1, ["power bank 20000mah"], Q),
    i("cadeado", "Cadeado para mala", 1, ["cadeado tsa"], Q),
    i("necessaire", "Necessaire", 1, ["necessaire viagem"], Q),
    i("travesseiro", "Travesseiro de pescoço", 2, ["travesseiro de pescoco"]),
    i("organizadores", "Organizadores de mala", 2, ["organizador de mala kit"], Q),
    i("balanca", "Balança de mala", 2, ["balanca digital de mala"], Q),
    i("fone", "Fone com cancelamento de ruído", 2, ["fone bluetooth cancelamento de ruido"]),
    i("mochila", "Mochila", 2, ["mochila de viagem"]),
    i("garrafa", "Garrafa térmica", 3, ["garrafa termica"]),
    i("rastreador", "Rastreador para mala", 3, ["rastreador bluetooth"]),
    i("camera", "Câmera de ação", 3, ["camera de acao"]),
  ],
};

const FITNESS: Planejador = {
  slug: "treino-em-casa",
  titulo: "Treino em casa",
  emoji: "🏋️",
  resumo: "Monte um cantinho de treino que cabe na sala.",
  ocasiao: "Lista de Desejos",
  fases: {
    1: "Para começar a treinar hoje.",
    2: "Mais variedade de exercícios.",
    3: "Equipamentos maiores para quando tiver espaço.",
  },
  itens: [
    i("tapete", "Tapete de yoga", 1, ["tapete de yoga"]),
    i("halteres", "Halteres", 1, ["kit halteres", "halter emborrachado"]),
    i("elasticos", "Elásticos", 1, ["kit elastico extensor", "mini band"]),
    i("corda", "Corda de pular", 1, ["corda de pular"], Q),
    i("garrafa", "Garrafa de água", 1, ["garrafa squeeze academia"], Q),
    i("kettlebell", "Kettlebell", 2, ["kettlebell"]),
    i("rolo", "Rolo de liberação", 2, ["rolo de liberacao miofascial"], Q),
    i("roda", "Roda abdominal", 2, ["roda abdominal"], Q),
    i("barra", "Barra de porta", 2, ["barra fixa de porta"]),
    i("balanca", "Balança de bioimpedância", 2, ["balanca bioimpedancia"]),
    i("banco", "Banco de supino", 3, ["banco supino ajustavel"]),
    i("bike", "Bicicleta ergométrica", 3, ["bicicleta ergometrica"]),
    i("esteira", "Esteira", 3, ["esteira eletrica"], E),
  ],
};

const UNIVERSITARIO: Planejador = {
  slug: "universitario",
  data: { pergunta: "Quando começam as aulas?", evento: "as aulas" },
  titulo: "Mudança para a faculdade",
  emoji: "🎓",
  resumo: "Para quem vai morar em república ou quitinete pela primeira vez.",
  ocasiao: "Lista de Desejos",
  fases: {
    1: "Para dormir, estudar e comer na primeira semana.",
    2: "Para a rotina ficar mais prática.",
    3: "Para deixar o quarto com a sua cara.",
  },
  itens: [
    i("colchao", "Colchão de solteiro", 1, ["colchao solteiro"]),
    i("roupa-cama", "Roupa de cama", 1, ["jogo de lencol solteiro"]),
    i("travesseiro", "Travesseiro", 1, ["travesseiro"]),
    i("toalhas", "Toalhas", 1, ["toalha de banho"]),
    i("kit-cozinha", "Kit básico de cozinha", 1, ["kit panelas pequeno", "kit utensilios cozinha"]),
    i("pratos", "Prato, copo e talheres", 1, ["kit prato copo talher"], Q),
    i("extensao", "Extensão", 1, ["extensao eletrica"], { ...E, ...Q }),
    i("cadeado", "Cadeado", 1, ["cadeado"], Q),
    i("luminaria", "Luminária de estudo", 2, ["luminaria de mesa led"]),
    i("mochila", "Mochila para notebook", 2, ["mochila notebook"]),
    i("sanduicheira", "Sanduicheira", 2, ["sanduicheira"], E),
    i("chaleira", "Chaleira elétrica", 2, ["chaleira eletrica"], E),
    i("varal", "Varal pequeno", 2, ["varal de chao"], Q),
    i("organizadores", "Organizadores", 2, ["caixa organizadora"], Q),
    i("frigobar", "Frigobar", 3, ["frigobar"], E),
    i("ventilador", "Ventilador", 3, ["ventilador de mesa"], E),
    i("decoracao", "Decoração do quarto", 3, ["fita led quarto", "quadros decorativos quarto"]),
  ],
};

const CASAMENTO: Planejador = {
  slug: "casamento",
  data: { pergunta: "Quando é o casamento?", evento: "o casamento" },
  titulo: "Lista de casamento",
  emoji: "💍",
  resumo: "A casa dos noivos item por item, pronta para virar lista de presentes.",
  ocasiao: "Casamento",
  fases: {
    1: "O que o casal mais usa no dia a dia.",
    2: "Eletros que facilitam a rotina.",
    3: "Presentes especiais e decoração.",
  },
  itens: [
    i("panelas", "Jogo de panelas", 1, ["jogo de panelas inox", "jogo de panelas antiaderente"]),
    i("jantar", "Aparelho de jantar", 1, ["aparelho de jantar 30 pecas"]),
    i("talheres", "Faqueiro", 1, ["faqueiro inox"]),
    i("tacas", "Taças e copos", 1, ["jogo de tacas", "jogo de copos"]),
    i("cama", "Jogo de cama", 1, ["jogo de cama queen"]),
    i("toalhas", "Jogo de toalhas", 1, ["jogo de toalhas banho"]),
    i("edredom", "Edredom", 1, ["edredom queen"]),
    i("pano-prato", "Panos de prato e avental", 1, ["kit pano de prato"], Q),
    i("potes", "Potes herméticos", 1, ["potes hermeticos"], Q),
    i("airfryer", "Air fryer", 2, ["air fryer"], E),
    i("batedeira", "Batedeira", 2, ["batedeira planetaria"], E),
    i("liquidificador", "Liquidificador", 2, ["liquidificador"], E),
    i("cafeteira", "Cafeteira", 2, ["cafeteira expresso", "cafeteira eletrica"], E),
    i("aspirador", "Aspirador", 2, ["aspirador de po vertical"], E),
    i("micro", "Micro-ondas", 2, ["micro-ondas"], E),
    i("tv", "Smart TV", 3, ["smart tv 55"], E),
    i("robo", "Robô aspirador", 3, ["robo aspirador"], E),
    i("adega", "Adega", 3, ["adega climatizada"], E),
    i("decor", "Decoração", 3, ["vaso decorativo", "quadros decorativos sala"]),
  ],
};

export const PLANEJADORES: Planejador[] = [
  CASA_NOVA,
  BEBE,
  CASAMENTO,
  SETUP,
  PET,
  UNIVERSITARIO,
  FITNESS,
  VIAGEM,
];
export const dataDo = (p: Planejador) =>
  p.data ?? { pergunta: "Tem uma data em mente?", evento: "a data" };
export const textoDaFase = (p: Planejador, f: Fase) => p.fases?.[f] ?? FASES[f].texto;
export const planejadorDo = (slug: string) => PLANEJADORES.find((p) => p.slug === slug) ?? null;

/* ---------- state (this device) ---------- */

export type Status = "falta" | "tenho" | "comprei" | "ganhei";
export type Estilo = "economico" | "equilibrado" | "premium";
export type EstadoItem = { status: Status; escolhido: ItemDesejo | null; presente: boolean };
export type EstadoPlano = {
  configurado: boolean;
  /** Total the person wants to spend (null = not set). */
  orcamento: number | null;
  estilo: Estilo;
  /** Moving date "YYYY-MM-DD". */
  data: string | null;
  volts: "127" | "220" | null;
  itens: Record<string, EstadoItem>;
  /** Public list created from this planner (id only; the edit key stays in lista-publica). */
  listaId: string | null;
};

export const chaveDoPlano = (slug: string) => `melhorescolha_planejador_v1_${slug}`;
export const estadoInicial = (): EstadoPlano => ({
  configurado: false,
  orcamento: null,
  estilo: "equilibrado",
  data: null,
  volts: null,
  itens: {},
  listaId: null,
});

const STATUS: Status[] = ["falta", "tenho", "comprei", "ganhei"];

/** Back from storage, every field checked against the planner's own items. */
export function lerEstado(bruto: unknown, p: Planejador): EstadoPlano {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const e = estadoInicial();
  e.configurado = o["configurado"] === true;
  const orc = o["orcamento"];
  e.orcamento =
    typeof orc === "number" && Number.isFinite(orc) && orc > 0 && orc < 1e7
      ? Math.round(orc)
      : null;
  e.estilo = o["estilo"] === "economico" || o["estilo"] === "premium" ? o["estilo"] : "equilibrado";
  e.data =
    typeof o["data"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o["data"]) ? o["data"] : null;
  e.volts = o["volts"] === "127" || o["volts"] === "220" ? o["volts"] : null;
  e.listaId =
    typeof o["listaId"] === "string" && /^[A-Za-z0-9]{10}$/.test(o["listaId"])
      ? o["listaId"]
      : null;
  const itens = (o["itens"] && typeof o["itens"] === "object" ? o["itens"] : {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const it of p.itens) {
    const x = itens[it.id];
    if (!x || typeof x !== "object") continue;
    const status = STATUS.includes(x["status"] as Status) ? (x["status"] as Status) : "falta";
    const escolhido = x["escolhido"]
      ? (lerLista({ itens: [x["escolhido"]] }).itens[0] ?? null)
      : null;
    e.itens[it.id] = { status, escolhido, presente: x["presente"] === true && escolhido != null };
  }
  return e;
}

export const itemDe = (e: EstadoPlano, id: string): EstadoItem =>
  e.itens[id] ?? { status: "falta", escolhido: null, presente: false };

export const mudarItem = (
  e: EstadoPlano,
  id: string,
  f: (x: EstadoItem) => EstadoItem,
): EstadoPlano => ({
  ...e,
  itens: { ...e.itens, [id]: f(itemDe(e, id)) },
});

/* ---------- numbers shown in the bar ---------- */

export type Resumo = {
  total: number;
  resolvidos: number;
  /** Chosen prices of essential items still to buy. */
  faltaEssencial: number;
  essenciaisSemProduto: number;
  /** Chosen prices of every item still to buy. */
  faltaTotal: number;
  gasto: number;
};

export function resumir(p: Planejador, e: EstadoPlano, fase?: Fase): Resumo {
  const r: Resumo = {
    total: 0,
    resolvidos: 0,
    faltaEssencial: 0,
    essenciaisSemProduto: 0,
    faltaTotal: 0,
    gasto: 0,
  };
  for (const it of p.itens) {
    const x = itemDe(e, it.id);
    const preco = x.escolhido?.preco ?? 0;
    if (it.fase === 1 && x.status === "falta") {
      r.faltaEssencial += preco;
      if (!x.escolhido) r.essenciaisSemProduto += 1;
    }
    if (x.status === "falta" && !x.presente) r.faltaTotal += preco;
    if (x.status === "comprei") r.gasto += preco;
    if (fase && it.fase !== fase) continue;
    r.total += 1;
    if (x.status !== "falta") r.resolvidos += 1;
  }
  return r;
}

/** Items that go to the public gift list. */
export const itensDoPresente = (p: Planejador, e: EstadoPlano): ItemDesejo[] =>
  p.itens.flatMap((it) => {
    const x = itemDe(e, it.id);
    return x.presente && x.escolhido && x.status === "falta" ? [x.escolhido] : [];
  });

/** Days until the moving date (negative = already moved). */
export function diasAte(data: string | null, hoje = new Date()): number | null {
  if (!data) return null;
  const alvo = Date.parse(`${data}T00:00:00`);
  if (!Number.isFinite(alvo)) return null;
  const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((alvo - zero) / 86_400_000);
}

/* ---------- offers of one item ---------- */

/** Voltage gate for plugged appliances: unknown voltage passes (the card warns). */
export function serveNaVoltagem(
  r: Pick<Resultado, "voltagem" | "nome">,
  volts: "127" | "220" | null,
  eletrico?: boolean,
) {
  if (!eletrico || !volts) return true;
  const v = r.voltagem ?? voltagemDoTexto(r.nome);
  return v == null || funcionaEm(v, volts);
}

/** Order by the chosen style. Equilibrado keeps the search order with official
    stores and top-10 best sellers first; nothing is dropped. */
export function ordenarOfertas(lista: Resultado[], estilo: Estilo): Resultado[] {
  const confiavel = (r: Resultado) =>
    Number(r.lojaOficial === true || (r.maisVendido ?? 999) <= 10);
  const preco = (r: Resultado) => r.preco ?? 1e9;
  const c = [...lista];
  if (estilo === "economico") return c.sort((a, b) => preco(a) - preco(b));
  if (estilo === "premium")
    return c.sort((a, b) => confiavel(b) - confiavel(a) || (b.preco ?? 0) - (a.preco ?? 0));
  return c.sort((a, b) => confiavel(b) - confiavel(a));
}
