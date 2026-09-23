import { createFileRoute } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://cupons-afiliado-ml.lovable.app/sobre";

export const Route = createFileRoute("/sobre")({
  component: Sobre,
  head: () => ({
    meta: [
      { title: "Sobre o site — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Quem mantém o site, de onde vêm os dados dos cupons e o que prometemos (e o que não prometemos) a quem usa.",
      },
      { property: "og:title", content: "Sobre o site — Cupons de Lojas Afiliadas" },
      {
        property: "og:description",
        content: "Quem mantém o site, de onde vêm os dados dos cupons e como o site se sustenta.",
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
      resumo="Uma ferramenta independente para descobrir quanto um cupom desconta de verdade."
      atualizacao="23/09/2026"
    >
      <h2>Por que este site existe</h2>
      <p>
        Um cupom anunciado como "40% de desconto" muitas vezes desconta R$ 2, porque tem um
        teto de desconto e um valor mínimo de compra escritos em letras pequenas. Quem compra
        só descobre isso no carrinho. Este site existe para mostrar esse número antes, com a
        conta feita.
      </p>

      <h2>De onde vêm as informações</h2>
      <p>
        As condições de cada cupom (percentual, teto de desconto, valor mínimo e validade) são
        lidas do texto da própria campanha do vendedor. Nada é estimado, arredondado ou
        preenchido por suposição. Quando uma condição não pôde ser confirmada, o cupom aparece
        marcado como não verificado em vez de ser apresentado como certo.
      </p>

      <h2>O que o site faz</h2>
      <ul>
        <li>Calcula a economia real de um cupom para o valor de compra que você informar.</li>
        <li>Mostra o teto de desconto e o valor mínimo com todas as letras.</li>
        <li>Ajuda a comparar cupons diferentes para a mesma compra.</li>
        <li>Publica guias explicando como cupons funcionam e como avaliar uma oferta.</li>
      </ul>

      <h2>O que o site não faz</h2>
      <ul>
        <li>Não garante preço, estoque, frete, prazo de entrega nem disponibilidade.</li>
        <li>Não afirma ter "o menor preço do Brasil" nem qualquer superlativo sem prova.</li>
        <li>Não cria cupons, descontos, prazos ou condições que não existam.</li>
        <li>Não é um site oficial de nenhuma loja ou marketplace.</li>
      </ul>

      <h2>Como o site se sustenta</h2>
      <p>
        Por comissão de afiliado em parte das compras feitas a partir daqui, sem custo
        adicional para quem compra. A explicação completa está na página de divulgação de
        afiliados. O site continua útil mesmo para quem nunca clicar em um link comercial: as
        contas, as comparações e os guias são abertos.
      </p>

      <h2>Contato</h2>
      <p>
        Encontrou um cupom com informação errada ou vencida? Avise pela página de contato.
        Correções desse tipo entram na frente da fila.
      </p>
    </LayoutConteudo>
  );
}
