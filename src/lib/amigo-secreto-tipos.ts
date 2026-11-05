/* AMIGO SECRETO (Weslei, 05/11): types shared by the page, the parser and the
   two public endpoints. Products are never stored here for the account: only
   what the person typed and the showcase definitions (terms), re-read on open. */
import type { Resultado } from "@/lib/busca-guiada-cliente";

export type VitrineCategoriaAmigo = {
  id: string;
  /** "Skincare e autocuidado", "Roupas de academia (shorts M e tops G)". */
  titulo: string;
  icone?: string;
  /** Search terms fed to the official catalog search (2-5 words each). */
  termosBusca: string[];
  /** "Carregar mais" step of the catalog (null = the catalog ran out). */
  cursorAtual: number | null;
  /** Next page of the catalog search (0 = not loaded yet). */
  pagina: number;
  /** Brand variants returned by the 1st page (continue the search). */
  variantes: string[];
  produtos: Resultado[];
  temMais: boolean;
  carregando: boolean;
  erro?: string | null;
};

export type TamanhosAmigo = {
  roupa?: string | null;
  calcado?: string | null;
  /** "Shorts: M · Tops: G" */
  observacoes?: string | null;
};

export type Amigo = {
  id: string;
  nome: string;
  /** Original text typed or pasted. */
  desejosTexto: string;
  /** null = use the default budget of the page. */
  orcamentoMin?: number | null;
  orcamentoMax?: number | null;
  tamanhosIdentificados?: TamanhosAmigo;
  vitrines: VitrineCategoriaAmigo[];
  comprado: boolean;
  produtoEscolhidoId?: string | null;
  /** Hearted products (05/11, saved on the device even without login). */
  favoritos?: Favorito[];
};

/** Snapshot of a hearted card; the price is labeled with the time it was read. */
export type Favorito = Resultado & { favoritadoEm: string };

export const MAX_FAVORITOS = 15;

export type EstadoAmigoSecreto = {
  orcamentoPadraoMin: number;
  orcamentoPadraoMax: number;
  amigos: Amigo[];
  amigoAtivoId: string | null;
};

/** What the interpretation (server or local) returns for one person. */
export type Interpretacao = {
  tamanhos: TamanhosAmigo;
  vitrines: Array<{ titulo: string; icone: string; termos: string[] }>;
};

export const CHAVE_LOCAL = "melhorescolha_amigo_secreto_v2";
export const ORCAMENTO_PADRAO = { min: 80, max: 100 } as const;
/** First load of each showcase; "+20 opções" after it. */
export const META_POR_VITRINE = 50;
export const LOTE_EXTRA = 20;
