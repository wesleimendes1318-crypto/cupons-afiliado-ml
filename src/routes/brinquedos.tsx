import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BannerArte } from "@/components/BannerArte";
import { ARTES } from "@/lib/artes";
import { BrinquedosPorIdade, type ItemBrinquedo } from "@/components/BrinquedosPorIdade";
import { BuscaGuiada } from "@/components/BuscaGuiada";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { supabase } from "@/integrations/supabase/client";
import { FAIXAS, pareceBrinquedo } from "@/lib/brinquedos";

/* Página dos brinquedos por idade (05/10): a lista vem do servidor para
   sair no HTML (busca do Google) e se atualiza no navegador. */

const URL = "https://melhorescolha.io/brinquedos";
const TITULO = "Brinquedos por idade com o menor preço conferido | Melhor Escolha";
const DESCRICAO =
  "Brinquedos mais vendidos e as melhores escolhas para bebês, 3 a 5, 6 a 8 e 9 a 12 anos, já comparados entre as lojas do Mercado Livre. Inclui opções até R$ 30 para doação, com o frete indicado.";

const PERGUNTAS = [
  {
    pergunta: "Como escolher um brinquedo pela idade?",
    resposta:
      "Confira a idade mínima indicada pelo fabricante. Para menores de 3 anos, evite peças pequenas que soltam. Na lista, cada brinquedo mostra a idade informada no catálogo quando ela existe.",
  },
  {
    pergunta: 'O que quer dizer "Menor preço encontrado"?',
    resposta:
      "Que este anúncio era a oferta nova mais barata entre as ofertas do mesmo produto no catálogo quando foi comparado, e nenhuma outra loja tinha o mesmo produto mais barato. O frete aparece à parte em cada cartão.",
  },
  {
    pergunta: "Quais brinquedos servem para doação?",
    resposta:
      'Na aba "Doação (até R$ 30)" ficam os brinquedos de até R$ 30, do mais barato ao mais caro. Para muitas crianças, um brinquedo simples já é simbólico.',
  },
];

export const Route = createFileRoute("/brinquedos")({
  loader: async () => {
    try {
      const { data } = await supabase.rpc("curadoria_brinquedos" as never);
      return {
        itens: Array.isArray(data)
          ? (data as ItemBrinquedo[]).filter((i) => pareceBrinquedo(i.nome ?? ""))
          : [],
      };
    } catch {
      return { itens: [] as ItemBrinquedo[] };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://melhorescolha.io/sazonal/criancas.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Brinquedos por idade com o menor preço conferido",
          url: URL,
          inLanguage: "pt-BR",
          description: DESCRICAO,
          isPartOf: {
            "@type": "WebSite",
            name: "Melhor Escolha",
            url: "https://melhorescolha.io/",
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: Math.min(loaderData?.itens.length ?? 0, 30),
            itemListElement: (loaderData?.itens ?? []).slice(0, 30).map((i, k) => ({
              "@type": "ListItem",
              position: k + 1,
              name: i.nome,
            })),
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: "https://melhorescolha.io/" },
            { "@type": "ListItem", position: 2, name: "Brinquedos por idade", item: URL },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PERGUNTAS.map((p) => ({
            "@type": "Question",
            name: p.pergunta,
            acceptedAnswer: { "@type": "Answer", text: p.resposta },
          })),
        }),
      },
    ],
  }),
  component: PaginaBrinquedos,
});

function PaginaBrinquedos() {
  const { itens } = Route.useLoaderData();
  return (
    <div className="fundo-conteudo min-h-screen">
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para o comparador
        </Link>
        <BannerArte
          arte={ARTES["brinquedos-aprender"]}
          etiqueta="Brinquedos"
          titulo="Brinquedos por idade com o menor preço conferido"
          resumo="Os mais vendidos e as melhores escolhas por idade, já comparados com as outras lojas. Inclui opções até R$ 30 para doação."
          prioridade
          className="mt-4"
        />
        <BrinquedosPorIdade inicial={itens} titulo="oculto" className="mt-4" />
        <BuscaGuiada contexto="criancas" className="mt-8" />

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {FAIXAS.map((f) => (
            <div key={f.id} className="rounded-3xl border border-border bg-card p-5">
              <h2 className="text-base font-bold">{f.nome}</h2>
              <p className="mt-1 text-sm text-secondary-ink">{f.dica}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight">Perguntas frequentes</h2>
          <dl className="mt-3 space-y-4">
            {PERGUNTAS.map((p) => (
              <div key={p.pergunta}>
                <dt className="font-semibold">{p.pergunta}</dt>
                <dd className="mt-1 text-sm text-secondary-ink">{p.resposta}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm">
            Veja também:{" "}
            <Link to="/dia-das-criancas" className="font-semibold text-[#0071e3] hover:underline">
              Dia das Crianças
            </Link>
            {" · "}
            <Link to="/natal" className="font-semibold text-[#0071e3] hover:underline">
              Presentes de Natal
            </Link>
            {" · "}
            <Link
              to="/categorias/$slug"
              params={{ slug: "brinquedos" }}
              className="font-semibold text-[#0071e3] hover:underline"
            >
              Como escolher brinquedos
            </Link>
          </p>
          <p className="mt-3 text-xs text-secondary-ink">
            Site independente, sem vínculo com o Mercado Livre. Recebo comissão do programa de
            afiliados, sem custo para você.
          </p>
        </section>
      </main>
      <RodapeInstitucional />
    </div>
  );
}
