/* Vitrine: produtos que alguém já comparou aqui.

   Só aparece o que foi pesquisado de verdade no site (nada de varrer
   catálogo). O preço vem SEMPRE com a data em que foi visto, e cada item tem
   "Comparar de novo" para atualizar antes de comprar: preço velho mostrado
   como atual seria enganar o cliente. Categorias proibidas para anúncio do
   Google ficam de fora no próprio banco (função vitrine). */

import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, TrendingDown } from "lucide-react";

import { CATEGORIAS } from "@/content/categorias";
import { lerFretesDaVitrine, semEconomiaSemFrete } from "@/lib/frete-vitrine";
import { recomendavel } from "@/lib/vitrine-recomendavel";
import { supabase } from "@/integrations/supabase/client";
import { atributoProduto } from "@/lib/perfil-visitante";
import { ehLinkDeAfiliado } from "@/lib/afiliado";
import { itemDoEndereco, type ResumoAvaliacoes } from "@/lib/avaliacoes-detalhe";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { CompararPreco, ComprarComSeguranca } from "@/components/BotoesCartao";
import { propsFotoCartao } from "@/lib/foto";
import { TrilhoRecomendacao } from "@/components/recomendacoes/TrilhoRecomendacao";
import { ordenarPorPontuacao } from "@/lib/vitrines-ranking";
import { SeloMarketplace } from "@/components/SeloMarketplace";
import { LinhaAvaliacoes, SeloBemAvaliado } from "@/components/Avaliacoes";
import {
  avaliacaoDaOferta,
  ContextoAvaliacoes,
  lerAvaliacoesDaVitrine,
  type MapaAvaliacoes,
} from "@/lib/avaliacoes-vitrine";
import { passaNaQualidade } from "@/lib/qualidade-avaliacao";

const NOME_CATEGORIA: Record<string, string> = Object.fromEntries([
  ...CATEGORIAS.map((c) => [c.slug, c.nome] as const),
  ["outros", "Mais achados"] as const,
]);

type ItemVitrine = {
  chave: string;
  titulo: string;
  imagem: string | null;
  categoria: string | null;
  categoria_site: string | null;
  loja: string | null;
  preco: number | null;
  url_produto: string | null;
  link: string | null;
  melhor_loja: string | null;
  melhor_preco: number | null;
  melhor_link: string | null;
  economia: number | null;
  lojas_comparadas: number | null;
  vezes: number | null;
  visto_em: string;
  cupom_codigo: string | null;
  cupom_desconto: string | null;
  /* Melhor alternativa: parecido mais barato e muito parecido (não é idêntico). */
  alt_preco: number | null;
  alt_economia: number | null;
  alt_titulo: string | null;
  alt_link: string | null;
  alt_loja: string | null;
  alt_oficial: boolean | null;
  alt_vantagem: string | null;
  alt_frete_gratis: boolean | null;
  alt_muda: string | null;
  /* 26/10 (Weslei: "padronização"): mais vendido da lista oficial que
     completa a fileira da categoria no mesmo cartão. */
  maisVendido?: "vendidos" | "tendencia" | "curadoria";
  resumo?: ResumoAvaliacoes | undefined;
  freteGratis?: boolean;
  lojaOficial?: boolean;
};

/* Maior economia que a comparação achou: a do mesmo produto ou, quando maior,
   a da melhor alternativa (parecido), que o selo diz "Até R$ X de desconto". */
const maiorEconomia = (i: ItemVitrine) => Math.max(i.economia ?? 0, i.alt_economia ?? 0);

/* Oferta atrás do botão: a melhor loja quando ela economiza, senão o anúncio. */
const destinoDe = (i: ItemVitrine) =>
  ((i.economia ?? 0) > 0 && i.melhor_preco != null ? i.melhor_link : null) ?? i.link;

const semAlternativa = (i: ItemVitrine): ItemVitrine => ({
  ...i,
  alt_preco: null,
  alt_economia: null,
  alt_titulo: null,
  alt_link: null,
  alt_loja: null,
  alt_oficial: null,
  alt_vantagem: null,
  alt_frete_gratis: null,
  alt_muda: null,
});

/* QUALIDADE PRIMEIRO (Weslei, 18/10: "Garanta sempre produtos com
   qualidade!!!!! Boas avaliações"): a oferta do botão e a alternativa só
   aparecem com nota 4,5 ou mais lida na página do anúncio
   (src/lib/qualidade-avaliacao.ts). Alternativa reprovada sai do cartão; o
   produto fica se a oferta dele passar. Leitura das notas que não trouxe
   nada (falha da rede) não esvazia a vitrine: aí só a nota baixa conhecida
   barra. */
function comQualidade(lista: ItemVitrine[], mapa: MapaAvaliacoes): ItemVitrine[] {
  const exigir = mapa.size > 0;
  const out: ItemVitrine[] = [];
  for (const i of lista) {
    const altOk =
      !!i.alt_link && passaNaQualidade(avaliacaoDaOferta(mapa, i.chave, i.alt_link), exigir);
    const item = altOk || !i.alt_link ? i : semAlternativa(i);
    if (!passaNaQualidade(avaliacaoDaOferta(mapa, i.chave, destinoDe(item)), exigir)) continue;
    out.push(item);
  }
  return out;
}

/* Código de cupom já gerado da loja, pronto para copiar. */
function CupomDaLoja({ codigo, desconto }: { codigo: string; desconto: string | null }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(codigo);
          setCopiou(true);
          setTimeout(() => setCopiou(false), 2500);
        } catch {
          /* sem área de transferência: o código continua visível */
        }
      }}
      className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-success bg-success/10 px-2 py-1.5 text-left"
      title="Copiar código do cupom"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-success">
          Cupom da loja{desconto ? ` · ${desconto}` : ""}
        </span>
        <span className="block truncate font-mono text-xs font-bold">{codigo}</span>
      </span>
      <span className="shrink-0 text-[11px] font-bold text-success">
        {copiou ? "copiado ✓" : "copiar"}
      </span>
    </button>
  );
}

const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const quando = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
};

type Aba = "recentes" | "economias" | "procurados";

/* Economia mínima para o 3º bloco da home ("diferença relevante"). */
const ECONOMIA_RELEVANTE = 10;

export function Vitrine({
  categoriaFixa,
  vazio,
}: {
  /* Página de categoria (09/10): só os produtos dela, sem os filtros de
     categoria. Sem ela (home, 27/10): só as oportunidades com economia real,
     numa fileira. */
  categoriaFixa?: string;
  /* Mostrado quando a categoria fixa ainda não tem produto. */
  vazio?: ReactNode;
} = {}) {
  const [itens, setItens] = useState<ItemVitrine[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<MapaAvaliacoes>(() => new Map());
  const [carregou, setCarregou] = useState(false);
  const [aba, setAba] = useState<Aba>("recentes");
  /* 24 de cada vez, sem teto (Weslei, 28/10: "Jamais limitar"). */
  const [mostrar, setMostrar] = useState(24);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ data }, fretes] = await Promise.all([
          supabase.rpc("vitrine" as never, { p_limite: categoriaFixa ? 300 : 120 } as never),
          lerFretesDaVitrine(),
        ]);
        if (!vivo || !Array.isArray(data)) return;
        const lidos = data as ItemVitrine[];
        /* Nota das pessoas de cada oferta (10/10), da última comparação. */
        const mapa = await lerAvaliacoesDaVitrine(lidos.map((i) => i.chave));
        if (!vivo) return;
        setAvaliacoes(mapa);
        setItens(
          comQualidade(semEconomiaSemFrete(lidos, fretes), mapa).filter((i) =>
            recomendavel(i, fretes),
          ),
        );
      } catch {
        /* sem vitrine: a página segue normal */
      } finally {
        if (vivo) setCarregou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [categoriaFixa]);

  const lista = useMemo(() => {
    let l = itens.filter((i) => (i.categoria_site ?? "outros") === categoriaFixa);
    if (aba === "economias")
      l = l.filter((i) => maiorEconomia(i) > 0).sort((a, b) => maiorEconomia(b) - maiorEconomia(a));
    else if (aba === "procurados") l = [...l].sort((a, b) => (b.vezes ?? 0) - (a.vezes ?? 0));
    return l;
  }, [itens, aba, categoriaFixa]);

  /* OPORTUNIDADES COM ECONOMIA REAL (3º bloco da home, 27/10): o mesmo
     produto mais barato em outra loja, com frete grátis confirmado nela
     (semEconomiaSemFrete zera o resto), sem repetir título, na ordem do
     ranking (nota lida, economia, frete). */
  const oportunidades = useMemo(() => {
    if (categoriaFixa) return [];
    const titulos = new Set<string>();
    const comEconomia = itens
      .filter((i) => (i.economia ?? 0) >= ECONOMIA_RELEVANTE && i.melhor_preco != null)
      .filter((i) => {
        const k = i.titulo.toLowerCase();
        if (titulos.has(k)) return false;
        titulos.add(k);
        return true;
      })
      .sort((a, b) => (b.economia ?? 0) - (a.economia ?? 0));
    return ordenarPorPontuacao(comEconomia, (i) => {
      const a = avaliacaoDaOferta(avaliacoes, i.chave, destinoDe(i))?.avaliacoes;
      return {
        nota: a?.nota,
        totalAvaliacoes: a?.total,
        economiaReais: i.economia,
        freteGratis: true,
      };
    });
  }, [itens, avaliacoes, categoriaFixa]);

  if (!categoriaFixa) {
    if (oportunidades.length < 3) return null;
    return (
      <ContextoAvaliacoes.Provider value={avaliacoes}>
        <div data-origem="vitrine">
          <TrilhoRecomendacao
            id="economia-real"
            icone={<TrendingDown className="size-5 text-success" />}
            titulo="Oportunidades com economia real"
            subtitulo="O mesmo produto mais barato em outra loja, com frete grátis confirmado. Preço de quando foi comparado: atualize antes de comprar."
          >
            {oportunidades.map((i) => (
              <Cartao key={i.chave} i={i} trilho />
            ))}
          </TrilhoRecomendacao>
        </div>
      </ContextoAvaliacoes.Provider>
    );
  }

  if (!carregou) return null;
  if (!lista.length && aba === "recentes") return <>{vazio ?? null}</>;

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "recentes", rotulo: "Pesquisados agora" },
    { id: "economias", rotulo: "Maiores economias" },
    { id: "procurados", rotulo: "Mais procurados" },
  ];

  return (
    <ContextoAvaliacoes.Provider value={avaliacoes}>
      <section className="mt-8" aria-label="Produtos já comparados" data-origem="vitrine">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">
              {`${NOME_CATEGORIA[categoriaFixa] ?? "Produtos"} que já comparei`}
            </h2>
            <p className="mt-1 text-sm text-secondary-ink">
              Preço de quando foi comparado. Toque em "Atualizar preço" para ver o preço de agora.
              {avaliacoes.size > 0 && " Só entram produtos com nota 4,5 ou mais de quem comprou."}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => {
                setAba(a.id);
                setMostrar(24);
              }}
              className={
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors " +
                (aba === a.id
                  ? "bg-ml-blue text-white"
                  : "border border-border bg-card hover:border-ml-blue")
              }
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-secondary-ink">
            Ainda não há produtos nesta lista.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
            {lista.slice(0, mostrar).map((i) => (
              <Cartao key={i.chave} i={i} />
            ))}
          </ul>
        )}
        {lista.length > mostrar && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMostrar((m) => m + 24)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3]/40 bg-card px-5 py-2.5 text-sm font-semibold text-[#0058b0] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              Ver mais {Math.min(24, lista.length - mostrar)} produtos
            </button>
          </div>
        )}
      </section>
    </ContextoAvaliacoes.Provider>
  );
}

function Cartao({ i, trilho = false }: { i: ItemVitrine; trilho?: boolean }) {
  const temEconomia = (i.economia ?? 0) > 0 && i.melhor_preco != null;
  const destino = destinoDe(i);
  const avaliacoes = useContext(ContextoAvaliacoes);
  const avaliacao = i.resumo ?? avaliacaoDaOferta(avaliacoes, i.chave, destino);
  /* Alternativa parecida que economiza mais que o mesmo produto: o selo vira
     "Até R$ X de desconto" (não é idêntico, por isso o "Até"). */
  const temAlternativa = (i.alt_economia ?? 0) > (temEconomia ? (i.economia ?? 0) : 0);
  const preco = temEconomia ? i.melhor_preco : i.preco;
  /* ENQUADRAMENTO (Weslei, 18/10: "melhor ajustado e não competindo com a
     foto"): a foto ocupa um quadro limpo, sem selo por cima; os selos vão
     na linha logo abaixo. Tocar na foto abre fotos e detalhes. */
  const foto = (
    <span className="relative block aspect-[4/3] overflow-hidden bg-white sm:aspect-auto sm:h-40">
      {i.imagem ? (
        <img
          {...propsFotoCartao(i.imagem)}
          alt={i.titulo}
          width={200}
          height={200}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain p-2.5 transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] text-secondary-ink">
          {NOME_CATEGORIA[i.categoria_site ?? "outros"] ?? "Produto comparado"}
        </span>
      )}
    </span>
  );
  return (
    <li
      key={i.chave}
      {...atributoProduto({
        chave: i.chave,
        titulo: i.titulo,
        categoria: i.categoria_site,
        preco,
        foto: i.imagem,
        url: i.url_produto,
        freteGratis: i.freteGratis ?? null,
      })}
      className={
        "group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card" +
        (trilho
          ? " w-[58%] shrink-0 snap-start min-[480px]:w-[40%] sm:w-[30%] lg:w-[23%] xl:w-[18.5%]"
          : "")
      }
    >
      <VerDetalhesVitrine
        chave={i.chave}
        titulo={i.titulo}
        imagem={i.imagem}
        preco={preco}
        link={destino}
        vistoEm={i.visto_em}
        urlProduto={i.url_produto}
        gatilho={foto}
        className="w-full"
      />
      <div className="flex flex-1 flex-col border-t border-border/60 p-2.5">
        {/* Selo do preço numa linha de altura fixa (os títulos alinham); o
            de nota alta vai junto das estrelas. */}
        <p className="flex min-h-5 flex-wrap items-center gap-1">
          {/* Loja da oferta do botão; com o mesmo produto confirmado em
              outro marketplace, "Disponível em 2+ lojas" (27/10). */}
          <SeloMarketplace links={[destino ?? i.url_produto, i.url_produto, i.melhor_link]} />
          {i.maisVendido ? (
            <span className="whitespace-nowrap rounded-full bg-[#fff1e6] px-1.5 py-0.5 text-[10px] font-bold leading-tight text-[#a34700]">
              {i.maisVendido === "tendencia" ? "Em alta nas buscas" : "Entre os mais vendidos"}
            </span>
          ) : temAlternativa ? (
            <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-success">
              <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
              Até {brl(i.alt_economia)} de desconto
            </span>
          ) : (
            temEconomia && (
              <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-success">
                <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
                {brl(i.economia)} a menos
              </span>
            )
          )}
        </p>
        <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug">{i.titulo}</p>
        <p className="mt-1 text-base font-extrabold tabular-nums">{brl(preco)}</p>
        <p className="truncate text-[11px] text-secondary-ink">
          {i.maisVendido ? (
            <>
              {i.lojaOficial ? "Loja oficial · " : ""}
              {i.freteGratis ? "Frete grátis" : "Frete: confira no anúncio"}
            </>
          ) : temEconomia ? (
            <>
              na {i.melhor_loja} <span className="line-through">{brl(i.preco)}</span>
            </>
          ) : (
            <>na {i.loja ?? "loja"}</>
          )}
        </p>
        <LinhaAvaliacoes resumo={avaliacao} titulo={i.titulo} link={destino} className="mt-0.5" />
        <SeloBemAvaliado resumo={avaliacao} className="mt-1 self-start" />
        {temAlternativa && <Alternativa i={i} />}
        {i.cupom_codigo && <CupomDaLoja codigo={i.cupom_codigo} desconto={i.cupom_desconto} />}
        <p className="mt-1 text-[10px] text-secondary-ink/80">
          {i.maisVendido ? "preço de referência de " : "visto em "}
          {quando(i.visto_em)}
          {(i.lojas_comparadas ?? 0) > 0
            ? ` · ${i.lojas_comparadas} ${i.lojas_comparadas === 1 ? "loja" : "lojas"}`
            : ""}
        </p>
        {/* BOTÃO DIRETO (Weslei, 05/10: "não tem o botão de consultar os
            produtos diretamente"): compra pelo link de afiliado (a melhor
            loja com frete grátis confirmado ou o próprio anúncio), com o
            preço de quando foi comparado ("visto em"); "Comparar preço"
            compara de novo na hora (25/10: mesmo rodapé em todo cartão,
            BotoesCartao). Detalhes fica numa linha discreta abaixo. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-2.5">
          {ehLinkDeAfiliado(destino) ? (
            <ComprarComSeguranca link={destino} origem="vitrine" />
          ) : (
            /* Sem link guardado (10/10: o da ficha do catálogo abria outra
               loja e foi descartado): o link do PRÓPRIO anúncio é gerado no
               clique. Só com o anúncio no endereço (a ficha pura abre a
               oferta destacada, que pode ter outro preço). */
            !temEconomia &&
            i.url_produto &&
            (i.maisVendido || /^MLB\d/.test(itemDoEndereco(i.url_produto) ?? "")) && (
              <VerNaLoja url={i.url_produto} grande />
            )
          )}
          {(i.url_produto || destino) && <CompararPreco url={i.url_produto ?? destino ?? ""} />}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <VerDetalhesVitrine
              chave={i.chave}
              titulo={i.titulo}
              imagem={i.imagem}
              preco={preco}
              link={destino}
              vistoEm={i.visto_em}
              urlProduto={i.url_produto}
              rotulo="Detalhes"
              className="min-h-7"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

/* Melhor alternativa no cartão (Weslei, 28/09): parecido mais barato, com as
   vantagens conferidas na comparação e o aviso de que não é idêntico.
   18/10 (Weslei: "mostrar as principais diferenças, mas que mais detalhes
   sejam consultados"): à vista só o preço e o que muda; loja, avaliações e
   vantagens abrem em "Mais". */
function Alternativa({ i }: { i: ItemVitrine }) {
  const avaliacoes = useContext(ContextoAvaliacoes);
  const [aberta, setAberta] = useState(false);
  const completo = maisCompleto(i.alt_vantagem, i.alt_muda);
  const vantagens = [
    i.alt_oficial === true ? "Loja oficial da marca" : null,
    completo ? "Mais completo" : null,
    i.alt_frete_gratis === true ? "Frete grátis" : null,
  ].filter((v): v is string => v != null);
  const muda = `Não é idêntico${i.alt_muda ? `. Muda: ${i.alt_muda}` : ""}`;
  return (
    <div className="mt-1.5 rounded-xl bg-success/5 px-2 py-1.5 ring-1 ring-success/25">
      <p className="flex flex-wrap items-baseline justify-between gap-x-1.5">
        <span className="text-[10px] font-bold text-success">Parecido mais barato</span>
        <span className="text-sm font-extrabold tabular-nums text-success">{brl(i.alt_preco)}</span>
      </p>
      <p className="line-clamp-2 text-[10px] leading-snug text-secondary-ink" title={muda}>
        {muda}
      </p>
      {aberta && (
        <div className="mt-1 border-t border-success/20 pt-1">
          {i.alt_loja && (
            <p className="truncate text-[10px] text-secondary-ink">
              Vendido por <strong className="text-foreground">{i.alt_loja}</strong>
            </p>
          )}
          <LinhaAvaliacoes
            resumo={avaliacaoDaOferta(avaliacoes, i.chave, i.alt_link)}
            titulo={i.alt_titulo ?? i.titulo}
            link={i.alt_link}
          />
          {vantagens.length > 0 && (
            <ul className="mt-0.5 flex flex-wrap gap-1">
              {vantagens.map((v) => (
                <li
                  key={v}
                  className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-px text-[10px] font-semibold text-success"
                >
                  {v === "Loja oficial da marca" && (
                    <BadgeCheck className="size-2.5" aria-hidden="true" />
                  )}
                  {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
        {ehLinkDeAfiliado(i.alt_link) && (
          <a
            href={i.alt_link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-[11px] font-bold text-success underline underline-offset-2 hover:brightness-90"
          >
            Ver alternativa
          </a>
        )}
        <button
          type="button"
          onClick={() => setAberta((x) => !x)}
          aria-expanded={aberta}
          className="text-[11px] font-semibold text-secondary-ink hover:underline"
        >
          {aberta ? "Menos" : "Mais"}
        </button>
      </p>
    </div>
  );
}

/* "Mais completo": a vantagem que a conferência apontou ou, sem ela, o que
   muda quando é algo A MAIS ("acessório adicional incluso", "brinde"). */
function maisCompleto(vantagem: string | null, muda: string | null): boolean {
  if (vantagem) return true;
  return /\b(adicional|inclus[oa]|acompanha|brinde|a mais)\b/i.test(muda ?? "");
}
