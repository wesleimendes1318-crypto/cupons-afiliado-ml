/* PLACAR DOS 3 E VEREDITO DO GARIMPO (Weslei, 11/10, prompt mestre "redesign
   premium estilo Apple + correção multi-player"). Regras puras (testes em
   tests/placar-garimpo.test.ts), sem rede:
   - "Economize R$ X" só com o MESMO produto conferido pela foto (ou um
     parecido de qualidade equivalente/superior que não "vem menos", dito
     "com modelo similar") mais barato que o preço do link;
   - nunca chama de "menor preço" o que é mais caro que a referência ou que
     outro player (11/10: o Mercado Livre aparecia como "Menor preço achado
     na busca" custando mais que a Shopee);
   - a busca do Mercado Livre não é conferida pela foto: nunca vira "mesmo
     produto" nem "economize";
   - valor em reais nunca junto de "frete" (o frete vai em linha própria).
   Nada inventado: sem o preço do link, não há economia calculada. */
import { naoEAlternativa } from "@/lib/alternativa";
import { NOME_PLAYER, type PlayerAfiliado } from "@/lib/campeao-segmento";
import type { OfertaGarimpo, ResultadoGarimpo } from "@/lib/garimpo-cliente";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CENTAVO = 0.009;

/** "na Shopee" / "no Mercado Livre". */
export const naPlayer = (p: PlayerAfiliado) =>
  `${p === "mercadolivre" ? "no" : "na"} ${NOME_PLAYER[p]}`;

export type OfertaPlacar = {
  player: PlayerAfiliado;
  id: string;
  /** "seu": o produto do próprio link (Amazon/Shopee). */
  relacao: "seu" | "mesmo" | "parecido" | "busca";
  preco: number;
  titulo: string;
  imagem: string | null;
  /** Link de afiliado pronto (Amazon/Shopee); no Mercado Livre, o endereço
      do anúncio para comparar (o link sai no clique). */
  link: string | null;
  qualidade: string | null;
  muda: string | null;
  prime: boolean;
};

export type EstadoPlayer = {
  player: PlayerAfiliado;
  status: "nao_consultado" | "carregando" | "pronto" | "erro";
  /** A melhor oferta para o placar: mesmo produto, depois parecido, depois
      a da busca. */
  melhor: OfertaPlacar | null;
  lidas: number | null;
  conferidas: number | null;
  /** Conferência pela foto rodou (para afirmar "já é o melhor preço"). */
  conferiu: boolean;
};

const qualidadeOk = (q: string | null | undefined) => q === "equivalente" || q === "superior";

/** Parecido que pode ser indicado como "modelo similar": qualidade
    equivalente/superior e não é mais barato por vir menos. */
export function parecidoIndicavel(o: Pick<OfertaGarimpo, "qualidade" | "muda">) {
  return qualidadeOk(o.qualidade) && !naoEAlternativa(o.muda);
}

function paraPlacar(player: PlayerAfiliado, o: OfertaGarimpo): OfertaPlacar {
  return {
    player,
    id: o.id,
    relacao: o.relacao,
    preco: o.preco,
    titulo: o.titulo,
    imagem: o.imagem,
    link: o.link,
    qualidade: o.qualidade ?? null,
    muda: o.muda ?? null,
    prime: (o.selos ?? []).includes("Prime"),
  };
}

const maisBarato = <T extends { preco: number }>(l: T[]) =>
  [...l].sort((a, b) => a.preco - b.preco)[0] ?? null;

/** Estado de um player do garimpo (Amazon/Shopee) para o placar. O player
    do próprio link mostra o produto do link quando nada do mesmo produto
    sai mais barato. */
export function estadoDoGarimpo(
  player: "amazon" | "shopee",
  status: EstadoPlayer["status"],
  r: ResultadoGarimpo | null,
  ehOrigem: boolean,
): EstadoPlayer {
  const ofertas = r?.ofertas ?? [];
  const mesmo = maisBarato(ofertas.filter((o) => o.relacao === "mesmo"));
  const parecido = maisBarato(ofertas.filter((o) => o.relacao === "parecido"));
  const busca = maisBarato(ofertas.filter((o) => o.relacao === "busca"));
  const seu =
    ehOrigem && r?.original.link && r.original.preco != null
      ? ({
          player,
          id: "seu",
          relacao: "seu",
          preco: r.original.preco,
          titulo: r.original.titulo ?? "O produto do seu link",
          imagem: r.original.imagem,
          link: r.original.link,
          qualidade: null,
          muda: null,
          prime: r.original.selos.includes("Prime"),
        } satisfies OfertaPlacar)
      : null;
  let melhor: OfertaPlacar | null = mesmo ? paraPlacar(player, mesmo) : null;
  if (seu && (!melhor || melhor.preco >= seu.preco - CENTAVO)) melhor = seu;
  if (!melhor && parecido) melhor = paraPlacar(player, parecido);
  if (!melhor && busca) melhor = paraPlacar(player, busca);
  return {
    player,
    status,
    melhor,
    lidas: r ? r.lidas : null,
    conferidas: r ? r.conferidas : null,
    conferiu: r?.conferencia === "ok",
  };
}

/** Estado do Mercado Livre (busca do catálogo, não conferida pela foto). */
export function estadoDoMercadoLivre(
  status: EstadoPlayer["status"],
  resultados: Array<{ nome: string; preco: number | null; imagem: string | null; url: string }>,
): EstadoPlayer {
  const comPreco = resultados.filter(
    (r): r is typeof r & { preco: number } => typeof r.preco === "number" && r.preco > 0,
  );
  const m = maisBarato(comPreco);
  return {
    player: "mercadolivre",
    status,
    melhor: m
      ? {
          player: "mercadolivre",
          id: m.url,
          relacao: "busca",
          preco: m.preco,
          titulo: m.nome,
          imagem: m.imagem,
          link: m.url,
          qualidade: null,
          muda: null,
          prime: false,
        }
      : null,
    lidas: status === "pronto" ? resultados.length : null,
    conferidas: null,
    conferiu: false,
  };
}

export type Veredito =
  | {
      tipo: "economia";
      oferta: OfertaPlacar;
      economia: number;
      similar: boolean;
      titulo: string;
      subtitulo: string;
    }
  | { tipo: "melhor_preco"; titulo: string; subtitulo: string }
  | { tipo: "melhor_do_mesmo"; oferta: OfertaPlacar; titulo: string; subtitulo: string }
  | { tipo: "conferindo"; titulo: string; subtitulo: string }
  | { tipo: "nenhum" };

/** O veredito em uma frase. `referencia` = preço do link colado. */
export function vereditoDoGarimpo(referencia: number | null, estados: EstadoPlayer[]): Veredito {
  const garimpos = estados.filter((e) => e.player !== "mercadolivre");
  const abertos = garimpos.filter((e) => e.status !== "nao_consultado");
  const carregando = abertos.some((e) => e.status === "carregando");
  const prontos = abertos.filter((e) => e.status === "pronto");
  /* Só o que foi conferido pela foto e tem link de afiliado. */
  const mesmos = prontos
    .map((e) => e.melhor)
    .filter((o): o is OfertaPlacar => !!o && o.relacao === "mesmo" && !!o.link);
  const parecidos = prontos
    .map((e) => e.melhor)
    .filter(
      (o): o is OfertaPlacar => !!o && o.relacao === "parecido" && !!o.link && parecidoIndicavel(o),
    );
  const melhorMesmo = maisBarato(mesmos);
  const melhorParecido = maisBarato(parecidos);
  /* Quem ainda não foi comparado (os 3, inclusive o Mercado Livre). */
  const naoConsultados = estados.filter((e) => e.status === "nao_consultado");
  const pendentes = naoConsultados.length
    ? ` Ainda falta comparar: ${naoConsultados.map((e) => NOME_PLAYER[e.player]).join(" e ")}.`
    : "";

  if (referencia != null) {
    if (melhorMesmo && melhorMesmo.preco < referencia - CENTAVO) {
      const economia = referencia - melhorMesmo.preco;
      return {
        tipo: "economia",
        oferta: melhorMesmo,
        economia,
        similar: false,
        titulo: `Economize ${brl(economia)} ${naPlayer(melhorMesmo.player)}!`,
        subtitulo: "Mesmo produto, conferido pela foto. Economia no produto.",
      };
    }
    if (melhorParecido && melhorParecido.preco <= referencia - 2) {
      const economia = referencia - melhorParecido.preco;
      return {
        tipo: "economia",
        oferta: melhorParecido,
        economia,
        similar: true,
        titulo: `Economize até ${brl(economia)} ${naPlayer(melhorParecido.player)} com modelo similar.`,
        subtitulo: "Não é idêntico ao seu: veja o que muda antes de comprar.",
      };
    }
    if (carregando)
      return {
        tipo: "conferindo",
        titulo: "Conferindo os preços…",
        subtitulo: "De 30 segundos a 2 minutos.",
      };
    if (prontos.some((e) => e.conferiu)) {
      const conferidas = prontos.reduce((s, e) => s + (e.conferidas ?? 0), 0);
      const onde = prontos
        .filter((e) => e.conferiu)
        .map((e) => naPlayer(e.player))
        .join(" e ");
      return {
        tipo: "melhor_preco",
        titulo: "Você já encontrou o melhor preço!",
        subtitulo: `O anúncio que você colou já é o melhor preço nesta análise: conferi ${conferidas} ${conferidas === 1 ? "oferta" : "ofertas"} pela foto ${onde} e nenhuma do mesmo produto saiu mais barata.${pendentes}`,
      };
    }
    return { tipo: "nenhum" };
  }
  /* Sem o preço do link: só o melhor preço do mesmo produto, sem economia. */
  if (melhorMesmo)
    return {
      tipo: "melhor_do_mesmo",
      oferta: melhorMesmo,
      titulo: `Melhor preço do mesmo produto: ${brl(melhorMesmo.preco)} ${naPlayer(melhorMesmo.player)}`,
      subtitulo: "Não consegui ler o preço do seu link para calcular a economia.",
    };
  if (carregando)
    return {
      tipo: "conferindo",
      titulo: "Conferindo os preços…",
      subtitulo: "De 30 segundos a 2 minutos.",
    };
  return { tipo: "nenhum" };
}

/** Player vencedor do placar (moldura verde e 🔥): só quem tem a oferta do
    veredito, ou o próprio link quando ele já é o melhor preço. */
export function vencedorDoPlacar(v: Veredito, estados: EstadoPlayer[]): PlayerAfiliado | null {
  if (v.tipo === "economia" || v.tipo === "melhor_do_mesmo") return v.oferta.player;
  if (v.tipo === "melhor_preco")
    return estados.find((e) => e.melhor?.relacao === "seu")?.player ?? null;
  return null;
}

export type RotuloMl =
  | { tipo: "vazio"; titulo: string; detalhe: null }
  | { tipo: "menor"; titulo: string; detalhe: string | null }
  | { tipo: "similar"; titulo: string; detalhe: string | null };

/** Cabeçalho honesto da busca no Mercado Livre (11/10): "Menor preço" só
    quando sai mais barato que o preço do link E que os outros players. */
export function rotuloMercadoLivre(
  menorMl: number | null,
  referencia: number | null,
  outros: Array<{ player: PlayerAfiliado; preco: number }>,
): RotuloMl {
  if (menorMl == null)
    return { tipo: "vazio", titulo: "Sem modelo compatível nesta análise", detalhe: null };
  const outro = maisBarato(outros.filter((o) => o.player !== "mercadolivre"));
  if (
    referencia != null &&
    menorMl < referencia - CENTAVO &&
    (!outro || menorMl <= outro.preco + CENTAVO)
  ) {
    return {
      tipo: "menor",
      titulo: `Menor preço no Mercado Livre: ${brl(menorMl)}`,
      detalhe: `${brl(referencia - menorMl)} a menos no produto do que você viu. Não conferi pela foto: veja se é o mesmo modelo.`,
    };
  }
  /* Mais caro (ou sem como comparar): a diferença para o menor conhecido. */
  const base =
    referencia != null && (!outro || referencia <= outro.preco)
      ? { preco: referencia, texto: "do que você viu" }
      : outro
        ? { preco: outro.preco, texto: `que ${naPlayer(outro.player)}` }
        : null;
  const diferenca = base && menorMl > base.preco + CENTAVO ? menorMl - base.preco : null;
  return {
    tipo: "similar",
    titulo: `Opções similares no Mercado Livre a partir de ${brl(menorMl)}${diferenca != null ? ` (+${brl(diferenca)} ${base!.texto})` : ""}`,
    detalhe: "Não localizamos o mesmo modelo mais barato nesta análise.",
  };
}

/** Diferença de uma oferta para o preço do link, em texto curto. */
export function diferencaNoProduto(
  preco: number,
  referencia: number | null,
): { texto: string; menos: boolean } | null {
  if (referencia == null || Math.abs(referencia - preco) < 0.01) return null;
  const menos = preco < referencia;
  return {
    texto: `${brl(Math.abs(referencia - preco))} ${menos ? "a menos" : "a mais"} no produto`,
    menos,
  };
}

/* ---------- O que muda em chips (sem setas) ---------- */

export type Chip = { icone: string; campo: string | null; valor: string; original: string | null };

const ICONES: Array<[RegExp, string]> = [
  [/\b(cor|cores|acabamento|estampa)\b/, "🎨"],
  [/\b(formato|design|desenho)\b/, "📐"],
  [/\b(tamanho|dimens|medida|altura|largura|comprimento|aro|tela)\b/, "📏"],
  [/\b(capacidade|volume|litr)/, "💧"],
  [/\b(voltagem|tens[aã]o|pot[eê]ncia|energia|alimenta[cç][aã]o)\b/, "⚡"],
  [/\b(material|tecido|composi[cç][aã]o)\b/, "🧵"],
  [/\b(quantidade|unidades?|kit|pe[cç]as?)\b/, "🔢"],
  [/\b(bateria|autonomia)\b/, "🔋"],
  [/\b(peso)\b/, "⚖️"],
  [/\b(conex[aã]o|bluetooth|wi-?fi|usb|cabo)\b/, "🔌"],
  [/\b(marca|modelo|vers[aã]o|gera[cç][aã]o|linha)\b/, "🏷️"],
];

const maiuscula = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1) : s);

const SETA = /\s*(?:->|→|=>|➜|⇒)\s*/;

/** "Cor: amarelo -> rosa, preto; Formato: quadrado -> redondo em cascata"
    vira chips ("🎨 Cor: Rosa/Preto", "📐 Formato: Redondo em cascata"). O
    valor é o DESTE produto; o do seu vai em `original` (para o title). */
export function chipsDoMuda(muda: string | null | undefined, max = 5): Chip[] {
  const texto = String(muda ?? "")
    .replace(/^\s*n[aã]o [eé] id[eê]ntico[^.]*\.\s*/i, "")
    .replace(/^\s*muda\s*:\s*/i, "")
    .trim();
  if (!texto) return [];
  /* Primeiro ";" e quebra de linha; depois "," só quando abre um campo novo
     ("Cor: rosa, preto" continua um chip só). */
  const partes: string[] = [];
  for (const bloco of texto.split(/\s*[;\n•]\s*/)) {
    for (const pedaco of bloco.split(/\s*,\s*/)) {
      if (!pedaco) continue;
      const abreCampo = /^[\p{L} ]{2,30}:/u.test(pedaco);
      if (partes.length && !abreCampo && bloco.includes(":")) {
        partes[partes.length - 1] += `/${pedaco}`;
      } else partes.push(pedaco);
    }
  }
  const chips: Chip[] = [];
  for (const parte of partes) {
    const limpo = parte.replace(/[.]+$/, "").trim();
    if (!limpo) continue;
    const m = limpo.match(/^([\p{L} ]{2,30}):\s*(.+)$/u);
    const campo = m ? maiuscula(m[1]!.trim()) : null;
    const resto = m ? m[2]! : limpo;
    const lados = resto.split(SETA);
    /* "o seu X → este Y": fica o Y. */
    const valor = (lados.length > 1 ? lados[lados.length - 1]! : resto)
      .replace(/^(este|esta|o deste|deste)\s+/i, "")
      .split("/")
      .map((v) => maiuscula(v.trim()))
      .filter(Boolean)
      .join("/");
    const original =
      lados.length > 1
        ? maiuscula(lados[0]!.replace(/^(o seu|seu|sua|a sua)\s+/i, "").trim())
        : null;
    if (!valor) continue;
    const chave = (campo ?? valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const icone = ICONES.find(([re]) => re.test(chave))?.[1] ?? "•";
    chips.push({
      icone,
      campo,
      valor: valor.slice(0, 60),
      original: original?.slice(0, 60) ?? null,
    });
    if (chips.length >= max) break;
  }
  return chips;
}
