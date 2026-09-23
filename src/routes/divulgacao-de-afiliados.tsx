import { createFileRoute } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://cupons-afiliado-ml.lovable.app/divulgacao-de-afiliados";

export const Route = createFileRoute("/divulgacao-de-afiliados")({
  component: Divulgacao,
  head: () => ({
    meta: [
      { title: "Divulgação de afiliados — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Como este site ganha dinheiro: comissão de afiliado em parte das compras, sem custo adicional para quem compra.",
      },
      { property: "og:title", content: "Divulgação de afiliados" },
      {
        property: "og:description",
        content: "Relação comercial declarada por inteiro: comissão, independência e limites.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Divulgacao() {
  return (
    <LayoutConteudo
      titulo="Divulgação de afiliados"
      resumo="A relação comercial deste site, declarada por inteiro e em português claro."
      atualizacao="23/09/2026"
    >
      <h2>Participação em programa de afiliados</h2>
      <p>
        Quem mantém este site participa de programa de afiliados e criadores de marketplace.
        Isso significa que alguns links aqui publicados carregam um identificador que registra
        que a visita à loja partiu deste site.
      </p>

      <h2>Podemos receber comissão</h2>
      <p>
        Quando uma compra é feita depois de clicar em um desses links, o site pode receber uma
        comissão paga pela loja ou pelo programa de afiliados. A comissão é paga pelo
        vendedor, nunca por quem compra.
      </p>

      <h2>Isso não aumenta o preço que você paga</h2>
      <p>
        O valor cobrado de você é o mesmo com ou sem o nosso link. A comissão não é um
        acréscimo no preço: ela sai da remuneração do próprio programa de afiliados.
      </p>

      <h2>Comissão não significa endosso</h2>
      <p>
        O fato de existir comissão <strong>não</strong> significa que o marketplace, a loja ou
        o vendedor administram, patrocinam, aprovam ou endossam este site. Somos um site
        independente, sem vínculo societário ou contratual de representação com nenhuma dessas
        empresas. Marcas citadas pertencem aos seus respectivos donos e são mencionadas apenas
        para identificar de onde vem uma oferta.
      </p>

      <h2>Como escolhemos o que aparece aqui</h2>
      <ul>
        <li>
          Um cupom aparece porque existe e porque as suas condições puderam ser lidas — não
          porque paga mais comissão.
        </li>
        <li>
          A economia mostrada é a conta real daquele cupom, mesmo quando o resultado é
          desanimador.
        </li>
        <li>Cupons com validade vencida saem do ar em vez de continuarem como ativos.</li>
        <li>
          Quando uma condição não pode ser confirmada, o cupom é marcado como não verificado.
        </li>
      </ul>

      <h2>Onde esta divulgação aparece</h2>
      <p>
        O aviso resumido — "este site pode receber comissão por compras realizadas através de
        determinados links" — fica visível no rodapé de todas as páginas e junto das listas de
        ofertas, não escondido em um canto.
      </p>

      <h2>Canais oficiais de divulgação</h2>
      <p>
        Os links de afiliado deste projeto são divulgados apenas nos canais declarados no
        cadastro do programa de afiliados. No momento, o endereço oficial é{" "}
        <strong>cupons-afiliado-ml.lovable.app</strong>. Se o site migrar para um domínio
        próprio, o novo endereço será declarado antes de passar a ser usado.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>Não escondemos nem disfarçamos que um link é de afiliado.</li>
        <li>Não trocamos o identificador de afiliado de outra pessoa pelo nosso.</li>
        <li>Não usamos robôs, cliques automáticos ou qualquer artifício para gerar métricas.</li>
        <li>Não registramos compras próprias para gerar comissão.</li>
        <li>Não compramos anúncios de pesquisa ou de compras para impulsionar links de afiliado.</li>
      </ul>
    </LayoutConteudo>
  );
}
