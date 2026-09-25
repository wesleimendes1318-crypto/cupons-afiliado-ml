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
/* Cada modelo tem a sua cota gratuita (medido em 25/09: 2.5-flash e
   flash-latest em 429 o resto do dia depois das baterias). O 2.5-flash-lite
   entra como mais uma cota; modelo que a chave nao tem (404) e pulado. */
const MODELOS = [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];
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

/* Um modelo, uma chamada. */
async function chamarModelo(
  chave: string,
  modelo: string,
  partes: Parte[],
  sinal: AbortSignal,
): Promise<Resultado> {
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
        signal: sinal,
      },
    );
    const j = (await r.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      error?: {
        message?: string;
        details?: Array<{
          retryDelay?: string;
          violations?: Array<{ quotaId?: string; quotaValue?: string }>;
        }>;
      };
    } | null;
    if (r.ok) {
      const texto = (j?.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join("");
      return texto
        ? { ok: true, texto, modelo }
        : { ok: false, status: 502, erro: "resposta vazia", modelo };
    }
    /* 429: qual cota acabou (por dia ou por minuto) e quando volta. */
    if (r.status === 429) {
      const det = j?.error?.details ?? [];
      const v = det.flatMap((d) => d.violations ?? [])[0];
      const volta = det.find((d) => d.retryDelay)?.retryDelay;
      const cota = v?.quotaId
        ? `cota ${v.quotaId}${v.quotaValue ? " limite " + v.quotaValue : ""}`
        : "cota esgotada";
      return {
        ok: false,
        status: 429,
        erro: `${cota}${volta ? " volta em " + volta : ""}`,
        modelo,
      };
    }
    return { ok: false, status: r.status, erro: (j?.error?.message ?? "").slice(0, 160), modelo };
  } catch (e) {
    return {
      ok: false,
      status: 504,
      erro: String((e as Error)?.message ?? e).slice(0, 100),
      modelo,
    };
  }
}

/* Modelos em paralelo escalonado. Medido em 25/09 (1.98.1): o flash-lite
   passou dos 17 s em metade das consultas e, como os modelos eram tentados um
   depois do outro, nao sobrava tempo para o segundo. Agora o primeiro modelo
   sai na hora; se nao respondeu em 5 s (ou falhou), o proximo sai junto, e
   vale a primeira resposta boa. Cada modelo tem a sua cota gratuita. */
const ESCALONA_MS = 5_000;

async function gerar(
  partes: Parte[],
  opcoes: { ordem?: string[]; prazo?: number } = {},
): Promise<Resultado> {
  const chave = process.env["GEMINI_API_KEY"];
  if (!chave) return { ok: false, status: 503, erro: "GEMINI_API_KEY ausente nos secrets" };
  const ordem = opcoes.ordem ?? ordemDosModelos();
  const prazo = opcoes.prazo ?? 17_000;
  const ctrl = new AbortController();
  return new Promise<Resultado>((fim) => {
    let proximo = 0;
    let andando = 0;
    let acabou = false;
    const falhas: string[] = [];
    let escalona: ReturnType<typeof setTimeout> | null = null;
    const encerrar = (r: Resultado) => {
      if (acabou) return;
      acabou = true;
      clearTimeout(corte);
      if (escalona) clearTimeout(escalona);
      ctrl.abort();
      fim(r);
    };
    const corte = setTimeout(
      () =>
        encerrar({
          ok: false,
          status: 504,
          erro: (falhas.join(" | ") || "tempo esgotado") + ` (prazo ${prazo / 1000}s)`,
        }),
      prazo,
    );
    const lancar = (): boolean => {
      if (acabou || proximo >= ordem.length) return false;
      const modelo = ordem[proximo++] as string;
      andando += 1;
      void chamarModelo(chave, modelo, partes, ctrl.signal).then((r) => {
        andando -= 1;
        if (acabou) return;
        if (r.ok) return encerrar(r);
        falhas.push(`${modelo} ${r.status} ${r.erro}`.slice(0, 140));
        if (!lancar() && andando === 0)
          encerrar({ ok: false, status: r.status, erro: falhas.join(" | "), modelo });
      });
      return true;
    };
    lancar();
    escalona = setTimeout(() => lancar(), ESCALONA_MS);
  });
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
  | {
      ok: false;
      status: number;
      erro: string;
      modelo?: string;
      /* Vereditos "diferente" ja dados quando so a confirmacao falhou: sao
         guardados, e a proxima tentativa so confere o que falta. */
      parcial?: Array<{
        indice: number;
        igual: boolean;
        confianca: number;
        motivo: string;
        semFoto: boolean;
      }>;
    };

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
    if (!novo.ok) {
      const negativos = (novo.parcial ?? [])
        .map((a) => ({ a, f: faltam[a.indice] }))
        .filter(({ a, f }) => f && !a.igual && !a.semFoto && (f.c.chave ?? "").trim());
      await guardarVereditos(
        chaveOriginal,
        negativos.map(({ a, f }) => ({
          chave: (f?.c.chave ?? "").trim(),
          igual: false,
          confianca: a.confianca,
          motivo: a.motivo,
        })),
        novo.modelo ?? "parcial",
      );
      return novo;
    }
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
  /* Tudo (fotos + conferencia + confirmacao) cabe em 21 s: a extensao espera
     o servidor por 26 s. */
  const t0 = Date.now();
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
        "Em diferencas, liste TODA diferenca visivel na foto ou no titulo em relacao ao original (cor, borda, " +
        "moldura, material, formato, estampa, acessorios inclusos como pelicula, quantidade, tamanho, modelo " +
        "compativel). Fundo, angulo e iluminacao nao contam. igual=true so com diferencas vazia, e o motivo " +
        "precisa citar os detalhes do original que voce viu na foto do candidato.\n" +
        'Responda so JSON: {"descricao_original":"...","candidatos":[{"indice":0,"diferencas":["..."],' +
        '"igual":false,"confianca":0-100,"motivo":"curto"}]}',
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

  const r = await gerar(partes, { prazo: Math.max(4_000, 13_000 - (Date.now() - t0)) });
  if (!r.ok) return r;
  const obj = lerJson<{ descricao_original?: string; candidatos?: VereditoIA[] }>(r.texto);
  if (!obj || !Array.isArray(obj.candidatos))
    return { ok: false, status: 502, erro: "JSON invalido da IA", modelo: r.modelo };

  const avaliacao = lerVereditos(obj.candidatos, lista.length).map((a) => ({
    ...a,
    semFoto: !fotos[a.indice],
  }));
  const descricao = obj.descricao_original ? String(obj.descricao_original).slice(0, 400) : null;

  /* SEGUNDA OPINIAO (25/09): o flash-lite aprovou uma capinha "slim toda
     transparente" como igual a uma capinha de acrilico com borda preta (90%),
     sem citar a borda. Todo "igual" passa por uma segunda conferencia, de
     preferencia de OUTRO modelo, comparando foto com foto e listando as
     diferencas. So fica igual o que as duas aprovarem. */
  const positivos = avaliacao.filter(
    (a) => a.igual && a.confianca >= CONFIANCA_MINIMA && !a.semFoto && fotoOriginal,
  );
  if (positivos.length && fotoOriginal) {
    const resta = 21_000 - (Date.now() - t0);
    const semConfirmar = (erro: string): Conferencia => ({
      ok: false,
      status: 504,
      erro: "confirmacao: " + erro,
      modelo: r.modelo,
      parcial: avaliacao,
    });
    if (resta < 4_000) return semConfirmar("sem tempo");
    const confirmacao: Parte[] = [
      {
        text:
          "Segunda conferencia, rigorosa. O cliente vai comprar o ANUNCIO ORIGINAL. Outra conferencia achou " +
          "que os CANDIDATOS abaixo sao exatamente o mesmo produto: confirme ou derrube cada um.\n" +
          "Compare a foto de cada candidato com a foto do original e liste TODAS as diferencas visiveis: cor, " +
          "bordas, moldura, material, transparencia, formato, estampa ou texto, acessorios inclusos (pelicula, " +
          "cabo, brinde), quantidade de unidades, tamanho ou volume, modelo compativel. Fundo, angulo, " +
          "iluminacao e montagem da foto nao contam.\n" +
          "igual=true SOMENTE se diferencas estiver vazia e voce enxergar no candidato os detalhes que " +
          "distinguem o original. Na duvida, igual=false.\n" +
          'Responda so JSON: {"candidatos":[{"indice":0,"diferencas":["..."],"igual":false,' +
          '"confianca":0-100,"motivo":"curto"}]}',
      },
      {
        text:
          "ANUNCIO ORIGINAL: " +
          (original.titulo ?? "") +
          (descricao ? "\nDescricao da foto do original: " + descricao : ""),
      },
      fotoOriginal,
    ];
    positivos.forEach((a, k) => {
      confirmacao.push({ text: `CANDIDATO ${k}: ${lista[a.indice]?.titulo ?? "(sem titulo)"}` });
      const f = fotos[a.indice];
      if (f) confirmacao.push(f);
    });
    const outroPrimeiro = [
      ...ordemDosModelos().filter((m) => m !== r.modelo),
      ...ordemDosModelos().filter((m) => m === r.modelo),
    ];
    const r2 = await gerar(confirmacao, { ordem: outroPrimeiro, prazo: Math.min(9_000, resta) });
    if (!r2.ok) return semConfirmar(`${r2.status} ${r2.erro}`);
    const obj2 = lerJson<{ candidatos?: VereditoIA[] }>(r2.texto);
    if (!obj2 || !Array.isArray(obj2.candidatos)) return semConfirmar("JSON invalido");
    const segunda = new Map(
      lerVereditos(obj2.candidatos, positivos.length).map((v) => [v.indice, v]),
    );
    positivos.forEach((a, k) => {
      const v = segunda.get(k);
      if (v && v.igual && v.confianca >= CONFIANCA_MINIMA) {
        a.confianca = Math.min(a.confianca, v.confianca);
        a.motivo = `${a.motivo} | confirmado (${r2.modelo})`.slice(0, 140);
      } else {
        a.igual = false;
        a.motivo = `2a conferencia (${r2.modelo}): ${v?.motivo || "nao confirmou"}`.slice(0, 140);
      }
    });
  }

  /* A regra final e daqui, nao da IA: sem foto do original ou do candidato,
     ou abaixo da confianca minima, nao passa. */
  const iguais = avaliacao
    .filter((a) => a.igual && a.confianca >= CONFIANCA_MINIMA && !a.semFoto && fotoOriginal)
    .map((a) => a.indice);
  return {
    ok: true,
    modelo: r.modelo,
    descricaoOriginal: descricao,
    iguais,
    avaliacao,
  };
}

type VereditoIA = {
  indice?: number;
  igual?: boolean;
  confianca?: number;
  motivo?: string;
  diferencas?: unknown;
};

/* Qualquer diferenca listada derruba o "igual", diga a IA o que disser. */
function lerVereditos(lista: VereditoIA[], total: number) {
  return lista
    .filter(
      (c) =>
        Number.isInteger(c.indice) && (c.indice as number) >= 0 && (c.indice as number) < total,
    )
    .map((c) => {
      const diferencas = Array.isArray(c.diferencas)
        ? c.diferencas.map((d) => String(d ?? "").trim()).filter(Boolean)
        : [];
      const igual = c.igual === true && diferencas.length === 0;
      const motivo = String(c.motivo ?? "") || diferencas.join("; ");
      return {
        indice: c.indice as number,
        igual,
        confianca: Math.max(0, Math.min(100, Number(c.confianca) || 0)),
        motivo: (c.igual === true && !igual
          ? "diferencas: " + diferencas.join("; ")
          : motivo
        ).slice(0, 140),
      };
    });
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
