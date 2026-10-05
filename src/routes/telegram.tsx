import { createFileRoute } from "@tanstack/react-router";

import { ConviteTelegram } from "@/components/ConviteTelegram";
import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://melhorescolha.io/telegram";
const TITULO = "Ofertas comparadas no Telegram — Melhor Escolha";
const DESCRICAO =
  "Canal com achados reais comparados no site: o mesmo produto em outras lojas dentro do Mercado Livre, com economia de verdade. E um bot para comparar o seu produto pela conversa.";

export const Route = createFileRoute("/telegram")({
  component: PaginaTelegram,
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

/* Regras do texto conferidas em src/routes/api/public/cron-garimpo.ts
   (05/10): até 3 achados por rodada, economia a partir de R$ 30 no produto,
   cada achado no máximo uma vez a cada 7 dias, frete grátis ou com valor
   conhecido. Sem prometer quantidade de posts por dia. */
function PaginaTelegram() {
  return (
    <LayoutConteudo
      etiqueta="Canal de ofertas"
      titulo="Ofertas comparadas no Telegram"
      resumo="Os achados das comparações feitas aqui no site, publicados num canal do Telegram. E um bot para comparar o seu produto sem sair da conversa."
      atualizacao="05/10/2026"
    >
      <h2>O que vai para o canal</h2>
      <ul>
        <li>
          Só comparações reais feitas no site, com economia a partir de R$ 30 no produto contra o
          anúncio comparado.
        </li>
        <li>
          Mesmo produto em outra loja ou um parecido mais barato. O parecido sempre vem marcado como
          "não é idêntico", com o que muda.
        </li>
        <li>
          Frete grátis ou com o valor conhecido, sempre em linha separada do preço. Frete pago de
          valor desconhecido não entra.
        </li>
        <li>No máximo 3 achados por vez, e cada achado aparece uma vez só na semana.</li>
        <li>
          O preço é o de quando foi comparado. Preço e estoque mudam: confira antes de comprar.
        </li>
      </ul>

      <h2>O que o bot faz</h2>
      <p>
        Mande para o bot o link de um produto (pode ser o link curto do app). Ele compara com outras
        lojas, pelas mesmas regras do site, e responde na conversa com o melhor preço, o frete e o
        botão de compra segura.
      </p>

      <ConviteTelegram formato="cartao" origem="pagina_telegram" />

      <p className="text-xs">
        Os botões de compra do canal e do bot são links do programa de afiliados: o preço que você
        paga é o mesmo, e eu recebo uma comissão. Canal e bot independentes, sem vínculo com o
        Mercado Livre.
      </p>
    </LayoutConteudo>
  );
}
