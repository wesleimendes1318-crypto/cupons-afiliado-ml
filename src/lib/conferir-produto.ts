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
  "a foto e o resto batem; abreviacoes equivalem (3s = 3 Stripes = 3 Listras; WV = Woven). Tecidos: malha = " +
  "tricot = knit = moletom leve; woven = tecido plano = tactel = microfibra; malha x woven e diferenca.\n" +
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
  "SEMPRE e diferenca, mesmo com foto identica: produto completo (aparelho, eletrodomestico, equipamento) x so " +
  "uma PARTE dele (carcaca, frontal, tampa, gabinete, moldura, display/tela, refil, peca de reposicao, acessorio " +
  "avulso). Peca custa muito menos e o vendedor usa a foto do aparelho: confira se o titulo diz que e so a peca.\n" +
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

/* Peca no lugar do aparelho (pedido 535, 30/09): mesma regra da extensao
   (extensao/comparador.js). Original que nao e peca x candidato carcaca,
   tampa, moldura, frontal, display/tela avulsa, refil ou peca de reposicao. */
export const RE_PECA_PARTE =
  /(?<!\bcom )\b(carca[çc]as?|gabinetes?|molduras?|tampas?|painel frontal|frontal (?:de|do|da|para)|telas? touch|touch ?screen|display (?:de|do|da|para|lcd|oled|compat[ií]vel)|refil|refis|pe[çc]as? de reposi[çc][ãa]o|(?:somente|apenas|s[oó]) (?:a )?pe[çc]a|suporte (?:de|para))\b/i;
export const MUDA_PECA = "Apenas carcaça / peça de reposição (não é o aparelho completo)";
export function pecaNoLugarDoAparelho(
  original: string | null | undefined,
  candidato: string | null | undefined,
) {
  return !RE_PECA_PARTE.test(String(original ?? "")) && RE_PECA_PARTE.test(String(candidato ?? ""));
}

/* ESPECULACAO NAO E DIFERENCA (02/10, pedido 550: "o candidato nao informa
   e o '4' do titulo pode indicar outra capacidade" tirou da tabela a mesma
   geladeira Black Inox da loja oficial Brastemp, com a mesma foto).
   Contradicao e o que os DOIS anuncios dizem de forma diferente. */
export const RE_ESPECULACAO =
  /\b(n[aã]o (informa|especifica|menciona|cita|confirma|indica)|sem informa[çc][aã]o|pode (indicar|ser|significar|sugerir)|possivelmente|provavelmente|talvez|n[aã]o (é|e) poss[ií]vel (confirmar|saber|verificar|afirmar))\b/i;
export function soEspeculacao(d: string | null | undefined) {
  return RE_ESPECULACAO.test(String(d ?? ""));
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
/* gemma-3-27b-it saiu do ar (02/10, pedido 588: 404 "not found"). */
const MODELOS_GEMMA = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
const CONFIANCA_MINIMA_GEMMA = 90;
const ehGemma = (modelo: string | undefined) => /^gemma/i.test(modelo ?? "");
const confiancaMinima = (modelo: string | undefined) =>
  ehGemma(modelo) ? CONFIANCA_MINIMA_GEMMA : CONFIANCA_MINIMA;

/* COTA DO DIA (28/09): 2.5-flash e flash-latest tem 20 pedidos por dia na
   cota gratuita. Depois do 429 de cota DIARIA, o modelo sai da fila ate a
   cota voltar (meia-noite do Pacifico = 07:00 UTC, com folga), em vez de
   gastar o tempo da segunda conferencia a cada consulta. Vale enquanto o
   servidor estiver de pe (memoria). */
const cotaAcabou = new Map<string, number>();
function proximaVoltaDaCota(): number {
  const d = new Date();
  const volta = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0);
  return volta > Date.now() ? volta : volta + 86_400_000;
}
/* A cota esgotada fica tambem no banco (ia_cotas), para todas as instancias
   do servidor; a leitura e guardada por 1 minuto. */
let cotasLidasEm = 0;
async function carregarCotas() {
  if (Date.now() - cotasLidasEm < 60_000) return;
  cotasLidasEm = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ia_cotas" as never)
      .select("modelo,ate")
      .gt("ate" as never, new Date().toISOString() as never);
    for (const l of (data ?? []) as Array<{ modelo: string; ate: string }>)
      cotaAcabou.set(l.modelo, Date.parse(l.ate));
  } catch {
    /* sem banco: fica so a memoria */
  }
}
async function marcarCotaAcabou(modelo: string) {
  const ate = proximaVoltaDaCota();
  cotaAcabou.set(modelo, ate);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ia_cotas" as never)
      .upsert({ modelo, ate: new Date(ate).toISOString() } as never);
  } catch {
    /* so memoria */
  }
}

function modeloDisponivel(m: string): boolean {
  const ate = cotaAcabou.get(m);
  if (!ate) return true;
  if (Date.now() >= ate) {
    cotaAcabou.delete(m);
    return true;
  }
  return false;
}

function ordemDosModelos(): string[] {
  const escolhido = (process.env["GEMINI_MODEL"] ?? "").trim();
  const gemini = escolhido ? [escolhido, ...MODELOS.filter((m) => m !== escolhido)] : MODELOS;
  const todos = [...gemini.filter((m) => !ehGemma(m)), ...MODELOS_GEMMA];
  const livres = todos.filter(modeloDisponivel);
  return livres.length ? livres : todos;
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
  /* JPEG em vez de WEBP (28/09): o Gemma nunca respondeu a conferencia (500
     com a foto webp). O mlstatic serve a mesma foto em .jpg; sem ela, usa a
     original. */
  const jpg = /\.webp$/i.test(url) ? url.replace(/\.webp$/i, ".jpg") : null;
  if (jpg) {
    const parte = await baixarImagem(jpg);
    if (parte) return parte;
  }
  return baixarImagem(url);
}

async function baixarImagem(url: string): Promise<Parte | null> {
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
      if (/PerDay/i.test(v?.quotaId ?? "")) void marcarCotaAcabou(modelo);
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
  opcoes: { ordem?: string[]; prazo?: number; iniciais?: number } = {},
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
    /* iniciais > 1: varios modelos saem juntos (segunda conferencia com o
       Gemma desde o inicio, 28/09); vale a primeira resposta boa. */
    for (let k = 0; k < Math.max(1, opcoes.iniciais ?? 1); k++) lancar();
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
      alertaOriginal?: string | null;
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
        vantagem?: string | null;
        qualidade?: string | null;
        qualidadeMotivo?: string | null;
        desvantagens?: string[] | null;
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
        vantagem?: string | null;
        qualidade?: string | null;
        qualidadeMotivo?: string | null;
        desvantagens?: string[] | null;
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
  qualidade?: string | null;
  qualidadeMotivo?: string | null;
  desvantagens?: string[] | null;
};

async function vereditosGuardados(original: string, chaves: string[]) {
  const mapa = new Map<string, Veredito>();
  if (!original || !chaves.length) return mapa;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ia_vereditos" as never)
      .select(
        "chave_candidato,igual,confianca,motivo,parecido,mesma_foto,semelhanca,qualidade,qualidade_motivo,desvantagens",
      )
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
        qualidade_motivo?: string | null;
      } & Veredito
    >) {
      /* Parecido guardado antes do veredito de qualidade (05/10) é
         conferido de novo: sem ele não pode virar recomendação. */
      if (l.parecido === true && !l.qualidade) continue;
      mapa.set(l.chave_candidato, {
        igual: l.igual,
        confianca: l.confianca,
        motivo: l.motivo,
        parecido: l.parecido === true,
        mesmaFoto: l.mesma_foto === true,
        semelhanca: l.semelhanca ?? null,
        qualidade: l.qualidade ?? null,
        qualidadeMotivo: l.qualidade_motivo ?? null,
        desvantagens: Array.isArray(l.desvantagens) ? l.desvantagens : null,
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
        qualidade: l.qualidade ?? null,
        qualidade_motivo: l.qualidadeMotivo ?? null,
        desvantagens: l.desvantagens ?? null,
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
  await carregarCotas();
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
    vantagem?: string | null;
    qualidade?: string | null;
    qualidadeMotivo?: string | null;
    desvantagens?: string[] | null;
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
          qualidade: a.qualidade ?? null,
          qualidadeMotivo: a.qualidadeMotivo ?? null,
          desvantagens: a.desvantagens ?? null,
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
  /* Peca no lugar do aparelho (pedido 535): nunca igual, diga a IA o que disser. */
  for (const a of avaliacao) {
    if (pecaNoLugarDoAparelho(original.titulo, lista[a.indice]?.titulo)) {
      a.igual = false;
      a.parecido = true;
      a.motivo = MUDA_PECA;
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
    alertaOriginal: novo && novo.ok ? (novo.alertaOriginal ?? null) : null,
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
      "Em diferencas liste so essas contradicoes (vazio se nenhuma). igual=true so com diferencas vazia. Escreva cada diferenca como 'Campo: valor do original -> valor do candidato' (ex.: 'Cor: branco -> preto', 'Capacidade: 500 L -> 477 L').\n" +
      "vantagem: o que o candidato oferece A MAIS que o original, de forma objetiva e curta (conjunto completo x so " +
      "uma peca, kit com mais unidades, volume maior, versao superior); vazio quando nao ha.\n" +
      "qualidade: compare a QUALIDADE do candidato com a do original, pelo que os dois informam (titulo, ficha, " +
      "foto) e pelo que se sabe do modelo/linha: inferior quando e objetivamente pior em algo que importa no uso " +
      "(resolucao nativa menor, menos brilho, capacidade, potencia, memoria ou armazenamento, material inferior, " +
      "versao de entrada ou mini da linha, marca generica no lugar de marca reconhecida); superior quando e melhor " +
      "nisso; equivalente quando atende o mesmo uso com o mesmo nivel; incerta quando nao da para afirmar. Nunca use " +
      "o preco para julgar. qualidade_motivo: curto, com o dado que sustenta (ex.: 'Resolucao nativa: 1080p -> " +
      "720p', 'Mesma linha, muda so a cor').\n" +
      "desvantagens: pense como um COMPRADOR cuidadoso que vai usar o produto e olhe TUDO (foto, titulo, ficha, " +
      "descricao), nao so a foto. Liste curto o que o candidato tem PIOR ou A MENOS que o original e pesa na compra " +
      "(ex.: 'Sem controle remoto', 'Resolucao: 1080p -> 720p', 'Material: metal -> plastico', 'Marca generica', " +
      "'Garantia: 12 meses -> 3 meses'). So o que os dados mostram, sem suposicao; [] quando nao ha.\n" +
      "original_contradiz: texto curto quando o PROPRIO anuncio original se contradiz, com a foto mostrando outro " +
      "produto que o titulo, a ficha ou a descricao descrevem (outro modelo, cor, tecido, quantidade); vazio quando " +
      "batem. Foto ilustrativa, angulo ou fundo nao contam.\n" +
      "parecido=true quando NAO e o mesmo produto mas serve como alternativa: mesmo tipo e mesma funcao, mesma " +
      "compatibilidade (mesmo modelo de celular, mesma voltagem, mesmo tamanho) e quantidade parecida; muda so " +
      "marca, cor, estampa ou detalhe. Outro modelo de celular, outro tamanho ou outro tipo de produto: parecido=false.\n" +
      'Responda so JSON: {"descricao_original":"...","original_contradiz":"","candidatos":[{"indice":0,"diferencas":["..."],"igual":false,"parecido":false,"mesma_foto":false,"semelhanca":0,"vantagem":"","qualidade":"equivalente","qualidade_motivo":"","desvantagens":[],"confianca":0-100,"motivo":"curto"}]}',
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
  /* Lotes de ate 4 em paralelo (12 candidatos = 3 chamadas; garimpo, 27/09). */
  const lotes: number[][] = [];
  for (let k = 0; k < todos.length; k += 4) lotes.push(todos.slice(k, k + 4));
  const prazo1 = Math.max(4_000, 13_000 - (Date.now() - t0));
  const respostas = await Promise.all(lotes.map((idx) => gerar(lote(idx), { prazo: prazo1 })));
  /* Um lote que falhou (cota, tempo) nao derruba os outros (28/09: um dos 3
     lotes passou do prazo e a consulta inteira ficou sem conferencia). Os
     candidatos dele so ficam sem veredito. Todos falharam: devolve a falha. */
  const boas = respostas.filter((x): x is Extract<Resultado, { ok: true }> => x.ok);
  if (!boas.length) return respostas[0] as Extract<Resultado, { ok: false }>;
  const r = boas[0] as Extract<Resultado, { ok: true }>;
  const vereditos: VereditoIA[] = [];
  let descricaoIA: string | undefined;
  /* ANUNCIO QUE SE CONTRADIZ (28/09, agasalho da SHOPMASP: foto do conjunto
     Woven, descricao "malha macia" do Basic 3S tricot). O site avisa o
     cliente em vez de fingir certeza. */
  let alertaOriginal: string | null = null;
  for (let n = 0; n < lotes.length; n++) {
    const rn = respostas[n] as Resultado;
    if (!rn.ok) continue;
    const on = lerJson<{
      descricao_original?: string;
      original_contradiz?: string;
      candidatos?: VereditoIA[];
    }>(rn.texto);
    if (!on || !Array.isArray(on.candidatos)) continue;
    descricaoIA ??= on.descricao_original;
    const contradiz = String(on.original_contradiz ?? "").trim();
    if (!alertaOriginal && contradiz.length >= 12) alertaOriginal = contradiz.slice(0, 220);
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
            "igual=true somente sem nenhuma contradicao. Contradicao real na duvida: igual=false. Escreva cada diferenca como 'Campo: valor do original -> valor do candidato' (ex.: 'Cor: branco -> preto', 'Capacidade: 500 L -> 477 L').\n" +
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
      /* Segunda opiniao de OUTRO modelo: os outros Gemini com cota, depois o
         Gemma (Weslei, 28/09: "lembre de usar o Gemma"; cota propria, minimo
         90) e so no fim o mesmo modelo da primeira conferencia. */
      const outroPrimeiro = [
        ...base.filter((m) => m !== r.modelo && !ehGemma(m)),
        ...base.filter((m) => m !== r.modelo && ehGemma(m)),
        r.modelo,
      ];
      /* Dois modelos saem juntos: com os outros Gemini sem cota, sao o Gemma e
         o proximo da fila, e o Gemma tem o prazo inteiro (antes entrava no
         fim e nunca chegou a responder). */
      r2 = await gerar(confirmacao, {
        ordem: outroPrimeiro,
        prazo: Math.min(9_000, resta),
        iniciais: 2,
      });
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
    alertaOriginal,
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
  vantagem?: string;
  qualidade?: string;
  qualidade_motivo?: string;
  desvantagens?: unknown;
};

const NIVEIS_QUALIDADE = new Set(["superior", "equivalente", "inferior", "incerta"]);

/* Qualquer diferenca listada derruba o "igual", diga a IA o que disser. */
function lerVereditos(lista: VereditoIA[], total: number) {
  return lista
    .filter(
      (c) =>
        Number.isInteger(c.indice) && (c.indice as number) >= 0 && (c.indice as number) < total,
    )
    .map((c) => {
      const todas = Array.isArray(c.diferencas)
        ? c.diferencas.map((d) => String(d ?? "").trim()).filter(Boolean)
        : [];
      /* Toda diferenca listada reprova, ate a especulativa (02/10, pedido 550:
         "pode indicar outra capacidade" era mesmo outro modelo, BRE68AK 477 L,
         com a mesma foto). Especulacao so muda o TEXTO do que muda. */
      const diferencas = todas.filter((d) => !soEspeculacao(d));
      const igual = c.igual === true && todas.length === 0;
      /* Quando nao e igual, o motivo e O QUE MUDA: e o aviso que o site mostra
         nos parecidos. Sem contradicao confirmada, diz isso. */
      const motivo =
        !igual && diferencas.length
          ? diferencas.join("; ")
          : !igual && todas.length
            ? "Não confirmado: " + todas.join("; ")
            : String(c.motivo ?? "") || diferencas.join("; ");
      const sem = Number(c.semelhanca);
      return {
        indice: c.indice as number,
        igual,
        /* "Igual" derrubado por diferenca vira parecido; a mesma foto tambem. */
        parecido: !igual && (c.parecido === true || c.igual === true || c.mesma_foto === true),
        mesmaFoto: c.mesma_foto === true,
        semelhanca: Number.isFinite(sem) ? Math.max(0, Math.min(100, Math.round(sem))) : null,
        vantagem:
          String(c.vantagem ?? "")
            .trim()
            .slice(0, 90) || null,
        /* Qualidade x original (05/10): só os 4 valores aceitos. */
        qualidade: NIVEIS_QUALIDADE.has(String(c.qualidade ?? "").toLowerCase())
          ? String(c.qualidade).toLowerCase()
          : null,
        qualidadeMotivo:
          String(c.qualidade_motivo ?? "")
            .trim()
            .slice(0, 90) || null,
        /* Desvantagens para quem compra (05/10): até 3, curtas. */
        desvantagens: Array.isArray(c.desvantagens)
          ? c.desvantagens
              .map((d) =>
                String(d ?? "")
                  .trim()
                  .slice(0, 80),
              )
              .filter(Boolean)
              .slice(0, 3)
          : [],
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

/* Mesma fila de modelos (Gemini e, sem cota, Gemma) para a "Ajuda para
   escolher" do resultado (28/09). */
export { gerar as gerarComModelos, imagem as baixarFoto, lerJson };
