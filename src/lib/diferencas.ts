/* O QUE MUDA PARA O CLIENTE (Weslei, 02/10: "indicar a diferença com mais
   clareza para quem está comprando, não somente a diferença técnica"). Cada
   diferença vira: o campo, o valor do anúncio colado ("o seu"), o valor deste
   anúncio ("este") e o que isso significa na compra. O significado é uma
   regra fixa por tipo de campo, ou conta feita com os dois números: nunca
   inventa vantagem nem defeito. Sem saber a ordem, mostra como veio. */

import { ESPECULACAO } from "@/lib/ficha";

export type DiferencaCliente = {
  campo: string | null;
  seu: string | null;
  este: string | null;
  /* Texto original, quando não deu para separar em seu x este. */
  texto: string;
  significa: string | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CAMPOS_FICHA =
  "Modelo|Capacidade|Voltagem|Armazenamento|Memória RAM|Tela|Volume|Conteúdo|Peso líquido|Unidades|Peças|Potência";

/* Número e unidade de um valor ("477 L", "500 litros", "128 GB", "1,5 kg"). */
function numero(v: string): { n: number; u: string } | null {
  const m = norm(v).match(/(\d+(?:[.,]\d+)?)\s*([a-z"]+)?/);
  if (!m?.[1]) return null;
  const u = (m[2] ?? "")
    .replace(/^(litros?|lts?)$/, "l")
    .replace(/^(polegadas?|pol)$/, '"')
    .replace(/^(unidades?|un|pecas?)$/, "un");
  return { n: Number(m[1].replace(",", ".")), u };
}

const fmt = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/* "23 L a menos" / "1 TB a mais", só com a mesma unidade nos dois. */
function delta(seu: string | null, este: string | null) {
  if (!seu || !este) return null;
  const a = numero(seu);
  const b = numero(este);
  if (!a || !b || a.u !== b.u || a.n === b.n) return null;
  const d = b.n - a.n;
  const u =
    b.u === "l" ? " L" : b.u === '"' ? '"' : b.u && b.u !== "un" ? ` ${b.u.toUpperCase()}` : "";
  return { d, txt: `${fmt(Math.abs(d))}${u} a ${d > 0 ? "mais" : "menos"}` };
}

/** O que a diferença significa para quem compra (regra fixa ou conta). */
export function significado(
  campo: string | null,
  seu: string | null,
  este: string | null,
  texto: string,
): string | null {
  const c = norm(campo ?? texto);
  const dd = delta(seu, este);
  if (/\b(usado|recondicionad|vitrine|seminovo|condicao)/.test(norm(texto)))
    return "Não é novo como o seu: confira o estado e a garantia antes de comprar.";
  if (/(replica|compativel com|similar|generic)/.test(norm(texto)) && /marca|original/.test(c))
    return "Não é da marca original: qualidade e garantia são outras.";
  if (/\bmarca\b/.test(c)) return "Outra marca: a garantia e a assistência são dessa marca.";
  if (/\b(cor|cores|acabamento|estampa|tonalidade|tom)\b/.test(c)) return "Muda só a aparência.";
  if (/capacidade/.test(c))
    return dd ? `Cabe ${dd.txt} que o seu.` : "Capacidade diferente da sua: confira se atende.";
  if (/(volume|conteudo|litro)/.test(c))
    return dd ? `Vem ${dd.txt} que o seu: compare pelo preço por litro.` : "Outro volume.";
  if (/peso/.test(c))
    return dd ? `${dd.txt.replace(/^./, (x) => x.toUpperCase())} que o seu.` : "Outro peso.";
  if (/voltagem|tensao|bivolt/.test(c))
    return "Confira se a voltagem serve na tomada onde você vai usar.";
  if (/armazenamento/.test(c))
    return dd
      ? `${dd.txt.replace(/^./, (x) => x.toUpperCase())} de espaço para arquivos.`
      : "Outro espaço de armazenamento.";
  if (/(memoria|ram)/.test(c))
    return dd ? `${dd.txt.replace(/^./, (x) => x.toUpperCase())} de memória.` : "Outra memória.";
  if (/(tela|polegada)/.test(c))
    return dd
      ? `Tela ${fmt(Math.abs(dd.d))}" ${dd.d > 0 ? "maior" : "menor"}.`
      : "Outro tamanho de tela.";
  if (/(unidade|quantidade|pecas|kit)/.test(c))
    return dd
      ? `Vem ${dd.txt} que o seu: compare pelo preço por unidade.`
      : "Outra quantidade: compare pelo preço por unidade.";
  if (/potencia/.test(c))
    return dd ? `${dd.txt.replace(/^./, (x) => x.toUpperCase())} de potência.` : "Outra potência.";
  if (/(compativel|compatibilidade|serve)/.test(c))
    return "Confira se serve no seu aparelho ou veículo antes de comprar.";
  if (/(tamanho|medida|dimens|altura|largura)/.test(c))
    return "Outro tamanho: confira as medidas antes de comprar.";
  if (/(material|tecido)/.test(c)) return "Outro material.";
  if (/\btipo\b/.test(c)) return "Outro tipo de produto: confira se atende ao seu uso.";
  if (/modelo|versao|linha|geracao/.test(c))
    return "Outra versão do produto: veja nas características o que muda no uso.";
  if (/(acompanha|acessorio|inclui|vem com|sem )/.test(c)) return "Muda o que vem na caixa.";
  return null;
}

/* O valor aparece no texto do colado (título e ficha)? Decide a ordem de
   "A x B". Palavra a palavra, sem o gênero ("Branco" acha "Branca"). */
const palavras = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/\s+/)
    .map((w) => (/^(litros?|lts?)$/.test(w) ? "l" : w))
    .filter((w) => w.length >= 2 || w === "l")
    .map((w) => (w.length > 3 ? w.replace(/[aoe]s?$/, "") : w));
function noTitulo(valor: string, titulo: string) {
  const v = palavras(valor);
  const t = new Set(palavras(titulo));
  return v.length > 0 && v.every((w) => t.has(w));
}

/* Tipo da diferença, para não repetir a mesma coisa duas vezes. */
function tipo(s: string) {
  const c = norm(s);
  if (/(unidade|quantidade|pecas|kit)/.test(c)) return "quantidade";
  if (/(capacidade|litro)/.test(c)) return "capacidade";
  if (/modelo/.test(c)) return "modelo";
  if (/\b(cor|cores)\b/.test(c)) return "cor";
  if (/voltagem/.test(c)) return "voltagem";
  return c;
}

/** Separa o "Muda" (conferência + fichas) em linhas para o cliente. */
export function diferencasParaCliente(
  muda: string | null | undefined,
  tituloColado: string | null | undefined,
  /* Ficha do colado: completa "o seu" quando a conferência só deu o outro. */
  fichaColado?: { caracteristicas?: { nome: string; valor: string }[] | null } | null,
): DiferencaCliente[] {
  const partes = (muda ?? "")
    .split(/;\s*/)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter(Boolean);
  const temFicha = partes.some((p) => new RegExp(`^(${CAMPOS_FICHA}) .+ \\(o seu: .+\\)$`).test(p));
  const out: DiferencaCliente[] = [];
  const vistos = new Set<string>();
  /* Tipos que a ficha já trouxe com os dois valores. */
  const comValores = new Set(
    partes
      .map((p) => p.match(new RegExp(`^(${CAMPOS_FICHA}) .+ \\(o seu: .+\\)$`))?.[1])
      .filter((c): c is string => Boolean(c))
      .map(tipo),
  );
  for (const p of partes) {
    let campo: string | null = null;
    let seu: string | null = null;
    let este: string | null = null;
    const ficha = p.match(new RegExp(`^(${CAMPOS_FICHA}) (.+) \\(o seu: (.+)\\)$`));
    const seta = p.match(/^([^:]{2,40}):\s*(.+?)\s*(?:→|->)\s*(.+)$/);
    const xis = p.match(/^([^:]{2,40}):\s*(.+?)\s+(?:x|vs\.?|versus)\s+(.+)$/i);
    /* Outras formas que a conferência usa: "modelo diferente (BRE57FB)",
       "Capacidade diferente (415L x 500L)", "Tipo duplex x inverse",
       "tipo duplex em vez de inverse". */
    const dif = p.match(/^([\p{L} ]{2,30}?) diferente \((.+?)\)$/iu);
    const emVez = p.match(/^([\p{L}]{2,20}) (.+?) em vez de (.+)$/iu);
    const xisSolto = p.match(/^([\p{L}]{2,20}) (.+?) (?:x|vs\.?) (.+)$/iu);
    const ordenar = (c: string, a: string, b: string) => {
      campo = c;
      const t = tituloColado ?? "";
      if (noTitulo(a, t) && !noTitulo(b, t)) [seu, este] = [a, b];
      else if (noTitulo(b, t) && !noTitulo(a, t)) [seu, este] = [b, a];
    };
    let par: [string, string] | null = null;
    if (ficha) [, campo = null, este = null, seu = null] = ficha;
    else if (seta) [, campo = null, seu = null, este = null] = seta;
    else if (xis) {
      par = [xis[2] ?? "", xis[3] ?? ""];
      ordenar(xis[1] ?? "", ...par);
    } else if (dif) {
      const [a = "", b] = (dif[2] ?? "").split(/\s+x\s+/i);
      if (b) {
        par = [a, b];
        ordenar(dif[1] ?? "", a, b);
      } else {
        campo = dif[1] ?? null;
        este = a;
      }
    } else if (emVez) [, campo = null, este = null, seu = null] = emVez;
    else if (xisSolto) {
      par = [xisSolto[2] ?? "", xisSolto[3] ?? ""];
      ordenar(xisSolto[1] ?? "", ...par);
    } else {
      const c = p.match(/^([^:]{2,40}):\s*(.+)$/);
      if (c) campo = c[1] ?? null;
    }
    /* Achismo ("pode indicar") sai quando a ficha já diz o fato. */
    if (temFicha && !ficha && ESPECULACAO.test(p)) continue;
    if (campo && este && !seu) {
      const k = norm(campo);
      const c = (fichaColado?.caracteristicas ?? []).find((x) => {
        const n = norm(String(x?.nome ?? ""));
        return k.length >= 3 && (n === k || n.startsWith(`${k} `));
      });
      if (c?.valor) seu = String(c.valor);
    }
    let significa = significado(campo, seu, este, p);
    /* Código de modelo com a mesma base (BRE66AB x BRE66AE): diz o fato. */
    const [m1, m2] = seu && este ? [seu, este] : (par ?? ["", ""]);
    if (campo && /modelo/i.test(campo) && m1 && m2) {
      const a = m1.trim().toUpperCase();
      const b = m2.trim().toUpperCase();
      let k = 0;
      while (k < a.length && a[k] === b[k]) k++;
      const base = a.slice(0, k).replace(/[A-Z]+$/, "");
      if (
        base.length >= 4 &&
        /\d$/.test(base) &&
        /^[A-Z]{0,3}$/.test(a.slice(base.length)) &&
        /^[A-Z]{0,3}$/.test(b.slice(base.length))
      )
        significa = `Mesmo modelo base (${base}), muda só o final do código.`;
    }
    if (!ficha && comValores.has(tipo(campo ?? p))) continue;
    const chave = campo ? norm(campo) : norm(p);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({
      campo: campo ? campo.trim().replace(/^./, (x) => x.toUpperCase()) : null,
      seu: seu?.trim() || null,
      este: este?.trim() || null,
      texto: p,
      significa,
    });
  }
  return out;
}
