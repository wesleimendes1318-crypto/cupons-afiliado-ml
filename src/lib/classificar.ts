/* MOTOR DE CLASSIFICAÇÃO (Weslei, 27/10). Decide o nó da taxonomia
   (src/content/taxonomia.ts) de um produto, com a confiança:

   Evidências, da mais forte para a mais fraca:
   - título que casa com o nó (e não com o "nao" dele): 2 pontos. O título é
     o que separa acessório do produto principal, e o Mercado Livre erra aí
     ("Controle remoto do receptor" vira receptor; receptor de microfone
     Shure vira "receptor de TV").
   - domínio/caminho OFICIAL do Mercado Livre que casa com o nó: 1,5.
   Vence a maior soma; empate vai para o nó mais fundo e depois para o
   primeiro declarado.

   Confiança:
   - alta: título e Mercado Livre concordam no nó, ou só o Mercado Livre
     aponta um nó final (sem filhos) e nenhum título discorda.
   - media: só uma evidência, ou o título contradiz o Mercado Livre (vale o
     título, e o caso fica marcado para revisão).
   - baixa: nada casou; fica no departamento da lista de origem (fila de
     tratamento: não entra em nenhuma subcategoria).
   - "fora": não serve para o site (código digital, peça de tela, produto
     falso, artigo adulto). Nunca é mostrado.
   Nada é inventado: sem evidência, o produto não ganha subcategoria. */

import { NOS, ORDEM, type CategoriaLegado, type NoTaxonomia } from "@/content/taxonomia";
import { pareceFalso } from "@/lib/falsificado";

export const VERSAO_TAXONOMIA = 1;

export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FORA: RegExp[] = [
  /\bgift ?cards?\b|\bcartao (de )?presente\b|\(digital\)|\bgame pass\b|\brazer gold\b|\bassinatura\b|\brecarga\b|\bcodigo digital\b/,
  /^\s*(?:\d+\s*)?(?:kit\s+)?(?:telas?|display|frontal)\b.*\b(?:compativel|lcd|oled|touch|incell)\b/,
  /\bsex ?shop\b|\beroticos?\b|\bvibrador\b|\bsexual\b|\bsex toys?\b/,
];

export type Classificacao = {
  /** Slug do nó, ou "fora". */
  no: string;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
  /** Categoria antiga equivalente (abas e cotas do agente). */
  legado: CategoriaLegado | null;
};

export type EntradaClassificacao = {
  nome: string;
  /** Domínio oficial, ex.: MLB-HARD_DRIVES_AND_SSDS. */
  dominio?: string | null;
  /** Caminho oficial, ex.: "Informática > Armazenamento > ...". */
  caminho?: string | null;
  /** Categoria da lista de onde veio (categoria_site). */
  fonte?: string | null;
};

type Pontos = { no: NoTaxonomia; titulo: boolean; ml: boolean; pontos: number; ordem: number };

const mesmaLinhagem = (a: NoTaxonomia, b: NoTaxonomia) =>
  a.caminho.includes(b.slug) || b.caminho.includes(a.slug);

export function classificar(e: EntradaClassificacao): Classificacao {
  const t = semAcento(e.nome ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { no: "fora", confianca: "alta", motivo: "sem nome", legado: null };
  if (FORA.some((r) => r.test(t)) || pareceFalso(e.nome)) {
    return {
      no: "fora",
      confianca: "alta",
      motivo: "fora do site (digital, peça de tela, falso ou adulto)",
      legado: null,
    };
  }
  const m = e.dominio || e.caminho ? semAcento(`${e.dominio ?? ""} | ${e.caminho ?? ""}`) : "";

  const casados: Pontos[] = [];
  ORDEM.forEach((slug, ordem) => {
    const no = NOS[slug]!;
    const titulo = !!no.titulo?.test(t) && !no.nao?.test(t);
    const ml = !!m && !!no.ml?.test(m);
    if (titulo || ml)
      casados.push({ no, titulo, ml, pontos: (titulo ? 2 : 0) + (ml ? 1.5 : 0), ordem });
  });

  if (!casados.length) {
    const dep = e.fonte && NOS[e.fonte] ? e.fonte : null;
    return dep
      ? {
          no: dep,
          confianca: "baixa",
          motivo: "sem evidência: só a lista de origem",
          legado: NOS[dep]!.legado,
        }
      : {
          no: "fora",
          confianca: "baixa",
          motivo: "sem evidência e sem lista de origem",
          legado: null,
        };
  }

  /* O nó só ganha pontos dos ancestrais do Mercado Livre quando está na
     mesma linhagem (consistência com o departamento oficial). */
  const mlCasados = casados.filter((c) => c.ml);
  for (const c of casados) {
    if (!c.ml && mlCasados.some((x) => mesmaLinhagem(x.no, c.no))) c.pontos += 0.5;
  }
  casados.sort((a, b) => b.pontos - a.pontos || b.no.nivel - a.no.nivel || a.ordem - b.ordem);
  const melhor = casados[0]!;
  const no = melhor.no;

  const tituloContra = casados.find((c) => c.titulo && c !== melhor && !mesmaLinhagem(c.no, no));
  const mlContra = mlCasados.length > 0 && !mlCasados.some((x) => mesmaLinhagem(x.no, no));

  let confianca: Classificacao["confianca"];
  let motivo: string;
  if (melhor.titulo && melhor.ml) {
    confianca = tituloContra ? "media" : "alta";
    motivo = "título e Mercado Livre concordam";
  } else if (melhor.ml) {
    const final = no.filhos.length === 0;
    confianca = final && !tituloContra ? "alta" : "media";
    motivo = final
      ? "categoria oficial do Mercado Livre"
      : "categoria oficial, sem subcategoria definida";
  } else if (mlContra) {
    confianca = "media";
    motivo = "título diverge do Mercado Livre (revisar)";
  } else {
    confianca = "media";
    motivo = m ? "título, dentro do departamento oficial" : "só pelo título";
  }
  return { no: no.slug, confianca, motivo, legado: no.legado };
}

/** Departamento (nível 1) de um nó. */
export const departamentoDe = (slug: string) => NOS[slug]?.caminho[0] ?? null;
