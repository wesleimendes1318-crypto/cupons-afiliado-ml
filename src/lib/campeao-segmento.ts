/* CAMPEÃO DO SEGMENTO (Weslei, 11/10, prompt mestre "garimpo no player de
   origem + roteamento por campeão do nicho"). Link de uma loja em que o
   Weslei não é afiliado (Magalu, KaBuM!, Casas Bahia, Shein...): a busca
   começa no marketplace afiliado mais forte para aquele tipo de produto, e
   os outros dois ficam a um toque (sob demanda).

   | Segmento                                        | Campeão        |
   | Livros, eBooks, leitores digitais / Kindle      | Amazon         |
   | Eletrônicos, informática, periféricos, Alexa    | Amazon         |
   | Autopeças, reposição, pneus, ferramentas pesadas| Mercado Livre  |
   | Linha branca (geladeira, lavadora, fogão...)    | Mercado Livre  |
   | Beleza, perfumaria, cosméticos, moda de marca   | Mercado Livre  |
   | Acessórios baratos (< R$ 50), bijuterias,       | Shopee         |
   |   utilidades leves, papelaria                   |                |
   | Demais / indeterminado                          | Mercado Livre  |

   A ordem das regras resolve os casos de fronteira: peça de carro antes de
   eletrônico (lâmpada de farol, central multimídia), acessório barato antes
   de eletrônico (capinha, película, cabo), mouse/teclado sempre Amazon.
   Só o título, a categoria lida na página e o preço lido: nada inventado. */

export type PlayerAfiliado = "mercadolivre" | "amazon" | "shopee";

export type Campeao = {
  player: PlayerAfiliado;
  segmento: string;
  /** Frase curta para a tela ("Para livros, a busca começa na Amazon."). */
  frase: string;
};

export const NOME_PLAYER: Record<PlayerAfiliado, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  shopee: "Shopee",
};

const LIVROS =
  /\b(livros?|e-?books?|kindle|leitor(es)? (digital|de livros)|capa (comum|dura)|mang[aá]s?|hqs?|graphic novel|box (de )?livros|audiolivro)\b/;

const AUTOPECAS =
  /\b(autope[cç]as?|auto pe[cç]as?|pe[cç]as? de reposi[cç][aã]o|pneus?|c[aâ]maras? de ar|amortecedor(es)?|pastilhas? de freio|discos? de freio|lonas? de freio|embreagem|kit rela[cç][aã]o|rela[cç][aã]o (moto|completa)|coroa e pinh[aã]o|radiador|velas? de igni[cç][aã]o|bobina de igni[cç][aã]o|correia dentada|filtro de (oleo|ar do motor|combust[ií]vel)|oleo (de motor|lubrificante)|bateria (automotiva|de carro|de moto|moura|heliar)|escapamento|motor de arranque|alternador|bomba de combust[ií]vel|retentor|rolamento de roda|bieleta|piv[oô] de suspens[aã]o|terminal de dire[cç][aã]o|bandeja de suspens[aã]o|coxim|para-?choques?|retrovisor|farol|lanterna traseira|martelete|esmerilhadeira|serra (m[aá]rmore|circular|tico-?tico)|compressor de ar|gerador (a gasolina|a diesel|de energia)|betoneira|m[aá]quina de solda|inversora de solda|macaco hidr[aá]ulico)\b/;

const LINHA_BRANCA =
  /\b(geladeiras?|refrigerador(es)?|freezer|frost ?free|lavadoras?|m[aá]quinas? de lavar|lava e seca|lava-?lou[cç]as|fog[aã]o|fog[oõ]es|cooktop|forno (el[eé]trico )?de embutir|micro-?ondas|secadoras? de roupas?|ar[ -]condicionado|split inverter|coifa|depurador de ar|adega climatizada|tanquinho)\b/;

const BELEZA_MODA =
  /\b(perfumes?|eau de (parfum|toilette|cologne)|col[oô]nia|desodorante|shampoo|xampu|condicionador|m[aá]scara capilar|leave-?in|hidratante|protetor solar|s[eé]rum|maquiagem|base l[ií]quida|batom|r[ií]mel|m[aá]scara de c[ií]lios|paleta de sombras?|esmalte|skin ?care|cosm[eé]ticos?|creme (facial|corporal|para)|t[eê]nis|sapatos?|sand[aá]lias?|botas?|camisetas?|camisas?|cal[cç]as?|jaquetas?|moletom|vestidos?|bermudas?|bolsas? (de couro|feminina|masculina))\b/;

const ACESSORIO_BARATO =
  /\b(capinhas?|capas? (para|de) (celular|iphone|galaxy|samsung|xiaomi|motorola)|case (para|de|anti)|pel[ií]culas?|suporte (para|de) celular|cabos? (usb|tipo c|lightning|carregador)|adesivos?|chaveiros?|bijuterias?|brincos?|colares?|pulseiras?|an[eé]is|anel|tiaras?|presilhas?|piranhas? de cabelo|scrunchies?|xuxinhas?|organizador(es)?|porta[ -]trecos?|potes?|utens[ií]lios?|esp[aá]tulas?|escorredor|cadernos?|canetas?|l[aá]pis|marca[ -]textos?|estojos?|agendas?|planners?|papelaria|washi tape|bloco de notas|post-?it)\b/;

const ELETRONICOS =
  /\b(echo( dot| show| pop)?|alexa|fire tv|smart speaker|fones? de ouvido|headsets?|headphones?|earbuds?|mouse|mouses|teclados?|monitor(es)?|notebooks?|laptops?|ssd|hd externo|pen ?drive|mem[oó]ria ram|placa de v[ií]deo|processador(es)?|placa[ -]m[aã]e|roteador(es)?|repetidor (de )?wi-?fi|webcam|microfones?|caixas? de som|smartwatch|rel[oó]gio inteligente|tablets?|ipad|iphone|smartphones?|celular(es)?|carregador(es)?|power ?bank|consoles?|playstation|ps5|xbox|nintendo|switch oled|controle (de|para) (videogame|ps5|ps4|xbox)|c[aâ]meras? (digital|de seguran[cç]a|gopro)|gopro|impressoras?|projetor(es)?|smart ?tvs?|televis[aã]o|televisores?|soundbar|chromecast)\b/;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* As regras usam o texto sem acento (as classes [aá] continuam valendo). */
const testa = (re: RegExp, texto: string) => re.test(texto) || re.test(semAcento(texto));

export function determinarCampeaoDoSegmento(entrada: {
  titulo?: string | null;
  categoria?: string | null;
  preco?: number | null;
}): Campeao {
  const texto =
    ` ${String(entrada.categoria ?? "")} ${String(entrada.titulo ?? "")} `.toLowerCase();
  const preco =
    typeof entrada.preco === "number" && Number.isFinite(entrada.preco) && entrada.preco > 0
      ? entrada.preco
      : null;

  if (testa(LIVROS, texto))
    return {
      player: "amazon",
      segmento: "livros e leitores digitais",
      frase: "Para livros, a busca começa na Amazon.",
    };
  if (testa(AUTOPECAS, texto))
    return {
      player: "mercadolivre",
      segmento: "autopeças e ferramentas",
      frase: "Para autopeças e ferramentas, a busca começa no Mercado Livre.",
    };
  if (testa(LINHA_BRANCA, texto))
    return {
      player: "mercadolivre",
      segmento: "eletrodomésticos grandes",
      frase: "Para eletrodomésticos grandes, a busca começa no Mercado Livre.",
    };
  if (testa(BELEZA_MODA, texto))
    return {
      player: "mercadolivre",
      segmento: "beleza, perfumaria e moda",
      frase: "Para beleza, perfumaria e moda, a busca começa no Mercado Livre.",
    };
  if (testa(ACESSORIO_BARATO, texto) && (preco == null || preco < 50))
    return {
      player: "shopee",
      segmento: "acessórios e utilidades de preço baixo",
      frase: "Para acessórios e utilidades de preço baixo, a busca começa na Shopee.",
    };
  if (testa(ELETRONICOS, texto))
    return {
      player: "amazon",
      segmento: "eletrônicos e informática",
      frase: "Para eletrônicos e informática, a busca começa na Amazon.",
    };
  return {
    player: "mercadolivre",
    segmento: "geral",
    frase: "A busca começa no Mercado Livre, que tem mais lojas para comparar.",
  };
}
