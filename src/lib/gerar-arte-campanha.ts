/* ARTE REALISTA DAS CAMPANHAS (Weslei, 05/10: "preferência de artes mais
   reais, como no caso anexo": render 3D fotorrealista, produtos em
   pedestais, cartão de comparação com ✓, luz de estúdio). Só servidor.

   Gera UMA vez por tema (tarefa operacao?tarefa=arte&tema=...), salva no
   armazenamento público do site (bucket "campanhas") e registra em
   campanha_artes; a vitrine só lê o arquivo salvo (nada de gerar a cada
   visita). Modelos: OpenAI gpt-image-1 (chave dos Secrets) e, sem ela ou com
   erro, Gemini de imagem (GEMINI_API_KEY). Sem texto, logotipo ou marca na
   imagem (políticas do programa de afiliados); títulos, preços e botões
   ficam no HTML. */
import { chaveGpt } from "@/lib/gpt";
import type { TemaVisualId } from "@/lib/campanha-visual";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* Versão dos prompts: mudar aqui gera um arquivo novo (cache do navegador). */
export const VERSAO_ARTE = 1;

const BASE =
  "Photorealistic 3D product render for an e-commerce price comparison campaign banner, landscape. Premium studio lighting with soft shadows and subtle reflections, shallow depth of field, clean modern composition, rounded cylindrical and square pedestals at different heights, a floating frosted-glass comparison card with three soft green check-mark circles and blank grey lines (absolutely no readable text). No words, no letters, no numbers, no logos, no brand names, no watermarks. Generic unbranded products only. Leave calm empty space on the left third of the image.";

export const PROMPTS_ARTE: Record<TemaVisualId, string> = {
  criancas: `${BASE} Theme: children's day gifts. Products: a cute plush teddy bear, a stack of colorful toy building blocks, a small red toy car and a gift box with satin ribbon, arranged on pastel pedestals. Palette: warm cream, soft sky blue, coral and sunny yellow. Background: soft warm cream to light blue gradient with gentle arch shapes.`,
  natal: `${BASE} Theme: Christmas gifts. Products: two wrapped gift boxes with golden satin ribbons, a glossy gold ornament ball and an elegant unbranded perfume bottle, on deep green velvet pedestals. Warm golden fairy-light bokeh in the background. Palette: deep evergreen, warm gold, cream and a touch of red. Background: deep green.`,
  black_friday: `${BASE} Theme: Black Friday. Products: two premium shopping bags (graphite and violet) with rope handles, a blank price tag with string, a pair of wireless headphones. Palette: deep graphite, violet and lavender light. Background: dark graphite with violet glow and soft light orbs.`,
  tecnologia: `${BASE} Theme: technology. Products: over-ear wireless headphones, a smartwatch and a compact bluetooth speaker, on white and light-blue pedestals. Palette: white, silver, calm blue. Background: light cool grey with soft blue light.`,
  casa: `${BASE} Theme: cozy home and decor. Products: a ceramic vase with dried pampas grass, a soft knitted cushion, a warm table lamp and a scented candle, on warm sand pedestals. Palette: warm sand, terracotta, sage green and cream. Background: warm off-white with soft sunlight.`,
  beleza: `${BASE} Theme: beauty and personal care. Products: an elegant unbranded perfume bottle, a lipstick, a cream jar and a compact, on blush pink pedestals with a few rose petals. Palette: blush pink, rose, champagne gold. Background: soft pink.`,
  neutro: `${BASE} Theme: smart shopping comparison. Products: white over-ear headphones and a light grey running sneaker on white pedestals, a small gift box. Palette: white, light grey and calm blue (#0071E3) accents with soft green check marks. Background: very light grey with soft blue glow.`,
};

function b64ParaBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function comOpenAi(prompt: string) {
  const chave = chaveGpt();
  if (!chave) return { ok: false as const, erro: "sem chave da OpenAI" };
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 82,
      n: 1,
    }),
    signal: AbortSignal.timeout(110_000),
  });
  const j = (await r.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  } | null;
  const b64 = j?.data?.[0]?.b64_json;
  if (!r.ok || !b64)
    return {
      ok: false as const,
      erro: `openai ${r.status}: ${j?.error?.message ?? "sem imagem"}`.slice(0, 200),
    };
  return {
    ok: true as const,
    bytes: b64ParaBytes(b64),
    tipo: "image/webp",
    ext: "webp",
    modelo: "gpt-image-1",
  };
}

async function comGemini(prompt: string) {
  const chave = process.env["GEMINI_API_KEY"];
  if (!chave) return { ok: false as const, erro: "sem GEMINI_API_KEY" };
  for (const modelo of ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"]) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    const j = (await r.json().catch(() => null)) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
      }>;
      error?: { message?: string };
    } | null;
    const parte = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (r.ok && parte?.data) {
      const tipo = parte.mimeType ?? "image/png";
      return {
        ok: true as const,
        bytes: b64ParaBytes(parte.data),
        tipo,
        ext: tipo.includes("jpeg") ? "jpg" : tipo.includes("webp") ? "webp" : "png",
        modelo,
      };
    }
    if (r.status !== 404 && r.status !== 400)
      return {
        ok: false as const,
        erro: `gemini ${r.status}: ${j?.error?.message ?? "sem imagem"}`.slice(0, 200),
      };
  }
  return { ok: false as const, erro: "gemini sem modelo de imagem disponível" };
}

/** Gera e salva a arte do tema. Não regera a mesma versão (só com forcar). */
export async function gerarArteCampanha(db: Db, tema: TemaVisualId, forcar = false) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const { data: atual } = await t
    .from("campanha_artes")
    .select("url,versao")
    .eq("tema", tema)
    .maybeSingle();
  if (atual?.url && atual.versao === VERSAO_ARTE && !forcar)
    return { ok: true, tema, url: atual.url, reaproveitada: true };
  const prompt = PROMPTS_ARTE[tema];
  let r: Awaited<ReturnType<typeof comOpenAi>> | Awaited<ReturnType<typeof comGemini>> =
    await comOpenAi(prompt);
  const erros: string[] = [];
  if (!r.ok) {
    erros.push(r.erro);
    r = await comGemini(prompt);
  }
  if (!r.ok) {
    erros.push(r.erro);
    return { ok: false, tema, erros };
  }
  const caminho = `${tema}-v${VERSAO_ARTE}-${Date.now()}.${r.ext}`;
  const up = await t.storage.from("campanhas").upload(caminho, r.bytes, {
    contentType: r.tipo,
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) return { ok: false, tema, erros: [...erros, `armazenamento: ${up.error.message}`] };
  const url = t.storage.from("campanhas").getPublicUrl(caminho).data.publicUrl as string;
  await t.from("campanha_artes").upsert({
    tema,
    url,
    versao: VERSAO_ARTE,
    modelo: r.modelo,
    bytes: r.bytes.length,
    gerada_em: new Date().toISOString(),
  });
  return { ok: true, tema, url, modelo: r.modelo, bytes: r.bytes.length, erros };
}
