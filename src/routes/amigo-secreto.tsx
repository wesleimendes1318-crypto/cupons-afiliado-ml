/* AMIGO SECRETO (Weslei, 05/11): one page per group draw. Each person's wish
   text turns into themed showcases (2-6 + "Ideias criativas"), each filled
   from the catalog search with products whose real cost (price + confirmed
   free shipping) fits the budget; 50 on the first load, "+20 opções" after.
   Every buy button is the site card (rule no. 1: affiliate link on click). */
import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AbasAmigos } from "@/components/AmigoSecreto/AbasAmigos";
import { CabecalhoAmigoSecreto, rotuloFaixa } from "@/components/AmigoSecreto/CabecalhoAmigoSecreto";
import { ImportarLista } from "@/components/AmigoSecreto/ImportarLista";
import { PainelDesejosAmigo } from "@/components/AmigoSecreto/PainelDesejosAmigo";
import { VitrineCategoria } from "@/components/AmigoSecreto/VitrineCategoria";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { carregarAte, passosIniciais, type PassoTermo } from "@/lib/amigo-secreto-busca";
import { ampliarTermos, aprovadoNaVitrine, contextoDaVitrine } from "@/lib/amigo-secreto-curadoria";
import {
  alternarFavorito,
  estadoVazio,
  juntarListas,
  lerDaConta,
  lerLocal,
  novaVitrine,
  novoId,
  paraGuardar,
  salvarLocal,
  salvarNaConta,
} from "@/lib/amigo-secreto-estado";
import { faixaDoTexto, importarListaWhatsapp, interpretarLocal } from "@/lib/amigo-secreto-parser-local";
import {
  LOTE_EXTRA,
  META_POR_VITRINE,
  type Amigo,
  type EstadoAmigoSecreto,
  type Interpretacao,
  type VitrineCategoriaAmigo,
} from "@/lib/amigo-secreto-tipos";
import { abrirLogin, useConta } from "@/lib/auth-otp";
import type { Resultado } from "@/lib/busca-guiada-cliente";

const URL_PAGINA = "https://melhorescolha.io/amigo-secreto";
const TITULO = "Presente de Amigo Secreto por Valor e Categoria | Ideias Prontas | Melhor Escolha";
const DESCRICAO =
  "Monte o amigo secreto do grupo: cole os pedidos de cada pessoa e veja vitrines de presentes no valor combinado, com frete grátis incluído no preço.";

const FAQ = [
  {
    p: "Como escolher presente de amigo secreto de R$ 80 a R$ 100?",
    r: "Escreva o que a pessoa gosta (roupa, livros, decoração, acessórios) e escolha a faixa R$ 80 a R$ 100. Cada interesse vira uma vitrine só com produtos que, somando o frete, ficam dentro desse valor.",
  },
  {
    p: "O frete entra no valor do presente?",
    r: "Sim. Aparecem só produtos com frete grátis confirmado, então o preço do cartão é o que você paga. Produtos com frete a calcular ou envio internacional ficam de fora.",
  },
  {
    p: "Posso colar a lista do sorteio do WhatsApp?",
    r: "Pode. Toque em “Colar lista do grupo”, cole a mensagem com um nome por linha e os pedidos de cada um, e todas as pessoas são criadas de uma vez.",
  },
  {
    p: "Como continuar a lista em outro aparelho?",
    r: "Entre com seu e-mail, sem senha. A lista fica salva na sua conta e abre igual no celular e no computador.",
  },
];

const IDEIAS = [
  "Roupas de academia",
  "Livros",
  "Decoração geek",
  "Bijuterias e semijoias",
  "Skincare e autocuidado",
  "Calçados",
  "Bolsas e carteiras",
  "Plantas e jardinagem",
  "Ideias criativas",
];

export const Route = createFileRoute("/amigo-secreto")({
  component: PaginaAmigoSecreto,
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_PAGINA },
    ],
    links: [{ rel: "canonical", href: URL_PAGINA }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.p,
            acceptedAnswer: { "@type": "Answer", text: f.r },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Ideias de presente de amigo secreto por categoria",
          itemListElement: IDEIAS.map((nome, i) => ({ "@type": "ListItem", position: i + 1, name: nome })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: "https://melhorescolha.io/" },
            { "@type": "ListItem", position: 2, name: "Amigo Secreto", item: URL_PAGINA },
          ],
        }),
      },
    ],
  }),
});

/** Wish text -> showcases. Server first (5 s), the local reader otherwise. */
async function interpretar(texto: string): Promise<Interpretacao> {
  try {
    const r = await fetch("/api/public/amigo-secreto-interpretar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto.slice(0, 600) }),
      signal: AbortSignal.timeout(6_000),
    });
    const j = (await r.json()) as Interpretacao;
    if (r.ok && Array.isArray(j.vitrines) && j.vitrines.length) return j;
  } catch {
    /* local below */
  }
  return interpretarLocal(texto);
}

function PaginaAmigoSecreto() {
  const [estado, setEstado] = useState<EstadoAmigoSecreto>(estadoVazio);
  const [pronto, setPronto] = useState(false);
  const [importar, setImportar] = useState(false);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const usuario = useConta();
  const [salvoNaConta, setSalvoNaConta] = useState(false);

  /* Per person: listings already shown (no repeat across showcases). Per
     showcase: where each search term stopped. */
  const vistos = useRef(new Map<string, Set<string>>());
  const passos = useRef(new Map<string, PassoTermo[]>());
  const tentadas = useRef(new Set<string>());
  const geracao = useRef(0);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    setEstado(lerLocal());
    setPronto(true);
  }, []);

  /* Instant save on this device (only typed data, never products). */
  const guardadoJson = JSON.stringify(paraGuardar(estado));
  useEffect(() => {
    if (pronto) salvarLocal(estado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardadoJson, pronto]);

  /* Account: on sign-in the account list joins this device's list; then
     every change is saved (1.5 s after the last one). */
  const contaLida = useRef<string | null>(null);
  useEffect(() => {
    if (!pronto || !usuario || contaLida.current === usuario.id) return;
    contaLida.current = usuario.id;
    void lerDaConta(usuario.id).then((c) => {
      if (c) setEstado((local) => juntarListas(c.estado, local));
    });
  }, [pronto, usuario]);
  useEffect(() => {
    if (!pronto || !usuario || contaLida.current !== usuario.id) return;
    const t = setTimeout(() => {
      void salvarNaConta(usuario.id, estado).then(setSalvoNaConta);
    }, 1_500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardadoJson, pronto, usuario]);

  const faixa = { min: estado.orcamentoPadraoMin || null, max: estado.orcamentoPadraoMax };
  const textoFaixa = rotuloFaixa(faixa.min, faixa.max);
  const ativo = estado.amigos.find((a) => a.id === estado.amigoAtivoId) ?? estado.amigos[0] ?? null;

  const mudarVitrine = useCallback(
    (amigoId: string, vitrineId: string, f: (v: VitrineCategoriaAmigo) => VitrineCategoriaAmigo) =>
      setEstado((e) => ({
        ...e,
        amigos: e.amigos.map((a) =>
          a.id === amigoId ? { ...a, vitrines: a.vitrines.map((v) => (v.id === vitrineId ? f(v) : v)) } : a,
        ),
      })),
    [],
  );

  const carregar = useCallback(
    async (amigoId: string, v: VitrineCategoriaAmigo, alvo: number) => {
      const minha = geracao.current;
      tentadas.current.add(v.id);
      const seen = vistos.current.get(amigoId) ?? new Set<string>();
      vistos.current.set(amigoId, seen);
      mudarVitrine(amigoId, v.id, (x) => ({ ...x, carregando: true, erro: null }));
      const texto = estadoRef.current.amigos.find((a) => a.id === amigoId)?.desejosTexto ?? "";
      const ctx = contextoDaVitrine(v, texto);
      const r = await carregarAte({
        passos: passos.current.get(v.id) ?? passosIniciais(ampliarTermos(v.termosBusca, ctx)),
        faixa,
        vistos: seen,
        alvo,
        aprovar: (x) => aprovadoNaVitrine(x.nome, ctx),
        cancelado: () => minha !== geracao.current,
        aoChegar: (novos) =>
          minha === geracao.current &&
          mudarVitrine(amigoId, v.id, (x) => ({ ...x, produtos: [...x.produtos, ...novos] })),
      });
      if (minha !== geracao.current) return;
      passos.current.set(v.id, r.passos);
      mudarVitrine(amigoId, v.id, (x) => ({
        ...x,
        carregando: false,
        temMais: r.passos.some((p) => !p.fim),
        erro: r.erro,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [faixa.min, faixa.max, mudarVitrine],
  );

  /* The active person's showcases load in order, two at a time. */
  useEffect(() => {
    if (!ativo) return;
    const emCurso = ativo.vitrines.filter((v) => v.carregando).length;
    const fila = ativo.vitrines.filter((v) => !v.carregando && !tentadas.current.has(v.id) && !v.produtos.length);
    fila.slice(0, Math.max(0, 2 - emCurso)).forEach((v) => void carregar(ativo.id, v, META_POR_VITRINE));
  }, [ativo, carregar]);

  /* Budget changed: every showcase starts over inside the new range. */
  const mudarFaixa = (min: number | null, max: number) => {
    geracao.current += 1;
    vistos.current.clear();
    passos.current.clear();
    tentadas.current.clear();
    setEstado((e) => ({
      ...e,
      orcamentoPadraoMin: min ?? 0,
      orcamentoPadraoMax: max,
      amigos: e.amigos.map((a) => ({
        ...a,
        vitrines: a.vitrines.map((v) => ({ ...novaVitrine({ titulo: v.titulo, icone: v.icone, termos: v.termosBusca }), id: v.id })),
      })),
    }));
  };

  const processar = async (amigoId: string, texto: string) => {
    setProcessando((s) => new Set(s).add(amigoId));
    const lida = await interpretar(texto);
    setProcessando((s) => {
      const n = new Set(s);
      n.delete(amigoId);
      return n;
    });
    vistos.current.delete(amigoId);
    setEstado((e) => ({
      ...e,
      amigos: e.amigos.map((a) =>
        a.id === amigoId ? { ...a, tamanhosIdentificados: lida.tamanhos, vitrines: lida.vitrines.map(novaVitrine) } : a,
      ),
    }));
  };

  const adicionar = (nome: string, desejos: string): string => {
    const id = novoId();
    const novo: Amigo = { id, nome, desejosTexto: desejos, vitrines: [], comprado: false };
    setEstado((e) => ({ ...e, amigos: [...e.amigos, novo], amigoAtivoId: e.amigoAtivoId ?? id }));
    return id;
  };

  const importarTexto = async (texto: string) => {
    const f = faixaDoTexto(texto);
    if (f) mudarFaixa(f.min, f.max);
    const nomes = new Set(estado.amigos.map((a) => a.nome.toLowerCase()));
    const novos = importarListaWhatsapp(texto).filter((p) => !nomes.has(p.nome.toLowerCase()));
    const ids = novos.map((p) => adicionar(p.nome, p.desejos));
    if (ids[0]) setEstado((e) => ({ ...e, amigoAtivoId: ids[0]! }));
    /* One at a time: the interpretation has its own per-minute limit. */
    for (const [k, p] of novos.entries()) await processar(ids[k]!, p.desejos);
  };

  const mudarAmigo = (id: string, f: (a: Amigo) => Amigo) =>
    setEstado((e) => ({ ...e, amigos: e.amigos.map((a) => (a.id === id ? f(a) : a)) }));

  /* Heart (05/11): per person, on this device even without login. */
  const favoritosAtivo = new Set((ativo?.favoritos ?? []).map((f) => f.produto));
  const favoritar = (r: Resultado) => {
    if (!ativo) return;
    const { produto, item, nome, imagem, preco, url, freteGratis } = r;
    mudarAmigo(ativo.id, (a) => ({
      ...a,
      favoritos: alternarFavorito(a.favoritos, {
        produto,
        item,
        nome,
        imagem,
        preco,
        url,
        freteGratis: freteGratis ?? null,
        favoritadoEm: new Date().toISOString(),
      }),
    }));
  };

  return (
    <div className="fundo-conteudo min-h-screen overflow-x-clip">
      <CabecalhoAmigoSecreto
        min={faixa.min}
        max={faixa.max}
        aoMudarFaixa={mudarFaixa}
        aoImportar={() => setImportar(true)}
      />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
        <header className="animate-conteudo">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0058b0] dark:text-[#64a8ff]">
            <Gift className="size-3.5" aria-hidden="true" />
            Amigo Secreto
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]">
            Ideias de presente para cada pessoa,
            <span className="block text-[#0071e3]">no valor combinado.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-secondary-ink">
            Escreva o que cada um gosta e veja vitrines personalizadas {textoFaixa}, só com frete grátis: o preço do
            cartão já é o que você paga.
          </p>
          {pronto &&
            (usuario ? (
              <p className="mt-2 text-xs text-secondary-ink">
                {salvoNaConta ? "Lista salva na sua conta." : "Lista salva neste aparelho."}
              </p>
            ) : (
              <p className="mt-2 text-xs text-secondary-ink">
                Lista salva neste aparelho.{" "}
                <button type="button" onClick={abrirLogin} className="inline-flex min-h-11 items-center font-semibold text-[#0058b0] underline-offset-2 hover:underline dark:text-[#64a8ff]">
                  Entre com e-mail para continuar no computador
                </button>
              </p>
            ))}
        </header>

        <AbasAmigos
          amigos={estado.amigos}
          ativoId={ativo?.id ?? null}
          aoEscolher={(id) => setEstado((e) => ({ ...e, amigoAtivoId: id }))}
          aoAdicionar={() => {
            const id = adicionar(`Pessoa ${estado.amigos.length + 1}`, "");
            setEstado((e) => ({ ...e, amigoAtivoId: id }));
          }}
        />

        {pronto && !estado.amigos.length && (
          <section className="vidro-barra animate-cartao rounded-3xl border border-white/60 p-6 text-center dark:border-white/10">
            <p className="text-lg font-bold">Comece pelo sorteio do grupo</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-secondary-ink">
              Cole a mensagem com os nomes e pedidos, ou adicione uma pessoa por vez.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setImportar(true)} className="min-h-11 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white">
                Colar lista do grupo
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = adicionar("Pessoa 1", "");
                  setEstado((e) => ({ ...e, amigoAtivoId: id }));
                }}
                className="vidro-botao min-h-11 rounded-full px-5 text-sm font-semibold"
              >
                Adicionar pessoa
              </button>
            </div>
          </section>
        )}

        {ativo && (
          <PainelDesejosAmigo
            key={ativo.id}
            amigo={ativo}
            processando={processando.has(ativo.id)}
            aoSalvar={(nome, desejos) => {
              mudarAmigo(ativo.id, (a) => ({ ...a, nome, desejosTexto: desejos }));
              void processar(ativo.id, desejos);
            }}
            aoReprocessar={() => void processar(ativo.id, ativo.desejosTexto)}
            aoMarcarComprado={(v) => mudarAmigo(ativo.id, (a) => ({ ...a, comprado: v }))}
            aoExcluir={() =>
              setEstado((e) => {
                const amigos = e.amigos.filter((a) => a.id !== ativo.id);
                return { ...e, amigos, amigoAtivoId: amigos[0]?.id ?? null };
              })
            }
          />
        )}

        {ativo && processando.has(ativo.id) && (
          <p className="animate-conteudo text-sm font-semibold text-secondary-ink" aria-live="polite">
            Separando os pedidos de {ativo.nome} em vitrines…
          </p>
        )}

        {ativo && (ativo.favoritos?.length ?? 0) > 0 && (
          <VitrineCategoria
            vitrine={{
              ...novaVitrine({ titulo: `Favoritos de ${ativo.nome}`, icone: "❤️", termos: [] }),
              id: "favoritos",
              produtos: ativo.favoritos!,
              temMais: false,
            }}
            faixa={textoFaixa}
            aoCarregarMais={() => undefined}
            favoritos={favoritosAtivo}
            aoFavoritar={favoritar}
            contadorFixo={`${ativo.favoritos!.length} ${ativo.favoritos!.length === 1 ? "produto salvo" : "produtos salvos"} · preço de quando você favoritou`}
          />
        )}

        {ativo &&
          ativo.vitrines.map((v) => (
            <VitrineCategoria
              key={v.id}
              vitrine={v}
              faixa={textoFaixa}
              aoCarregarMais={() => void carregar(ativo.id, v, LOTE_EXTRA)}
              favoritos={favoritosAtivo}
              aoFavoritar={favoritar}
            />
          ))}

        <section aria-labelledby="faq-amigo" className="mt-6 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-7">
          <h2 id="faq-amigo" className="text-xl font-extrabold tracking-tight">
            Perguntas frequentes
          </h2>
          <dl className="mt-3 divide-y divide-border">
            {FAQ.map((f) => (
              <div key={f.p} className="py-3">
                <dt className="font-semibold">{f.p}</dt>
                <dd className="mt-1 text-sm text-secondary-ink">{f.r}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <RodapeInstitucional />
      <ImportarLista aberto={importar} aoFechar={() => setImportar(false)} aoImportar={(t) => void importarTexto(t)} />
    </div>
  );
}
