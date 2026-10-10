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
  /* campo -> valor e o nome da característica como o anúncio escreve. */
  const m = new Map<string, { valor: string; nome: string }>();
  for (const c of d?.caracteristicas ?? []) {
    const nome = String(c?.nome ?? "").trim();
    const k = semAcento(nome);
    const v = String(c?.valor ?? "").trim();
    if (CAMPOS[k] && v && !m.has(CAMPOS[k])) m.set(CAMPOS[k], { valor: v, nome });
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
  return diferencasDaFichaItens(colado, outro).map((d) => `${d.campo} ${d.este} (o seu: ${d.seu})`);
}

/** As mesmas diferenças, separadas: campo, valor do colado (seu), valor do
 *  outro anúncio (este) e o nome da característica no outro anúncio. */
export function diferencasDaFichaItens(
  colado: Detalhes,
  outro: Detalhes,
): { campo: string; seu: string; este: string; nome: string }[] {
  const a = mapa(colado);
  const b = mapa(outro);
  const out: { campo: string; seu: string; este: string; nome: string }[] = [];
  for (const [campo, va] of a) {
    const vb = b.get(campo);
    if (vb && !iguais(campo, va.valor, vb.valor))
      out.push({ campo, seu: va.valor, este: vb.valor, nome: vb.nome });
  }
  return out;
}

/* Achismo da conferência ("não informa", "pode indicar"): com a ficha
   dizendo o fato, o achismo sai do texto. Mesma lista do servidor. */
export const ESPECULACAO =
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
    /* Item cortado no meio (motivo gravado com corte seco em 140, até 10/10):
       "Alimentação: Pilha ->" sem o valor do outro anúncio sai da tela. */
    .filter((p) => !/->\s*$/.test(p))
    .filter((p) => !(ficha.length && ESPECULACAO.test(p)));
  /* A conferência escreve "Campo: original -> candidato" (02/10). */
  const todas = [...ficha, ...partes.map((p) => p.replace(/\s*->\s*/g, " → "))];
  return todas.length ? todas.join("; ") : (muda ?? null);
}

/** Ficha x ficha para a tela: o que é igual nos campos decisivos (mais a
 *  marca) e os nomes das características do outro anúncio que diferem do
 *  colado (para destacar em amarelo; aqui a cor também conta). */
export function compararFichas(
  colado: Detalhes,
  outro: Detalhes,
): { iguais: { campo: string; valor: string }[]; diferentes: string[] } {
  const iguais: { campo: string; valor: string }[] = [];
  const diferentes: string[] = [];
  const doColado = new Map<string, string>();
  for (const c of colado?.caracteristicas ?? []) {
    const k = semAcento(String(c?.nome ?? ""));
    const v = String(c?.valor ?? "").trim();
    if (k && v && !doColado.has(k)) doColado.set(k, v);
  }
  const vistos = new Set<string>();
  for (const c of outro?.caracteristicas ?? []) {
    const nome = String(c?.nome ?? "").trim();
    const k = semAcento(nome);
    const v = String(c?.valor ?? "").trim();
    const va = doColado.get(k);
    if (!k || !v || !va) continue;
    const campo = CAMPOS[k] ?? (k === "marca" ? "Marca" : k === "cor" ? "Cor" : null);
    if (!campo) {
      if (semAcento(va).replace(/\s+/g, "") !== semAcento(v).replace(/\s+/g, ""))
        diferentes.push(nome);
      continue;
    }
    if (iguais_(campo, va, v)) {
      if (campo !== "Cor" && !vistos.has(campo)) {
        vistos.add(campo);
        iguais.push({ campo, valor: v });
      }
    } else diferentes.push(nome);
  }
  return { iguais, diferentes };
}

function iguais_(campo: string, a: string, b: string) {
  if (campo === "Marca" || campo === "Cor")
    return semAcento(a).replace(/\s+/g, "") === semAcento(b).replace(/\s+/g, "");
  return iguais(campo, a, b);
}

/** Lado a lado pelas fichas: as características que os DOIS anúncios
 *  informam, primeiro as diferentes (para o "Comparar com o seu"). */
export function linhasLadoALado(
  colado: Detalhes,
  outro: Detalhes,
  max = 10,
): { nome: string; seu: string; este: string; igual: boolean }[] {
  const doColado = new Map<string, { nome: string; valor: string }>();
  for (const c of colado?.caracteristicas ?? []) {
    const k = semAcento(String(c?.nome ?? ""));
    const v = String(c?.valor ?? "").trim();
    if (k && v && !doColado.has(k)) doColado.set(k, { nome: String(c.nome).trim(), valor: v });
  }
  const { diferentes } = compararFichas(colado, outro);
  const linhas: { nome: string; seu: string; este: string; igual: boolean }[] = [];
  const vistos = new Set<string>();
  for (const c of outro?.caracteristicas ?? []) {
    const k = semAcento(String(c?.nome ?? ""));
    const v = String(c?.valor ?? "").trim();
    const a = doColado.get(k);
    if (!a || !v || vistos.has(k)) continue;
    vistos.add(k);
    linhas.push({
      nome: a.nome,
      seu: a.valor,
      este: v,
      igual: !diferentes.includes(String(c.nome).trim()),
    });
  }
  return [...linhas.filter((l) => !l.igual), ...linhas.filter((l) => l.igual)].slice(0, max);
}
