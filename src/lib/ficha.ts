/* O QUE MUDA PELA FICHA (Weslei, 02/10: "seja um especialista em TODAS as
   categorias"). Pedido 550: o parecido de R$ 5.039 tinha a mesma foto e a
   conferência escreveu "o '4' do título pode indicar outra capacidade"; a
   ficha dele dizia o fato: Modelo BRE68AK e 477 L (o colado: BRE66, 500 L).
   Quando os dois anúncios trazem o mesmo campo decisivo com valores
   diferentes, isso é o que muda, sem achismo. Só acrescenta diferença,
   nunca transforma parecido em igual. */

type Detalhes = { caracteristicas?: { nome: string; valor: string }[] | null } | null | undefined;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* Campos que decidem se é o mesmo produto, em qualquer categoria. Cor fica de
   fora (cada vendedor escreve de um jeito: "Prateado" x "Inox") e o código
   alfanumérico também (o vendedor copia o de outra cor). */
const CAMPOS: Record<string, string> = {
  modelo: "Modelo",
  "capacidade total": "Capacidade",
  capacidade: "Capacidade",
  voltagem: "Voltagem",
  "armazenamento interno": "Armazenamento",
  "memoria ram": "Memória RAM",
  "tamanho da tela": "Tela",
  volume: "Volume",
  "conteudo liquido": "Conteúdo",
  "peso liquido": "Peso líquido",
  "quantidade de unidades": "Unidades",
  "unidades por kit": "Unidades",
  "quantidade de pecas": "Peças",
  potencia: "Potência",
};

function mapa(d: Detalhes) {
  const m = new Map<string, string>();
  for (const c of d?.caracteristicas ?? []) {
    const k = semAcento(String(c?.nome ?? ""));
    const v = String(c?.valor ?? "").trim();
    if (CAMPOS[k] && v && !m.has(CAMPOS[k])) m.set(CAMPOS[k], v);
  }
  return m;
}

function iguais(campo: string, a: string, b: string) {
  const x = semAcento(a).replace(/\s+/g, "");
  const y = semAcento(b).replace(/\s+/g, "");
  if (x === y) return true;
  if (campo === "Modelo") return x.startsWith(y) || y.startsWith(x);
  if (campo === "Voltagem") {
    const bi = (s: string) => /bivolt/.test(s) || (/(110|127)/.test(s) && /220/.test(s));
    if (bi(x) && bi(y)) return true;
  }
  const nums = (s: string) =>
    (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")).join("/");
  return nums(x) !== "" && nums(x) === nums(y);
}

/** Diferenças confirmadas pelas duas fichas, prontas para a tela:
 *  ["Modelo BRE68AK (o seu: BRE66)", "Capacidade 477 L (o seu: 500 L)"]. */
export function diferencasDaFicha(colado: Detalhes, outro: Detalhes): string[] {
  const a = mapa(colado);
  const b = mapa(outro);
  const out: string[] = [];
  for (const [campo, va] of a) {
    const vb = b.get(campo);
    if (vb && !iguais(campo, va, vb)) out.push(`${campo} ${vb} (o seu: ${va})`);
  }
  return out;
}

/* Achismo da conferência ("não informa", "pode indicar"): com a ficha
   dizendo o fato, o achismo sai do texto. Mesma lista do servidor. */
const ESPECULACAO =
  /(n[aã]o (informa|especifica|menciona|cita|confirma|indica)|sem informa[çc][aã]o|pode (indicar|ser|significar|sugerir)|possivelmente|provavelmente|talvez|n[aã]o confirmado)/i;

/** O que muda, juntando a conferência pela foto e as fichas. */
export function mudaCompleta(
  muda: string | null | undefined,
  coladoDetalhes: Detalhes,
  outroDetalhes: Detalhes,
): string | null {
  const ficha = diferencasDaFicha(coladoDetalhes, outroDetalhes);
  const partes = (muda ?? "")
    .split(/;\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !(ficha.length && ESPECULACAO.test(p)));
  const todas = [...ficha, ...partes];
  return todas.length ? todas.join("; ") : (muda ?? null);
}
