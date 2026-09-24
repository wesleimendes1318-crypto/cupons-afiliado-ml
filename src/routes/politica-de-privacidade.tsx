import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { abrirPreferencias } from "@/lib/consentimento";

const URL = "https://cupons-afiliado-ml.lovable.app/politica-de-privacidade";

export const Route = createFileRoute("/politica-de-privacidade")({
  component: Privacidade,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Cupons de Lojas Afiliadas" },
      {
        name: "description",
        content:
          "Quais dados o site trata, para quê, com quem compartilha e como exercer seus direitos previstos na LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade" },
      {
        property: "og:description",
        content: "Tratamento de dados, cookies, medição e publicidade, em linguagem simples.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Privacidade() {
  return (
    <LayoutConteudo
      etiqueta="LGPD"
      titulo="Política de Privacidade"
      resumo="O que fazemos com dados de quem visita este site, escrito para ser entendido."
      atualizacao="24/09/2026"
    >
      <h2>Quem é o responsável</h2>
      <p>
        Este site é mantido por uma pessoa física, participante de programa de afiliados, que
        atua como controladora dos dados aqui tratados, nos termos da Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018). O canal de contato está na{" "}
        <Link to="/contato" className="font-semibold text-ml-blue hover:underline">
          página de contato
        </Link>
        .
      </p>

      <h2>Dados que tratamos</h2>
      <ul>
        <li>
          <strong>Dados de navegação:</strong> páginas vistas, buscas feitas no site, tipo de
          dispositivo e navegador, além do endereço IP registrado por padrão por qualquer
          servidor web.
        </li>
        <li>
          <strong>Preferências guardadas no seu navegador:</strong> a sua escolha sobre
          cookies e configurações da tela. Ficam no seu aparelho.
        </li>
        <li>
          <strong>Links de produto que você cola:</strong> o endereço do anúncio do Mercado
          Livre, para comparar o preço do mesmo produto em outras lojas. Guardamos o link, o
          produto, os preços encontrados e o link de compra gerado, sem nada que identifique
          você.
        </li>
        <li>
          <strong>Dados que você envia:</strong> apenas o que você escrever espontaneamente ao
          entrar em contato.
        </li>
      </ul>
      <p>
        Não pedimos cadastro para usar o site, não coletamos CPF, endereço, dados bancários
        nem dados de pagamento. Compras acontecem no site da loja, sob a política de
        privacidade dela.
      </p>

      <h2>Para que tratamos</h2>
      <ul>
        <li>Exibir as páginas e manter o site funcionando (interesse legítimo e execução do serviço).</li>
        <li>Comparar o preço do produto que você colou entre lojas (execução do serviço que você pediu).</li>
        <li>Entender quais conteúdos são úteis, de forma agregada (mediante o seu consentimento).</li>
        <li>Exibir publicidade de terceiros, caso ativada no futuro (mediante o seu consentimento).</li>
        <li>Responder a quem nos procura (consentimento ao enviar a mensagem).</li>
        <li>Prevenir abuso, fraude e uso automatizado indevido (interesse legítimo).</li>
      </ul>

      <h2>Cookies e tecnologias semelhantes</h2>
      <p>
        Cookies essenciais são necessários para o site funcionar e para lembrar a sua escolha
        de privacidade. Cookies de medição de audiência e de publicidade só são usados se você
        autorizar, e ficam bloqueados enquanto você não autorizar. Você pode rever a decisão a
        qualquer momento:
      </p>
      <p>
        <button
          type="button"
          onClick={abrirPreferencias}
          className="font-semibold text-ml-blue hover:underline"
        >
          Abrir preferências de cookies
        </button>{" "}
        · Detalhes na{" "}
        <Link to="/politica-de-cookies" className="font-semibold text-ml-blue hover:underline">
          política de cookies
        </Link>
        .
      </p>

      <h2>Medição de audiência</h2>
      <p>
        Com a sua autorização, usamos o Google Analytics 4 (Google LLC), com IP anonimizado,
        para contar visitas e eventos como comparação feita e clique em comprar, sem nome,
        e-mail, telefone ou qualquer dado que identifique você diretamente. Usamos o Modo de
        Consentimento do Google: sem autorização, nada disso é gravado. A finalidade é
        melhorar o site, não perfilar pessoas.
      </p>

      <h2>Publicidade</h2>
      <p>
        Quando o site exibir anúncios, eles virão do Google AdSense (Google LLC), só serão
        carregados para quem autorizou cookies de publicidade e virão identificados com a
        etiqueta "Publicidade". Terceiros, incluindo o Google, podem usar cookies para exibir
        anúncios com base em visitas anteriores a este e a outros sites. Você pode desativar a
        publicidade personalizada nas{" "}
        <a
          href="https://adssettings.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ml-blue hover:underline"
        >
          configurações de anúncios do Google
        </a>
        .
      </p>

      <h2>Links de afiliado</h2>
      <p>
        Parte dos links leva a lojas parceiras com um identificador de afiliado. Ao clicar,
        você passa a navegar no site da loja, que trata os seus dados conforme as próprias
        políticas. A nossa relação comercial está descrita na{" "}
        <Link to="/divulgacao-de-afiliados" className="font-semibold text-ml-blue hover:underline">
          divulgação de afiliados
        </Link>
        .
      </p>

      <h2>Compartilhamento</h2>
      <p>
        Não vendemos dados. Compartilhamos apenas com os prestadores necessários para o site
        existir: hospedagem, banco de dados e, se autorizado por você, os serviços de medição
        e de publicidade. Também podemos compartilhar diante de obrigação legal ou ordem
        judicial.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Registros técnicos e de audiência são mantidos pelo prazo necessário à finalidade e
        depois descartados ou mantidos de forma agregada. Mensagens de contato ficam guardadas
        enquanto o assunto estiver em andamento.
      </p>

      <h2>Seus direitos</h2>
      <p>
        A LGPD garante a você confirmar a existência de tratamento, acessar, corrigir,
        anonimizar, bloquear ou eliminar dados, solicitar portabilidade, revogar consentimento
        e saber com quem compartilhamos. Basta pedir pelo canal de contato; respondemos em
        prazo razoável.
      </p>

      <h2>Crianças e adolescentes</h2>
      <p>
        O site não é direcionado a menores de 18 anos e não coleta intencionalmente dados
        dessa faixa etária.
      </p>

      <h2>Segurança e limites</h2>
      <p>
        Adotamos medidas técnicas razoáveis para proteger os dados tratados. Nenhum sistema é
        infalível, e esta política descreve práticas — não constitui declaração de
        conformidade jurídica absoluta nem substitui orientação de advogado.
      </p>

      <h2>Mudanças</h2>
      <p>
        Alterações relevantes serão publicadas aqui com nova data de atualização no topo da
        página.
      </p>
    </LayoutConteudo>
  );
}
