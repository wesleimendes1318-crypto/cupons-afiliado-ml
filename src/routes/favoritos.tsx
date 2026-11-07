import { createFileRoute } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { PainelListasDesejos } from "@/components/painel/PainelListasDesejos";

export const Route = createFileRoute("/favoritos")({
  component: Favoritos,
  head: () => ({
    meta: [
      { title: "Lista de desejos — Melhor Escolha" },
      {
        name: "description",
        content: "Os produtos que você salvou, para comprar depois ou mandar no WhatsApp.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* Content lives in the component so /painel shows the same screen in a tab. */
function Favoritos() {
  return (
    <LayoutConteudo
      titulo="Lista de desejos"
      resumo="Toque no coração de qualquer produto do site para guardar aqui. Escolha os que quiser e mande no WhatsApp."
    >
      <PainelListasDesejos />
    </LayoutConteudo>
  );
}
