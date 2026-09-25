import { createFileRoute } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://melhorescolha.io/sobre";

export const Route = createFileRoute("/sobre")({
  component: Sobre,
  head: () => ({
    meta: [
      { title: "Sobre o site — Melhor Escolha" },
      {
        name: "description",
        content:
          "Quem mantém o site, como a comparação de preços funciona e o que prometemos (e o que não prometemos) a quem usa.",
      },
      { property: "og:title", content: "Sobre o site — Melhor Escolha" },
      {
        property: "og:description",
        content:
          "Quem mantém o site, como a comparação de preços funciona e como o site se sustenta.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Sobre() {
  return (
    <LayoutConteudo
      etiqueta="Quem somos"
      titulo="Sobre o site"
      resumo="Um comparador de preços independente: você cola o link de um produto e vê o mesmo produto em outras lojas, do mais barato ao mais caro."
      atualizacao="25/09/2026"
    >
      <h2>Por que este site existe</h2>
      <p>
        O mesmo produto costuma ser vendido por várias lojas, com preços diferentes. O anúncio que
        aparece primeiro nem sempre é o mais barato, e comparar um por um toma tempo. Este site faz
        essa comparação por você e mostra a diferença de preço de cada loja.
      </p>

      <h2>Como funciona</h2>
      <ul>
        <li>Você cola o link do anúncio do produto que quer comprar.</li>
        <li>
          O site procura o mesmo produto em outras lojas e confere marca, modelo, foto e título de
          cada anúncio. Todo resultado igual passa por uma segunda conferência.
        </li>
        <li>
          Em até um minuto aparece a tabela com todas as lojas do mesmo produto, da mais barata à
          mais cara, cada uma com o botão de compra segura.
        </li>
        <li>
          Anúncios apenas parecidos (outra marca ou outro detalhe) aparecem separados, com o aviso
          do que muda.
        </li>
      </ul>

      <h2>O que o site não faz</h2>
      <ul>
        <li>Não mostra produto parecido como se fosse o mesmo.</li>
        <li>
          Não garante preço, estoque, frete, prazo de entrega nem disponibilidade: o preço é o de
          quando comparei.
        </li>
        <li>Não afirma ter "o menor preço do Brasil" nem qualquer superlativo sem prova.</li>
        <li>Não é um site oficial de nenhuma loja ou marketplace.</li>
      </ul>

      <h2>E os cupons?</h2>
      <p>
        O site começou mostrando o desconto real de cupons. Depois que a forma de distribuir cupons
        mudou, eles ficaram em segundo plano, e o foco passou a ser a comparação de preços. Os guias
        sobre cupons continuam disponíveis na página de guias.
      </p>

      <h2>Como o site se sustenta</h2>
      <p>
        Por comissão de afiliado em parte das compras feitas a partir daqui, sem custo adicional
        para quem compra: o preço é o mesmo da loja. A explicação completa está na página de
        divulgação de afiliados.
      </p>

      <h2>Contato</h2>
      <p>
        Viu uma loja na comparação que não era o mesmo produto, ou um preço errado? Avise pela
        página de contato. Correções desse tipo entram na frente da fila.
      </p>
    </LayoutConteudo>
  );
}
