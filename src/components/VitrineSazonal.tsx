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
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Link2, RefreshCw, ShieldCheck } from "lucide-react";

import { CenarioCampanha } from "@/components/CenarioCampanha";
import {
  identificarTema,
  TEMAS_VISUAIS,
  type PaletaCampanha,
  type TemaVisualId,
} from "@/lib/campanha-visual";
import { seloDoMenorPreco } from "@/lib/selos";
import { lerFretesDaVitrine, semEconomiaSemFrete } from "@/lib/frete-vitrine";
import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { menorPrecoVale } from "@/lib/menor-preco";
import { descontoReal } from "@/lib/regra-economia";
import {
  antecipada,
  combinaComTemporada,
  diasAte,
  rotuloDa,
  temporadasEmDestaque,
  type Temporada,
} from "@/lib/sazonal";
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
  /* Quando foi comparado (para "preço de dd/mm"). */
  vistoEm?: string;
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
    vistoEm: i.visto_em,
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
    vistoEm: i.visto_em,
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
        const [v, m, fretes] = await Promise.all([
          supabase.rpc("vitrine" as never, { p_limite: 120 } as never),
          supabase.rpc("vitrine_menor_preco" as never, { p_limite: 120 } as never),
          lerFretesDaVitrine(),
        ]);
        if (!vivo) return;
        if (Array.isArray(v.data)) setItens(semEconomiaSemFrete(v.data as ItemVitrine[], fretes));
        if (Array.isArray(m.data))
          setMenores(
            (m.data as ItemMenorPreco[]).filter((i) => fretes.get(i.chave)?.frete_gratis === true),
          );
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
  ofertas.filter((o) => combinaComTemporada(t, o.titulo));

/* ------------------------------------------------------------------
   VITRINE DE CAMPANHAS (Weslei, 05/10: experiência visual encantadora,
   profissional e alinhada à marca; identificar o tema de cada campanha e
   adaptar arte, símbolos, cores e composição). O tema vem de
   identificarTema (configurado > conteúdo > neutro) e a paleta, a arte e os
   textos, de src/lib/campanha-visual.ts. Títulos, preços, datas e botões
   ficam no HTML, separados da arte. */

/* Campanha para a vitrine: as temporadas e qualquer campanha futura (outra
   data, categoria) com o mínimo para identificar o tema e contar os dias. */
export type CampanhaVitrine = {
  id: string;
  nome: string;
  emoji?: string;
  inicio: string;
  fim: string;
  dia: string;
  pagina?: string;
  temaVisual?: TemaVisualId;
  titulo?: string;
  tituloDestaque?: string;
  descricao?: string;
  descricaoConteudo?: string;
  categorias?: ReadonlyArray<{ nome: string }>;
};

/** Tema de UMA campanha (campanhas simultâneas não se misturam). */
export function temaDaCampanha(c: CampanhaVitrine, lista: Oferta[]) {
  return identificarTema({
    temaConfigurado: c.temaVisual ?? null,
    nome: c.nome,
    descricao: c.descricaoConteudo ?? c.descricao ?? null,
    categorias: (c.categorias ?? []).map((x) => x.nome),
    produtos: lista.map((o) => o.titulo),
  });
}

const comoTemporada = (c: CampanhaVitrine) => c as unknown as Temporada;

function contagem(c: CampanhaVitrine) {
  const t = comoTemporada(c);
  const d = diasAte(t);
  const data = `${c.dia.slice(8, 10)}/${c.dia.slice(5, 7)}`;
  if (antecipada(t)) return `${c.nome} em ${d} ${d === 1 ? "dia" : "dias"} · ${data}`;
  return d === 0 ? `${c.nome} é hoje` : `Faltam ${d} ${d === 1 ? "dia" : "dias"} · ${data}`;
}

const dataCurta = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;

/* Ícone do Telegram (avião de papel), desenhado aqui. */
export function IconeTelegram({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M21.6 3.2 2.9 10.4c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.7.4.9.9.9.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.4-1.5Zm-3.5 3.6-8.6 7.8-.4 3.4-1.5-4.7 10.2-6.4c.5-.3.9 0 .3 0Z" />
    </svg>
  );
}

export function BotaoTelegram({ p, texto }: { p: PaletaCampanha; texto: string }) {
  return (
    <a
      href={LINK_CANAL}
      target="_blank"
      rel="noopener noreferrer"
      data-origem="sazonal"
      className="campanha-botao inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        borderColor: p.borda,
        color: p.texto,
        background: p.superficie,
        outlineColor: p.destaque,
      }}
    >
      <span className="grid size-5 place-items-center rounded-full bg-[#2aabee] text-white">
        <IconeTelegram className="size-3" />
      </span>
      {texto}
    </a>
  );
}

/* Classificação do cartão: o que está sendo comparado, com o dado. */
function classificacao(o: Oferta) {
  if (o.tipo === "menor") {
    const selo = seloDoMenorPreco(o.lojas ?? null, o.preco, o.antes);
    return {
      chip: selo?.texto ?? "Melhor preço",
      chipClasse: "bg-[#e8f1fd] text-[#0058b0]",
      linha: (
        <>
          {selo?.nota ?? "entre as lojas consultadas"} · 2ª loja{" "}
          <span className="tabular-nums">{brl(o.antes)}</span>
        </>
      ),
    };
  }
  const aMenos = (
    <strong className="font-bold text-[#14692e] tabular-nums">{brl(o.economia)} a menos</strong>
  );
  return o.tipo === "parecido"
    ? {
        chip: "Parecido",
        chipClasse: "bg-[#fff4e0] text-[#8a5300]",
        linha: (
          <>
            {aMenos} que o anúncio comparado (
            <span className="line-through tabular-nums">{brl(o.antes)}</span>). Não é idêntico.
          </>
        ),
      }
    : {
        chip: "Mesmo produto",
        chipClasse: "bg-[#e8f5ec] text-[#14692e]",
        linha: (
          <>
            {aMenos} que em outra loja (
            <span className="line-through tabular-nums">{brl(o.antes)}</span>)
          </>
        ),
      };
}

export function CartaoOferta({
  o,
  className = "",
  naHome = true,
  atraso = 0,
}: {
  o: Oferta;
  className?: string;
  /* Fora da home, "Atualizar preço" abre a comparação pelo endereço. */
  naHome?: boolean;
  atraso?: number;
}) {
  const c = classificacao(o);
  const quando = o.recente ? "Conferido hoje" : `Preço de ${dataCurta(o.vistoEm) ?? "antes"}`;
  const atualizar = !o.link || !o.recente;
  const classeAtualizar = o.link
    ? "mt-1.5 text-[#0058b0] hover:bg-[#f5f5f7]"
    : "bg-[#0071e3] py-2 font-bold text-white hover:brightness-110";
  return (
    <li
      className={`campanha-entra campanha-cartao flex flex-col overflow-hidden rounded-2xl bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 ${className}`}
      style={{ animationDelay: `${Math.min(atraso, 8) * 50}ms` }}
    >
      {/* Foto sempre dentro da área (05/10: fotos grandes estouravam o
          cartão): caixa de altura fixa e imagem absoluta com object-contain. */}
      <div className="relative h-28 overflow-hidden bg-white sm:h-32">
        {o.imagem ? (
          <img
            src={o.imagem}
            alt={o.titulo}
            width={200}
            height={200}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-2.5"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[11px] text-[#86868b]">
            Foto indisponível
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-[#f0f0f2] p-3">
        <p className="line-clamp-2 min-h-[2.5em] text-[12px] font-semibold leading-snug">
          {o.titulo}
        </p>
        <p className="mt-1.5 text-[17px] font-extrabold leading-none tracking-tight tabular-nums">
          {brl(o.preco)}
        </p>
        <span
          className={`mt-1.5 self-start rounded-full px-2 py-0.5 text-[10px] font-bold ${c.chipClasse}`}
        >
          {c.chip}
        </span>
        <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-[#515154]">{c.linha}</p>
        <p className="mt-1 truncate text-[11px] text-[#6e6e73]">
          {o.loja ? `Vendido por ${o.loja}` : " "}
        </p>
        <p className="text-[10px] text-[#86868b]">{quando}</p>
        <div className="mt-auto pt-3">
          <VerDetalhesVitrine
            chave={o.chave}
            titulo={o.titulo}
            imagem={o.imagem}
            preco={o.preco}
            link={o.link}
            vistoEm={o.vistoEm ?? null}
            className="mb-0.5"
          />
          {o.link && (
            <a
              href={o.link}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-origem="sazonal"
              className="campanha-botao flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#14692e] px-2 py-1.5 text-[11px] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14692e]"
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              Comprar com segurança
            </a>
          )}
          {atualizar &&
            o.urlProduto &&
            (naHome ? (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("comparar-link", { detail: o.urlProduto }))
                }
                className={`campanha-botao flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${classeAtualizar}`}
              >
                <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                {o.link ? "Atualizar preço" : "Ver o preço de agora"}
              </button>
            ) : (
              <a
                href={`/?link=${encodeURIComponent(o.urlProduto)}`}
                className={`campanha-botao flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${classeAtualizar}`}
              >
                <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                {o.link ? "Atualizar preço" : "Ver o preço de agora"}
              </a>
            ))}
        </div>
      </div>
    </li>
  );
}

/* Convite "Tem um produto em mente?": do tamanho de um cartão, integrado à
   grade (data-convite-colar esconde o botão flutuante enquanto aparece). */
function CartaoColar({
  p,
  natal,
  naHome,
  className = "",
}: {
  p: PaletaCampanha;
  natal: boolean;
  naHome: boolean;
  className?: string;
}) {
  const conteudo = (
    <>
      <span
        className="grid size-10 place-items-center rounded-full"
        style={{ background: p.destaque, color: p.sobreDestaque }}
      >
        <Link2 className="size-5" aria-hidden="true" />
      </span>
      <span className="mt-2.5 text-[14px] font-bold leading-snug" style={{ color: p.texto }}>
        {natal ? "Já escolheu o presente?" : "Tem um produto em mente?"}
      </span>
      <span className="mt-1 text-[12px] leading-snug" style={{ color: p.textoSuave }}>
        Cole o link e eu comparo com as outras lojas em menos de 2 minutos.
      </span>
      <span
        className="mt-3 inline-flex min-h-9 items-center rounded-full px-4 text-[12px] font-bold"
        style={{ background: p.destaque, color: p.sobreDestaque }}
      >
        Colar o link
      </span>
    </>
  );
  const classe =
    "campanha-cartao flex h-full w-full flex-col items-center justify-center rounded-2xl border p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2";
  const estilo = { borderColor: p.borda, background: p.cartao, outlineColor: p.destaque };
  return (
    <li className={`flex ${className}`} data-convite-colar>
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

/* Grade: celular em carrossel (produtos à mão logo abaixo do destaque); PC
   em 5 colunas, completada pelo convite quando há poucos. */
export function GradeOfertas({
  p,
  lista,
  naHome = true,
  natal = false,
}: {
  p: PaletaCampanha;
  lista: Oferta[];
  naHome?: boolean;
  natal?: boolean;
}) {
  const completar = lista.length < 5 || lista.length % 5 !== 0;
  const largura = "w-[56%] shrink-0 snap-start min-[480px]:w-[38%] sm:w-auto";
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
      {lista.map((o, i) => (
        <CartaoOferta key={o.chave} o={o} naHome={naHome} atraso={i} className={largura} />
      ))}
      {completar && <CartaoColar p={p} natal={natal} naHome={naHome} className={largura} />}
    </ul>
  );
}

/* Destaque de uma campanha com ofertas: título curto em duas partes,
   descrição de uma linha, ações e a arte do tema com as fotos reais. */
export function SecaoCampanha({
  c,
  lista,
  total,
  naHome = true,
}: {
  c: CampanhaVitrine;
  lista: Oferta[];
  total: number;
  naHome?: boolean;
}) {
  const { tema } = temaDaCampanha(c, lista);
  const v = TEMAS_VISUAIS[tema];
  const p = v.paleta;
  const titulo = c.titulo ?? v.titulo;
  const destaque = c.tituloDestaque ?? v.tituloDestaque;
  const descricao = c.descricao ?? v.descricao;
  const fotos = lista.map((o) => o.imagem);
  return (
    <section
      aria-labelledby={`campanha-${c.id}`}
      data-tema={tema}
      className="campanha-entra relative overflow-hidden rounded-[28px] shadow-[0_10px_40px_-18px_rgba(0,0,0,0.25)]"
      style={{ background: p.fundo, color: p.texto }}
    >
      {/* Cenário de estúdio: no celular, faixa no topo que some no fundo; no
          PC, a lateral direita do destaque, fundida no fundo da seção. */}
      <CenarioCampanha
        tema={tema}
        fundir="baixo"
        cartao={false}
        className="relative h-44 md:hidden"
      />
      <CenarioCampanha
        tema={tema}
        fotos={fotos}
        fundir="ambos"
        className="absolute right-0 top-0 hidden h-[300px] w-[52%] md:block"
      />
      <div className="relative -mt-8 px-5 pt-0 sm:px-7 md:mt-0 md:flex md:min-h-[300px] md:items-center md:pt-6">
        <div className="min-w-0 md:max-w-[50%]">
          <p
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: p.superficie,
              color: p.rotulo,
              boxShadow: `inset 0 0 0 1px ${p.borda}`,
            }}
          >
            {c.emoji && <span aria-hidden="true">{c.emoji}</span>}
            {contagem(c)}
          </p>
          <h2
            id={`campanha-${c.id}`}
            className="mt-2.5 text-[22px] font-extrabold leading-[1.15] tracking-tight sm:text-[28px]"
          >
            {titulo} <span style={{ color: p.realce }}>{destaque}</span>
          </h2>
          <p
            className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed sm:text-[14px]"
            style={{ color: p.textoSuave }}
          >
            {descricao}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {c.pagina ? (
              <Link
                to={c.pagina as "/natal"}
                className="campanha-botao inline-flex min-h-10 items-center rounded-full px-5 py-2 text-[13px] font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: p.destaque, color: p.sobreDestaque, outlineColor: p.destaque }}
              >
                {total > lista.length ? `Ver todos os ${total}` : `Ver os ${total} achados`}
              </Link>
            ) : (
              <a
                href={`#ofertas-${c.id}`}
                className="campanha-botao inline-flex min-h-10 items-center rounded-full px-5 py-2 text-[13px] font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: p.destaque, color: p.sobreDestaque, outlineColor: p.destaque }}
              >
                Ver os {total} achados
              </a>
            )}
            <BotaoTelegram p={p} texto="Receber no Telegram" />
          </div>
        </div>
      </div>
      <div id={`ofertas-${c.id}`} className="px-4 pb-5 pt-4 sm:px-7 sm:pb-6">
        <GradeOfertas p={p} lista={lista} naHome={naHome} natal={tema === "natal"} />
      </div>
    </section>
  );
}

/* Campanha sem oferta conferida ainda (ativa) ou futura que só mostra a
   contagem (Black Friday antes da campanha). */
export function CartaoCampanhaCompacta({ c, futura }: { c: CampanhaVitrine; futura: boolean }) {
  const { tema } = temaDaCampanha(c, []);
  const p = TEMAS_VISUAIS[tema].paleta;
  const d = diasAte(comoTemporada(c));
  return (
    <section
      aria-labelledby={`campanha-${c.id}`}
      data-tema={tema}
      className="campanha-entra relative overflow-hidden rounded-[28px] shadow-[0_10px_40px_-18px_rgba(0,0,0,0.25)]"
      style={{ background: p.fundo, color: p.texto }}
    >
      <CenarioCampanha
        tema={tema}
        fundir="esquerda"
        cartao={false}
        className="absolute inset-y-0 right-0 hidden w-[46%] md:block"
      />
      <div className="relative grid items-center gap-4 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-7 md:min-h-[150px] md:grid-cols-[auto_minmax(0,1fr)_auto] md:pr-[30%]">
        <div
          className="grid size-[76px] place-items-center rounded-2xl text-center"
          style={{ background: p.superficie, boxShadow: `inset 0 0 0 1px ${p.borda}` }}
        >
          <span
            className="text-[30px] font-extrabold leading-none tabular-nums"
            style={{ color: p.rotulo }}
          >
            {d}
          </span>
          <span
            className="-mt-4 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: p.textoSuave }}
          >
            {d === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: p.rotulo }}>
            {c.emoji && <span aria-hidden="true">{c.emoji} </span>}
            {c.nome} · {c.dia.slice(8, 10)}/{c.dia.slice(5, 7)}
          </p>
          <h2
            id={`campanha-${c.id}`}
            className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl"
          >
            {d === 0
              ? `${c.nome} é hoje`
              : `Faltam ${d} ${d === 1 ? "dia" : "dias"} para a ${c.nome}`}
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm" style={{ color: p.textoSuave }}>
            {futura
              ? "As ofertas aparecem aqui quando a campanha começar. Até lá, acompanhe o preço do que você quer: na data, você vê se o desconto é de verdade."
              : "Os achados aparecem aqui assim que forem conferidos. Cole o link do produto que você quer e eu comparo agora."}
          </p>
        </div>
        <BotaoTelegram p={p} texto="Avisar no Telegram" />
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
          <SecaoCampanha key={t.id} c={t} lista={lista} total={total} />
        ) : carregou ? (
          <CartaoCampanhaCompacta key={t.id} c={t} futura={false} />
        ) : null,
      )}

      {menores.length >= 2 && (
        <section
          aria-labelledby="campanha-menor-preco"
          className="campanha-entra overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-sm sm:p-7"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1fd] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0058b0]">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Conferido em várias lojas
          </p>
          <h2 id="campanha-menor-preco" className="mt-3 text-2xl font-extrabold tracking-tight">
            Melhor preço entre as lojas
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-secondary-ink">
            O anúncio já é o mais barato entre as lojas consultadas que vendem o mesmo produto. A
            diferença para a 2ª loja aparece em cada cartão.
          </p>
          <div className="mt-4">
            <GradeOfertas p={TEMAS_VISUAIS.neutro.paleta} lista={menores} />
          </div>
        </section>
      )}

      {futuras.map((t) => (
        <CartaoCampanhaCompacta key={t.id} c={t} futura />
      ))}
    </div>
  );
}
