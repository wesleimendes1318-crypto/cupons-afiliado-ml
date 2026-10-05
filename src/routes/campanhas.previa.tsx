import { createFileRoute } from "@tanstack/react-router";

import { ArteCampanha } from "@/components/ArteCampanha";
import {
  CartaoCampanhaCompacta,
  daTemporada,
  SecaoCampanha,
  temaDaCampanha,
  useOfertas,
  type CampanhaVitrine,
} from "@/components/VitrineSazonal";
import { TEMPORADAS } from "@/lib/sazonal";
import { identificarTema, TEMAS_VISUAIS, type TemaVisualId } from "@/lib/campanha-visual";

/* PRÉVIA DO SISTEMA VISUAL DAS CAMPANHAS (05/10): artes de cada tema e a
   identificação de tema em campanhas de exemplo. Página de conferência
   (noindex, fora do sitemap); não mostra preço nem botão de compra. */

const EXEMPLOS = [
  {
    nome: "Dia das Crianças (configurado)",
    conteudo: { temaConfigurado: "criancas" as TemaVisualId, nome: "Dia das Crianças" },
  },
  {
    nome: "Semana da Tecnologia (sem tema configurado)",
    conteudo: {
      nome: "Semana da Tecnologia",
      descricao: "Ofertas de eletrônicos",
      produtos: [
        "Fone JBL Tune 520BT",
        "Smartwatch Amazfit Bip 5",
        "Caixa de Som JBL Go 4",
        "Kit 30 Cabides",
      ],
    },
  },
  {
    nome: "Ofertas de outubro (sem tema e sem pistas)",
    conteudo: {
      nome: "Ofertas de outubro",
      produtos: ["Kit 30 Cabides", "Garrafa Térmica 1L", "Mochila Escolar"],
    },
  },
  {
    nome: "Achados da semana: metade brinquedos, metade casa (o calendário desempata com 1 ponto)",
    conteudo: {
      nome: "Achados da semana",
      produtos: [
        "Boneca Baby Alive",
        "Jogo de Cama Casal",
        "Carrinho Hot Wheels",
        "Tapete para Sala",
      ],
    },
  },
];

export const Route = createFileRoute("/campanhas/previa")({
  head: () => ({
    meta: [
      { title: "Prévia das campanhas — Melhor Escolha" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Previa,
});

/* Campanhas de exemplo SEM tema configurado: o tema sai do conteúdo. */
const TECNOLOGIA: CampanhaVitrine = {
  id: "previa-tecnologia",
  nome: "Semana da Tecnologia",
  inicio: "2026-10-01",
  fim: "2026-10-31",
  dia: "2026-10-31",
};
const SEM_TEMA: CampanhaVitrine = {
  id: "previa-neutra",
  nome: "Achados de outubro",
  inicio: "2026-10-01",
  fim: "2026-10-31",
  dia: "2026-10-31",
};
const RE_TECNOLOGIA = /\b(fone|jbl|smartwatch|caixa de som|notebook|celular|tablet|monitor)\b/i;

function Secoes() {
  const { ofertas } = useOfertas();
  const criancas = TEMPORADAS.find((t) => t.id === "criancas")!;
  const bf = TEMPORADAS.find((t) => t.id === "black_friday")!;
  const listaCriancas = daTemporada(criancas, ofertas).slice(0, 5);
  const listaTec = ofertas.filter((o) => RE_TECNOLOGIA.test(o.titulo)).slice(0, 5);
  const listaNeutra = ofertas
    .filter((o) => !RE_TECNOLOGIA.test(o.titulo) && !listaCriancas.includes(o))
    .slice(0, 4);
  const casos: Array<[string, CampanhaVitrine, typeof ofertas]> = [
    ["Dia das Crianças (tema configurado)", criancas, listaCriancas],
    ["Semana da Tecnologia (sem tema: identificado pelos produtos)", TECNOLOGIA, listaTec],
    ["Achados de outubro (sem tema e sem pistas: neutro da marca)", SEM_TEMA, listaNeutra],
  ];
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold">Seções completas</h2>
      {casos.map(([rotulo, c, lista]) => (
        <div key={c.id} className="space-y-2">
          <p className="text-sm font-semibold text-secondary-ink">
            {rotulo}: tema {TEMAS_VISUAIS[temaDaCampanha(c, lista).tema].nome} (
            {temaDaCampanha(c, lista).fonte})
          </p>
          <SecaoCampanha c={c} lista={lista} total={lista.length} naHome={false} />
        </div>
      ))}
      <p className="text-sm font-semibold text-secondary-ink">
        Black Friday antes da campanha (só contagem)
      </p>
      <CartaoCampanhaCompacta c={bf} futura />
    </section>
  );
}

function Previa() {
  return (
    <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold">Prévia do sistema visual das campanhas</h1>
      <Secoes />
      <section>
        <h2 className="text-lg font-bold">Identificação de tema</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {EXEMPLOS.map((e) => {
            const r = identificarTema(e.conteudo);
            return (
              <li key={e.nome} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-semibold">{e.nome}</p>
                <p className="mt-1">
                  Tema: <strong>{TEMAS_VISUAIS[r.tema].nome}</strong> ({r.fonte})
                </p>
                <p className="text-secondary-ink">Pontos: {JSON.stringify(r.pontos)}</p>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-bold">Artes por tema</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(TEMAS_VISUAIS) as TemaVisualId[]).map((id) => (
            <li
              key={id}
              data-tema={id}
              className="overflow-hidden rounded-3xl border border-border"
              style={{
                background: TEMAS_VISUAIS[id].paleta.fundo,
                color: TEMAS_VISUAIS[id].paleta.texto,
              }}
            >
              <ArteCampanha tema={id} className="aspect-[6/5] w-full" />
              <p className="px-4 pb-3 text-sm font-semibold">{TEMAS_VISUAIS[id].nome}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
