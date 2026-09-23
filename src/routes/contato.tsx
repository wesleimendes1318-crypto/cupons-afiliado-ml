import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://cupons-afiliado-ml.lovable.app/contato";

export const Route = createFileRoute("/contato")({
  component: Contato,
  head: () => ({
    meta: [
      { title: "Contato — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Como falar com quem mantém o site: correções de cupom, dúvidas sobre privacidade e demais assuntos.",
      },
      { property: "og:title", content: "Contato" },
      {
        property: "og:description",
        content: "Canal para correções de cupons, privacidade e outros assuntos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Contato() {
  return (
    <LayoutConteudo
      titulo="Contato"
      resumo="Fale com quem mantém o site."
      atualizacao="23/09/2026"
    >
      <h2>Canal de contato</h2>
      <p>
        O atendimento é feito pelo perfil{" "}
        <a
          href="https://www.instagram.com/wslmendes/"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-semibold text-ml-blue hover:underline"
        >
          @wslmendes no Instagram
        </a>
        . Respondo por mensagem direta, em português, normalmente em alguns dias úteis.
      </p>

      <h2>Assuntos atendidos</h2>
      <ul>
        <li>
          <strong>Correção de cupom:</strong> cupom vencido, condição errada, desconto que não
          bate. Correções desse tipo entram na frente da fila.
        </li>
        <li>
          <strong>Privacidade:</strong> pedidos relacionados aos seus direitos previstos na
          LGPD, descritos na{" "}
          <Link to="/politica-de-privacidade" className="font-semibold text-ml-blue hover:underline">
            política de privacidade
          </Link>
          .
        </li>
        <li>
          <strong>Conteúdo:</strong> sugestões de guias e correções de texto.
        </li>
      </ul>

      <h2>O que não é atendido aqui</h2>
      <p>
        Pedido, pagamento, entrega, troca, devolução e garantia são responsabilidade da loja
        onde a compra foi feita. Este site não vende produtos e não tem acesso a pedidos. Nessas
        situações, procure o atendimento da própria loja.
      </p>

      <h2>Encontrou erro em uma informação?</h2>
      <p>
        Envie o nome do vendedor e, se puder, um print da tela. Informação que não puder ser
        reconfirmada é despublicada ou marcada como não verificada em vez de continuar no ar
        como certa.
      </p>
    </LayoutConteudo>
  );
}
