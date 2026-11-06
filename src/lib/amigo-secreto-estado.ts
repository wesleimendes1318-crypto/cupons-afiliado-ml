import { lerPerfil } from "@/lib/amigo-secreto-perfil";
/* AMIGO SECRETO: saving the list (05/11). Instant save on this device
   (localStorage, melhorescolha_amigo_secreto_v2) and, signed in, in the
   account (table amigo_secreto_conta, RLS per user). Only what the person
   typed is saved; products are re-read from the catalog on open, so a saved
   price never goes stale on screen. */
import { supabase } from "@/integrations/supabase/client";
import {
  CHAVE_LOCAL,
  MAX_FAVORITOS,
  ORCAMENTO_PADRAO,
  type Amigo,
  type Favorito,
  type EstadoAmigoSecreto,
  type VitrineCategoriaAmigo,
} from "@/lib/amigo-secreto-tipos";

export const estadoVazio = (): EstadoAmigoSecreto => ({
  orcamentoPadraoMin: ORCAMENTO_PADRAO.min,
  orcamentoPadraoMax: ORCAMENTO_PADRAO.max,
  amigos: [],
  amigoAtivoId: null,
});

export const novoId = () => Math.random().toString(36).slice(2, 10);

export function novaVitrine(v: { titulo: string; icone?: string | undefined; termos: string[] }): VitrineCategoriaAmigo {
  return {
    id: novoId(),
    titulo: v.titulo,
    icone: v.icone ?? "🎁",
    termosBusca: v.termos,
    cursorAtual: null,
    pagina: 0,
    variantes: [],
    produtos: [],
    temMais: true,
    carregando: false,
    erro: null,
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const valor = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100_000 ? v : null);

/** What goes to storage: no products, no loading state. */
export function paraGuardar(e: EstadoAmigoSecreto) {
  return {
    orcamentoPadraoMin: e.orcamentoPadraoMin,
    orcamentoPadraoMax: e.orcamentoPadraoMax,
    amigoAtivoId: e.amigoAtivoId,
    freteACalcular: e.freteACalcular === true,
    faixaEscolhida: e.faixaEscolhida === true,
    dataFesta: e.dataFesta ?? null,
    amigos: e.amigos.slice(0, 40).map((a) => ({
      id: a.id,
      nome: a.nome,
      desejosTexto: a.desejosTexto,
      orcamentoMin: a.orcamentoMin ?? null,
      orcamentoMax: a.orcamentoMax ?? null,
      tamanhosIdentificados: a.tamanhosIdentificados ?? {},
      comprado: a.comprado,
      produtoEscolhidoId: a.produtoEscolhidoId ?? null,
      vitrines: a.vitrines.map((v) => ({ id: v.id, titulo: v.titulo, icone: v.icone, termos: v.termosBusca })),
      favoritos: (a.favoritos ?? []).slice(0, MAX_FAVORITOS),
      perfil: a.perfil ?? {},
    })),
  };
}

/** Back from storage (local or account), every field checked. */
export function lerGuardado(bruto: unknown): EstadoAmigoSecreto {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const base = estadoVazio();
  const amigos: Amigo[] = (Array.isArray(o["amigos"]) ? o["amigos"] : []).slice(0, 40).flatMap((x: Record<string, unknown>) => {
    const nome = str(x?.["nome"], 40).trim();
    if (!nome) return [];
    const t = (x["tamanhosIdentificados"] ?? {}) as Record<string, unknown>;
    return [
      {
        id: str(x["id"], 20) || novoId(),
        nome,
        desejosTexto: str(x["desejosTexto"], 600),
        orcamentoMin: valor(x["orcamentoMin"]),
        orcamentoMax: valor(x["orcamentoMax"]),
        tamanhosIdentificados: {
          roupa: str(t["roupa"], 4) || null,
          calcado: str(t["calcado"], 2) || null,
          observacoes: str(t["observacoes"], 80) || null,
        },
        comprado: x["comprado"] === true,
        favoritos: lerFavoritos(x["favoritos"]),
        perfil: lerPerfil(x["perfil"]),
        produtoEscolhidoId: str(x["produtoEscolhidoId"], 20) || null,
        vitrines: (Array.isArray(x["vitrines"]) ? x["vitrines"] : []).slice(0, 8).flatMap((v: Record<string, unknown>) => {
          const termos = (Array.isArray(v?.["termos"]) ? v["termos"] : [])
            .map((s) => str(s, 60).trim())
            .filter(Boolean)
            .slice(0, 6);
          const titulo = str(v?.["titulo"], 70).trim();
          if (!titulo || !termos.length) return [];
          return [{ ...novaVitrine({ titulo, icone: str(v["icone"], 4) || "🎁", termos }), id: str(v["id"], 20) || novoId() }];
        }),
      },
    ];
  });
  const min = valor(o["orcamentoPadraoMin"]);
  const max = valor(o["orcamentoPadraoMax"]);
  const ativo = str(o["amigoAtivoId"], 20);
  return {
    orcamentoPadraoMin: min ?? base.orcamentoPadraoMin,
    orcamentoPadraoMax: max ?? base.orcamentoPadraoMax,
    amigos,
    amigoAtivoId: amigos.some((a) => a.id === ativo) ? ativo : (amigos[0]?.id ?? null),
    freteACalcular: o["freteACalcular"] === true,
    faixaEscolhida: o["faixaEscolhida"] === true,
    dataFesta: /^\d{4}-\d{2}-\d{2}$/.test(str(o["dataFesta"], 10)) ? str(o["dataFesta"], 10) : null,
  };
}

const RE_ML = /^https:\/\/(www|produto)\.mercadolivre\.com\.br\//;

/** Hearted cards back from storage: only valid catalog listings. */
export function lerFavoritos(v: unknown): Favorito[] {
  return (Array.isArray(v) ? v : []).slice(0, MAX_FAVORITOS).flatMap((f: Record<string, unknown>) => {
    const produto = str(f?.["produto"], 20);
    const item = str(f?.["item"], 20);
    const url = str(f?.["url"], 300);
    const nome = str(f?.["nome"], 160);
    const imagem = str(f?.["imagem"], 300);
    if (!/^MLB\d+$/.test(produto) || !/^(MLB\d+)?$/.test(item) || !RE_ML.test(url) || !nome) return [];
    return [
      {
        produto,
        item,
        nome,
        url,
        imagem: /^https:\/\/http2\.mlstatic\.com\//.test(imagem) ? imagem : null,
        preco: valor(f["preco"]),
        freteGratis: typeof f["freteGratis"] === "boolean" ? f["freteGratis"] : null,
        favoritadoEm: str(f["favoritadoEm"], 30) || new Date(0).toISOString(),
      },
    ];
  });
}

/** Heart toggle: adds on top, removes when already there. */
export function alternarFavorito(lista: Favorito[] | undefined, r: Favorito): Favorito[] {
  const atual = lista ?? [];
  return atual.some((f) => f.produto === r.produto)
    ? atual.filter((f) => f.produto !== r.produto)
    : [r, ...atual].slice(0, MAX_FAVORITOS);
}

export function lerLocal(): EstadoAmigoSecreto {
  try {
    const s = localStorage.getItem(CHAVE_LOCAL);
    return s ? lerGuardado(JSON.parse(s)) : estadoVazio();
  } catch {
    return estadoVazio();
  }
}

export function salvarLocal(e: EstadoAmigoSecreto) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(paraGuardar(e)));
  } catch {
    /* private window / full storage: the page keeps working in memory */
  }
}

/* The table is outside the generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("amigo_secreto_conta");

export async function lerDaConta(userId: string): Promise<{ estado: EstadoAmigoSecreto; em: string } | null> {
  try {
    const { data, error } = await tabela().select("dados, atualizado_em").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return { estado: lerGuardado(data.dados), em: String(data.atualizado_em ?? "") };
  } catch {
    return null;
  }
}

export async function salvarNaConta(userId: string, e: EstadoAmigoSecreto): Promise<boolean> {
  try {
    const { error } = await tabela().upsert({
      user_id: userId,
      dados: paraGuardar(e),
      atualizado_em: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Account and device together: same person (id) keeps the account version,
    people only on this device are added. */
export function juntarListas(conta: EstadoAmigoSecreto, local: EstadoAmigoSecreto): EstadoAmigoSecreto {
  const ids = new Set(conta.amigos.map((a) => a.id));
  const nomes = new Set(conta.amigos.map((a) => a.nome.toLowerCase()));
  const extras = local.amigos.filter((a) => !ids.has(a.id) && !nomes.has(a.nome.toLowerCase()));
  return { ...conta, amigos: [...conta.amigos, ...extras], amigoAtivoId: conta.amigoAtivoId ?? local.amigoAtivoId };
}
