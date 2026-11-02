/* VOLTAGEM (Weslei, 02/11: "Voltagem: Escolha precisa funcionar. Considere
   o sistema de energia da região do CEP. Em Mogi a voltagem de
   eletrodomésticos é de 220"). A voltagem de cada produto vem do atributo
   oficial VOLTAGE do catálogo (o título quase nunca diz); sem ele, do
   título. A da região é a tensão fase-neutro usual do município (tabela
   por estado com as exceções conhecidas); o site sempre pede para conferir
   na tomada, porque um mesmo imóvel pode ter as duas. */
import { semAcento } from "@/lib/classificar";

export type Voltagem = "127" | "220" | "bivolt";

/** "127V", "110 V", "220V", "Bivolt", "110V/220V" -> 127 | 220 | bivolt. */
export function voltagemDoTexto(texto: string | null | undefined): Voltagem | null {
  const t = semAcento(String(texto ?? ""));
  if (!t) return null;
  if (/\bbivolt\b|\bbi-?volt\b/.test(t)) return "bivolt";
  const a = /\b(?:110|115|120|127) ?v(?:olts?)?\b/.test(t);
  const b = /\b(?:220|230|240) ?v(?:olts?)?\b/.test(t);
  if (a && b) return "bivolt";
  if (a) return "127";
  if (b) return "220";
  return null;
}

/** Atributo VOLTAGE da ficha oficial (value_name). */
export function voltagemDosAtributos(
  atributos: Array<{ id?: string; value_name?: string | null }> | null | undefined,
): Voltagem | null {
  const a = (atributos ?? []).find((x) => x?.id === "VOLTAGE");
  if (!a?.value_name) return null;
  const v = voltagemDoTexto(a.value_name);
  if (v) return v;
  /* "127", "220" sem o V. */
  const n = semAcento(a.value_name);
  if (/^\s*(?:110|127)\s*$/.test(n)) return "127";
  if (/^\s*220\s*$/.test(n)) return "220";
  return null;
}

export const rotuloVoltagem = (v: Voltagem) => (v === "bivolt" ? "Bivolt" : `${v} V`);

/** Texto que o filtro por título lê: o nome sem as voltagens que ele cita
    e, no fim, a voltagem oficial (o atributo manda sobre o título). */
export function textoComVoltagem(nome: string, v: Voltagem | null | undefined) {
  if (!v) return nome;
  const limpo = nome.replace(/\b(?:110|115|120|127|220|230|240) ?v(?:olts?)?\b|\bbi-?volt\b/gi, " ");
  return `${limpo} ${v === "bivolt" ? "bivolt" : `${v}v`}`;
}

/** Funciona na tomada da região (bivolt funciona nas duas). */
export const funcionaEm = (produto: Voltagem, rede: "127" | "220") =>
  produto === "bivolt" || produto === rede;

/* Tensão usual por estado e exceções por município (lista pública por
   estado, conferida em 02/11/2026; Mogi das Cruzes = 220 V, como disse o
   Weslei). */
const PADRAO_UF: Record<string, "127" | "220"> = {
  AC: "127", AL: "220", AP: "127", AM: "127", BA: "220", CE: "220", DF: "220",
  ES: "127", GO: "220", MA: "220", MT: "127", MS: "127", MG: "127", PA: "127",
  PB: "220", PR: "127", PE: "220", PI: "220", RJ: "127", RN: "220", RS: "220",
  RO: "127", RR: "127", SC: "220", SP: "127", SE: "220", TO: "220",
};

const EXCECOES: Record<string, string[]> = {
  SP: [
    "assis", "bastos", "biritiba-mirim", "biritiba mirim", "boituva", "bora", "cacapava",
    "campo limpo paulista", "candido mota", "caraguatatuba", "cruzalia", "echapora",
    "florinea", "guaruja", "iacri", "ibirarema", "iepe", "ipero", "itupeva", "jambeiro",
    "joao ramalho", "jundiai", "louveira", "lutecia", "maracai", "mogi das cruzes",
    "oscar bressane", "palmital", "paraguacu paulista", "platina", "porto feliz", "quata",
    "rancharia", "ribeirao do sul", "rinopolis", "salesopolis", "salto grande", "santa branca",
    "sao jose dos campos", "sao sebastiao", "tupa", "varzea paulista", "vinhedo",
  ],
  ES: ["alegre", "guacui"],
  MT: ["araguaiana", "barra do garcas", "cocalinho"],
  PR: ["rio negro"],
  RJ: ["nova friburgo"],
  RS: [
    "canoas", "capao da canoa", "capela de santana", "general camara", "porto alegre",
    "rio grande", "sao leopoldo", "torres", "tramandai", "arroio do sal", "imbe",
    "tres cachoeiras", "tres palmeiras",
  ],
  SE: ["itabaiana", "moita bonita", "neopolis", "pacatuba", "propria", "telha"],
  TO: ["dianopolis"],
  BA: [
    "salvador", "lauro de freitas", "camacari", "simoes filho", "candeias", "ilheus", "itabuna",
    "alagoinhas", "santo antonio de jesus", "cruz das almas", "paulo afonso", "madre de deus",
    "sao francisco do conde", "vera cruz", "itaparica", "santo amaro", "itacare", "jaguaquara",
    "ipiau", "bom jesus da lapa", "canavieiras", "belmonte", "pojuca", "catu",
  ],
};

export type VoltagemDaRegiao = { volts: "127" | "220"; cidade: string; uf: string };

/** Tensão usual da cidade (null sem cidade/UF conhecida). */
export function voltagemDaRegiao(
  cidade: string | null | undefined,
  uf: string | null | undefined,
): VoltagemDaRegiao | null {
  const u = String(uf ?? "").toUpperCase();
  const padrao = PADRAO_UF[u];
  if (!padrao || !cidade) return null;
  const c = semAcento(cidade).trim();
  const excecao = (EXCECOES[u] ?? []).includes(c);
  const volts = excecao ? (padrao === "127" ? "220" : "127") : padrao;
  return { volts, cidade, uf: u };
}
