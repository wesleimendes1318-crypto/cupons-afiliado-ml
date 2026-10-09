/* CATEGORIA CERTA DOS MAIS VENDIDOS (Weslei, 09/10: "está colocando
   produtos em categorias incorretas"). A lista oficial de mais vendidos de
   uma categoria do Mercado Livre traz produtos que, no site, são de outra
   (Moda: guarda-chuva e presilha de cabelo; Beleza: papel higiênico e
   fralda; Informática: gift card, power bank e controle de PS5; Celulares:
   tela de reposição). O agente guardava todos na categoria da lista.
   Agora o NOME decide:
   1. FORA: não serve para comparar preço (código digital de valor fixo),
      peça de reposição de celular ou sem categoria no site (fralda).
   2. Regras pelo nome, em ordem (a primeira que casa vale), acima da lista
      de onde o produto veio.
   3. Sem regra, fica a categoria da lista (o Mercado Livre já a separou). */

import { pareceFalso } from "@/lib/falsificado";

export type CategoriaSite =
  | "eletronicos"
  | "celulares"
  | "informatica"
  | "casa"
  | "moda"
  | "beleza"
  | "automotivo"
  | "brinquedos"
  | "eletrodomesticos"
  | "ferramentas";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FORA: RegExp[] = [
  /\bgift ?cards?\b|\bcartao (de )?presente\b|\(digital\)|\bxbox game pass\b|\bgame pass ultimate\b|\brazer gold\b|\bassinatura\b|\brecarga\b|\bcodigo digital\b/,
  /\bfraldas?\b/,
  /^\s*(?:\d+\s*)?(?:kit\s+)?(?:telas?|display|frontal)\b.*\b(?:compativel|lcd|oled|touch|incell)\b/,
];

const REGRAS: Array<[RegExp, CategoriaSite]> = [
  /* Ferramentas, material elétrico e EPI (09/10: categoria própria). */
  [
    /\b(kit|jogo|maleta) (de )?(ferramentas|chaves?|brocas?)\b|\bchaves? (de )?precisao\b|\bestilete\b|\bterminais? eletric|\bconector(es)? eletric|\bwago\b|\btermo ?retratil\b|\bfita isolante\b|\bfuradeira\b|\bparafusadeira\b|\bserra (circular|tico|marmore|meia esquadria|eletrica)\b|\besmerilhadeira\b|\blixadeira\b|\bmartelete\b|\balicate\b|\btrena\b|\bnivel a laser\b|\bmultimetro\b|\bluvas? (de )?(seguranca|epi|nitrilica|vaqueta|raspa)\b|\boculos de (protecao|seguranca)\b|\bprotetor auricular\b|\bbotina\b|\bcapacete de seguranca\b|\bmascara pff\d?\b|\bepi\b|\bdecapador\b/,
    "ferramentas",
  ],
  /* Malas e mochilas: Moda (antes de "necessaire", "notebook"...). */
  [/\bmalas?\b|\bmochilas?\b/, "moda"],
  /* "Brinquedo ..." no começo do nome (bolha de sabão é brinquedo). */
  [/^brinquedos?\b/, "brinquedos"],
  /* Utilidades da casa que aparecem em Moda, Beleza e Informática (e
     cama/banho com personagem, que não é brinquedo). */
  [
    /\bguarda[- ]?chuvas?\b|\bsombrinhas?\b|\blancheira\b|\bbolsa (iso)?termica\b|\bmarmitas?\b|\bpapel higienico\b|\bpercarbonato\b|\btira manchas\b|\bsabao (liquido|em po|em barra)\b|\blava roupas\b|\bdetergente\b|\bamaciante\b|\bpanos?\b|\bleques?\b|\bpotes?\b|\bluminaria\b|\babajur\b|\bastronauta\b.*\b(luz|projetor|nebulosa|galaxia)\b|\bfronhas?\b|\blencol\b|\bedredom\b|\btravesseiros?\b|\btoalhas?\b|\bcortinas?\b|\btapetes?\b/,
    "casa",
  ],
  /* Beleza antes de "infantil" (perfume infantil, presilha infantil). */
  [
    /\bperfumes?\b|\bcolonias?\b|\bpresilhas?\b|\bpiranhas? (de|para) cabelo\b|\bxuxinhas?\b|\bamarrador(es)?\b|\btiaras?\b|\bescova (rotativa|secadora|alisadora|de cabelo)\b|\bsecador (de|para) cabelo\b|\bchapinha\b|\bprancha (alisadora|de cabelo)\b|\bmaquiagem\b|\bprotetor solar\b|\bshampoo\b|\bhidratante\b|\bserum\b|\bdesodorante\b/,
    "beleza",
  ],
  [
    /\bbrinquedos?\b|\binfantil\b|\bbonecas?\b|\bbonecos?\b|\bpelucias?\b|\blego\b|\bhot wheels\b|\bpokemon\b|\bfigurinhas\b|\bpatinete\b/,
    "brinquedos",
  ],
  /* Aparelho celular antes de "moto" (Moto G06 é celular). */
  [
    /^(smartphone|celular)\b|\bgalaxy [as]\d{2}\b|\bmoto [ge]\d+\b|\biphone \d+\b.*\b\d+ ?gb\b/,
    "celulares",
  ],
  [
    /automotiv|\bveicular\b|\bcapacetes?\b|\bmotocicleta\b|\bmotoboy\b|\bmoto\b|\bpneus?\b|\bcarplay\b|\bandroid auto\b|\bvulcani/,
    "automotivo",
  ],
  [
    /\bair ?fryer\b|\bfritadeira\b|\bliquidificador\b|\bbatedeira\b|\bcafeteira\b|\bmicro-?ondas\b|\bgeladeira\b|\brefrigerador\b|\bfogao\b|\bcooktop\b|\bforno eletrico\b|\blava[- ]?loucas\b|\bmaquina de lavar\b|\blavadora\b|\bsecadora de roupas?\b|\baspirador\b|\bventilador(es)?\b|\bclimatizador\b|\bar[- ]condicionado\b|\bpurificador\b|\bsanduicheira\b|\bgrill eletrico\b|\bchaleira eletrica\b|\bmixer\b|\bprocessador de alimentos\b|\bferro de passar\b|\bpanela (eletrica|de arroz eletrica)\b/,
    "eletrodomesticos",
  ],
  [
    /\bsmartwatch\b|\brelogio inteligente\b|\bsmartband\b|\bpower ?bank\b|\bcarregador portatil\b|\bcarregador\b.*\b(celular|iphone|samsung|galaxy|turbo|usb-?c|tipo-?c|xiaomi|motorola)\b|\bcapinhas?\b|\bpeliculas?\b|\bcabo\b.*\b(celular|iphone|usb-?c|tipo-?c|lightning)\b/,
    "celulares",
  ],
  [
    /\bcontroles?\b.*\b(joystick|ps[1-5]|playstation|xbox|dualsense|dualshock|gamepad|nintendo|switch)\b|\bjoystick\b|\bconsoles?\b|\bheadset\b|\bheadphone\b|\bcaixa (de )?som\b|\bcaixinha de som\b|\bsmart ?tv\b|\btv stick\b|\bsuporte (de |para )?tv\b|\bantena digital\b|\becho dot\b|\balexa\b|^microfones?\b|\bmicrofone (de )?lapela\b|\bsoundbar\b/,
    "eletronicos",
  ],
  [
    /\bssd\b|\bhd externo\b|\bteclados?\b|\bmouse\b|\bwebcam\b|\bmonitor\b(?! de (pressao|bebe))|\bnotebook\b|\bprocessador\b(?! (de|triturador) )|\bplaca (mae|de video|de rede)\b|\bmemoria ram\b|\broteador\b|\badaptador wi-?fi\b|\bimpressora\b|\bfilamento\b|\bmouse ?pad\b|\bdeskpad\b|\bpendrive\b/,
    "informatica",
  ],
  [
    /\btenis\b|\bchinelos?\b|\bsandalias?\b|\bsapatos?\b|\bbotas?\b|\bcamisetas?\b|\bcamisas?\b|\bvestidos?\b|\bcalcas?\b|\bjaquetas?\b|\bmoletom\b|\bbermudas?\b|\bbones?\b|\bchapeu\b|\bcintos?\b|\bgravatas?\b|\brelogios?\b|\boculos\b|\bbolsas?\b|\bcarteiras?\b/,
    "moda",
  ],
];

/** Categoria do site para um produto da lista de mais vendidos, ou null
 *  quando ele não deve aparecer. `fonte` é a categoria da lista. */
export function categoriaDoMaisVendido(
  nome: string,
  fonte: CategoriaSite | string,
): CategoriaSite | null {
  const t = semAcento(nome);
  if (!t.trim()) return null;
  if (FORA.some((r) => r.test(t)) || pareceFalso(nome)) return null;
  for (const [re, cat] of REGRAS) if (re.test(t)) return cat;
  return (fonte as CategoriaSite) || null;
}
