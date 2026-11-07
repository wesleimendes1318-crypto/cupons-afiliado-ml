import { createFileRoute } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { PainelAlertasPreco } from "@/components/painel/PainelAlertasPreco";

export const Route = createFileRoute("/meus-precos")({
  component: MeusPrecos,
  head: () => ({
    meta: [
      { title: "Meus preços — Melhor Escolha" },
      {
        name: "description",
        content: "Os produtos que você acompanha: preço de agora, quanto caiu e o histórico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* Content lives in the component so /painel shows the same screen in a tab. */
function MeusPrecos() {
  return (
    <LayoutConteudo
      etiqueta="Seus produtos"
      titulo="Meus preços"
      resumo="Os produtos que você acompanha. Eu confiro o preço de tempos em tempos e mostro aqui quando cai. Esta página atualiza sozinha."
    >
      <PainelAlertasPreco />
    </LayoutConteudo>
  );
}
