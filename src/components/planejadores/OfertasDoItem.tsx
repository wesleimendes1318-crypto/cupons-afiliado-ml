/* Offers of one planner item: the same catalog search and card as Amigo
   Secreto (CartaoBusca: real photo, price, shipping line, "Comprar com
   segurança" through the affiliate link generated on click). The corner
   button adds or removes the product (several per item, Weslei 06/11).
   Rail: snap scroll, glass arrows from sm, edge fades, skeletons while
   loading (Weslei 06/11: "melhore a vitrine e os efeitos de carregamento e
   navegação"). */
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BotaoCarregarMaisVitrine } from "@/components/AmigoSecreto/BotaoCarregarMaisVitrine";
import { CartoesDeEspera } from "@/components/AmigoSecreto/EsperaVitrine";
import { abrirComparacao } from "@/components/BotoesCartao";
import { CartaoBusca, doCatalogo } from "@/components/BuscaGuiada";
import {
  carregarAte,
  idsDoResultado,
  lerPaginaDoTermo,
  passosIniciais,
  type PassoTermo,
} from "@/lib/amigo-secreto-busca";
import type { Resultado } from "@/lib/busca-guiada-cliente";
import { ordenarOfertas, serveNaVoltagem, type Estilo, type ItemPlano } from "@/lib/planejadores";

const FAIXA = { min: null, max: null, freteACalcular: true };

export function OfertasDoItem({
  item,
  estilo,
  volts,
  escolhidosIds,
  aoEscolher,
}: {
  item: ItemPlano;
  estilo: Estilo;
  volts: "127" | "220" | null;
  escolhidosIds: string[];
  aoEscolher: (r: Resultado) => void;
}) {
  const [produtos, setProdutos] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [temMais, setTemMais] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const passos = useRef<PassoTermo[]>(passosIniciais(item.termos));
  const vistos = useRef(new Set<string>());
  const vivo = useRef(true);
  const trilho = useRef<HTMLUListElement>(null);
  const [borda, setBorda] = useState({ ini: true, fim: false });
  const medirBorda = () => {
    const t = trilho.current;
    if (!t) return;
    setBorda({ ini: t.scrollLeft < 8, fim: t.scrollLeft + t.clientWidth >= t.scrollWidth - 8 });
  };
  const rolar = (dir: 1 | -1) => {
    const t = trilho.current;
    if (!t) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: suave ? "smooth" : "auto" });
  };

  /* Stage 1 (Weslei, 06/11: "resultados rápidos enquanto busca novos"):
     listings the site already stored for these terms show at once. */
  const doEstoque = async () => {
    const respostas = await Promise.all(
      passosIniciais(item.termos).map((p) => lerPaginaDoTermo(p, FAIXA, [], true)),
    );
    if (!vivo.current) return;
    const novos = respostas
      .flatMap((r) => r.resposta?.resultados ?? [])
      .filter((x) => {
        const ids = idsDoResultado(x);
        if (!ids.length || ids.some((id) => vistos.current.has(id))) return false;
        if (!serveNaVoltagem(x, volts, item.eletrico)) return false;
        ids.forEach((id) => vistos.current.add(id));
        return true;
      });
    if (novos.length) setProdutos((p) => [...novos, ...p]);
  };

  const carregar = async (primeira = false) => {
    setCarregando(true);
    setErro(null);
    if (primeira) await doEstoque();
    if (!vivo.current) return;
    const r = await carregarAte({
      passos: passos.current,
      faixa: FAIXA,
      vistos: vistos.current,
      alvo: 12,
      maxChamadas: 9,
      aprovar: (x) => serveNaVoltagem(x, volts, item.eletrico),
      cancelado: () => !vivo.current,
      aoChegar: (novos) => vivo.current && setProdutos((p) => [...p, ...novos]),
    });
    if (!vivo.current) return;
    passos.current = r.passos;
    setTemMais(r.passos.some((p) => !p.fim));
    setErro(r.erro);
    setCarregando(false);
  };

  useEffect(() => {
    vivo.current = true;
    void carregar(true);
    return () => {
      vivo.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = ordenarOfertas(produtos, estilo);
  const n = lista.length;
  const marcados = escolhidosIds.length;
  // re-measure the edges when cards arrive
  useEffect(medirBorda, [n]);
  return (
    <div className="min-w-0">
      <p className="text-xs text-secondary-ink" aria-live="polite">
        {carregando && !n
          ? "Procurando as melhores ofertas…"
          : n
            ? `${n} ${n === 1 ? "opção" : "opções"}${item.eletrico && volts ? ` que funcionam em ${volts} V ou bivolt` : ""}. ${marcados ? `${marcados} ${marcados === 1 ? "escolhida" : "escolhidas"}. ` : ""}Toque em + para escolher quantas quiser.`
            : (erro ?? "Ainda não achamos ofertas para este item.")}
      </p>
      {n > 0 || carregando ? (
        <div className="relative">
          <ul
            ref={trilho}
            onScroll={medirBorda}
            className="-mx-4 mt-2 grid snap-x snap-mandatory scroll-px-4 auto-cols-[11.5rem] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] sm:auto-cols-[13.5rem] [&::-webkit-scrollbar]:hidden [&>li]:snap-start"
          >
            {lista.map((r, k) => {
              const ativo = escolhidosIds.includes(r.item || r.produto);
              return (
                <CartaoBusca
                  key={r.item || r.produto}
                  c={doCatalogo(r, undefined)}
                  indice={k}
                  resumo={undefined}
                  comparar={abrirComparacao}
                  canto={
                    <button
                      type="button"
                      aria-pressed={ativo}
                      aria-label={ativo ? "Produto escolhido" : `Escolher para ${item.nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        aoEscolher(r);
                      }}
                      className={
                        "grid size-11 place-items-center rounded-full shadow-sm transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
                        (ativo ? "bg-[#34c759] text-white" : "vidro-botao text-[#0071e3]")
                      }
                    >
                      {ativo ? (
                        <Check className="size-5" aria-hidden="true" />
                      ) : (
                        <Plus className="size-5" aria-hidden="true" />
                      )}
                    </button>
                  }
                />
              );
            })}
            {carregando && <CartoesDeEspera quantos={n < 3 ? 3 : 2} />}
          </ul>
          {/* edge fades: there is more to the side */}
          <span
            aria-hidden="true"
            className={
              "pointer-events-none absolute inset-y-0 -left-4 w-8 bg-gradient-to-r from-card to-transparent transition-opacity duration-300 " +
              (borda.ini ? "opacity-0" : "opacity-100")
            }
          />
          <span
            aria-hidden="true"
            className={
              "pointer-events-none absolute inset-y-0 -right-4 w-8 bg-gradient-to-l from-card to-transparent transition-opacity duration-300 " +
              (borda.fim ? "opacity-0" : "opacity-100")
            }
          />
          {(
            [
              [-1, borda.ini, "Ofertas anteriores", ChevronLeft, "left-0"],
              [1, borda.fim, "Mais ofertas", ChevronRight, "right-0"],
            ] as const
          ).map(([dir, escondida, rotulo, Icone, lado]) => (
            <button
              key={dir}
              type="button"
              aria-label={rotulo}
              tabIndex={escondida ? -1 : 0}
              onClick={() => rolar(dir)}
              className={
                "vidro-botao absolute top-[30%] z-10 hidden size-11 place-items-center rounded-full text-foreground shadow-md transition duration-300 active:scale-90 sm:grid " +
                lado +
                (escondida ? " pointer-events-none scale-90 opacity-0" : " opacity-100")
              }
            >
              <Icone className="size-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      {!carregando && temMais && n > 0 && (
        <BotaoCarregarMaisVitrine
          carregando={false}
          aoCarregar={() => void carregar()}
          rotulo="Ver mais opções"
        />
      )}
    </div>
  );
}
