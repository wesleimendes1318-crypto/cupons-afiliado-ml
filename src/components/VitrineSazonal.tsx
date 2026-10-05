/* SEÇÕES SAZONAIS E ESTRATÉGIAS DA VITRINE (Weslei, 05/10: "crie sessões
   prioritárias dessas categorias sazonais... precisa ENCANTAR... design
   profissional"; "alimentar minhas vitrines com múltiplas estratégias").
   Três fontes de oferta, todas JÁ COMPARADAS e com desconto real
   (src/lib/regra-economia.ts):
   1. mesmo produto mais barato em outra loja;
   2. alternativa de qualidade igual ou melhor (alternativa da vitrine);
   3. JÁ É O MENOR PREÇO: o próprio anúncio é o mais barato do mesmo
      produto contra pelo menos 2 lojas mais caras (vitrine_menor_preco).
   Uma seção por temporada com ofertas (Dia das Crianças; Natal
   antecipado), arte própria e contagem de dias; Black Friday antes da
   campanha só com a contagem. Depois, "Já é o menor preço" geral. Compra
   só com link de afiliado e comparação de menos de 24 h (senão "Ver o
   preço de agora"; preço velho não vira compra, regra de 02/10). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Link2, RefreshCw, ShieldCheck } from "lucide-react";

import { ArteSazonal, DecoracaoSazonal } from "@/components/ArteSazonal";
import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { menorPrecoVale } from "@/lib/menor-preco";
import { descontoReal } from "@/lib/regra-economia";
import { antecipada, diasAte, rotuloDa, temporadasEmDestaque, type Temporada } from "@/lib/sazonal";
import { LINK_CANAL } from "@/lib/telegram-publico";

export type ItemVitrine = {
  chave: string;
  titulo: string;
  imagem: string | null;
  loja: string | null;
  preco: number | null;
  url_produto: string | null;
  link?: string | null;
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

export type ItemMenorPreco = {
  chave: string;
  titulo: string;
  imagem: string | null;
  loja: string | null;
  preco: number | null;
  link: string | null;
  url_produto: string | null;
  segunda_preco: number | null;
  segunda_loja: string | null;
  lojas_mais_caras: number | null;
  visto_em: string;
};

export type Oferta = {
  chave: string;
  titulo: string;
  imagem: string | null;
  preco: number;
  antes: number;
  economia: number;
  loja: string | null;
  link: string | null;
  tipo: "mesmo" | "parecido" | "menor";
  lojas?: number | null;
  urlProduto: string | null;
  recente: boolean;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const recente = (iso: string) => Date.now() - Date.parse(iso) < 24 * 3600_000;

/* A melhor oferta de cada produto comparado: o mesmo produto em outra loja
   ou, se economiza mais, a alternativa (que só entra na vitrine com
   qualidade equivalente ou superior; ver alternativa_da_analise). */
export function ofertaDo(i: ItemVitrine): Oferta | null {
  const mesmo =
    (i.economia ?? 0) > 0 && i.melhor_preco != null && i.preco != null
      ? {
          titulo: i.titulo,
          preco: i.melhor_preco,
          economia: i.economia as number,
          loja: i.melhor_loja,
          link: ehLinkDeAfiliado(i.melhor_link) ? i.melhor_link : null,
          tipo: "mesmo" as const,
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
          tipo: "parecido" as const,
        }
      : null;
  const melhor = mesmo && (!alt || mesmo.economia >= alt.economia) ? mesmo : alt;
  if (!melhor || i.preco == null) return null;
  return {
    chave: i.chave,
    imagem: i.imagem,
    antes: i.preco,
    urlProduto: i.url_produto,
    recente: recente(i.visto_em),
    ...melhor,
  };
}

export function ofertaMenorPreco(i: ItemMenorPreco): Oferta | null {
  if (!menorPrecoVale(i) || i.preco == null || i.segunda_preco == null) return null;
  return {
    chave: i.chave,
    titulo: i.titulo,
    imagem: i.imagem,
    preco: i.preco,
    antes: i.segunda_preco,
    economia: Math.round((i.segunda_preco - i.preco) * 100) / 100,
    loja: i.loja,
    link: ehLinkDeAfiliado(i.link) ? i.link : null,
    tipo: "menor",
    lojas: i.lojas_mais_caras,
    urlProduto: i.url_produto,
    recente: recente(i.visto_em),
  };
}

/** Todas as ofertas válidas (as três estratégias), sem repetir produto.
    Mesmo produto e alternativa: desconto real (regra-economia). Menor
    preço: o mais barato contra pelo menos 2 lojas (menorPrecoVale). */
export function useOfertas() {
  const [itens, setItens] = useState<ItemVitrine[]>([]);
  const [menores, setMenores] = useState<ItemMenorPreco[]>([]);
  const [carregou, setCarregou] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [v, m] = await Promise.all([
          supabase.rpc("vitrine" as never, { p_limite: 120 } as never),
          supabase.rpc("vitrine_menor_preco" as never, { p_limite: 120 } as never),
        ]);
        if (!vivo) return;
        if (Array.isArray(v.data)) setItens(v.data as ItemVitrine[]);
        if (Array.isArray(m.data)) setMenores(m.data as ItemMenorPreco[]);
      } catch {
        /* sem dados: as seções mostram o estado vazio */
      } finally {
        if (vivo) setCarregou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  const ofertas = useMemo(() => {
    const vistas = new Set<string>();
    const lista: Oferta[] = [];
    for (const o of [...itens.map(ofertaDo), ...menores.map(ofertaMenorPreco)]) {
      if (!o || vistas.has(o.chave)) continue;
      if (o.tipo !== "menor" && !descontoReal(o.economia, o.antes)) continue;
      vistas.add(o.chave);
      lista.push(o);
    }
    /* Economia de verdade primeiro; "menor preço" com diferença pequena
       depois dos descontos maiores. */
    return lista.sort((a, b) => b.economia - a.economia);
  }, [itens, menores]);
  return { ofertas, carregou };
}

export const daTemporada = (t: Temporada, ofertas: Oferta[]) =>
  ofertas.filter((o) => t.termos.test(o.titulo));

function contagem(t: Temporada) {
  const d = diasAte(t);
  if (antecipada(t)) return `${t.nome} em ${d} ${d === 1 ? "dia" : "dias"}`;
  return d === 0 ? `${t.nome} é hoje` : `Faltam ${d} ${d === 1 ? "dia" : "dias"}`;
}

/* Ícone do Telegram (avião de papel), desenhado aqui. */
export function IconeTelegram({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M21.6 3.2 2.9 10.4c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.7.4.9.9.9.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.4-1.5Zm-3.5 3.6-8.6 7.8-.4 3.4-1.5-4.7 10.2-6.4c.5-.3.9 0 .3 0Z" />
    </svg>
  );
}

export function BotaoTelegram({ t, texto }: { t: Temporada; texto: string }) {
  return (
    <a
      href={LINK_CANAL}
      target="_blank"
      rel="noopener noreferrer"
      data-origem="sazonal"
      className="campanha-botao inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        borderColor: t.tema.borda,
        color: t.tema.texto,
        background: t.tema.superficie,
        outlineColor: t.tema.destaque,
      }}
    >
      <span
        className="grid size-5 place-items-center rounded-full"
        style={{ background: "#2aabee", color: "#fff" }}
      >
        <IconeTelegram className="size-3" />
      </span>
      {texto}
    </a>
  );
}

const SELO: Record<Oferta["tipo"], { texto: string; classe: string }> = {
  mesmo: { texto: "Mesmo produto", classe: "bg-[#eef6ff] text-[#0058b0]" },
  parecido: { texto: "Parecido", classe: "bg-[#f5f5f7] text-[#424245]" },
  menor: { texto: "Menor preço", classe: "bg-[#e8f5ec] text-[#14692e]" },
};

export function CartaoOferta({
  o,
  className = "",
  naHome = true,
  atraso = 0,
}: {
  o: Oferta;
  className?: string;
  /* Fora da home, "Ver o preço de agora" abre a comparação pelo endereço. */
  naHome?: boolean;
  atraso?: number;
}) {
  const selo = SELO[o.tipo];
  return (
    <li
      className={`campanha-entra campanha-cartao flex flex-col overflow-hidden rounded-2xl bg-white text-[#1d1d1f] shadow-[0_2px_10px_rgba(0,0,0,0.08)] ring-1 ring-black/5 ${className}`}
      style={{ animationDelay: `${Math.min(atraso, 8) * 60}ms` }}
    >
      <div className="relative h-36 shrink-0 bg-white sm:h-40">
        {o.imagem ? (
          <img
            src={o.imagem}
            alt={o.titulo}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-3"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-[#86868b]">
            Foto indisponível
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-[#14692e] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          {brl(o.economia)} a menos
        </span>
      </div>
      <div className="flex flex-1 flex-col border-t border-[#f0f0f2] p-3">
        <span
          className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${selo.classe}`}
        >
          {selo.texto}
        </span>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5em] text-xs font-medium leading-snug">
          {o.titulo}
        </p>
        <p className="mt-2 text-[17px] font-extrabold leading-none tabular-nums">{brl(o.preco)}</p>
        <p className="mt-1 min-h-[1.25em] text-[11px] leading-tight text-[#6e6e73] tabular-nums">
          <span className="line-through">{brl(o.antes)}</span>{" "}
          {o.tipo === "menor"
            ? `na 2ª loja mais barata${o.lojas ? ` (de ${o.lojas + 1} lojas)` : ""}`
            : o.tipo === "parecido"
              ? "no anúncio comparado"
              : "em outra loja"}
        </p>
        <p className="mt-1 min-h-[1.25em] truncate text-[11px] text-[#6e6e73]">
          {o.loja ? `Vendido por ${o.loja}` : ""}
        </p>
        <div className="mt-auto pt-2.5">
          {o.recente && o.link ? (
            <a
              href={o.link}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="sazonal"
              className="campanha-botao flex items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#14692e] px-2 py-2 text-[11px] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14692e]"
            >
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Comprar com segurança
            </a>
          ) : (
            o.urlProduto &&
            (!naHome ? (
              <a
                href={`/?link=${encodeURIComponent(o.urlProduto)}`}
                className="campanha-botao flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#0071e3] px-2 py-2 text-[11px] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
              >
                <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                Ver o preço de agora
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("comparar-link", { detail: o.urlProduto }))
                }
                className="campanha-botao flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#0071e3] px-2 py-2 text-[11px] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
              >
                <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                Ver o preço de agora
              </button>
            ))
          )}
        </div>
      </div>
    </li>
  );
}

/* Cartão que completa a grade quando há poucos produtos: convida a colar o
   link do presente (nada de espaço vazio). */
function CartaoColar({
  t,
  naHome,
  className = "",
}: {
  t: Temporada;
  naHome: boolean;
  className?: string;
}) {
  const conteudo = (
    <>
      <span
        className="grid size-10 place-items-center rounded-full"
        style={{ background: t.tema.destaque, color: t.tema.sobreDestaque }}
      >
        <Link2 className="size-5" aria-hidden="true" />
      </span>
      <span className="mt-3 text-sm font-bold" style={{ color: t.tema.texto }}>
        {t.id === "natal" ? "Já escolheu o presente?" : "Tem um produto em mente?"}
      </span>
      <span className="mt-1 text-xs" style={{ color: t.tema.textoSuave }}>
        Cole o link e eu comparo com as outras lojas em menos de 2 minutos.
      </span>
    </>
  );
  const classe =
    "campanha-cartao flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center focus-visible:outline-2 w-full";
  const estilo = { borderColor: t.tema.borda, background: t.tema.superficie };
  return (
    <li className={`flex ${className}`}>
      {naHome ? (
        <a href="#colar-link" className={classe} style={estilo}>
          {conteudo}
        </a>
      ) : (
        <Link to="/" className={classe} style={estilo}>
          {conteudo}
        </Link>
      )}
    </li>
  );
}

/* Grade que se adapta à quantidade real: celular em carrossel (produtos à
   mão logo abaixo do título); no PC grade de 5, completada pelo convite
   de colar o link quando há poucos. */
export function GradeOfertas({
  t,
  lista,
  naHome = true,
}: {
  t: Temporada;
  lista: Oferta[];
  naHome?: boolean;
}) {
  const completar = lista.length < 5;
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
      {lista.map((o, i) => (
        <CartaoOferta
          key={o.chave}
          o={o}
          naHome={naHome}
          atraso={i}
          className="w-[62%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-auto"
        />
      ))}
      {completar && (
        <CartaoColar
          t={t}
          naHome={naHome}
          className="w-[62%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-auto"
        />
      )}
    </ul>
  );
}

/* Seção de uma campanha com ofertas (ativa ou antecipada). */
function SecaoCampanha({ t, lista, total }: { t: Temporada; lista: Oferta[]; total: number }) {
  return (
    <section
      aria-labelledby={`campanha-${t.id}`}
      className="campanha-entra relative overflow-hidden rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
      style={{ background: t.tema.fundo, color: t.tema.texto }}
    >
      <DecoracaoSazonal t={t} />
      <div className="relative grid items-center gap-2 px-4 pt-5 sm:px-7 sm:pt-7 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:gap-6">
        <div className="relative z-10 min-w-0 pr-32 sm:pr-0">
          <p
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: t.tema.superficie,
              color: t.tema.texto,
              boxShadow: `inset 0 0 0 1px ${t.tema.borda}`,
            }}
          >
            <span aria-hidden="true">{t.emoji}</span>
            {contagem(t)}
          </p>
          <h2
            id={`campanha-${t.id}`}
            className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]"
          >
            {rotuloDa(t)}
          </h2>
          <p
            className="mt-1.5 text-[13px] leading-snug sm:hidden"
            style={{ color: t.tema.textoSuave }}
          >
            Já comparados: só desconto real, qualidade igual ou melhor.
          </p>
          <p
            className="mt-2 hidden max-w-[56ch] text-sm leading-relaxed sm:block"
            style={{ color: t.tema.textoSuave }}
          >
            {t.id === "natal"
              ? "Comprar antes é economizar. Presentes já comparados com as outras lojas: o mesmo produto mais barato, uma alternativa de qualidade igual ou melhor, ou o menor preço confirmado."
              : "Produtos já comparados com as outras lojas: o mesmo produto mais barato, uma alternativa de qualidade igual ou melhor, ou o menor preço confirmado."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
            {t.pagina && (
              <Link
                to={t.pagina as "/natal"}
                className="campanha-botao inline-flex items-center rounded-full px-4 py-2 text-xs font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: t.tema.destaque,
                  color: t.tema.sobreDestaque,
                  outlineColor: t.tema.destaque,
                }}
              >
                Ver {total > lista.length ? `todos os ${total}` : "a página"}
              </Link>
            )}
            <BotaoTelegram t={t} texto="Receber no Telegram" />
          </div>
        </div>
        <ArteSazonal
          t={t}
          className="pointer-events-none absolute -right-1 top-3 h-28 w-36 sm:static sm:mx-auto sm:h-40 sm:w-56 md:h-52 md:w-full"
        />
      </div>
      <div className="relative px-4 pb-5 pt-4 sm:px-7 sm:pb-7">
        <GradeOfertas t={t} lista={lista} />
      </div>
    </section>
  );
}

/* Campanha sem oferta conferida ainda (ativa) ou futura que só mostra a
   contagem (Black Friday antes da campanha). */
function CartaoCampanhaCompacta({ t, futura }: { t: Temporada; futura: boolean }) {
  const d = diasAte(t);
  return (
    <section
      aria-labelledby={`campanha-${t.id}`}
      className="campanha-entra relative overflow-hidden rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
      style={{ background: t.tema.fundo, color: t.tema.texto }}
    >
      <DecoracaoSazonal t={t} />
      <div className="relative grid items-center gap-4 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-7 md:grid-cols-[auto_minmax(0,1fr)_200px_auto]">
        <div
          className="grid size-[72px] place-items-center rounded-2xl text-center"
          style={{ background: t.tema.superficie, boxShadow: `inset 0 0 0 1px ${t.tema.borda}` }}
        >
          <span
            className="text-[28px] font-extrabold leading-none tabular-nums"
            style={{ color: t.tema.rotulo }}
          >
            {d}
          </span>
          <span
            className="-mt-4 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: t.tema.textoSuave }}
          >
            {d === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="relative z-10 min-w-0 pr-24 md:pr-0">
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: t.tema.rotulo }}
          >
            <span aria-hidden="true">{t.emoji} </span>
            {t.nome} · {t.dia.slice(8, 10)}/{t.dia.slice(5, 7)}
          </p>
          <h2
            id={`campanha-${t.id}`}
            className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl"
          >
            {d === 0
              ? `${t.nome} é hoje`
              : `Faltam ${d} ${d === 1 ? "dia" : "dias"} para a ${t.nome}`}
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm" style={{ color: t.tema.textoSuave }}>
            {futura
              ? "As ofertas aparecem aqui quando a campanha começar. Até lá, acompanhe o preço do que você quer: na data, você vê se o desconto é de verdade."
              : "Os achados aparecem aqui assim que forem conferidos. Cole o link do produto que você quer e eu comparo agora."}
          </p>
        </div>
        <ArteSazonal
          t={t}
          className="pointer-events-none absolute -right-2 top-1 h-24 w-32 opacity-90 md:static md:h-28 md:w-full md:opacity-100"
        />
        <BotaoTelegram t={t} texto="Avisar no Telegram" />
      </div>
    </section>
  );
}

export function VitrineSazonal() {
  const [temporadas] = useState(() => temporadasEmDestaque());
  const { ofertas, carregou } = useOfertas();

  const secoes = useMemo(() => {
    const usados = new Set<string>();
    return temporadas
      .filter((t) => !antecipada(t) || t.ofertasAntecipadas)
      .map((t) => {
        const todas = daTemporada(t, ofertas).filter((o) => !usados.has(o.chave));
        const lista = todas.slice(0, 10);
        lista.forEach((o) => usados.add(o.chave));
        return { t, lista, total: todas.length };
      });
  }, [ofertas, temporadas]);

  /* "Já é o menor preço" fora das temporadas (estratégia geral). */
  const menores = useMemo(() => {
    const nasSecoes = new Set(secoes.flatMap((s) => s.lista.map((o) => o.chave)));
    return ofertas.filter((o) => o.tipo === "menor" && !nasSecoes.has(o.chave)).slice(0, 10);
  }, [ofertas, secoes]);

  /* Black Friday antes da campanha (Weslei, 05/10: "as lojas ainda não
     entraram na mesma campanha"): só a contagem de dias, sem ofertas. */
  const futuras = temporadas.filter((t) => antecipada(t) && !t.ofertasAntecipadas);

  if (!temporadas.length && menores.length < 2) return null;

  return (
    <div className="mt-8 space-y-6" data-origem="sazonal">
      {secoes.map(({ t, lista, total }) =>
        lista.length > 0 ? (
          <SecaoCampanha key={t.id} t={t} lista={lista} total={total} />
        ) : carregou ? (
          <CartaoCampanhaCompacta key={t.id} t={t} futura={false} />
        ) : null,
      )}

      {menores.length >= 2 && (
        <section
          aria-labelledby="campanha-menor-preco"
          className="campanha-entra overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-sm sm:p-7"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f5ec] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#14692e]">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Conferido em várias lojas
          </p>
          <h2 id="campanha-menor-preco" className="mt-3 text-2xl font-extrabold tracking-tight">
            Já é o menor preço
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-secondary-ink">
            O anúncio já é o mais barato entre as lojas que vendem o mesmo produto. A diferença para
            a 2ª loja mais barata aparece em cada cartão.
          </p>
          <div className="mt-4">
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
              {menores.map((o, i) => (
                <CartaoOferta
                  key={o.chave}
                  o={o}
                  atraso={i}
                  className="w-[62%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-auto"
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      {futuras.map((t) => (
        <CartaoCampanhaCompacta key={t.id} t={t} futura />
      ))}
    </div>
  );
}
