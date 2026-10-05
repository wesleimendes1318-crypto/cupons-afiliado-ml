/* "VER DETALHES" NOS CARTÕES DA VITRINE (Weslei, 05/10: "dê a opção de
   expandir o anúncio para analisar detalhes, descrição, características").
   Abre um painel com o que a comparação leu no anúncio: foto, título,
   características, destaques e descrição (RPC pública detalhes_da_vitrine).
   Preço é o de quando foi comparado, com a data. O botão de compra só aparece
   com link de afiliado (meli.la). Nada é inventado: sem detalhes guardados,
   o painel diz isso e oferece comparar de novo. */
import { useEffect, useRef, useState } from "react";
import { Info, LoaderCircle, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";

type Carac = { nome: string; valor: string };
type Detalhes = {
  caracteristicas?: Carac[] | null;
  destaques?: string[] | null;
  descricao?: string | null;
};
type Resposta = {
  titulo: string | null;
  imagem: string | null;
  detalhes: Detalhes | null;
  comparado_em: string | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cache = new Map<string, Resposta | null>();

const dataCurta = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;

export function VerDetalhesVitrine({
  chave,
  titulo,
  imagem,
  preco,
  link,
  vistoEm,
  className = "",
}: {
  chave: string;
  titulo: string;
  imagem?: string | null;
  preco?: number | null;
  link?: string | null;
  vistoEm?: string | null;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!/^MLB\d{5,}$/.test(chave)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-[#0058b0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${className}`}
      >
        <Info className="size-3.5" aria-hidden="true" />
        Ver detalhes do anúncio
      </button>
      {aberto && (
        <Painel
          chave={chave}
          titulo={titulo}
          imagem={imagem ?? null}
          preco={preco ?? null}
          link={link ?? null}
          vistoEm={vistoEm ?? null}
          fechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function Painel({
  chave,
  titulo,
  imagem,
  preco,
  link,
  vistoEm,
  fechar,
}: {
  chave: string;
  titulo: string;
  imagem: string | null;
  preco: number | null;
  link: string | null;
  vistoEm: string | null;
  fechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [dados, setDados] = useState<Resposta | null | undefined>(cache.get(chave));
  const [descricaoToda, setDescricaoToda] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    if (cache.has(chave)) return;
    let vivo = true;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("detalhes_da_vitrine", { p_chave: chave });
        const r = (Array.isArray(data) ? data[0] : null) as Resposta | null;
        cache.set(chave, r ?? null);
        if (vivo) setDados(r ?? null);
      } catch {
        if (vivo) setDados(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave]);

  const det = dados?.detalhes ?? null;
  const carac = (det?.caracteristicas ?? []).filter((c) => c && c.nome && c.valor);
  const dest = (det?.destaques ?? []).filter(Boolean);
  const descricao = (det?.descricao ?? "").trim();
  const longa = descricao.length > 420;
  const foto = imagem ?? dados?.imagem ?? null;
  const data = dataCurta(vistoEm ?? dados?.comparado_em ?? null);

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby={`det-${chave}`}
      className="m-auto max-h-[88vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-white p-0 text-[#1d1d1f] shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-[#f5f5f7]">
            {foto && (
              <img
                src={foto}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-contain p-1.5 mix-blend-multiply"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={`det-${chave}`} className="text-[15px] font-bold leading-snug">
              {titulo}
            </h3>
            {preco != null && (
              <p className="mt-1 text-lg font-extrabold tabular-nums">
                {brl(preco)}
                {data && (
                  <span className="ml-1.5 text-[11px] font-medium text-[#6e6e73]">
                    preço de {data}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] focus-visible:outline-2 focus-visible:outline-[#0071e3]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-[13px]">
          {dados === undefined ? (
            <p className="flex items-center gap-2 text-[#6e6e73]">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Carregando os detalhes do anúncio…
            </p>
          ) : !det || (!carac.length && !dest.length && !descricao) ? (
            <p className="rounded-2xl bg-[#f5f5f7] p-3 text-[#424245]">
              Ainda não tenho os detalhes deste anúncio. Use "Atualizar preço" para comparar de novo
              e ver as características.
            </p>
          ) : (
            <>
              {dest.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
                    Destaques
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {dest.slice(0, 12).map((d, k) => (
                      <li key={k}>{d}</li>
                    ))}
                  </ul>
                </section>
              )}
              {carac.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
                    Características
                  </h4>
                  <table className="mt-1.5 w-full border-collapse overflow-hidden rounded-xl">
                    <tbody>
                      {carac.slice(0, 40).map((c, k) => (
                        <tr key={k} className={k % 2 ? "bg-white" : "bg-[#f5f5f7]"}>
                          <th className="w-2/5 px-2 py-1 text-left align-top font-semibold text-[#6e6e73]">
                            {c.nome}
                          </th>
                          <td className="px-2 py-1 align-top [overflow-wrap:anywhere]">
                            {c.valor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {descricao && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
                    Descrição do anúncio
                  </h4>
                  <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#424245]">
                    {longa && !descricaoToda ? descricao.slice(0, 420).trimEnd() + "…" : descricao}
                  </p>
                  {longa && (
                    <button
                      type="button"
                      onClick={() => setDescricaoToda((x) => !x)}
                      className="mt-1 font-bold text-[#0058b0] hover:underline"
                    >
                      {descricaoToda ? "Mostrar menos" : "Ler descrição completa"}
                    </button>
                  )}
                </section>
              )}
              <p className="text-[11px] text-[#6e6e73]">
                Informações lidas no anúncio quando ele foi comparado. Confira no anúncio antes de
                comprar.
              </p>
            </>
          )}
        </div>

        {link && ehLinkDeAfiliado(link) && (
          <div className="border-t border-border p-4">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="vitrine_detalhes"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-success py-2.5 text-sm font-bold text-white transition hover:brightness-95"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Comprar com segurança
            </a>
          </div>
        )}
      </div>
    </dialog>
  );
}
