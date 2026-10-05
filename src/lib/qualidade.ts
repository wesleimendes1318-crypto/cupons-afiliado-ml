/* QUALIDADE EQUIVALENTE OU MELHOR (Weslei, 05/10: "a recomendação não deve
   oferecer somente o menor valor, mas também a melhor qualidade ou
   equivalente do que foi buscado. Isso é uma premissa"). Caso real: projetor
   L018 (Full HD nativo, 1920x1080) x Magcubic HY300 Pro (linha mini, 720p)
   pela metade do preço saiu como Melhor alternativa e no canal.

   A Melhor alternativa (site, "Me ajude a escolher", bot e canal) só aceita
   parecido com qualidade EQUIVALENTE ou SUPERIOR. Ordem de decisão:
   1. Piora objetiva veta (resolução nativa menor, menos brilho, capacidade,
      armazenamento, memória, potência ou bateria; versão mini) -> inferior.
   2. Veredito da conferência pela foto (campo qualidade do parecido).
   3. Só muda cor/acabamento/estampa (ou o final do código) -> equivalente.
   4. Senão, incerta: não vira recomendação (continua nos Parecidos).
   Nunca usa o preço para julgar qualidade e nunca inventa: o motivo é o dado
   que sustenta. */

import { diferencasParaCliente } from "@/lib/diferencas";

export type NivelQualidade = "superior" | "equivalente" | "inferior" | "incerta";
export type Qualidade = { nivel: NivelQualidade; motivo: string | null };

type Detalhes = { caracteristicas?: { nome: string; valor: string }[] | null } | null | undefined;

type Parecido = {
  titulo?: string | null | undefined;
  muda?: string | null | undefined;
  qualidade?: string | null | undefined;
  qualidadeMotivo?: string | null | undefined;
  /* Desvantagens apontadas pela conferência (05/10), olhando tudo como comprador. */
  desvantagens?: string[] | null | undefined;
  detalhes?: Detalhes;
};
type Colado = { titulo?: string | null | undefined; detalhes?: Detalhes };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const NIVEIS = new Set<NivelQualidade>(["superior", "equivalente", "inferior", "incerta"]);

/* Campos da ficha em que MAIS é melhor (comparação só com número nos dois). */
const MAIS_E_MELHOR: Array<[RegExp, string]> = [
  [/^brilho/, "Brilho"],
  [/^capacidade/, "Capacidade"],
  [/^armazenamento/, "Armazenamento"],
  [/^memoria ram|^ram\b/, "Memória RAM"],
  [/^potencia(?! consumida)/, "Potência"],
  [/^bateria|^capacidade da bateria/, "Bateria"],
  [/^relacao de contraste|^contraste/, "Contraste"],
];

function numero(v: string): number | null {
  /* "17.000 lm" -> 17000; "1,73 kg" -> 1.73; "20000:1" -> 20000. */
  const m = /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)/.exec(v);
  if (!m) return null;
  const bruto = m[1]!;
  const n = /^\d{1,3}(\.\d{3})+$/.test(bruto)
    ? Number(bruto.replace(/\./g, ""))
    : Number(bruto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function mapaFicha(d: Detalhes) {
  const m = new Map<string, string>();
  for (const c of d?.caracteristicas ?? []) {
    const k = norm(String(c?.nome ?? ""));
    const v = String(c?.valor ?? "").trim();
    if (k && v && !m.has(k)) m.set(k, v);
  }
  return m;
}

/* Resolução nativa (altura em px): ficha "1920 px x 1080 px" ou o menor
   "NNNp" do título ("4k 720p" é 720p nativo; "4K" sozinho é propaganda). */
function resolucao(titulo: string | null | undefined, ficha: Map<string, string>): number | null {
  for (const [k, v] of ficha)
    if (/^resolucao( nativa| da tela)?$/.test(k)) {
      const nums = [...v.matchAll(/(\d{3,4})/g)].map((x) => Number(x[1]));
      if (nums.length >= 2) return Math.min(...nums);
    }
  const t = norm(titulo ?? "");
  const ps = [...t.matchAll(/\b(480|540|720|1080|1440|2160)p\b/g)].map((x) => Number(x[1]));
  if (ps.length) return Math.min(...ps);
  if (/\b(full ?hd|fhd)\b/.test(t)) return 1080;
  return null;
}

/* Piora (ou melhora) objetiva pelos dados dos dois anúncios. */
function pioresEMelhores(p: Parecido, c: Colado) {
  const fp = mapaFicha(p.detalhes);
  const fc = mapaFicha(c.detalhes);
  const piores: string[] = [];
  const melhores: string[] = [];

  const rc = resolucao(c.titulo, fc);
  const rp = resolucao(p.titulo, fp);
  if (rc && rp && rp < rc) piores.push(`Resolução nativa: ${rc}p → ${rp}p`);
  if (rc && rp && rp > rc) melhores.push(`Resolução nativa: ${rc}p → ${rp}p`);

  if (fc.get("e mini") === "Não" && fp.get("e mini") === "Sim") piores.push("Versão mini");

  for (const [k, va] of fc) {
    const regra = MAIS_E_MELHOR.find(([re]) => re.test(k));
    const vb = fp.get(k);
    if (!regra || !vb) continue;
    const a = numero(va);
    const b = numero(vb);
    if (a == null || b == null || a <= 0) continue;
    if (b < a * 0.99) piores.push(`${regra[1]}: ${va} → ${vb}`);
    else if (b > a * 1.01) melhores.push(`${regra[1]}: ${va} → ${vb}`);
  }

  /* Números que a conferência escreveu no "muda" (ex.: "Capacidade: 500 L -> 477 L"). */
  for (const d of diferencasParaCliente(p.muda, c.titulo)) {
    const regra = MAIS_E_MELHOR.find(([re]) => re.test(norm(d.campo ?? "")));
    if (!regra || !d.seu || !d.este) continue;
    const a = numero(d.seu);
    const b = numero(d.este);
    if (a == null || b == null || a <= 0) continue;
    const txt = `${regra[1]}: ${d.seu} → ${d.este}`;
    if (b < a * 0.99 && !piores.some((x) => x.startsWith(regra[1]))) piores.push(txt);
    else if (b > a * 1.01 && !melhores.some((x) => x.startsWith(regra[1]))) melhores.push(txt);
  }

  return { piores, melhores };
}

function comparacaoObjetiva(p: Parecido, c: Colado): Qualidade | null {
  const { piores, melhores } = pioresEMelhores(p, c);
  if (piores.length) return { nivel: "inferior", motivo: piores.slice(0, 2).join("; ") };
  if (melhores.length && !p.qualidade)
    return { nivel: "superior", motivo: melhores.slice(0, 2).join("; ") };
  return null;
}

/* Diferenças que não mudam a qualidade do produto. */
const NEUTRO = /^(cor|cores|acabamento|estampa|desenho|padrao|tonalidade)\b/;
function soDiferencaNeutra(p: Parecido, c: Colado) {
  const itens = diferencasParaCliente(p.muda, c.titulo);
  if (!itens.length) return false;
  return itens.every(
    (d) =>
      NEUTRO.test(norm(d.campo ?? "")) ||
      NEUTRO.test(norm(d.texto)) ||
      /muda so o final do codigo/.test(norm(d.texto)),
  );
}

export function qualidadeDoParecido(p: Parecido, colado: Colado): Qualidade {
  const objetiva = comparacaoObjetiva(p, colado);
  if (objetiva?.nivel === "inferior") return objetiva;
  const conferida = String(p.qualidade ?? "").toLowerCase() as NivelQualidade;
  if (NIVEIS.has(conferida)) {
    /* "Produto idêntico" num parecido contradiz o "não é idêntico" da tela
       (05/10, geladeira Inox x Black Inox): vira o motivo neutro, se for o
       caso, ou fica sem motivo. */
    const motivo = (p.qualidadeMotivo ?? "").trim();
    const contradiz = /id[eê]ntic|mesmo produto|igual ao/i.test(motivo);
    return {
      nivel: conferida,
      motivo: !contradiz
        ? motivo || null
        : soDiferencaNeutra(p, colado)
          ? "Muda só a cor ou o acabamento"
          : null,
    };
  }
  if (objetiva) return objetiva;
  if (soDiferencaNeutra(p, colado))
    return { nivel: "equivalente", motivo: "Muda só a cor ou o acabamento" };
  return { nivel: "incerta", motivo: null };
}

/** A premissa: só equivalente ou superior pode ser recomendado. */
export function qualidadeAceita(q: Qualidade) {
  return q.nivel === "equivalente" || q.nivel === "superior";
}

/** Texto curto para a tela e para o Telegram. */
export function textoDaQualidade(q: Qualidade): string {
  const m = q.motivo ? ` (${q.motivo})` : "";
  if (q.nivel === "superior") return `Qualidade superior à do seu${m}`;
  if (q.nivel === "equivalente") return `Qualidade equivalente à do seu${m}`;
  if (q.nivel === "inferior") return `Qualidade inferior à do seu${m}`;
  return "Qualidade não confirmada como equivalente à do seu";
}

/* DESVANTAGENS (Weslei, 05/10: "precisa ter a indicação de desvantagens,
   quando houver"; "pensar como um consumidor"). O que o parecido tem PIOR
   ou A MENOS que o anúncio colado, só com dado que sustenta: piora objetiva
   das fichas/títulos, o que a conferência apontou olhando foto, título,
   ficha e descrição (o frete já aparece em linha própria). Nunca inventa: sem dado, lista vazia. */
export function desvantagensDoParecido(p: Parecido, colado: Colado): string[] {
  const out: string[] = [];
  /* Mesmo assunto pela 1ª palavra ("Resolução nativa" = "Resolucao"). */
  const campo = (t: string) => norm(t.split(":")[0] ?? t).split(" ")[0];
  const temCampo = (t: string) => out.some((x) => campo(x) === campo(t));
  for (const d of pioresEMelhores(p, colado).piores) if (!temCampo(d)) out.push(d);
  for (const d of p.desvantagens ?? []) {
    const t = String(d ?? "")
      .trim()
      .replace(/\s*->\s*/g, " → ");
    if (t && t.length <= 90 && !temCampo(t)) out.push(t);
  }
  return out.slice(0, 4);
}
