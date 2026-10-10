/* MODELO PELO TÍTULO (10/10, pedido 1181): a conferência pela foto chamou o
   "Echo Dot Max" de parecido que só muda a cor ("Cor: Preto -> Roxo",
   qualidade equivalente) contra o "Echo Dot 5ª Geração". Sem ficha (Amazon e
   Shopee não têm), o título é o que diz o modelo: versão (Max, Pro, Plus,
   Mini, Lite, Ultra...) e geração. Quando os dois títulos dizem coisas
   diferentes, o "Muda" ganha "Modelo: o do colado -> o do candidato" e o
   candidato nunca vira "mesmo produto". Só acrescenta diferença. */

const VERSOES = [
  "max",
  "pro",
  "plus",
  "mini",
  "lite",
  "ultra",
  "slim",
  "kids",
  "note",
  "neo",
  "fe",
] as const;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function versoes(titulo: string): Set<string> {
  const palavras = new Set(
    semAcento(titulo)
      .split(/[^a-z0-9+]+/)
      .filter(Boolean),
  );
  const achadas = new Set<string>();
  for (const v of VERSOES) if (palavras.has(v)) achadas.add(v);
  if ([...palavras].some((p) => p.endsWith("+"))) achadas.add("plus");
  return achadas;
}

function geracao(titulo: string): number | null {
  const t = semAcento(titulo);
  const m =
    /\b(\d{1,2})\s*(?:a|ª|º|°|th|rd|nd|st)?\s*gera(?:cao|tion)\b/.exec(t) ??
    /\bgera(?:cao|tion)\s*(\d{1,2})\b/.exec(t) ??
    /\b(\d{1,2})\s*(?:a|th|rd|nd|st)?\s*gen\b/.exec(t) ??
    /\bgen\s*(\d{1,2})\b/.exec(t);
  return m ? Number(m[1]) : null;
}

const nomeVersao = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function descricao(vs: Set<string>, g: number | null): string {
  const partes = [...vs].map(nomeVersao);
  if (g != null) partes.push(`${g}ª geração`);
  return partes.length ? partes.join(" ") : "versão padrão";
}

/** "Modelo: 5ª geração -> Max" quando os títulos dizem modelos diferentes. */
export function diferencaDeModelo(
  original: string | null | undefined,
  candidato: string | null | undefined,
): string | null {
  if (!original || !candidato) return null;
  const vo = versoes(original);
  const vc = versoes(candidato);
  const go = geracao(original);
  const gc = geracao(candidato);
  const versaoMuda = vo.size !== vc.size || [...vo].some((v) => !vc.has(v));
  const geracaoMuda = go != null && gc != null && go !== gc;
  if (!versaoMuda && !geracaoMuda) return null;
  return `Modelo: ${descricao(vo, go)} -> ${descricao(vc, gc)}`;
}
