import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { abrirPreferencias } from "@/lib/consentimento";

const URL = "https://cupons-afiliado-ml.lovable.app/politica-de-cookies";

export const Route = createFileRoute("/politica-de-cookies")({
  component: Cookies,
  head: () => ({
    meta: [
      { title: "Política de Cookies — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Quais cookies o site usa, para que servem e como aceitar, recusar ou mudar a sua escolha a qualquer momento.",
      },
      { property: "og:title", content: "Política de Cookies" },
      {
        property: "og:description",
        content: "Categorias de cookies, finalidade de cada uma e como revogar o consentimento.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Cookies() {
  return (
    <LayoutConteudo
      etiqueta="Privacidade"
      titulo="Política de Cookies"
      resumo="O que fica guardado no seu navegador e como você controla isso."
      atualizacao="24/09/2026"
    >
      <h2>O que são cookies</h2>
      <p>
        São pequenos arquivos que um site guarda no seu navegador para lembrar informações
        entre uma página e outra. Também usamos o armazenamento local do navegador, que
        funciona de forma parecida.
      </p>

      <h2>Categorias usadas aqui</h2>

      <h3>1. Essenciais — sempre ativos</h3>
      <p>
        Fazem o site abrir, manter a sessão de navegação e lembrar a sua decisão sobre
        privacidade, para não perguntar de novo a cada visita. Sem eles o site não funciona,
        por isso não dependem de consentimento.
      </p>

      <h3>2. Medição de audiência — só com a sua autorização</h3>
      <p>
        Contam visitas e mostram quais páginas ajudam mais, de forma agregada. Quando
        ativada, a medição usa o <strong>Google Analytics 4</strong> (Google LLC), com IP
        anonimizado. O script do Google Analytics só é carregado depois que você autoriza.
      </p>

      <h3>3. Publicidade — só com a sua autorização</h3>
      <p>
        Usados por redes de anúncios de terceiros, como o <strong>Google AdSense</strong>, para
        exibir e medir anúncios. O script de anúncios só é carregado depois que você autoriza
        esta categoria. Enquanto o site não exibir anúncios, nenhum cookie desta categoria é
        gravado.
      </p>

      <h2>Modo de consentimento do Google</h2>
      <p>
        O site usa o Modo de Consentimento (Consent Mode v2) do Google. Antes de qualquer
        escolha, tudo começa <strong>negado</strong>: armazenamento de análise, de anúncios,
        uso de dados para anúncios e personalização. Só o que você autorizar passa a valer, e
        se você mudar de ideia a autorização é retirada na hora. Saiba como o Google usa os
        dados em{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites?hl=pt-BR"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ml-blue hover:underline"
        >
          policies.google.com
        </a>
        .
      </p>

      <h2>Links para o Mercado Livre</h2>
      <p>
        Os botões de compra levam ao Mercado Livre por links de afiliado. Ao clicar, você sai
        deste site e passa a valer a política de cookies do Mercado Livre. Este site não lê nem
        grava cookies do Mercado Livre no seu navegador.
      </p>

      <h2>Como escolher</h2>
      <p>
        Na primeira visita aparece um aviso com três caminhos: aceitar todos, recusar os
        opcionais ou gerenciar cada categoria separadamente. A sua escolha é respeitada pelos
        recursos correspondentes — o que você recusa não é carregado.
      </p>
      <p>
        <button
          type="button"
          onClick={abrirPreferencias}
          className="font-semibold text-ml-blue hover:underline"
        >
          Abrir preferências de cookies
        </button>
      </p>

      <h2>Apagando pelo navegador</h2>
      <p>
        Você também pode apagar ou bloquear cookies nas configurações do seu navegador.
        Bloqueando os essenciais, partes do site podem parar de funcionar.
      </p>

      <h2>Mais informações</h2>
      <p>
        O tratamento de dados como um todo está descrito na{" "}
        <Link to="/politica-de-privacidade" className="font-semibold text-ml-blue hover:underline">
          política de privacidade
        </Link>
        .
      </p>
    </LayoutConteudo>
  );
}
