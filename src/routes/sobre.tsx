import { createFileRoute, Link } from "@tanstack/react-router";

import { VideoComoFuncionaEstatico } from "@/components/ComoFunciona";

import { AssinaturaAutor } from "@/components/AssinaturaAutor";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { AUTOR_LD, AUTOR_NOME } from "@/lib/autor";

const URL = "https://melhorescolha.io/sobre";

export const Route = createFileRoute("/sobre")({
  component: Sobre,
  head: () => ({
    meta: [
      { title: "Sobre o Melhor Escolha e quem compara os preços" },
      {
        name: "description",
        content:
          "Quem é Weslei Mendes Silva, como cada comparação de preço é feita e conferida, de onde vêm os números dos guias e como o site se sustenta.",
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: URL,
          inLanguage: "pt-BR",
          dateModified: "2026-11-13",
          mainEntity: {
            ...AUTOR_LD,
            description:
              "Formado em Psicologia, pós-graduado em Gestão de Produtos Digitais pela FIAP, com seis anos em melhoria contínua e processos na OLX e no Mercado Livre.",
          },
        }),
      },
    ],
  }),
});

function Sobre() {
  return (
    <LayoutConteudo
      etiqueta="Quem somos"
      titulo="Sobre o site"
      resumo="Um site independente que compara os preços dos produtos vendidos no Mercado Livre: você cola o link de um produto e vê o mesmo produto em outras lojas de lá, do mais barato ao mais caro, com a loja oficial quando houver."
      atualizacao="13/11/2026"
    >
      <AssinaturaAutor atualizado="13/11/2026" />

      <h2>Quem faz as comparações</h2>
      <p>
        Eu sou {AUTOR_NOME}. Sou formado em Psicologia e pós-graduado em Gestão de Produtos Digitais
        pela FIAP. Trabalhei seis anos com melhoria contínua e processos na OLX e no Mercado Livre,
        olhando de perto como as pessoas escolhem o que comprar e onde elas perdem dinheiro sem
        perceber.
      </p>
      <p>
        O Melhor Escolha é um projeto meu, independente. Hoje ele não tem vínculo, patrocínio ou
        aprovação do Mercado Livre, da Amazon, da Shopee ou de qualquer loja anunciada.
      </p>
      <p>
        O mesmo produto costuma ser vendido por várias lojas, com preços diferentes. O anúncio que
        aparece primeiro nem sempre é o mais barato, e comparar um por um toma tempo. Este site faz
        essa comparação por você e mostra a diferença de preço de cada loja.
      </p>

      <h2>Como funciona</h2>
      <VideoComoFuncionaEstatico />
      <ul>
        <li>Você cola o link do anúncio do produto que quer comprar.</li>
        <li>
          O site procura o mesmo produto em outras lojas dentro do Mercado Livre e confere pela
          foto, descrição e características. Todo resultado igual passa por uma segunda conferência.
        </li>
        <li>
          Em menos de dois minutos aparece a tabela com todas as lojas do mesmo produto, da mais
          barata à mais cara, com a loja oficial marcada quando houver e o botão de compra segura em
          cada uma.
        </li>
        <li>
          Anúncios apenas parecidos (outra marca ou outro detalhe) aparecem separados, com a
          descrição do que muda.
        </li>
      </ul>

      <h2>De onde vêm os números dos guias</h2>
      <p>
        Cada número que aparece nos guias e nas categorias saiu de uma comparação feita aqui, com
        data. Entre 18/10 e 13/11/2026 o site guardou 1.285 comparações com pelo menos duas lojas
        vendendo o mesmo produto. Em 46% delas havia o mesmo produto mais barato em outra loja, e a
        diferença mediana foi de R$ 20,00 (13,6% do preço do anúncio colado).
      </p>
      <ul>
        <li>Preço é o de quando comparei. Ele muda, e por isso todo exemplo traz a data.</li>
        <li>
          Quando o frete não é conhecido, a loja com frete pago não passa na frente de uma com frete
          grátis.
        </li>
        <li>
          Quando o preço é muito mais baixo que o das lojas oficiais, isso aparece como alerta, não
          como vantagem. Os detalhes estão no{" "}
          <Link
            to="/guias/$slug"
            params={{ slug: "quanto-se-economiza-comparando-lojas" }}
            className="font-semibold text-ml-blue hover:underline"
          >
            levantamento completo
          </Link>
          .
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
