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
      titulo="Política de Cookies"
      resumo="O que fica guardado no seu navegador e como você controla isso."
      atualizacao="23/09/2026"
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
        Contam visitas e mostram quais páginas ajudam mais, de forma agregada. Ficam
        bloqueados até você autorizar e são desativados se você recusar.
      </p>

      <h3>3. Publicidade — só com a sua autorização</h3>
      <p>
        Usados por redes de anúncios de terceiros para exibir e medir anúncios.{" "}
        <strong>Hoje o site não exibe nenhum anúncio</strong>, então nenhum cookie desta
        categoria é gravado. Se isso mudar, esta página será atualizada antes.
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
