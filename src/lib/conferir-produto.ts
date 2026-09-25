/* Conferencia do MESMO produto pela Gemini, com a chave do servidor
   (GEMINI_API_KEY nos secrets). A extensao chama isto quando a chave dela
   falha ou nao existe: a comparacao nao pode depender de uma configuracao no
   computador de casa.

   Como confere: a Gemini primeiro descreve a FOTO do anuncio original (tipo,
   cor, bordas, material, formato, detalhes visiveis) e depois compara cada
   candidato com essa descricao, pela foto e pelo titulo. So passa o que ela
   disser que e igual com confianca alta. Candidato sem foto nao passa: sem
   imagem nao da para garantir (caso real: capinha com borda preta x capinha
   toda transparente). */

export type Anuncio = {
  titulo?: string | null | undefined;
  imagem?: string | null | undefined;
  preco?: number | null | undefined;
};

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } };

type Resultado =
  | { ok: true; texto: string; modelo: string }
  | { ok: false; status: number; erro: string; modelo?: string };

/* 2.5 Flash sem a etapa de "pensar" responde em segundos; o prazo e curto. */
const MODELOS = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest"];
const CONFIANCA_MINIMA = 80;

function ordemDosModelos(): string[] {
  const escolhido = (process.env["GEMINI_MODEL"] ?? "").trim();
  return escolhido ? [escolhido, ...MODELOS.filter((m) => m !== escolhido)] : MODELOS;
}

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
    return {
      inline_data: {
        mime_type: /^image\//.test(tipo) ? tipo : "image/jpeg",
        data: paraBase64(buf),
      },
    };
  } catch {
    return null;
  }
}

async function gerar(partes: Parte[]): Promise<Resultado> {
  const chave = process.env["GEMINI_API_KEY"];
  if (!chave) return { ok: false, status: 503, erro: "GEMINI_API_KEY ausente nos secrets" };
  let ultimo: Resultado = { ok: false, status: 502, erro: "sem resposta" };
  /* Prazo total de 17 s: a consulta do cliente inteira cabe em 1 minuto. */
  const inicio = Date.now();
  for (const modelo of ordemDosModelos()) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      if (Date.now() - inicio > 16_000) return ultimo;
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-goog-api-key": chave },
            body: JSON.stringify({
              contents: [{ role: "user", parts: partes }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0,
                ...(/2\.5-flash/.test(modelo) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
            signal: AbortSignal.timeout(Math.max(3_000, 17_000 - (Date.now() - inicio))),
          },
        );
        const j = (await r.json().catch(() => null)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
          error?: { message?: string };
        } | null;
        if (r.ok) {
          const texto = (j?.candidates?.[0]?.content?.parts ?? [])
            .filter((p) => !p.thought && p.text)
            .map((p) => p.text)
            .join("");
          if (texto) return { ok: true, texto, modelo };
          ultimo = { ok: false, status: 502, erro: "resposta vazia", modelo };
          break;
        }
        ultimo = {
          ok: false,
          status: r.status,
          erro: (j?.error?.message ?? "").slice(0, 200),
          modelo,
        };
        /* 429 (cota) e 5xx passam com uma pausa; 404 (modelo que a chave nao
           tem) vai direto para o proximo; o resto e defeito do pedido. */
        /* 429 = cota esgotada: repetir o mesmo modelo só gasta mais cota.
           Vai direto para o próximo. 5xx ganha uma segunda chance. */
        if (r.status === 429) break;
        if (r.status >= 500) {
          if (tentativa === 0) await new Promise((ok) => setTimeout(ok, 1000));
          continue;
        }
        if (r.status === 404) break;
        return ultimo;
      } catch (e) {
        ultimo = {
          ok: false,
          status: 504,
          erro: String((e as Error)?.message ?? e).slice(0, 120),
          modelo,
        };
      }
    }
  }
  return ultimo;
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

/* VEREDITOS GUARDADOS (custo zero, pedido do Weslei): cada par "anúncio
   original x candidato" conferido pela Gemini fica na tabela ia_vereditos por
   30 dias. Na próxima consulta com o mesmo par, a resposta vem do banco e não
   gasta cota da API. Só vai para a Gemini o que nunca foi conferido. */
type Veredito = { igual: boolean; confianca: number; motivo: string };

async function vereditosGuardados(original: string, chaves: string[]) {
  const mapa = new Map<string, Veredito>();
  if (!original || !chaves.length) return mapa;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ia_vereditos" as never)
      .select("chave_candidato,igual,confianca,motivo")
      .eq("chave_original" as never, original as never)
      .in("chave_candidato" as never, chaves as never)
      .gte("criado_em" as never, new Date(Date.now() - 30 * 86400_000).toISOString() as never);
    for (const l of (data ?? []) as Array<{ chave_candidato: string } & Veredito>) {
      mapa.set(l.chave_candidato, { igual: l.igual, confianca: l.confianca, motivo: l.motivo });
    }
  } catch {
    /* sem cache: confere tudo */
  }
  return mapa;
}

async function guardarVereditos(
  original: string,
  linhas: Array<{ chave: string } & Veredito>,
  modelo: string,
) {
  if (!original || !linhas.length) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ia_vereditos" as never).upsert(
      linhas.map((l) => ({
        chave_original: original,
        chave_candidato: l.chave,
        igual: l.igual,
        confianca: l.confianca,
        motivo: l.motivo,
        modelo,
        criado_em: new Date().toISOString(),
      })) as never,
    );
  } catch {
    /* só cache */
  }
}

export async function conferirMesmoProduto(
  original: Anuncio & { chave?: string | null | undefined },
  candidatos: Array<Anuncio & { chave?: string | null | undefined }>,
): Promise<Conferencia & { guardados?: number }> {
  const lista = candidatos.slice(0, 12);
  const chaveOriginal = (original.chave ?? "").trim();
  const guardados = await vereditosGuardados(
    chaveOriginal,
    lista.map((c) => (c.chave ?? "").trim()).filter(Boolean),
  );
  const faltam = lista
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !guardados.has((c.chave ?? "").trim()));

  let novo: Conferencia | null = null;
  if (faltam.length) {
    novo = await conferirSemGuardar(
      original,
      faltam.map((f) => f.c),
    );
    if (!novo.ok) return novo;
  }

  const avaliacao: Array<{
    indice: number;
    igual: boolean;
    confianca: number;
    motivo: string;
    semFoto: boolean;
    guardado?: boolean;
  }> = [];
  lista.forEach((c, i) => {
    const g = guardados.get((c.chave ?? "").trim());
    if (g) avaliacao.push({ indice: i, ...g, semFoto: false, guardado: true });
  });
  const paraGuardar: Array<{ chave: string } & Veredito> = [];
  if (novo && novo.ok) {
    for (const a of novo.avaliacao) {
      const f = faltam[a.indice];
      if (!f) continue;
      avaliacao.push({ ...a, indice: f.i });
      const chave = (f.c.chave ?? "").trim();
      /* Sem foto não é veredito de verdade: não guarda. */
      if (chave && !a.semFoto)
        paraGuardar.push({ chave, igual: a.igual, confianca: a.confianca, motivo: a.motivo });
    }
    await guardarVereditos(chaveOriginal, paraGuardar, novo.modelo);
  }
  const iguais = avaliacao
    .filter((a) => a.igual && a.confianca >= CONFIANCA_MINIMA && !a.semFoto)
    .map((a) => a.indice);
  return {
    ok: true,
    modelo: novo && novo.ok ? novo.modelo : "guardado",
    descricaoOriginal: novo && novo.ok ? novo.descricaoOriginal : null,
    iguais,
    avaliacao,
    guardados: guardados.size,
  };
}

async function conferirSemGuardar(original: Anuncio, candidatos: Anuncio[]): Promise<Conferencia> {
  const lista = candidatos.slice(0, 12);
  const [fotoOriginal, ...fotos] = await Promise.all([
    imagem(original.imagem),
    ...lista.map((c) => imagem(c.imagem)),
  ]);

  const partes: Parte[] = [
    {
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
    { text: "ANUNCIO ORIGINAL: " + (original.titulo ?? "") + (fotoOriginal ? "" : " (sem foto)") },
  ];
  if (fotoOriginal) partes.push(fotoOriginal);
  lista.forEach((c, i) => {
    partes.push({
      text: `CANDIDATO ${i}: ${c.titulo ?? "(sem titulo)"}${fotos[i] ? "" : " (sem foto)"}`,
    });
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
