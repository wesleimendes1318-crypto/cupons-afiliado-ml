import type { ReactNode } from "react";

import { EmAltaCatalogo } from "@/components/EmAltaCatalogo";
import { Vitrine } from "@/components/Vitrine";
import { VitrineSazonal } from "@/components/VitrineSazonal";
import { MaisDesejadosHome, RecomendacoesHome } from "@/components/recomendacoes/RecomendacoesHome";
import { temInteracoes, usePerfilVisitante } from "@/lib/perfil-visitante";
import { temporadasAtivas } from "@/lib/sazonal";

/* Vitrines da home (Weslei, 02/11): de volta a trilhos visíveis, sem abas que
   escondem o conteúdo. Quem já buscou ou abriu produtos vê "Para você"
   primeiro; visitante novo começa por "Mais desejados e em alta". Cada
   vitrine mantém as próprias regras (afiliado, nota 4,5+, frete) e some
   sozinha quando não tem produto suficiente. */
export function VitrinesHome() {
  const pessoal = temInteracoes(usePerfilVisitante());
  /* Black Friday (Weslei, 26/11): during the season the seasonal showcase
     leads, then confirmed savings, then personal/most wanted, then best
     sellers. Only shown while the box is idle, so search results stay first. */
  if (temporadasAtivas().some((t) => t.id === "black_friday")) {
    return (
      <div className="mt-4">
        <VitrineSazonal key="temporada" soAtiva />
        <Vitrine key="economia" />
        {pessoal ? <RecomendacoesHome key="para-voce" /> : <MaisDesejadosHome key="desejados" />}
        {pessoal ? <MaisDesejadosHome key="desejados" /> : <RecomendacoesHome key="para-voce" />}
        <EmAltaCatalogo key="vendidos" naHome limite={12} />
      </div>
    );
  }
  const blocos: ReactNode[] = [
    <MaisDesejadosHome key="desejados" />,
    <Vitrine key="economia" />,
    <EmAltaCatalogo key="vendidos" naHome limite={12} />,
    <VitrineSazonal key="temporada" soAtiva />,
  ];
  blocos.splice(pessoal ? 0 : 1, 0, <RecomendacoesHome key="para-voce" />);
  return <div className="mt-4">{blocos}</div>;
}
