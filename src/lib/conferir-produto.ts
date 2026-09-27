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
  categoria?: string | null | undefined;
  fatos?: string | null | undefined;
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
/* gemini-2.5-flash-lite saiu (27/09: 404 "no longer available to new
   users") e so gastava a vaga do segundo modelo. */
const MODELOS = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest"];
const CONFIANCA_MINIMA = 80;

/* ROUPA E FOTO IGUAL (Weslei, 27/09): o agasalho "Basic 3s" colado e o
   "Woven 3 Listras" da loja oficial tinham a MESMA foto oficial (mesma pessoa,
   mesma pose), mas a conferencia reprovou so pelo nome no titulo, e a loja
   R$ 83 mais barata foi para "Parecidos". Contradicao e o que os DOIS dizem de
   forma diferente; nome de linha ou abreviacao que so um titulo tem nao conta.
   A IA tambem diz se e a mesma foto (mesma_foto) e o quanto parece
   (semelhanca), para revisar e para ordenar as alternativas. */
export const REGRA_NOMES =
  "Contradicao so existe quando os DOIS anuncios dizem coisas diferentes sobre o mesmo ponto. Palavra que so um " +
  "dos titulos tem (nome de linha, apelido, abreviacao, basic, essentials, tipo de tecido) NAO e contradicao quando " +
  "a foto e o resto batem; abreviacoes equivalem (3s = 3 Stripes = 3 Listras; WV = Woven).\n" +
  "Roupa, calcado e acessorio de moda: compare as pecas (conjunto jaqueta + calca x so jaqueta), a cor de cada " +
  "parte, listras ou estampa e onde ficam, logo, gola, capuz, ziper, bolsos, modelagem e genero; tecido so conta " +
  "quando os dois informam e sao diferentes (tricot x woven). Tamanho da grade (P, M, G, 40, 42) NAO e diferenca: " +
  "cada anuncio vende varios tamanhos.\n" +
  "mesma_foto=true quando a foto do candidato e a MESMA foto do original ou da mesma sessao de fotos (mesma pessoa " +
  "ou manequim, mesma pose, mesmo produto), mesmo recortada, com outro fundo ou outro enquadramento. Com " +
  "mesma_foto=true e nada na foto contradizendo, so contradicao EXPLICITA nos dois titulos derruba o igual.\n" +
  "semelhanca de 0 a 100: quanto o produto do candidato se parece com o do original (100 = identico).\n";
/* O que muda e o que NAO muda o produto, por categoria do marketplace
   (Weslei, 27/09: "considere todas as categorias"). */
export const REGRA_CATEGORIAS =
  "NUNCA sao diferenca (nao mudam o produto): loja, frete, prazo, garantia da loja, forma de pagamento, palavras de venda " +
  "(original como propaganda, lancamento, envio imediato, promocao, nota fiscal), ordem das palavras, sinonimos, portugues x ingles, " +
  "codigo do vendedor, embalagem nova do mesmo produto, lote ou validade, foto de caixa x foto do produto, marca dagua, " +
  "e variacao a escolha no anuncio (cor, tamanho, voltagem) quando inclui a do original.\n" +
  "SEMPRE sao diferenca, em qualquer categoria: condicao (novo x usado, seminovo, recondicionado, vitrine, mostruario, " +
  "avariado, sem caixa, tester), original x replica, similar, compativel ou generico, outra marca, e kit x unidade, par " +
  "ou quantidade diferente.\n" +
  "O que decide em cada categoria (conta so se os dois informam e diferem):\n" +
  "Celulares e informatica: modelo e geracao, armazenamento, RAM, cor, 4G x 5G, chip, teclado ABNT2 x US, polegadas.\n" +
  "Eletrodomesticos, eletronicos, ferramentas, agro e industria: voltagem (110/127, 220, bivolt), potencia, capacidade em " +
  "litros ou kg, com ou sem bateria/carregador, acessorios inclusos, monofasico x trifasico, cor/acabamento (inox x branco).\n" +
  "Acessorios para veiculos e pecas: veiculo, ano e motor compativeis, lado (esquerdo x direito), dianteiro x traseiro, " +
  "medida (aro, pneu 175/70 R14, indices de carga e velocidade), par x unidade.\n" +
  "Beleza, perfumaria e cuidado pessoal: volume ou peso, concentracao (parfum, EDP, EDT, colonia), tom ou cor da " +
  "maquiagem, refil x com frasco, itens do kit.\n" +
  "Alimentos, bebidas, suplementos e saude: sabor, peso ou volume, quantidade de unidades, versao (zero, sem lactose, " +
  "integral), dosagem ou concentracao.\n" +
  "Pet: faixa de peso ou porte do animal, idade (filhote x adulto), sabor, quantidade (pipetas, comprimidos).\n" +
  "Bebes: tamanho e quantidade de fraldas, faixa de idade ou peso.\n" +
  "Calcados, bolsas e joias: modelo, cor, material (ouro 18k x folheado, couro x sintetico); numeracao da grade nao conta; " +
  "tamanho da bolsa ou aro do anel informado no titulo conta.\n" +
  "Casa, moveis, decoracao, colchoes e construcao: medidas, tamanho (solteiro, casal, queen, king), cor e acabamento, " +
  "material, quantidade de pecas, densidade, bitola, comprimento.\n" +
  "Esportes, brinquedos, festas e papelaria: peso (halter), tamanho, cor, numero de pecas, tema ou personagem, gramatura, " +
  "quantidade.\n" +
  "Games, livros, musica e filmes: plataforma (PS5 x PS4), midia fisica x digital, edicao (padrao, deluxe, capa dura x " +
  "brochura), idioma, volume, formato (CD, vinil, Blu-ray); reimpressao nao conta.\n" +
  "Cameras e instrumentos: so corpo x kit com lente, modelo, canhoto x destro, numero de cordas.\n" +
  "Item unico (veiculo, imovel, ingresso, servico, usado unico, antiguidade): so e igual se for o mesmo item.\n";
/* Categoria e ficha do original no texto da conferencia (27/09): a IA aplica
   a regra da categoria e compara com os fatos do anuncio, nao so o titulo. */
function fatosDoOriginal(original: Anuncio): string {
  return (
    (original.categoria ? "\nCategoria: " + original.categoria.slice(0, 300) : "") +
    (original.fatos ? "\nFicha do anuncio original: " + original.fatos.slice(0, 900) : "")
  );
}

/* CONDICAO pelo titulo (27/09): usado, recondicionado, vitrine... nunca e o
   mesmo produto que um novo, diga a IA o que disser. */
const RE_CONDICAO =
  /\b(usad[oa]s?|seminov[oa]s?|semi-nov[oa]s?|recondicionad[oa]s?|vitrine|mostru[aá]rio|open ?box|avariad[oa]s?|sem caixa|tester|refurbished|used)\b/i;
export function condicaoDoTitulo(t: string | null | undefined): string | null {
  const m = RE_CONDICAO.exec(String(t ?? ""));
  return m ? (m[1] ?? "").toLowerCase() : null;
}

/* Revisao de quem teve a MESMA foto mas foi reprovado: so vira igual com a
   segunda conferencia (de preferencia outro modelo) dizendo igual, sem
   diferenca, tambem com mesma_foto e com confianca >= 90. */
const CONFIANCA_REVISAO = 90;
const MAX_REVISAO = 4;
/* Vereditos guardados antes desta regra (27/09) nao valem: podem ser
   reprovacoes so por nome no titulo. */
const REGRAS_DESDE = Date.parse("2026-09-28T00:00:00Z");

/* GEMMA (autorizado pelo Weslei em 25/09): so quando a Gemini nao der
   (cota esgotada, fora do ar, tempo). Mesma chave, cota gratuita propria.
   Vem sempre DEPOIS de todos os Gemini; modelo que a chave nao tem (404) e
   pulado. Veredito do Gemma precisa de confianca maior (e mais fraco em
   detalhe de foto). */
const MODELOS_GEMMA = ["gemma-4-31b-it", "gemma-4-26b-a4b-it", "gemma-3-27b-it"];
const CONFIANCA_MINIMA_GEMMA = 90;
const ehGemma = (modelo: string | undefined) => /^gemma/i.test(modelo ?? "");
const confiancaMinima = (modelo: string | undefined) =>
  ehGemma(modelo) ? CONFIANCA_MINIMA_GEMMA : CONFIANCA_MINIMA;

function ordemDosModelos(): string[] {
  const escolhido = (process.env["GEMINI_MODEL"] ?? "").trim();
  const gemini = escolhido ? [escolhido, ...MODELOS.filter((m) => m !== escolhido)] : MODELOS;
  return [...gemini.filter((m) => !ehGemma(m)), ...MODELOS_GEMMA];
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
          /* Gemma nao tem o modo JSON da Gemini: o pedido ja manda
             responder so JSON e lerJson tira o bloco {} do texto. */
          generationConfig: ehGemma(modelo)
            ? { temperature: 0 }
            : {
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
        parecido?: boolean;
        mesmaFoto?: boolean;
        semelhanca?: number | null;
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
        parecido?: boolean;
        mesmaFoto?: boolean;
        semelhanca?: number | null;
      }>;
    };

/* VEREDITOS GUARDADOS (custo zero, pedido do Weslei): cada par "anúncio
   original x candidato" conferido pela Gemini fica na tabela ia_vereditos por
   30 dias. Na próxima consulta com o mesmo par, a resposta vem do banco e não
   gasta cota da API. Só vai para a Gemini o que nunca foi conferido. */
/* parecido: NAO e o mesmo produto, mas e uma alternativa honesta (mesmo tipo
   e funcao, mesma compatibilidade/tamanho; muda marca, cor ou detalhe). O site
   mostra separado, com o aviso "nao e o mesmo produto" (Weslei, 25/09). */
type Veredito = {
  igual: boolean;
  confianca: number;
  motivo: string;
  parecido?: boolean;
  mesmaFoto?: boolean;
  semelhanca?: number | null;
};

async function vereditosGuardados(original: string, chaves: string[]) {
  const mapa = new Map<string, Veredito>();
  if (!original || !chaves.length) return mapa;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ia_vereditos" as never)
      .select("chave_candidato,igual,confianca,motivo,parecido,mesma_foto,semelhanca")
      .eq("chave_original" as never, original as never)
      .in("chave_candidato" as never, chaves as never)
      .gte(
        "criado_em" as never,
        new Date(Math.max(Date.now() - 30 * 86400_000, REGRAS_DESDE)).toISOString() as never,
      );
    for (const l of (data ?? []) as Array<
      {
        chave_candidato: string;
        mesma_foto?: boolean | null;
        semelhanca?: number | null;
      } & Veredito
    >) {
      mapa.set(l.chave_candidato, {
        igual: l.igual,
        confianca: l.confianca,
        motivo: l.motivo,
        parecido: l.parecido === true,
        mesmaFoto: l.mesma_foto === true,
        semelhanca: l.semelhanca ?? null,
      });
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
        parecido: l.parecido === true,
        mesma_foto: l.mesmaFoto === true,
        semelhanca: l.semelhanca ?? null,
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
          parecido: a.parecido === true,
          mesmaFoto: a.mesmaFoto === true,
          semelhanca: a.semelhanca ?? null,
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
    parecido?: boolean;
    mesmaFoto?: boolean;
    semelhanca?: number | null;
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
        paraGuardar.push({
          chave,
          igual: a.igual,
          confianca: a.confianca,
          motivo: a.motivo,
          parecido: a.parecido === true,
          mesmaFoto: a.mesmaFoto === true,
          semelhanca: a.semelhanca ?? null,
        });
    }
    await guardarVereditos(chaveOriginal, paraGuardar, novo.modelo);
  }
  /* Condicao diferente no titulo (usado x novo) derruba o igual. */
  const condOriginal = condicaoDoTitulo(original.titulo);
  for (const a of avaliacao) {
    const cond = condicaoDoTitulo(lista[a.indice]?.titulo);
    if (a.igual && cond && cond !== condOriginal) {
      a.igual = false;
      a.parecido = true;
      a.motivo = `Condição diferente (${cond})`;
    }
  }
  const iguais = avaliacao
    .filter((a) => a.igual && a.confianca >= CONFIANCA_MINIMA && !a.semFoto)
    .map((a) => a.indice);
  for (const a of avaliacao) if (a.igual || a.semFoto) a.parecido = false;
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

  const pedido: Parte = {
    text:
      "Voce confere anuncios para um comparador de precos. O cliente vai comprar o produto do ANUNCIO ORIGINAL " +
      "e so pode ver outra loja como mesmo produto se o PRODUTO for o mesmo. Cada vendedor faz a propria foto: " +
      "fundo, angulo, montagem, textos, selos, enfeites e quantas unidades aparecem na foto NAO importam.\n" +
      "Passo 1: descreva o PRODUTO do original (foto e titulo): tipo, marca e modelo, cor e acabamento do proprio " +
      "produto, material, formato, tamanho/volume, compatibilidade (modelo do celular, voltagem) e quantidade do kit.\n" +
      "Passo 2: para cada CANDIDATO, use a foto e o titulo dele. E o mesmo produto quando tipo, marca/modelo (se o " +
      "original tem marca), cor e acabamento do produto, tamanho, compatibilidade e quantidade batem. Detalhe que so " +
      "nao aparece na foto do candidato NAO e diferenca (ex.: gravacao pequena que o angulo nao mostra), se o titulo " +
      "e o resto confirmam. Diferenca e o que CONTRADIZ o original: outra marca, outra cor ou borda do produto " +
      "(capinha transparente com borda preta x capinha toda transparente), outro modelo compativel, outro tamanho, " +
      "outra quantidade, acessorio vendido junto (ex.: pelicula). Anuncio que atende varios modelos so e igual se " +
      "citar o mesmo modelo do original. Candidato sem foto: igual=false. Ignore preco, loja e propaganda.\n" +
      REGRA_NOMES +
      REGRA_CATEGORIAS +
      "Em diferencas liste so essas contradicoes (vazio se nenhuma). igual=true so com diferencas vazia.\n" +
      "parecido=true quando NAO e o mesmo produto mas serve como alternativa: mesmo tipo e mesma funcao, mesma " +
      "compatibilidade (mesmo modelo de celular, mesma voltagem, mesmo tamanho) e quantidade parecida; muda so " +
      "marca, cor, estampa ou detalhe. Outro modelo de celular, outro tamanho ou outro tipo de produto: parecido=false.\n" +
      'Responda so JSON: {"descricao_original":"...","candidatos":[{"indice":0,"diferencas":["..."],"igual":false,"parecido":false,"mesma_foto":false,"semelhanca":0,"confianca":0-100,"motivo":"curto"}]}',
  };

  /* Dois lotes em paralelo (27/09): 8 candidatos de uma vez passaram do
     prazo de 13 s com a regra de roupa/mesma foto; metade em cada chamada
     responde bem antes. Cada lote leva o original e os seus candidatos. */
  const lote = (idx: number[]): Parte[] => {
    const p: Parte[] = [
      pedido,
      {
        text:
          "ANUNCIO ORIGINAL: " +
          (original.titulo ?? "") +
          (fotoOriginal ? "" : " (sem foto)") +
          fatosDoOriginal(original),
      },
    ];
    if (fotoOriginal) p.push(fotoOriginal);
    idx.forEach((i, k) => {
      p.push({
        text: `CANDIDATO ${k}: ${lista[i]?.titulo ?? "(sem titulo)"}${fotos[i] ? "" : " (sem foto)"}`,
      });
      const f = fotos[i];
      if (f) p.push(f);
    });
    return p;
  };
  const todos = lista.map((_, i) => i);
  const metade = Math.ceil(todos.length / 2);
  const lotes = todos.length > 4 ? [todos.slice(0, metade), todos.slice(metade)] : [todos];
  const prazo1 = Math.max(4_000, 13_000 - (Date.now() - t0));
  const respostas = await Promise.all(lotes.map((idx) => gerar(lote(idx), { prazo: prazo1 })));
  const falha = respostas.find((x) => !x.ok);
  if (falha && !falha.ok) return falha;
  const r = respostas[0] as Extract<Resultado, { ok: true }>;
  const vereditos: VereditoIA[] = [];
  let descricaoIA: string | undefined;
  for (let n = 0; n < lotes.length; n++) {
    const rn = respostas[n] as Extract<Resultado, { ok: true }>;
    const on = lerJson<{ descricao_original?: string; candidatos?: VereditoIA[] }>(rn.texto);
    if (!on || !Array.isArray(on.candidatos))
      return { ok: false, status: 502, erro: "JSON invalido da IA", modelo: rn.modelo };
    descricaoIA ??= on.descricao_original;
    const idx = lotes[n] as number[];
    for (const c of on.candidatos) {
      const g = Number.isInteger(c.indice) ? idx[c.indice as number] : undefined;
      if (g !== undefined) vereditos.push({ ...c, indice: g });
    }
  }
  const obj = { descricao_original: descricaoIA, candidatos: vereditos };

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
  /* "Igual" abaixo do minimo do modelo (Gemma: 90) nao conta como igual:
     sem isso ele escapava da segunda conferencia e passava no filtro final. */
  for (const a of avaliacao) {
    if (a.igual && a.confianca < confiancaMinima(r.modelo)) {
      a.igual = false;
      a.parecido = true;
      a.motivo =
        `confianca ${a.confianca} abaixo de ${confiancaMinima(r.modelo)}: ${a.motivo}`.slice(
          0,
          140,
        );
    }
  }
  const positivos = avaliacao.filter((a) => a.igual && !a.semFoto && fotoOriginal);
  /* REVISAO (27/09): reprovado com a MESMA foto do original vai junto para a
     segunda conferencia, com o motivo da primeira. Os mais parecidos primeiro. */
  const revisar = fotoOriginal
    ? avaliacao
        .filter((a) => !a.igual && a.mesmaFoto && !a.semFoto)
        .sort((x, y) => (y.semelhanca ?? 0) - (x.semelhanca ?? 0))
        .slice(0, MAX_REVISAO)
    : [];
  const paraSegunda = [...positivos, ...revisar];
  if (paraSegunda.length && fotoOriginal) {
    const resta = 21_000 - (Date.now() - t0);
    const semConfirmar = (erro: string): Conferencia => ({
      ok: false,
      status: 504,
      erro: "confirmacao: " + erro,
      modelo: r.modelo,
      parcial: avaliacao,
    });
    /* Sem "igual" a confirmar, falha na revisao nao derruba a consulta: os
       revisados so continuam em "Parecidos". */
    let r2: Resultado | null = null;
    if (resta < 4_000) {
      if (positivos.length) return semConfirmar("sem tempo");
    } else {
      const confirmacao: Parte[] = [
        {
          text:
            "Segunda conferencia. O cliente vai comprar o ANUNCIO ORIGINAL. Outra conferencia achou que os CANDIDATOS " +
            "abaixo sao o mesmo PRODUTO: confirme ou derrube cada um. Os marcados REVISAR foram reprovados por ela " +
            "apesar de a foto ser a mesma do original: veja o motivo dado e decida se e contradicao real ou so nome " +
            "diferente no titulo.\n" +
            "Cada vendedor faz a propria foto: fundo, angulo, montagem, textos, selos e enfeites NAO contam, nem detalhe " +
            "que so nao aparece na foto. Liste em diferencas o que CONTRADIZ o original no produto: outra marca, outra cor " +
            "ou borda, outro material ou formato, outro modelo compativel, outro tamanho ou volume, outra quantidade, " +
            "acessorio vendido junto (pelicula, cabo).\n" +
            REGRA_NOMES +
            REGRA_CATEGORIAS +
            "igual=true somente sem nenhuma contradicao. Contradicao real na duvida: igual=false.\n" +
            'Responda so JSON: {"candidatos":[{"indice":0,"diferencas":["..."],"igual":false,"parecido":true,"mesma_foto":false,"semelhanca":0,"confianca":0-100,"motivo":"curto"}]}',
        },
        {
          text:
            "ANUNCIO ORIGINAL: " +
            (original.titulo ?? "") +
            fatosDoOriginal(original) +
            (descricao ? "\nDescricao da foto do original: " + descricao : ""),
        },
        fotoOriginal,
      ];
      paraSegunda.forEach((a, k) => {
        const rev = k >= positivos.length;
        confirmacao.push({
          text:
            `CANDIDATO ${k}: ${lista[a.indice]?.titulo ?? "(sem titulo)"}` +
            (rev ? ` (REVISAR; a primeira conferencia disse: ${a.motivo.slice(0, 120)})` : ""),
        });
        const f = fotos[a.indice];
        if (f) confirmacao.push(f);
      });
      /* Outro Gemini primeiro; o mesmo Gemini depois; Gemma so no fim. */
      const base = ordemDosModelos();
      const outroPrimeiro = [
        ...base.filter((m) => m !== r.modelo && !ehGemma(m)),
        ...(ehGemma(r.modelo) ? [] : [r.modelo]),
        ...base.filter((m) => m !== r.modelo && ehGemma(m)),
        ...(ehGemma(r.modelo) ? [r.modelo] : []),
      ];
      r2 = await gerar(confirmacao, { ordem: outroPrimeiro, prazo: Math.min(9_000, resta) });
      if (!r2.ok && positivos.length) return semConfirmar(`${r2.status} ${r2.erro}`);
    }
    const obj2 = r2 && r2.ok ? lerJson<{ candidatos?: VereditoIA[] }>(r2.texto) : null;
    if (r2 && r2.ok && (!obj2 || !Array.isArray(obj2.candidatos)) && positivos.length)
      return semConfirmar("JSON invalido");
    const modelo2 = r2 && r2.ok ? r2.modelo : "";
    const segunda = new Map(
      obj2 && Array.isArray(obj2.candidatos)
        ? lerVereditos(obj2.candidatos, paraSegunda.length).map((v) => [v.indice, v])
        : [],
    );
    positivos.forEach((a, k) => {
      const v = segunda.get(k);
      if (v && v.igual && v.confianca >= confiancaMinima(modelo2)) {
        a.confianca = Math.min(a.confianca, v.confianca);
        a.motivo = `${a.motivo.slice(0, 95)} | confirmado (${modelo2})`;
      } else {
        a.igual = false;
        a.parecido = v ? v.parecido : true;
        a.motivo = (v?.motivo || "a segunda conferencia nao confirmou").slice(0, 140);
      }
    });
    revisar.forEach((a, n) => {
      const v = segunda.get(positivos.length + n);
      if (!v) return;
      if (v.semelhanca != null) a.semelhanca = Math.max(a.semelhanca ?? 0, v.semelhanca);
      if (
        v.igual &&
        v.mesmaFoto &&
        v.confianca >= Math.max(CONFIANCA_REVISAO, confiancaMinima(modelo2))
      ) {
        a.igual = true;
        a.parecido = false;
        a.confianca = v.confianca;
        a.motivo = `mesma foto; ${v.motivo.slice(0, 80)} | revisto (${modelo2})`.slice(0, 140);
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
  parecido?: boolean;
  mesma_foto?: boolean;
  semelhanca?: number;
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
      /* Quando nao e igual, o motivo e O QUE MUDA: e o aviso que o site mostra
         nos parecidos. */
      const motivo =
        !igual && diferencas.length
          ? diferencas.join("; ")
          : String(c.motivo ?? "") || diferencas.join("; ");
      const sem = Number(c.semelhanca);
      return {
        indice: c.indice as number,
        igual,
        /* "Igual" derrubado por diferenca vira parecido; a mesma foto tambem. */
        parecido: !igual && (c.parecido === true || c.igual === true || c.mesma_foto === true),
        mesmaFoto: c.mesma_foto === true,
        semelhanca: Number.isFinite(sem) ? Math.max(0, Math.min(100, Math.round(sem))) : null,
        confianca: Math.max(0, Math.min(100, Number(c.confianca) || 0)),
        motivo: motivo.slice(0, 140),
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
