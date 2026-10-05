/* PERFIL ANÔNIMO DO VISITANTE (Weslei, 05/10): o que a pessoa costuma
   comparar, para a Vitrine mostrar primeiro os produtos do mesmo interesse.

   - Só no navegador (localStorage "melhorescolha_perfil"); nada vai para o
     servidor. Sem nome, e-mail, telefone, IP ou endereço: só contagem por
     tipo de produto, preço médio e se a pessoa escolheu frete grátis.
   - Só com o consentimento de "análise" (lerConsentimento().analise). Sem
     ele não grava nem lê; quem recusar depois tem o perfil apagado.
   - Todo acesso ao armazenamento em try/catch (janela anônima, armazenamento
     bloqueado): sem perfil, o site segue no modo padrão.
   As últimas comparações continuam no histórico do aparelho (me_historico_v1,
   BuscaPorLink), que já existia; o perfil não duplica essa lista. */

import { lerConsentimento } from "@/lib/consentimento";

export type ClusterInteresse =
  | "informatica_hardware"
  | "eletrodomesticos"
  | "smartphones_tech"
  | "moda_esportes"
  | "ferramentas_casa"
  | "automotivo"
  | "cuidados_pet_bebe"
  | "geral";

export const CLUSTERS: ClusterInteresse[] = [
  "informatica_hardware",
  "eletrodomesticos",
  "smartphones_tech",
  "moda_esportes",
  "ferramentas_casa",
  "automotivo",
  "cuidados_pet_bebe",
  "geral",
];

export type PerfilVisitante = {
  versao: 1;
  clusters: Record<ClusterInteresse, number>;
  ticketMedio: number;
  totalPesquisas: number;
  sensivelAFreteGratis: boolean;
  atualizadoEm: string;
};

const CHAVE_PERFIL = "melhorescolha_perfil";
export const EVENTO_PERFIL = "perfil-visitante-atualizado";

function permitido(): boolean {
  if (typeof window === "undefined") return false;
  return lerConsentimento()?.analise === true;
}

function vazio(): PerfilVisitante {
  return {
    versao: 1,
    clusters: Object.fromEntries(CLUSTERS.map((c) => [c, 0])) as Record<ClusterInteresse, number>,
    ticketMedio: 0,
    totalPesquisas: 0,
    sensivelAFreteGratis: false,
    atualizadoEm: new Date().toISOString(),
  };
}

/* Lê o perfil guardado; formato estranho (versão antiga, editado à mão) vira
   null em vez de quebrar a tela. */
export function obterPerfil(): PerfilVisitante | null {
  if (!permitido()) return null;
  try {
    const salvo = window.localStorage.getItem(CHAVE_PERFIL);
    if (!salvo) return null;
    const p = JSON.parse(salvo) as Partial<PerfilVisitante>;
    if (p?.versao !== 1 || !p.clusters || typeof p.clusters !== "object") return null;
    const base = vazio();
    for (const c of CLUSTERS) {
      const n = Number((p.clusters as Record<string, unknown>)[c]);
      base.clusters[c] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    base.ticketMedio = Number.isFinite(Number(p.ticketMedio)) ? Number(p.ticketMedio) : 0;
    base.totalPesquisas = Number.isFinite(Number(p.totalPesquisas)) ? Number(p.totalPesquisas) : 0;
    base.sensivelAFreteGratis = p.sensivelAFreteGratis === true;
    base.atualizadoEm = typeof p.atualizadoEm === "string" ? p.atualizadoEm : base.atualizadoEm;
    return base;
  } catch {
    return null;
  }
}

/* Tipo de produto pelo título (+ categoria do anúncio quando houver). Ordem
   importa: eletrodoméstico antes de informática ("Geladeira Inteligente" não
   é Intel); palavras inteiras para "pet" não pegar "tapete". */
const REGRAS: Array<[ClusterInteresse, RegExp]> = [
  [
    "eletrodomesticos",
    /\b(geladeira|refrigerador|fog[aã]o|micro-?ondas|lavadora|lava e seca|lava-lou[cç]as|secadora|ar[- ]condicionado|cooktop|cervejeira|freezer|air ?fryer|fritadeira|liquidificador|aspirador|purificador|ventilador)(?:e?s)?\b/i,
  ],
  [
    "informatica_hardware",
    /\b(ssd|hd externo|mem[oó]ria ram|ddr[345]|processador|ryzen|geforce|rtx|radeon|intel core|placa de v[ií]deo|placa-m[aã]e|monitor|teclado|mouse|notebook|headset|webcam|roteador|controlador midi)(?:e?s)?\b/i,
  ],
  [
    "smartphones_tech",
    /\b(iphone|galaxy|smartphone|celular|xiaomi|redmi|poco|motorola|moto g|smartwatch|fone de ouvido|airpods|tablet|ipad|carregador|capinha|capa|pel[ií]cula)(?:e?s)?\b/i,
  ],
  [
    "moda_esportes",
    /\b(t[eê]nis|camisa|camiseta|agasalho|moletom|jaqueta|bermuda|short|chuteira|cal[cç]a|vestido|bon[eé]|mochila|adidas|nike|puma|olympikus|mizuno)(?:e?s)?\b/i,
  ],
  [
    "ferramentas_casa",
    /\b(furadeira|parafusadeira|esmerilhadeira|martelete|serra|lixadeira|ferramenta|jogo de chaves|alicate|trena|escada|torneira|chuveiro|l[aâ]mpada|panela|cabide)(?:e?s)?\b/i,
  ],
  [
    "automotivo",
    /\b(pneu|disco de freio|pastilhas? de freio|amortecedor|farol|l[aâ]mpada automotiva|bateria (heliar|moura)|[oó]leo de motor|palheta|retrovisor|para-choque|carro|moto)(?:e?s)?\b/i,
  ],
  [
    "cuidados_pet_bebe",
    /\b(fralda|len[cç]o umedecido|mamadeira|chupeta|whey|creatina|ra[cç][aã]o|pet|c[aã]es|gatos|areia sanit[aá]ria|shampoo|condicionador|hidratante|perfume|protetor solar)(?:e?s)?\b/i,
  ],
];

/* Categoria do anúncio (breadcrumb do Mercado Livre) decide primeiro: é mais
   confiável que o título ("Pastilhas de Cânfora" não é peça de carro). */
const POR_CATEGORIA: Array<[ClusterInteresse, RegExp]> = [
  ["eletrodomesticos", /eletrodom[eé]stic/i],
  ["informatica_hardware", /inform[aá]tica|games|instrumentos musicais/i],
  ["smartphones_tech", /celulares|telefones|eletr[oô]nicos|c[aâ]meras/i],
  ["moda_esportes", /esportes|fitness|cal[cç]ados|roupas|bolsas/i],
  ["ferramentas_casa", /ferramentas|constru[cç][aã]o|casa, m[oó]veis|ind[uú]stria/i],
  ["automotivo", /ve[ií]culos|carros|motos/i],
  ["cuidados_pet_bebe", /pet shop|beb[eê]s|beleza|cuidado pessoal|sa[uú]de|suplementos/i],
];

export function detectarCluster(
  titulo: string,
  categoriaBreadcrumb?: string | null,
): ClusterInteresse {
  const categoria = categoriaBreadcrumb ?? "";
  if (categoria) for (const [cluster, re] of POR_CATEGORIA) if (re.test(categoria)) return cluster;
  const texto = `${titulo ?? ""} ${categoria}`;
  for (const [cluster, re] of REGRAS) if (re.test(texto)) return cluster;
  return "geral";
}

export function registrarInteracaoVisitante(params: {
  titulo: string;
  preco: number | null;
  categoria?: string | null;
  freteGratisEscolhido: boolean;
}): void {
  if (!permitido()) return;
  try {
    const atual = obterPerfil() ?? vazio();
    const cluster = detectarCluster(params.titulo, params.categoria);
    atual.clusters[cluster] += 1;
    atual.totalPesquisas += 1;
    if (params.preco != null && Number.isFinite(params.preco) && params.preco > 0) {
      const n = atual.totalPesquisas;
      atual.ticketMedio =
        Math.round(((atual.ticketMedio * (n - 1) + params.preco) / n) * 100) / 100;
    }
    if (params.freteGratisEscolhido) atual.sensivelAFreteGratis = true;
    atual.atualizadoEm = new Date().toISOString();
    window.localStorage.setItem(CHAVE_PERFIL, JSON.stringify(atual));
    window.dispatchEvent(new CustomEvent(EVENTO_PERFIL));
  } catch {
    /* armazenamento bloqueado: segue sem perfil */
  }
}

export function limparPerfil(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_PERFIL);
    window.dispatchEvent(new CustomEvent(EVENTO_PERFIL));
  } catch {
    /* ignora */
  }
}

/* Interesse principal: o tipo mais comparado, desde que não seja "geral" e
   tenha pelo menos 2 comparações (uma só não diz o que a pessoa procura). */
export function clusterPredominante(perfil: PerfilVisitante | null): ClusterInteresse | null {
  if (!perfil) return null;
  let principal: ClusterInteresse | null = null;
  let maior = 0;
  for (const c of CLUSTERS) {
    if (c === "geral") continue;
    const n = perfil.clusters[c] ?? 0;
    if (n > maior) {
      maior = n;
      principal = c;
    }
  }
  return maior >= 2 ? principal : null;
}
