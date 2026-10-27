/* SUGESTÕES ENQUANTO DIGITA (Weslei, 27/10). Lista suspensa sob o campo da
   home e o do cabeçalho: recentes do aparelho, buscas sugeridas, produtos já
   comparados ou em alta (foto e preço visto) e categorias. Tudo do que o
   site já tem, lido uma vez por visita: nenhuma consulta por letra digitada.
   Teclado: setas escolhem, Enter abre, Esc fecha; toque no celular. */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "@tanstack/react-router";
import { History, LayoutGrid, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  obterSugestoes,
  type ProdutoConhecido,
  type RecenteConhecido,
  type Sugestao,
} from "@/lib/busca-sugestoes";

const ESPERA_MS = 180;

/* Vitrine (produtos já comparados) + mais vendidos em alta, uma vez por
   visita. Também é a resposta imediata da busca por texto (27/10). */
let produtosDaVisita: Promise<ProdutoConhecido[]> | null = null;
export function carregarProdutos(): Promise<ProdutoConhecido[]> {
  produtosDaVisita ??= (async () => {
    const [vitrine, emAlta] = await Promise.all([
      supabase.rpc("vitrine" as never, { p_limite: 120 } as never),
      supabase
        .rpc(
          "em_alta_por_categoria_v3" as never,
          { p_categoria: null, p_por_categoria: 40 } as never,
        )
        .range(0, 999),
    ]);
    const v = (Array.isArray(vitrine.data) ? vitrine.data : []) as Array<{
      titulo: string | null;
      imagem: string | null;
      preco: number | null;
      url_produto: string | null;
      link: string | null;
      melhor_link: string | null;
      visto_em: string | null;
    }>;
    const e = (Array.isArray(emAlta.data) ? emAlta.data : []) as Array<{
      nome: string | null;
      imagem: string | null;
      preco: number | null;
      url: string | null;
      atualizado_em: string | null;
      frete_gratis: boolean | null;
    }>;
    return [
      ...v.map((i) => ({
        titulo: i.titulo,
        imagem: i.imagem,
        preco: i.preco,
        url: i.url_produto,
        link: i.link,
        outroLink: i.melhor_link,
        vistoEm: i.visto_em,
      })),
      ...e.map((i) => ({
        titulo: i.nome,
        imagem: i.imagem,
        preco: i.preco,
        url: i.url,
        vistoEm: i.atualizado_em,
        freteGratis: i.frete_gratis,
      })),
    ]
      .filter((i) => Boolean(i.titulo && i.url))
      .map((i) => ({ ...i, preco: i.preco != null ? Number(i.preco) : null }) as ProdutoConhecido);
  })().catch(() => {
    produtosDaVisita = null;
    return [];
  });
  return produtosDaVisita;
}

/* As últimas comparações deste aparelho (as mesmas de "Buscas recentes"). */
function lerRecentes(): RecenteConhecido[] {
  try {
    const lista = JSON.parse(window.localStorage.getItem("me_historico_v1") ?? "[]");
    return Array.isArray(lista) ? (lista as RecenteConhecido[]) : [];
  } catch {
    return [];
  }
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Estado da lista para um campo. `buscar` recebe o link (recente/produto)
    ou o texto (busca sugerida); categoria abre a página dela. */
export function useSugestoesBusca(valor: string, buscar: (alvo: string) => void) {
  const router = useRouter();
  const id = useId();
  const area = useRef<HTMLElement | null>(null);
  const caixa = useCallback((el: HTMLElement | null) => {
    area.current = el;
  }, []);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [produtos, setProdutos] = useState<ProdutoConhecido[]>([]);
  const [recentes, setRecentes] = useState<RecenteConhecido[]>([]);
  const [termo, setTermo] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setTermo(valor), ESPERA_MS);
    return () => clearTimeout(t);
  }, [valor]);

  const lista = useMemo(
    () => (aberto ? obterSugestoes(termo, { produtos, recentes }) : []),
    [aberto, termo, produtos, recentes],
  );
  useEffect(() => setAtivo(-1), [lista]);

  /* Toque ou clique fora fecha. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const abrir = () => {
    if (!aberto) setRecentes(lerRecentes());
    setAberto(true);
    void carregarProdutos().then(setProdutos);
  };

  const escolher = (s: Sugestao) => {
    setAberto(false);
    if (s.tipo === "categoria") {
      void router.navigate({ to: "/categorias/$slug", params: { slug: s.slug } });
      return;
    }
    buscar(s.tipo === "termo" ? s.texto : s.url);
  };

  /** true quando a tecla foi usada pela lista (quem chama não faz mais nada). */
  const teclar = (e: KeyboardEvent): boolean => {
    if (e.key === "Escape" && aberto) {
      setAberto(false);
      return true;
    }
    if (!lista.length) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = lista.length;
      setAtivo((a) => (e.key === "ArrowDown" ? (a + 1) % n : a <= 0 ? n - 1 : a - 1));
      return true;
    }
    if (e.key === "Enter" && ativo >= 0 && lista[ativo]) {
      e.preventDefault();
      escolher(lista[ativo]);
      return true;
    }
    return false;
  };

  const idLista = `${id}-sugestoes`;
  return {
    caixa,
    lista,
    ativo,
    setAtivo,
    escolher,
    abrir,
    fechar: () => setAberto(false),
    teclar,
    idLista,
    idOpcao: (i: number) => `${id}-op-${i}`,
    /* Atributos de combobox para o campo. */
    propsCampo: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": lista.length > 0,
      "aria-controls": idLista,
      "aria-activedescendant": ativo >= 0 ? `${id}-op-${ativo}` : undefined,
    },
  };
}

const SECOES: Record<Sugestao["tipo"], string> = {
  recente: "Buscas recentes",
  termo: "Buscas sugeridas",
  produto: "Produtos em destaque",
  categoria: "Categorias",
};

export function SugestoesBusca({
  estado,
  className = "",
}: {
  estado: ReturnType<typeof useSugestoesBusca>;
  className?: string;
}) {
  const { lista, ativo, setAtivo, escolher, idLista, idOpcao } = estado;
  if (!lista.length) return null;
  return (
    <ul
      id={idLista}
      role="listbox"
      aria-label="Sugestões de busca"
      className={
        "absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70vh,460px)] overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.06] bg-white/95 p-1.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none dark:border-white/10 dark:bg-neutral-900/95 " +
        className
      }
    >
      {lista.map((s, i) => {
        const titulo = i === 0 || lista[i - 1]!.tipo !== s.tipo ? SECOES[s.tipo] : null;
        return (
          <li key={`${s.tipo}-${i}`} role="presentation">
            {titulo && (
              <p
                role="presentation"
                className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#86868b]"
              >
                {titulo}
              </p>
            )}
            <div
              id={idOpcao(i)}
              role="option"
              aria-selected={i === ativo}
              onPointerEnter={() => setAtivo(i)}
              /* Sem tirar o foco do campo antes do clique. */
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(s)}
              className={
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-[15px] text-[#1d1d1f] dark:text-white " +
                (i === ativo ? "bg-[#0071e3]/10" : "")
              }
            >
              {s.tipo === "produto" || s.tipo === "recente" ? (
                s.imagem ? (
                  <img
                    src={s.imagem}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-lg bg-white object-contain"
                  />
                ) : (
                  <History className="size-4 shrink-0 text-[#86868b]" aria-hidden="true" />
                )
              ) : s.tipo === "categoria" ? (
                <LayoutGrid className="size-4 shrink-0 text-[#0071e3]" aria-hidden="true" />
              ) : (
                <Search className="size-4 shrink-0 text-[#86868b]" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1">
                  {s.tipo === "categoria" ? `Ir para ${s.texto}` : s.texto}
                </span>
                {s.tipo === "produto" && s.preco != null && s.preco > 0 && (
                  <span className="block text-[12px] tabular-nums text-[#6e6e73]">
                    Visto por {brl(s.preco)} · toque para comparar agora
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
