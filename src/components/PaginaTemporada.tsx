/* PÁGINA DA CATEGORIA SAZONAL (Weslei, 05/10: "pode adicionar a categoria
   de Natal, já é interessante a antecedência para o Natal"; "deixe mais
   personalizado, com artes"). Arte própria, contagem de dias, todas as
   ofertas já comparadas da temporada (mesmo produto mais barato,
   alternativa de qualidade igual ou melhor e "já é o menor preço") e as
   regras de escolha, sem prometer o que não foi medido. */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Link2 } from "lucide-react";
import { useState } from "react";

import { ArteCampanha } from "@/components/ArteCampanha";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { BrinquedosPorIdade } from "@/components/BrinquedosPorIdade";
import { BuscaGuiada } from "@/components/BuscaGuiada";
import {
  BotaoTelegram,
  daTemporada,
  GradeOfertas,
  temaDaCampanha,
  useOfertas,
} from "@/components/VitrineSazonal";
import { TEMAS_VISUAIS } from "@/lib/campanha-visual";
import { antecipada, diasAte, hojeEmBrasilia, TEMPORADAS, type Temporada } from "@/lib/sazonal";

/* Títulos das artes do Weslei (05/10: "aproveite ou melhore os textos, eles
   estão excelentes"); o <title> da página continua com a busca do Google. */
const TEXTO: Record<string, { titulo: string; slogan: string; resumo: string; dicas: string[] }> = {
  natal: {
    titulo: "Natal: escolhas que viram sorrisos.",
    slogan: "Compare antes de presentear.",
    resumo:
      "Comprar antes é economizar: perto do Natal os preços sobem e o estoque acaba. Aqui ficam os presentes que já comparei, com o mesmo produto mais barato em outra loja ou com o menor preço confirmado.",
    dicas: [
      "Compre com antecedência: assim dá tempo de chegar e você foge da alta de dezembro.",
      "Acompanhe o preço do presente que você quer: eu aviso quando cair.",
      "Cole o link de qualquer produto: eu comparo com as outras lojas em menos de 2 minutos.",
    ],
  },
  criancas: {
    titulo: "Dia das Crianças: um mundo para brincar.",
    slogan: "Compare. Escolha. Encante.",
    resumo:
      "Os brinquedos e presentes que já comparei, com o mesmo produto mais barato em outra loja, uma alternativa de qualidade igual ou melhor, ou o menor preço confirmado.",
    dicas: [
      "Veja o prazo de entrega no anúncio antes de comprar, para chegar até a data.",
      "Confira a idade indicada do brinquedo no anúncio.",
      "Cole o link de qualquer produto: eu comparo com as outras lojas em menos de 2 minutos.",
    ],
  },
};

export function PaginaTemporada({ id }: { id: Temporada["id"] }) {
  const t = TEMPORADAS.find((x) => x.id === id)!;
  const textos = TEXTO[id] ?? TEXTO["natal"]!;
  const { ofertas, carregou } = useOfertas();
  const lista = daTemporada(t, ofertas);
  const [dias] = useState(() => diasAte(t));
  const [antes] = useState(() => antecipada(t));
  /* Campanha encerrada (passou o último dia): sem contagem nem compra. */
  const [encerrada] = useState(() => hojeEmBrasilia() > t.fim);
  /* Tema da campanha (configurado > conteúdo > neutro) e a paleta dele. */
  const { tema } = temaDaCampanha(t, lista);
  const p = TEMAS_VISUAIS[tema].paleta;

  return (
    <div className="fundo-conteudo min-h-screen">
      <header className="relative overflow-hidden" style={{ background: p.fundo, color: p.texto }}>
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_340px] md:py-14">
          <div className="campanha-entra min-w-0">
            <Link
              to="/"
              className="campanha-botao inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold focus-visible:outline-2"
              style={{
                background: p.superficie,
                color: p.texto,
                boxShadow: `inset 0 0 0 1px ${p.borda}`,
              }}
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Voltar para o comparador
            </Link>
            <p
              className="mt-6 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: p.superficie,
                color: p.rotulo,
                boxShadow: `inset 0 0 0 1px ${p.borda}`,
              }}
            >
              <span aria-hidden="true">{t.emoji}</span>
              {encerrada
                ? "Campanha encerrada"
                : dias === 0
                  ? `${t.nome} é hoje`
                  : `${antes ? "Antecipe: " : ""}faltam ${dias} ${dias === 1 ? "dia" : "dias"} · ${t.dia.slice(8, 10)}/${t.dia.slice(5, 7)}`}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]">
              {textos.titulo}
              {!encerrada && (
                <span className="block" style={{ color: p.realce }}>
                  {textos.slogan}
                </span>
              )}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: p.textoSuave }}>
              {encerrada
                ? "Esta campanha já passou. Os produtos comparados continuam na vitrine geral do site, e você pode comparar qualquer produto colando o link."
                : textos.resumo}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                to="/"
                className="campanha-botao inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: p.destaque, color: p.sobreDestaque }}
              >
                <Link2 className="size-4" aria-hidden="true" />
                Comparar o meu produto
              </Link>
              <BotaoTelegram p={p} texto="Receber os achados no Telegram" />
            </div>
          </div>
          <ArteCampanha
            tema={tema}
            fotos={lista.map((o) => o.imagem)}
            className="mx-auto h-44 w-full max-w-[380px] sm:h-52 md:h-[240px]"
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {!encerrada && (
          <>
            <h2 className="text-xl font-extrabold tracking-tight">
              {!carregou
                ? "Carregando os achados…"
                : lista.length
                  ? `${lista.length} ${lista.length === 1 ? "achado conferido" : "achados conferidos"}`
                  : "Os achados aparecem aqui assim que forem conferidos"}
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">
              Preço de quando foi comparado. Toque em "Ver o preço de agora" para comparar de novo.
            </p>
            {carregou && !lista.length ? (
              /* Campanha sem achado conferido ainda: estado próprio, sem
                 grade vazia. */
              <div
                className="relative mt-4 overflow-hidden rounded-[28px] px-5 py-8 text-center sm:px-10"
                style={{ background: p.fundo, color: p.texto }}
              >
                <div className="relative mx-auto max-w-md">
                  <p className="mt-3 text-base font-bold">Estou conferindo os primeiros achados</p>
                  <p className="mt-1 text-sm" style={{ color: p.textoSuave }}>
                    Assim que um produto passar na comparação (mesmo produto, qualidade e desconto
                    real), ele aparece aqui. Enquanto isso, cole o link do que você quer comprar.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link
                      to="/"
                      className="campanha-botao inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold"
                      style={{ background: p.destaque, color: p.sobreDestaque }}
                    >
                      <Link2 className="size-4" aria-hidden="true" />
                      Comparar o meu produto
                    </Link>
                    <BotaoTelegram p={p} texto="Avisar no Telegram" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[28px] p-4 sm:p-6" style={{ background: p.fundo }}>
                <GradeOfertas p={p} lista={lista} naHome={false} natal={tema === "natal"} />
              </div>
            )}
          </>
        )}

        {!encerrada && <BrinquedosPorIdade className="mt-10" />}
        {!encerrada && (id === "natal" || id === "criancas") && (
          <BuscaGuiada contexto={id} className="mt-10" />
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <BadgeCheck className="size-4 text-success" aria-hidden="true" />
              Como escolho cada achado
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-secondary-ink">
              <li>Confiro pela foto, descrição e características se é o mesmo produto.</li>
              <li>
                Parecido só entra com qualidade igual ou melhor, e sempre marcado como parecido.
              </li>
              <li>
                Desconto real: pelo menos R$ 30 no produto, ou R$ 10 e 20% em produtos mais baratos.
              </li>
              <li>
                "Menor preço" é quando o anúncio já é o mais barato entre pelo menos 3 lojas; a
                diferença para a 2ª loja aparece no cartão.
              </li>
              <li>Frete aparece separado do preço; frete pago de valor desconhecido não entra.</li>
            </ul>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-base font-bold">Dicas para economizar</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-secondary-ink">
              {textos.dicas.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <RodapeInstitucional />
    </div>
  );
}
