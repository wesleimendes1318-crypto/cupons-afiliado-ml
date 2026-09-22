/* Política de privacidade da extensão Conferidor de Cupons.

   Existe por exigência da Chrome Web Store: sem uma URL pública de política de
   privacidade a extensão não é aceita. Mas o conteúdo não é enfeite para
   auditoria, é a descrição honesta do que a extensão faz com dado de quem a
   instala, e por isso está em português simples, sem juridiquês.
*/

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: Privacidade,
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Conferidor de Cupons" },
      {
        name: "description",
        content:
          "O que a extensão Conferidor de Cupons faz e não faz com os seus dados.",
      },
    ],
  }),
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{titulo}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-secondary-ink">
        {children}
      </div>
    </section>
  );
}

function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/" className="text-sm font-semibold text-ml-blue hover:underline">
        Voltar para o site
      </Link>

      <h1 className="mt-6 text-2xl font-extrabold">
        Política de Privacidade — Conferidor de Cupons
      </h1>
      <p className="mt-1 text-xs text-secondary-ink">
        Última atualização: 22 de setembro de 2026
      </p>

      <Secao titulo="Quem somos">
        <p>
          O Conferidor de Cupons é uma extensão de navegador mantida por Weslei Mendes,
          participante do programa de afiliados do Mercado Livre. É uma ferramenta
          independente: <span className="font-semibold text-foreground">não tem vínculo com o
          Mercado Livre</span>, não é um produto oficial dele e não é endossada por ele.
        </p>
      </Secao>

      <Secao titulo="O que a extensão coleta">
        <p className="text-base font-bold text-foreground">Nada sobre você.</p>
        <p>
          A extensão não coleta, não armazena e não transmite informação pessoal, histórico
          de navegação, localização, conteúdo de mensagens, credenciais nem dados de
          pagamento.
        </p>
      </Secao>

      <Secao titulo="O que fica guardado no seu navegador">
        <p>Apenas no armazenamento local do próprio navegador, e nunca enviado para nós:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Token de sincronização, digitado por você nas opções.</li>
          <li>
            Chave da API do Gemini, se você optar por usar o recurso de gerar texto de
            divulgação. Esse recurso vem desligado.
          </li>
          <li>
            Cache dos cupons já conferidos e do vendedor de cada anúncio, para não repetir a
            mesma consulta.
          </li>
        </ul>
        <p>Removendo a extensão, o navegador apaga tudo isso.</p>
      </Secao>

      <Secao titulo="O que a extensão envia para fora">
        <p>
          Para o banco de dados deste site, apenas dados públicos de comércio: cupons do
          programa de afiliados (desconto, teto, compra mínima, validade, vendedor), dados
          públicos de anúncios (título, preço, vendedor) e os links e códigos gerados na
          conta do próprio usuário. Nada disso identifica pessoa alguma.
        </p>
        <p>
          Para o Google Gemini, somente se você configurar a sua própria chave: título e
          preço de um produto, para gerar um texto de divulgação. Sem chave configurada,
          nenhuma requisição é feita.
        </p>
      </Secao>

      <Secao titulo="Sessão do Mercado Livre">
        <p>
          A extensão usa a sessão que você já tem aberta no navegador para ler as condições
          dos cupons e gerar os links da sua própria conta de afiliado. Ela não lê, não copia
          e não transmite os seus cookies, a sua senha ou qualquer credencial.
        </p>
      </Secao>

      <Secao titulo="O que a extensão não faz">
        <ul className="list-disc space-y-1 pl-5">
          <li>Não altera links das páginas que você visita.</li>
          <li>Não injeta código de afiliado na sua navegação.</li>
          <li>Não substitui o código de afiliado de outra pessoa pelo nosso.</li>
          <li>Não lê páginas fora do Mercado Livre e deste site.</li>
          <li>Não vende nem compartilha dados com terceiros.</li>
          <li>Não exibe anúncios.</li>
        </ul>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Como não coletamos dados pessoais, não há dados seus para consultar, corrigir ou
          excluir. Removendo a extensão, todo o armazenamento local é apagado pelo próprio
          navegador.
        </p>
      </Secao>

      <Secao titulo="Alterações">
        <p>
          Mudanças nesta política são publicadas nesta mesma página, com a data de
          atualização no topo.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>weslei.mendes1318@gmail.com</p>
      </Secao>
    </main>
  );
}
