/* Conferencia do MESMO produto pela IA do Lovable (credencial gerenciada pela
   plataforma, so no servidor). A extensao chama isto: a comparacao nao pode
   depender de uma configuracao no computador de casa.

   Como confere: a IA primeiro descreve a FOTO do anuncio original e depois
   compara cada candidato com essa descricao, pela foto e pelo titulo. So passa
   o que ela disser que e igual com confianca alta. Candidato sem foto nao passa. */

import { chamarLovableIa, MODELO_IA } from "@/lib/public-ai-api";

export type Anuncio = {
  titulo?: string | null | undefined;
  imagem?: string | null | undefined;
  preco?: number | null | undefined;
};

type Parte = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

type Resultado =
  | { ok: true; texto: string; modelo: string }
  | { ok: false; status: number; erro: string; modelo?: string };

const CONFIANCA_MINIMA = 80;

function paraBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

/* So foto do proprio Mercado Livre (mlstatic): nada de baixar endereco
   qualquer que venha no pedido. */
async function imagem(url: string | null | undefined): Promise<Parte | null> {
  if (!url || !/^https:\/\/[a-z0-9.-]*mlstatic\.com\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 1_500_000) return null;
    const tipo = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0] ?? "image/jpeg";
    const mime = /^image\//.test(tipo) ? tipo : "image/jpeg";
    return { type: "image_url", image_url: { url: `data:${mime};base64,${paraBase64(buf)}` } };
  } catch {
    return null;
  }
}

const txt = (text: string): Parte => ({ type: "text", text });

async function gerar(partes: Parte[]): Promise<Resultado> {
  const r = await chamarLovableIa([{ role: "user", content: partes }], { esforco: "low", prazoMs: 25_000 });
  if (!r.ok) return { ...r, modelo: MODELO_IA };
  return { ok: true, texto: r.texto, modelo: MODELO_IA };
}

function lerJson<T>(texto: string): T | null {
  try {
    return JSON.parse(texto) as T;
  } catch {
    const m = /\{[\s\S]*\}/.exec(texto);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

export type Conferencia =
  | {
      ok: true;
      modelo: string;
      descricaoOriginal: string | null;
      iguais: number[];
      avaliacao: Array<{
        indice: number;
        igual: boolean;
        confianca: number;
        motivo: string;
        semFoto: boolean;
      }>;
    }
  | { ok: false; status: number; erro: string; modelo?: string };

export async function conferirMesmoProduto(
  original: Anuncio,
  candidatos: Anuncio[],
): Promise<Conferencia> {
  const lista = candidatos.slice(0, 12);
  const [fotoOriginal, ...fotos] = await Promise.all([
    imagem(original.imagem),
    ...lista.map((c) => imagem(c.imagem)),
  ]);

  const partes: Parte[] = [
    {
      type: "text",
      text:
        "Voce confere anuncios para um comparador de precos. O cliente vai comprar o produto do ANUNCIO ORIGINAL " +
        "e so pode ver outra loja se for EXATAMENTE o mesmo produto.\n" +
        "Passo 1: descreva a FOTO do anuncio original em detalhe: tipo de produto, marca/modelo visiveis, cor, " +
        "bordas, material, acabamento, formato, tamanho aparente, quantidade de unidades e qualquer detalhe que " +
        "diferencie de produtos parecidos.\n" +
        "Passo 2: para cada CANDIDATO, compare a foto dele com essa descricao e o titulo dele com o titulo " +
        "original. E o mesmo produto so se bater: tipo, marca e modelo, versao, cor e acabamento (ex.: capinha " +
        "transparente com borda preta NAO e igual a capinha toda transparente), tamanho/volume/capacidade, " +
        "compatibilidade (modelo do celular, voltagem) e quantidade (kit, unidades). Anuncio que atende varios " +
        "modelos so e igual se o titulo citar o mesmo modelo do original. Candidato sem foto: igual=false. " +
        "Na duvida, igual=false. Ignore preco, loja e texto de propaganda.\n" +
        'Responda so JSON: {"descricao_original":"...","candidatos":[{"indice":0,"igual":true,"confianca":0-100,' +
        '"motivo":"curto"}]}',
    },
    txt("ANUNCIO ORIGINAL: " + (original.titulo ?? "") + (fotoOriginal ? "" : " (sem foto)")),
  ];
  if (fotoOriginal) partes.push(fotoOriginal);
  lista.forEach((c, i) => {
    partes.push(txt(`CANDIDATO ${i}: ${c.titulo ?? "(sem titulo)"}${fotos[i] ? "" : " (sem foto)"}`));
    const f = fotos[i];
    if (f) partes.push(f);
  });

  const r = await gerar(partes);
  if (!r.ok) return r;
  const obj = lerJson<{
    descricao_original?: string;
    candidatos?: Array<{ indice?: number; igual?: boolean; confianca?: number; motivo?: string }>;
  }>(r.texto);
  if (!obj || !Array.isArray(obj.candidatos))
    return { ok: false, status: 502, erro: "JSON invalido da IA", modelo: r.modelo };

  const avaliacao = obj.candidatos
    .filter(
      (c) =>
        Number.isInteger(c.indice) &&
        (c.indice as number) >= 0 &&
        (c.indice as number) < lista.length,
    )
    .map((c) => {
      const indice = c.indice as number;
      return {
        indice,
        igual: c.igual === true,
        confianca: Math.max(0, Math.min(100, Number(c.confianca) || 0)),
        motivo: String(c.motivo ?? "").slice(0, 140),
        semFoto: !fotos[indice],
      };
    });
  /* A regra final e daqui, nao da IA: sem foto do original ou do candidato,
     ou abaixo da confianca minima, nao passa. */
  const iguais = avaliacao
    .filter((a) => a.igual && a.confianca >= CONFIANCA_MINIMA && !a.semFoto && fotoOriginal)
    .map((a) => a.indice);
  return {
    ok: true,
    modelo: r.modelo,
    descricaoOriginal: obj.descricao_original ? String(obj.descricao_original).slice(0, 400) : null,
    iguais,
    avaliacao,
  };
}

export async function termoDeBusca(
  original: Anuncio,
): Promise<
  { ok: true; busca: string; modelo: string } | { ok: false; status: number; erro: string }
> {
  const partes: Parte[] = [
    {
      type: "text",
      text:
        "Escreva a melhor busca curta (3 a 8 palavras, sem aspas, sem pontuacao) para achar EXATAMENTE este produto " +
        "em outras lojas de um marketplace brasileiro: marca, linha/modelo, versao, cor quando for parte do produto, " +
        "tamanho/volume/capacidade e compatibilidade quando existirem. Use a foto para confirmar o que e o produto. " +
        'Sem palavras de marketing. Responda so JSON {"busca":"..."}.\nTitulo do anuncio: ' +
        (original.titulo ?? ""),
    },
  ];
  const foto = await imagem(original.imagem);
  if (foto) partes.push(foto);
  const r = await gerar(partes);
  if (!r.ok) return r;
  const obj = lerJson<{ busca?: string }>(r.texto);
  const busca = String(obj?.busca ?? "")
    .replace(/["']/g, "")
    .trim();
  if (busca.length < 6) return { ok: false, status: 502, erro: "busca vazia" };
  return { ok: true, busca: busca.slice(0, 90), modelo: r.modelo };
}
