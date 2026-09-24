import { createFileRoute, Link } from "@tanstack/react-router";

import { LayoutConteudo } from "@/components/LayoutConteudo";

const URL = "https://melhorescolha.io/termos-de-uso";

export const Route = createFileRoute("/termos-de-uso")({
  component: Termos,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Melhor Escolha" },
      {
        name: "description",
        content:
          "Condições para usar o site: natureza informativa do conteúdo, limites de responsabilidade e uso permitido.",
      },
      { property: "og:title", content: "Termos de Uso" },
      {
        property: "og:description",
        content: "As regras de uso deste site e os limites do que ele promete.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Termos() {
  return (
    <LayoutConteudo
      etiqueta="Documento legal"
      titulo="Termos de Uso"
      resumo="As condições para usar este site, sem juridiquês desnecessário."
      atualizacao="23/09/2026"
    >
      <h2>1. Aceitação</h2>
      <p>
        Ao usar este site você concorda com estes termos. Se não concordar com algum ponto,
        basta não utilizá-lo.
      </p>

      <h2>2. O que o site é</h2>
      <p>
        Uma ferramenta informativa e independente que reúne cupons e calcula a economia real
        de cada um. O site não vende produtos, não processa pagamentos, não emite nota fiscal,
        não entrega mercadorias e não intermedeia a relação entre você e a loja.
      </p>

      <h2>3. Independência</h2>
      <p>
        Este site não é oficial, não é operado, patrocinado, administrado nem aprovado por
        nenhum marketplace, loja ou marca aqui citada. Marcas pertencem aos seus respectivos
        titulares.
      </p>

      <h2>4. Informações sujeitas a mudança</h2>
      <p>
        Preço, estoque, frete, prazo de entrega, percentual de desconto, teto, valor mínimo e
        validade de cupom mudam a qualquer momento e sem aviso. Os dados aqui são uma
        fotografia do momento da coleta, com a data indicada quando disponível. Confira sempre
        na página da loja antes de finalizar a compra. Não garantimos que um cupom funcionará
        na sua compra específica.
      </p>

      <h2>5. Links de afiliado</h2>
      <p>
        Parte dos links é de afiliado e pode gerar comissão, sem custo adicional para você,
        conforme a{" "}
        <Link to="/divulgacao-de-afiliados" className="font-semibold text-ml-blue hover:underline">
          divulgação de afiliados
        </Link>
        .
      </p>

      <h2>6. Relação de consumo com a loja</h2>
      <p>
        Compra, pagamento, entrega, troca, garantia, arrependimento e devolução são
        responsabilidade da loja ou do vendedor, conforme o Código de Defesa do Consumidor.
        Reclamações sobre pedidos devem ser feitas diretamente a eles.
      </p>

      <h2>7. Uso permitido</h2>
      <ul>
        <li>Consultar e comparar cupons livremente, para uso próprio.</li>
        <li>Compartilhar links das páginas do site.</li>
      </ul>
      <p>É vedado:</p>
      <ul>
        <li>Raspar, copiar em massa ou republicar o conteúdo do site sem autorização.</li>
        <li>Usar robôs para gerar acessos, cliques ou requisições em volume anormal.</li>
        <li>Tentar burlar limites técnicos, sobrecarregar os servidores ou explorar falhas.</li>
        <li>Usar o site para spam ou para qualquer finalidade ilícita.</li>
      </ul>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        O conteúdo é oferecido "no estado em que se encontra". Dentro dos limites da lei
        aplicável, não respondemos por prejuízos decorrentes de decisão de compra tomada com
        base em informação que mudou na loja, nem por indisponibilidade temporária do site.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Estes termos podem mudar. A data de atualização no topo indica a versão vigente.
      </p>

      <h2>10. Lei aplicável</h2>
      <p>
        Aplica-se a legislação brasileira, incluindo o Código de Defesa do Consumidor, o Marco
        Civil da Internet e a Lei Geral de Proteção de Dados.
      </p>
    </LayoutConteudo>
  );
}
