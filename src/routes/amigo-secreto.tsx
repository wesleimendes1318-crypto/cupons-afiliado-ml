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
import { CompartilharSigilo } from "@/components/AmigoSecreto/CompartilharSigilo";
import { ImportarLista } from "@/components/AmigoSecreto/ImportarLista";
import { QuestionarioPerfil } from "@/components/AmigoSecreto/QuestionarioPerfil";
import { aplicarPerfil, termosDosFavoritos, textoParaLeitura, type PerfilAmigo } from "@/lib/amigo-secreto-perfil";
import { PainelDesejosAmigo } from "@/components/AmigoSecreto/PainelDesejosAmigo";
import { VitrineCategoria } from "@/components/AmigoSecreto/VitrineCategoria";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { carregarAte, passosIniciais, restamReservas, type PassoTermo } from "@/lib/amigo-secreto-busca";
import { ampliarTermos, aprovadoNaVitrine, contextoDaVitrine, termosDeReserva } from "@/lib/amigo-secreto-curadoria";
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
  META_FUNDO,
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
    r: "Escreva o que a pessoa gosta (roupa, livros, decoração, acessórios) e escolha a faixa (ou deixe em qualquer valor). Cada interesse vira uma vitrine só com produtos que, somando o frete, ficam dentro desse valor.",
  },
  {
    p: "O frete entra no valor do presente?",
    r: "Por padrão, sim: aparecem só produtos com frete grátis confirmado, então o preço do cartão é o que você paga. Se quiser mais opções, marque “Incluir produtos com frete a calcular”; aí o frete aparece na página da loja. Envio internacional fica de fora.",
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
async function interpretar(texto: string, nome?: string): Promise<Interpretacao> {
  try {
    const r = await fetch("/api/public/amigo-secreto-interpretar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto.slice(0, 600), ...(nome ? { nome: nome.slice(0, 40) } : {}) }),
      signal: AbortSignal.timeout(6_000),
    });
    const j = (await r.json()) as Interpretacao;
    if (r.ok && Array.isArray(j.vitrines) && j.vitrines.length) return j;
  } catch {
    /* local below */
  }
  return interpretarLocal(texto, nome);
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
  const completadas = useRef(new Map<string, number>());
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

  const faixa = {
    min: estado.orcamentoPadraoMin || null,
    max: estado.orcamentoPadraoMax || null,
    freteACalcular: estado.freteACalcular === true,
  };
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
      const amigo = estadoRef.current.amigos.find((a) => a.id === amigoId);
      const ctx = aplicarPerfil(contextoDaVitrine(v, textoParaLeitura(amigo?.desejosTexto ?? "", amigo?.perfil), amigo?.nome), amigo?.perfil);
      const reserva = termosDeReserva(v.termosBusca, ctx);
      const r = await carregarAte({
        passos: passos.current.get(v.id) ?? passosIniciais(ampliarTermos(v.termosBusca, ctx)),
        termosReserva: reserva,
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
      /* At least 20 on open (Weslei, 05/11): when free shipping alone gives
         fewer, the same terms complete with "frete a calcular" listings
         (price inside the budget, shipping shown on the card). */
      const faltam = META_POR_VITRINE - (v.produtos.length + r.novos.length);
      if (alvo === META_POR_VITRINE && !faixa.freteACalcular && faltam > 0) {
        await carregarAte({
          passos: passosIniciais(ampliarTermos(v.termosBusca, ctx)),
          faixa: { ...faixa, freteACalcular: true },
          vistos: seen,
          alvo: faltam,
          termosReserva: reserva,
          aprovar: (x) => aprovadoNaVitrine(x.nome, ctx),
          cancelado: () => minha !== geracao.current,
          aoChegar: (novos) =>
            minha === geracao.current &&
            mudarVitrine(amigoId, v.id, (x) => ({ ...x, produtos: [...x.produtos, ...novos] })),
        });
        if (minha !== geracao.current) return;
      }
      mudarVitrine(amigoId, v.id, (x) => ({
        ...x,
        carregando: false,
        temMais: r.passos.some((p) => !p.fim) || restamReservas(r.passos, reserva),
        erro: r.erro,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [faixa.min, faixa.max, faixa.freteACalcular, mudarVitrine],
  );

  /* The active person's showcases load in order, two at a time. */
  useEffect(() => {
    if (!ativo || !estado.faixaEscolhida) return;
    const emCurso = ativo.vitrines.filter((v) => v.carregando).length;
    const fila = ativo.vitrines.filter((v) => !v.carregando && !tentadas.current.has(v.id) && !v.produtos.length);
    fila.slice(0, Math.max(0, 3 - emCurso)).forEach((v) => void carregar(ativo.id, v, META_POR_VITRINE));
    /* Background fill: once nothing is loading, one showcase at a time grows to META_FUNDO. */
    if (fila.length) return;
    const abertas = ativo.vitrines.filter(
      /* Thin showcases (< 4) get up to 3 background rounds, the rest one. */
      (v) => v.temMais && !v.erro && v.produtos.length < META_FUNDO && (completadas.current.get(v.id) ?? 0) < (v.produtos.length < 4 ? 3 : 1),
    );
    /* Thin showcases (< 4 on the first batch) are filled first. */
    const fina = abertas.find((v) => v.produtos.length < 4 && !v.carregando);
    /* A thin showcase does not wait for the others; the rest fill one at a time. */
    const proxima = fina && emCurso < 3 ? fina : emCurso ? undefined : abertas.find((v) => !v.carregando);
    if (!proxima) return;
    completadas.current.set(proxima.id, (completadas.current.get(proxima.id) ?? 0) + 1);
    void carregar(ativo.id, proxima, META_FUNDO - proxima.produtos.length);
  }, [ativo, carregar, estado.faixaEscolhida]);

  /* Budget changed: every showcase starts over inside the new range. */
  const mudarFaixa = (min: number | null, max: number | null, freteACalcular = estado.freteACalcular === true) => {
    geracao.current += 1;
    vistos.current.clear();
    passos.current.clear();
    tentadas.current.clear();
    completadas.current.clear();
    setEstado((e) => ({
      ...e,
      orcamentoPadraoMin: min ?? 0,
      orcamentoPadraoMax: max ?? 0,
      freteACalcular,
      faixaEscolhida: true,
      amigos: e.amigos.map((a) => ({
        ...a,
        vitrines: a.vitrines.map((v) => ({ ...novaVitrine({ titulo: v.titulo, icone: v.icone, termos: v.termosBusca }), id: v.id })),
      })),
    }));
  };

  const processar = async (amigoId: string, texto: string, perfil?: PerfilAmigo) => {
    setProcessando((s) => new Set(s).add(amigoId));
    const p = perfil ?? estadoRef.current.amigos.find((a) => a.id === amigoId)?.perfil;
    const nome = estadoRef.current.amigos.find((a) => a.id === amigoId)?.nome;
    const lida = await interpretar(textoParaLeitura(texto, p), nome);
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

  /* Weslei, 05/11: favorites -> "Combina com os favoritos" showcase (the
     model only writes searches; products come from the catalog). */
  const [sugerindo, setSugerindo] = useState(false);
  const sugerirPelosFavoritos = async () => {
    if (!ativo?.favoritos?.length) return;
    const alvo = ativo;
    const titulos = alvo.favoritos!.slice(0, 10).map((f) => f.nome);
    setSugerindo(true);
    let termos: string[] = [];
    try {
      const r = await fetch("/api/public/amigo-secreto-sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoParaLeitura(alvo.desejosTexto, alvo.perfil), favoritos: titulos }),
        signal: AbortSignal.timeout(9_000),
      });
      const j = (await r.json()) as { termos?: string[] };
      termos = (j.termos ?? []).filter((t) => typeof t === "string");
    } catch {
      /* local below */
    }
    if (termos.length < 2) termos = termosDosFavoritos(titulos);
    setSugerindo(false);
    if (!termos.length) return;
    const nova = novaVitrine({ titulo: "Combina com os favoritos", icone: "✨", termos: termos.slice(0, 6) });
    mudarAmigo(alvo.id, (a) => ({
      ...a,
      vitrines: [nova, ...a.vitrines.filter((v) => v.titulo !== "Combina com os favoritos")].slice(0, 8),
    }));
  };
  const proximoMax = faixa.max ? Math.ceil((faixa.max * 1.2) / 10) * 10 : null;
  const ampliar = {
    freteACalcular: faixa.freteACalcular,
    proximoMax,
    aoAceitarFrete: () => mudarFaixa(faixa.min, faixa.max, true),
    aoSubirValor: () => mudarFaixa(faixa.min, proximoMax),
  };

  return (
    <div className="fundo-conteudo min-h-screen overflow-x-clip">
      <CabecalhoAmigoSecreto
        min={faixa.min}
        max={faixa.max}
        escolhida={pronto ? estado.faixaEscolhida === true : true}
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
            Escreva o que cada um gosta e veja vitrines personalizadas {textoFaixa}
            {faixa.freteACalcular ? ", com frete grátis ou a calcular." : ", com frete grátis primeiro. Se faltar opção, completamos com frete a calcular, avisado no cartão."}
          </p>
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-[#0071e3]"
              checked={faixa.freteACalcular}
              onChange={(e) => mudarFaixa(faixa.min, faixa.max, e.target.checked)}
            />
            Incluir produtos com frete a calcular
          </label>
          <label className="ml-0 mt-1 flex min-h-11 flex-wrap items-center gap-2 text-sm font-semibold sm:ml-4 sm:inline-flex">
            Data da festa
            <input
              type="date"
              value={estado.dataFesta ?? ""}
              onChange={(e) => setEstado((x) => ({ ...x, dataFesta: e.target.value || null }))}
              className="h-11 rounded-xl border border-border bg-card px-3 text-base text-foreground"
            />
            <span className="text-xs font-normal text-secondary-ink">mostra só o que chega a tempo</span>
          </label>
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

        {ativo && (
          <QuestionarioPerfil
            key={`p-${ativo.id}`}
            nome={ativo.nome}
            perfil={ativo.perfil}
            aoAplicar={(perfil) => {
              mudarAmigo(ativo.id, (a) => ({ ...a, perfil }));
              if (ativo.desejosTexto) void processar(ativo.id, ativo.desejosTexto, perfil);
            }}
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
        {ativo && (ativo.favoritos?.length ?? 0) > 0 && (
          <div className="-mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sugerindo}
              onClick={() => void sugerirPelosFavoritos()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              ✨ {sugerindo ? "Procurando ideias parecidas…" : "Mais ideias parecidas com os favoritos"}
            </button>
            <CompartilharSigilo favoritos={ativo.favoritos!} faixa={textoFaixa} />
          </div>
        )}

        {ativo && ativo.vitrines.length > 0 && pronto && !estado.faixaEscolhida && (
          <p className="rounded-2xl bg-[#eef4ff] p-4 text-sm font-semibold text-[#0058b0] dark:bg-white/5 dark:text-[#64a8ff]">
            Escolha o valor do presente no topo para ver as opções.
          </p>
        )}
        {ativo &&
          estado.faixaEscolhida &&
          ativo.vitrines.map((v) => (
            <VitrineCategoria
              key={v.id}
              vitrine={v}
              faixa={textoFaixa}
              aoCarregarMais={() => {
                /* "Buscar mais" after the end (06/11): terms stopped by two empty pages get another try. */
                const ps = passos.current.get(v.id);
                if (ps && !v.temMais) passos.current.set(v.id, ps.map((p) => (p.cursor != null ? { ...p, fim: false, vazias: 0 } : p)));
                void carregar(ativo.id, v, LOTE_EXTRA);
              }}
              favoritos={favoritosAtivo}
              aoFavoritar={favoritar}
              ampliar={ampliar}
              dataFesta={estado.dataFesta ?? null}
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
