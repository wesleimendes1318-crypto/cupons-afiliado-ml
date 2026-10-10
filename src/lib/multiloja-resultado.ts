/* Trava final do que os outros marketplaces mostram na tela (09/10): vale
   para o resultado das APIs e para o gravado pela extensão. Mesmas regras
   do Mercado Livre: só link de afiliado do próprio marketplace, nada usado
   nem falso, foto dos hosts conhecidos e o resumo do que foi lido. */
import { ehLinkDeCompra } from "@/lib/afiliado";
import type { LojaExterna, ResumoMarketplace } from "@/lib/coletor-multiloja";
import { pareceFalso } from "@/lib/falsificado";
import { diferencaDeModelo } from "@/lib/modelo-titulo";

export type RespostaMultiloja = {
  ativo: boolean;
  lojas: LojaExterna[];
  /* Por marketplace: quantos resultados leu e quantos conferiu pela foto.
     Sem a chave, a marketplace não foi consultada nesta comparação. */
  resumo?: Partial<Record<"amazon" | "shopee", ResumoMarketplace>>;
  /* A conferência pela foto não respondeu: nada entrou. */
  incompleto?: boolean;
  aguardar?: boolean;
  adiado?: boolean;
};

/* Foto só dos endereços das marketplaces (o resultado da extensão vem de
   páginas lidas: nada de endereço qualquer na tela). */
const RE_FOTO =
  /^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|([a-z0-9-]+\.)*susercontent\.com|cf\.shopee\.com\.br)\//i;

const RE_CONDICAO_RUIM =
  /\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box|mostru[aá]rio)\b/i;

const texto = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const inteiro = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 999) : 0;

function limparResumo(r: unknown): RespostaMultiloja["resumo"] {
  if (!r || typeof r !== "object") return undefined;
  const o = r as Record<string, unknown>;
  const saida: NonNullable<RespostaMultiloja["resumo"]> = {};
  for (const mk of ["amazon", "shopee"] as const) {
    const x = o[mk] as Record<string, unknown> | undefined;
    if (!x || typeof x !== "object") continue;
    saida[mk] = {
      lidas: inteiro(x["lidas"]),
      conferidas: inteiro(x["conferidas"]),
      motivo: texto(x["motivo"], 120),
    };
  }
  return Object.keys(saida).length ? saida : undefined;
}

/** Trava final de tudo que vai para a tela: só link de afiliado do próprio
    marketplace, preço válido, sem usado nem falso e foto dos hosts
    conhecidos. */
export function limparResultado(r: unknown, tituloColado?: string | null): RespostaMultiloja {
  const o = (r ?? {}) as Partial<RespostaMultiloja>;
  const lojas = (Array.isArray(o.lojas) ? o.lojas : [])
    .filter(
      (l) =>
        l &&
        (l.marketplace === "amazon" || l.marketplace === "shopee") &&
        typeof l.preco === "number" &&
        Number.isFinite(l.preco) &&
        l.preco > 0 &&
        typeof l.titulo === "string" &&
        !RE_CONDICAO_RUIM.test(l.titulo) &&
        !pareceFalso(l.titulo) &&
        (l.relacao === "mesmo" || l.relacao === "parecido") &&
        ehLinkDeCompra(l.link, l.marketplace),
    )
    .map((l) => ({
      ...l,
      imagem: typeof l.imagem === "string" && RE_FOTO.test(l.imagem) ? l.imagem : null,
      titulo: l.titulo.slice(0, 300),
      loja: texto(l.loja, 80),
      freteGratis: l.freteGratis === true ? true : l.freteGratis === false ? false : null,
      custoFrete:
        typeof l.custoFrete === "number" && Number.isFinite(l.custoFrete) && l.custoFrete > 0
          ? l.custoFrete
          : null,
      notaFrete: texto(l.notaFrete, 80),
      selos: Array.isArray(l.selos) ? l.selos.filter((x) => x === "Prime") : [],
      /* Item cortado no meio ("Campo: X ->" sem o outro valor) sai. */
      muda: texto(
        (typeof l.muda === "string" ? l.muda : "")
          .split(/;\s*/)
          .filter((p) => p.trim() && !/->\s*$/.test(p))
          .join("; "),
        400,
      ),
      qualidade: texto(l.qualidade, 20),
      qualidadeMotivo: texto(l.qualidadeMotivo, 200),
      desvantagens: Array.isArray(l.desvantagens)
        ? l.desvantagens
            .map((d) => texto(d, 160))
            .filter((d): d is string => d != null)
            .slice(0, 4)
        : null,
      mesmaFoto: l.mesmaFoto === true,
    }))
    /* Modelo pelo título (10/10, pedido 1181: "Echo Dot Max" saiu como
       "Cor: Preto -> Roxo" contra o "Echo Dot 5ª Geração"): versão ou geração
       diferente nunca é o mesmo produto; o "Muda" ganha a linha do modelo e a
       qualidade, julgada sem saber disso, volta a "não confirmada". */
    .map((l) => {
      const dif = diferencaDeModelo(tituloColado, l.titulo);
      if (!dif || /\bmodelo\b/i.test(l.muda ?? ""))
        return dif ? { ...l, relacao: "parecido" as const } : l;
      return {
        ...l,
        relacao: "parecido" as const,
        muda: [dif, l.muda].filter(Boolean).join("; "),
        qualidade: null,
        qualidadeMotivo: null,
      };
    })
    .sort(
      (a, b) =>
        (a.relacao === "mesmo" ? 0 : 1) - (b.relacao === "mesmo" ? 0 : 1) || a.preco - b.preco,
    );
  const resumo = limparResumo(o.resumo);
  return {
    ativo: o.ativo !== false,
    lojas,
    ...(resumo ? { resumo } : {}),
    ...(o.incompleto === true ? { incompleto: true } : {}),
  };
}
