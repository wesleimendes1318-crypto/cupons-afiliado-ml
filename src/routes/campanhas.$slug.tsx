import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { useState } from "react";

import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { campanhaDoBanco, ofertasDaCampanha, SecaoCampanha } from "@/components/VitrineSazonal";
import { supabase } from "@/integrations/supabase/client";
import { useRevalidarAoVoltar, type CampanhaPublica } from "@/lib/campanhas-publicas";

/* PÁGINA DE UMA CAMPANHA DO BANCO (Weslei, 09/10). Ativa: os achados
   curados. Vencida (ou vencendo com a aba aberta): "Esta campanha encerrou
   recentemente", sem produtos nem compra, em vez de página de erro.
   Futura: só a data de início. Campanha que não existe: 404. As do
   calendário com página própria (/natal, /dia-das-criancas) seguem lá. */

type CampanhaPagina = Omit<CampanhaPublica, "fonte" | "nacional" | "link_afiliado_campanha"> & {
  estado: "ativa" | "encerrada" | "futura" | "pausada";
};

const PAGINA_DA_TEMPORADA: Record<string, "/natal" | "/dia-das-criancas"> = {
  natal: "/natal",
  criancas: "/dia-das-criancas",
};

const SITE = "https://melhorescolha.io";

export const Route = createFileRoute("/campanhas/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase.rpc(
      "campanha_publica" as never,
      { p_slug: params.slug } as never,
    );
    const c = Array.isArray(data) ? (data[0] as CampanhaPagina | undefined) : undefined;
    if (!c) throw notFound();
    return { c };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.c;
    const titulo = c ? `${c.nome} — Melhor Escolha` : "Campanha — Melhor Escolha";
    const descricao =
      c?.estado === "ativa"
        ? (c.beneficio_texto ?? "Produtos já comparados entre as lojas.")
        : "Esta campanha encerrou recentemente. Compare qualquer produto colando o link.";
    const url = `${SITE}/campanhas/${params.slug}`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:url", content: url },
        ...(c?.estado === "ativa" ? [] : [{ name: "robots", content: "noindex, follow" }]),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PaginaCampanha,
});

function PaginaCampanha() {
  const { c } = Route.useLoaderData();
  /* Aba aberta passando do fim: ao voltar depois de 10 min, encerra. */
  const [venceu, setVenceu] = useState(() => Date.parse(c.termina_em) <= Date.now());
  useRevalidarAoVoltar(() => setVenceu(Date.parse(c.termina_em) <= Date.now()));
  const estado = venceu ? "encerrada" : c.estado;
  const daTemporada = c.temporada ? PAGINA_DA_TEMPORADA[c.temporada] : undefined;
  const publica: CampanhaPublica = {
    ...c,
    fonte: c.temporada ? "calendario" : "tendencia",
    nacional: true,
    link_afiliado_campanha: null,
  };
  const lista = estado === "ativa" ? ofertasDaCampanha(publica) : [];

  return (
    <div className="fundo-conteudo min-h-screen">
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {estado === "ativa" && lista.length > 0 ? (
          <>
            <SecaoCampanha
              c={{
                ...campanhaDoBanco(publica, false),
                ...(daTemporada ? { pagina: daTemporada } : {}),
              }}
              lista={lista}
              total={lista.length}
              naHome={false}
            />
            {c.regras_resumo && (
              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-secondary-ink">
                {c.regras_resumo}
              </p>
            )}
          </>
        ) : (
          <section className="mx-auto max-w-2xl rounded-3xl border border-black/5 bg-card p-6 text-center shadow-sm sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary-ink">
              {c.nome}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {estado === "futura"
                ? `Começa em ${new Date(c.inicia_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                : estado === "pausada"
                  ? "Esta campanha está pausada no momento"
                  : estado === "ativa"
                    ? "Os achados desta campanha estão sendo conferidos"
                    : "Esta campanha encerrou recentemente"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-secondary-ink">
              Os produtos comparados continuam na vitrine do site. Cole o link de qualquer produto e
              eu mostro o mesmo produto em outras lojas, do mais barato ao mais caro.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-bold text-white hover:brightness-110"
            >
              <Link2 className="size-4" aria-hidden="true" />
              Comparar o meu produto
            </Link>
          </section>
        )}
        <p className="mt-6 text-xs text-secondary-ink">
          Site independente, sem vínculo com o Mercado Livre. Recebo comissão do programa de
          afiliados, sem custo para você.
        </p>
      </main>
      <RodapeInstitucional />
    </div>
  );
}
