/* SEÇÕES SAZONAIS (Weslei, 05/10: "crie sessões prioritárias dessas
   categorias sazonais... precisa ENCANTAR o cliente... pense no design,
   precisa ser profissional"). Uma seção por temporada em destaque (Dia das
   Crianças em andamento; Black Friday e Natal antecipados), com tema
   próprio e só produtos JÁ COMPARADOS com desconto real contra outra loja
   (mesmo produto) ou alternativa de qualidade equivalente. Aparece com 2 ou
   mais produtos. Botão de compra só com link de afiliado (meli.la) e
   comparação de menos de 24 h; mais antiga, "Comparar de novo" (preço
   velho não vira compra; regra de 02/10). */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { antecipada, diasAte, rotuloDa, temporadasEmDestaque, type Temporada } from "@/lib/sazonal";
import { LINK_CANAL } from "@/lib/telegram-publico";

type Item = {
  chave: string;
  titulo: string;
  imagem: string | null;
  loja: string | null;
  preco: number | null;
  url_produto: string | null;
  melhor_loja: string | null;
  melhor_preco: number | null;
  melhor_link: string | null;
  economia: number | null;
  visto_em: string;
  alt_preco: number | null;
  alt_economia: number | null;
  alt_titulo: string | null;
  alt_link: string | null;
  alt_loja: string | null;
  alt_frete_gratis: boolean | null;
};

type Oferta = {
  chave: string;
  titulo: string;
  imagem: string | null;
  preco: number;
  antes: number;
  economia: number;
  loja: string | null;
  link: string | null;
  parecido: boolean;
  urlProduto: string | null;
  recente: boolean;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* A melhor oferta de cada produto comparado: o mesmo produto em outra loja
   ou, se economiza mais, a alternativa (que só entra na vitrine com
   qualidade equivalente ou superior; ver alternativa_da_analise). */
function ofertaDo(i: Item): Oferta | null {
  const recente = Date.now() - Date.parse(i.visto_em) < 24 * 3600_000;
  const mesmo =
    (i.economia ?? 0) > 0 && i.melhor_preco != null && i.preco != null
      ? {
          titulo: i.titulo,
          preco: i.melhor_preco,
          economia: i.economia as number,
          loja: i.melhor_loja,
          link: ehLinkDeAfiliado(i.melhor_link) ? i.melhor_link : null,
          parecido: false,
        }
      : null;
  const alt =
    (i.alt_economia ?? 0) > 0 && i.alt_preco != null && i.preco != null && i.alt_frete_gratis
      ? {
          titulo: i.alt_titulo ?? i.titulo,
          preco: i.alt_preco,
          economia: i.alt_economia as number,
          loja: i.alt_loja,
          link: ehLinkDeAfiliado(i.alt_link) ? i.alt_link : null,
          parecido: true,
        }
      : null;
  const melhor = mesmo && (!alt || mesmo.economia >= alt.economia) ? mesmo : alt;
  if (!melhor || i.preco == null) return null;
  return {
    chave: i.chave,
    imagem: i.imagem,
    antes: i.preco,
    urlProduto: i.url_produto,
    recente,
    ...melhor,
  };
}

function contagem(t: Temporada) {
  const d = diasAte(t);
  if (antecipada(t)) return `${t.nome} em ${d} dias`;
  return d === 0 ? "É hoje" : `Faltam ${d} ${d === 1 ? "dia" : "dias"}`;
}

export function VitrineSazonal() {
  const [itens, setItens] = useState<Item[]>([]);
  const [temporadas] = useState(() => temporadasEmDestaque());

  useEffect(() => {
    if (!temporadas.length) return;
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("vitrine" as never, { p_limite: 200 } as never);
        if (vivo && Array.isArray(data)) setItens(data as Item[]);
      } catch {
        /* sem dados: a seção não aparece */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [temporadas.length]);

  const secoes = useMemo(() => {
    const usados = new Set<string>();
    return temporadas
      .filter((t) => !antecipada(t) || t.ofertasAntecipadas)
      .map((t) => {
        const ofertas = itens
          .filter((i) => t.termos.test(`${i.titulo} ${i.alt_titulo ?? ""}`))
          .map(ofertaDo)
          /* Desconto que vale a pena: pelo menos R$ 15 e 5% do anúncio
             comparado (R$ 2 de diferença não encanta ninguém). */
          .filter(
            (o): o is Oferta =>
              o != null && !usados.has(o.chave) && o.economia >= 15 && o.economia >= o.antes * 0.05,
          )
          .sort((a, b) => b.economia - a.economia)
          .slice(0, 10);
        ofertas.forEach((o) => usados.add(o.chave));
        return { t, ofertas };
      })
      .filter((s) => s.ofertas.length >= 2);
  }, [itens, temporadas]);

  /* Black Friday antes da campanha (Weslei, 05/10: "as lojas ainda não
     entraram na mesma campanha"): só a contagem de dias, sem ofertas. */
  const contagens = temporadas.filter((t) => antecipada(t) && !t.ofertasAntecipadas);

  if (!secoes.length && !contagens.length) return null;

  return (
    <div className="mt-8 space-y-6" data-origem="sazonal">
      {secoes.map(({ t, ofertas }) => (
        <section
          key={t.id}
          aria-label={rotuloDa(t)}
          className="overflow-hidden rounded-3xl p-4 shadow-sm sm:p-6"
          style={{ background: t.tema.fundo, color: t.tema.texto }}
        >
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: t.tema.chip, color: t.tema.destaque }}
              >
                <span aria-hidden="true">{t.emoji}</span>
                {contagem(t)}
              </p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
                {rotuloDa(t)}
              </h2>
              <p className="mt-1 max-w-[62ch] text-sm opacity-85">
                O mesmo produto mais barato em outra loja, conferido pela foto, descrição e
                características. Só desconto real, com qualidade igual ou melhor.
              </p>
            </div>
            <a
              href={LINK_CANAL}
              target="_blank"
              rel="noopener noreferrer"
              data-origem="sazonal"
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-80"
              style={{ borderColor: t.tema.destaque, color: t.tema.destaque }}
            >
              Receber os achados no Telegram
            </a>
          </header>

          <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {ofertas.map((o) => (
              <li
                key={o.chave}
                className="flex w-[60%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white text-[#1d1d1f] shadow-sm min-[480px]:w-[38%] sm:w-auto"
              >
                <div className="relative h-32 shrink-0 bg-white sm:h-36">
                  {o.imagem ? (
                    <img
                      src={o.imagem}
                      alt={o.titulo}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-contain p-2.5"
                    />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded-full bg-[#1a7f37] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {brl(o.economia)} a menos
                  </span>
                  {o.parecido && (
                    <span className="absolute right-2 top-2 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold text-[#424245]">
                      Parecido
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col border-t border-[#f0f0f2] p-2.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug">{o.titulo}</p>
                  <p className="mt-1.5 text-base font-extrabold leading-none tabular-nums">
                    {brl(o.preco)}
                  </p>
                  <p className="mt-1 text-[11px] text-[#6e6e73] tabular-nums">
                    <span className="line-through">{brl(o.antes)}</span>{" "}
                    {o.parecido ? "no anúncio comparado" : "em outra loja"}
                  </p>
                  {o.loja && (
                    <p className="mt-1 truncate text-[11px] text-[#6e6e73]">Vendido por {o.loja}</p>
                  )}
                  <div className="mt-auto pt-2.5">
                    {o.recente && o.link ? (
                      <a
                        href={o.link}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        data-origem="sazonal"
                        className="flex items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#1a7f37] px-2 py-1.5 text-[11px] font-bold text-white hover:brightness-95"
                      >
                        <ShieldCheck className="size-3 shrink-0" aria-hidden="true" />
                        Comprar com segurança
                      </a>
                    ) : (
                      o.urlProduto && (
                        <button
                          type="button"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("comparar-link", { detail: o.urlProduto }),
                            )
                          }
                          className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#0071e3] px-2 py-1.5 text-[11px] font-bold text-white hover:brightness-95"
                        >
                          <RefreshCw className="size-3 shrink-0" aria-hidden="true" />
                          Ver o preço de agora
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {contagens.map((t) => (
        <section
          key={t.id}
          aria-label={t.nome}
          className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl px-5 py-5 shadow-sm sm:px-6"
          style={{ background: t.tema.fundo, color: t.tema.texto }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="grid size-16 shrink-0 place-items-center rounded-2xl text-center"
              style={{ background: t.tema.chip, color: t.tema.destaque }}
            >
              <span className="text-2xl font-extrabold leading-none tabular-nums">
                {diasAte(t)}
              </span>
              <span className="-mt-3 text-[10px] font-bold uppercase tracking-wider">
                {diasAte(t) === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: t.tema.destaque }}
              >
                <span aria-hidden="true">{t.emoji} </span>
                {t.nome} · {t.dia.slice(8, 10)}/{t.dia.slice(5, 7)}
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl">
                Faltam {diasAte(t)} {diasAte(t) === 1 ? "dia" : "dias"} para a {t.nome}
              </h2>
              <p className="mt-1 max-w-[62ch] text-sm opacity-85">
                As ofertas aparecem aqui quando a campanha começar. Até lá, acompanhe o preço do que
                você quer: na data, você vê se o desconto é de verdade.
              </p>
            </div>
          </div>
          <a
            href={LINK_CANAL}
            target="_blank"
            rel="noopener noreferrer"
            data-origem="sazonal"
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ borderColor: t.tema.destaque, color: t.tema.destaque }}
          >
            Avisar no Telegram
          </a>
        </section>
      ))}
    </div>
  );
}
