/* AMIGO SECRETO (Weslei, 05/11): optional profile questionnaire, the secret
   WhatsApp text (never names the drawn person) and the local fallback of the
   "ideas like the favorites" showcase. Profile answers are optional and
   inclusive: style of the pieces is a preference, not a gender question. */
import type { ContextoVitrine } from "@/lib/amigo-secreto-curadoria";

export type EstiloPecas = "feminino" | "masculino" | "neutro";
export type FaixaIdade = "crianca" | "adolescente" | "18-29" | "30-49" | "50+";

export type PerfilAmigo = {
  estilo?: EstiloPecas | null;
  idade?: FaixaIdade | null;
  roupa?: string | null;
  calcado?: string | null;
  /** "cores neutras, gosta de café, faz yoga" */
  gostos?: string | null;
};

export const OPCOES_ESTILO: Array<{ v: EstiloPecas | null; rotulo: string }> = [
  { v: "feminino", rotulo: "Peças femininas" },
  { v: "masculino", rotulo: "Peças masculinas" },
  { v: "neutro", rotulo: "Unissex / sem gênero" },
  { v: null, rotulo: "Tanto faz" },
];

export const OPCOES_IDADE: Array<{ v: FaixaIdade; rotulo: string }> = [
  { v: "crianca", rotulo: "Criança" },
  { v: "adolescente", rotulo: "Adolescente" },
  { v: "18-29", rotulo: "18 a 29" },
  { v: "30-49", rotulo: "30 a 49" },
  { v: "50+", rotulo: "50 ou mais" },
];

const IDADE_TIPICA: Record<FaixaIdade, number> = {
  crianca: 9,
  adolescente: 15,
  "18-29": 25,
  "30-49": 38,
  "50+": 58,
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function lerPerfil(bruto: unknown): PerfilAmigo {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const estilo = OPCOES_ESTILO.find((x) => x.v && x.v === o["estilo"])?.v ?? null;
  const idade = OPCOES_IDADE.find((x) => x.v === o["idade"])?.v ?? null;
  return {
    estilo,
    idade,
    roupa: str(o["roupa"], 4).toUpperCase() || null,
    calcado: str(o["calcado"], 2).replace(/\D/g, "") || null,
    gostos: str(o["gostos"], 120) || null,
  };
}

export const perfilVazio = (p?: PerfilAmigo | null) =>
  !p || (!p.estilo && !p.idade && !p.roupa && !p.calcado && !p.gostos);

/** Profile in words, appended to the wish text the reader interprets. */
export function textoDoPerfil(p?: PerfilAmigo | null): string {
  if (perfilVazio(p)) return "";
  const partes: string[] = [];
  if (p!.estilo === "feminino") partes.push("prefere peças femininas");
  if (p!.estilo === "masculino") partes.push("prefere peças masculinas");
  if (p!.estilo === "neutro") partes.push("prefere peças unissex");
  if (p!.idade) partes.push(`tem cerca de ${IDADE_TIPICA[p!.idade]} anos`);
  if (p!.roupa) partes.push(`roupa ${p!.roupa}`);
  if (p!.calcado) partes.push(`calçado ${p!.calcado}`);
  if (p!.gostos) partes.push(`gosta de ${p!.gostos}`);
  return `Perfil: ${partes.join(", ")}.`;
}

/** Wish text + profile, inside the 600 chars the reader accepts. */
export function textoParaLeitura(desejos: string, p?: PerfilAmigo | null): string {
  const perfil = textoDoPerfil(p);
  if (!perfil) return desejos.slice(0, 600);
  return `${desejos.slice(0, Math.max(0, 598 - perfil.length))} ${perfil}`.trim();
}

/** The questionnaire wins over what the free text suggested. */
export function aplicarPerfil(c: ContextoVitrine, p?: PerfilAmigo | null): ContextoVitrine {
  if (perfilVazio(p)) return c;
  return {
    ...c,
    genero: p!.estilo === "neutro" ? null : (p!.estilo ?? c.genero),
    adulto: p!.idade ? p!.idade !== "crianca" : c.adulto,
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type ItemSigilo = { titulo: string; preco: number | null; link: string };

/** WhatsApp text to ask an opinion: NEVER names the drawn person (Weslei,
    05/11: "não deve revelar quem é o amigo secreto"). Only Weslei's links. */
export function textoSigiloWhatsApp(itens: ItemSigilo[], faixa: string): string {
  const ok = itens.filter((i) => /^https:\/\/(meli\.la|amzn\.to|s\.shopee\.com\.br|shope\.ee)\//.test(i.link) || /[?&]tag=melhoresc0fff-20/.test(i.link));
  const linhas = ok.map((i, k) => {
    const preco = i.preco != null ? `\n💰 ${brl(i.preco)} (preço de quando salvei)` : "";
    return `${k + 1}. *${i.titulo.replace(/[*_~`]/g, "")}*${preco}\n👉 ${i.link}`;
  });
  return `🎁 *Me ajuda a escolher um presente de amigo secreto?*\nFaixa ${faixa}. Qual destes você escolheria?\n\n${linhas.join("\n\n")}`;
}

const PALAVRA_FRACA =
  /^(de|da|do|das|dos|e|com|para|pra|em|kit|que|assim|um|uma|o|a|os|as|no|na|é|e|un|und|unidade|unidades|cor|tamanho|novo|nova|original|promocao|oferta|\d+.*|p|m|g|gg|pp)$/;

/** Local fallback: short searches built from the favorites' titles. */
export function termosDosFavoritos(titulos: string[]): string[] {
  const termos: string[] = [];
  for (const t of titulos.slice(0, 10)) {
    const palavras = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !PALAVRA_FRACA.test(w));
    if (palavras.length >= 2) termos.push(palavras.slice(0, 3).join(" "));
    if (palavras.length >= 3) termos.push(`${palavras.slice(0, 2).join(" ")} presente`);
  }
  return [...new Set(termos)].slice(0, 8);
}
