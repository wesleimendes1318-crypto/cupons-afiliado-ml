/* Same product, other sellers, inside the details drawer (Weslei, 08/11:
   "produtos idênticos mas mais baratos em outros vendedores"). Rows come from
   the comparison table (same-product sellers only), ordered by final cost;
   unknown cost never wins. Every buy ends in his affiliate link (rule no. 1). */
import { useState } from "react";
import { Store } from "lucide-react";

import { VerNaLoja } from "@/components/BuscaPorLink";
import type { VendedorNaTabela } from "@/components/ComparacaoMarketplaces";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { ordenarVendedores } from "@/lib/ficha-detalhes";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OutrosVendedores({
  vendedores,
  atual,
}: {
  vendedores: VendedorNaTabela[];
  /* Row of the open product (its final cost is the savings base). */
  atual: string | null;
}) {
  const [todos, setTodos] = useState(false);
  const lista = ordenarVendedores(vendedores, atual);
  if (!lista.length) return null;
  const base = vendedores.find((v) => v.chave === atual)?.total ?? null;
  const vistos = todos ? lista : lista.slice(0, 4);

  return (
    <section
      aria-label="Mesmo produto em outros vendedores"
      className="space-y-2 rounded-3xl border border-border/60 bg-white p-4 dark:bg-white/5"
    >
      <div>
        <h4 className="flex items-center gap-2 text-[13px] font-bold">
          <Store className="size-4 text-[#0071e3]" aria-hidden="true" />
          Mesmo produto em outros vendedores
        </h4>
        <p className="mt-0.5 text-[11px] text-[#6e6e73]">Do menor para o maior custo final.</p>
      </div>
      <ul className="divide-y divide-border/60">
        {vistos.map((v) => {
          const menos =
            base != null && v.total != null ? Math.round((base - v.total) * 100) / 100 : 0;
          const link = v.link && ehLinkDeAfiliado(v.link) ? v.link : null;
          return (
            <li key={v.chave} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{v.loja}</p>
                <p className="tabular-nums">
                  <strong className="text-[15px]">{brl(v.total ?? v.preco)}</strong>{" "}
                  <span className="text-[11px] text-[#6e6e73]">
                    {v.total == null ? "+ frete" : v.freteGratis ? "frete grátis" : "com frete"}
                  </span>
                </p>
                {menos >= 1 && (
                  <span className="mt-0.5 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-[#248a3d]">
                    {brl(menos)} a menos
                  </span>
                )}
              </div>
              <div className="w-[7.5rem] shrink-0">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    data-origem="detalhes_vendedores"
                    className="flex min-h-11 w-full items-center justify-center rounded-full bg-success px-3 text-center text-[13px] font-bold leading-tight text-white hover:brightness-95"
                  >
                    Comprar com segurança ↗
                  </a>
                ) : (
                  <VerNaLoja url={v.urlLoja as string} cartao />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {lista.length > 4 && (
        <button
          type="button"
          onClick={() => setTodos((x) => !x)}
          className="font-semibold text-[#0058b0] hover:underline"
        >
          {todos ? "Mostrar menos" : `Ver todos os ${lista.length} vendedores`}
        </button>
      )}
    </section>
  );
}
