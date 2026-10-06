import "@tanstack/react-start/server-only";

/** Adaptador do servidor. OMNI_ROUTER é a credencial, não o endereço do provedor. */
export type RespostaOmni =
  | { ok: true; texto: string; modelo: string }
  | { ok: false; status: number; erro: string };

type Opcoes = {
  prazo?: number;
  imagens?: string[];
  sistema?: string;
  formato?: { nome: string; schema: object };
  json?: boolean;
};

function configuracao() {
  const chave = process.env["OMNI_ROUTER"]?.trim();
  const provedor = process.env["OMNI_ROUTER_PROVIDER"]?.trim() || "omniroute";
  if (!chave || !["omniroute", "openrouter"].includes(provedor)) return null;
  // Uma chave do OmniRoute nunca é enviada ao OpenRouter por suposição.
  const base = process.env["OMNI_ROUTER_BASE_URL"]?.trim() ||
    (provedor === "openrouter" ? "https://openrouter.ai/api/v1" : "");
  try {
    const url = new URL(base);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env["NODE_ENV"] !== "production"))) return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.endsWith("/chat/completions")) url.pathname += "/chat/completions";
    return { chave, provedor, url: url.toString() };
  } catch {
    return null;
  }
}

export function omniRouterConfigurado(): boolean {
  return configuracao() !== null;
}

export function objetoJsonValido(texto: string): boolean {
  try {
    const j: unknown = JSON.parse(texto);
    return j !== null && typeof j === "object" && !Array.isArray(j);
  } catch {
    return false;
  }
}

let ultimoRegistro = 0;
let ultimoEstado = "";

async function registrar(provedor: string, r: RespostaOmni, inicio: number, modelo: string | null) {
  const estado = `${provedor}:${r.ok ? "ok" : r.status}:${modelo}`;
  // Limita escritas repetidas; uma mudança de estado é registrada imediatamente.
  if (estado === ultimoEstado && Date.now() - ultimoRegistro < 30_000) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sinc_config").upsert({
      chave: "omni_router_diagnostico",
      valor: JSON.stringify({
        quando: new Date().toISOString(), provedor, ok: r.ok,
        status: r.ok ? 200 : r.status, modelo,
        duracao_ms: Date.now() - inicio,
        // Sem prompt, imagem, credencial, URL ou corpo de erro do provedor.
        erro: r.ok ? null : r.erro,
      }),
    }).abortSignal(AbortSignal.timeout(500));
    if (!error) {
      ultimoEstado = estado;
      ultimoRegistro = Date.now();
    }
  } catch {
    // Diagnóstico não pode impedir a resposta ao comprador.
  }
}

export async function perguntarAoOmniRouter(prompt: string, opcoes: Opcoes = {}): Promise<RespostaOmni> {
  const inicio = Date.now();
  const config = configuracao();
  if (!config) return { ok: false, status: 503, erro: "Rota de IA sem configuração válida no servidor." };
  const imagens = opcoes.imagens ?? [];
  if (!prompt.trim() || prompt.length > 64_000 || imagens.length > 7) {
    return { ok: false, status: 400, erro: "Pedido de IA fora dos limites permitidos." };
  }
  // Mesma origem de imagens que o comparador já aceita; sem URLs arbitrárias.
  if (imagens.some((imagem) => {
    try {
      const url = new URL(imagem);
      return url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
        !(url.hostname === "mlstatic.com" || url.hostname.endsWith(".mlstatic.com"));
    } catch { return true; }
  })) return { ok: false, status: 400, erro: "Imagem de produto inválida." };

  const personalizados = process.env[imagens.length ? "OMNI_ROUTER_VISION_MODELS" : "OMNI_ROUTER_MODELS"];
  const padrao = config.provedor === "openrouter"
    ? "openai/gpt-4o-mini,google/gemini-2.5-flash"
    : imagens.length ? "" : "auto/cheap";
  const modelos = [...new Set((personalizados || padrao).split(",").map((m) => m.trim()).filter(Boolean))].slice(0, 3);
  if (!modelos.length) return { ok: false, status: 503, erro: "Configure um modelo com visão para esta rota." };

  const prazo = Math.min(30_000, Math.max(0, opcoes.prazo ?? 15_000));
  const fim = inicio + prazo;
  const limite = Number(process.env["OMNI_ROUTER_MAX_TOKENS"]);
  const maxTokens = Number.isFinite(limite) && limite > 0 ? Math.min(4096, Math.max(128, Math.floor(limite))) : 1600;
  const json = opcoes.json !== false || Boolean(opcoes.formato);
  let resultado: RespostaOmni = { ok: false, status: 504, erro: "Prazo da rota de IA esgotado." };
  let modeloUsado: string | null = null;
  for (const [indice, modelo] of modelos.entries()) {
    const resta = fim - Date.now();
    if (resta < 100) break;
    modeloUsado = modelo;
    try {
      const r = await fetch(config.url, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://melhorescolha.io", "X-Title": "Melhor Escolha",
          "X-OpenRouter-Title": "Melhor Escolha",
        },
        body: JSON.stringify({
          model: modelo, max_tokens: maxTokens, temperature: 0.2,
          messages: [
            ...(opcoes.sistema ? [{ role: "system", content: opcoes.sistema }] : []),
            { role: "user", content: imagens.length
              ? [{ type: "text", text: prompt }, ...imagens.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))]
              : prompt },
          ],
          ...(json ? { response_format: opcoes.formato
            ? { type: "json_schema", json_schema: { name: opcoes.formato.nome, strict: true, schema: opcoes.formato.schema } }
            : { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(Math.max(1, Math.floor(resta / (modelos.length - indice)))),
      });
      const j = await r.json().catch(() => null);
      const texto = j?.choices?.[0]?.message?.content;
      if (r.ok && !j?.error && typeof texto === "string" && texto.trim() && (!json || objetoJsonValido(texto))) {
        resultado = { ok: true, texto, modelo: typeof j?.model === "string" ? j.model.slice(0, 160) : modelo };
        break;
      }
      const status = r.ok ? 502 : r.status;
      resultado = { ok: false, status, erro: `Rota de IA indisponível (HTTP ${status}).` };
      // Crédito e autenticação não melhoram ao trocar de modelo.
      if (![404, 408, 429].includes(status) && status < 500) break;
    } catch {
      resultado = { ok: false, status: 504, erro: "A rota de IA não respondeu dentro do prazo." };
    }
  }
  // Aguarda a escrita por no máximo 500 ms, inclusive em runtimes de requisições curtas.
  await registrar(config.provedor, resultado, inicio, resultado.ok ? resultado.modelo : modeloUsado);
  return resultado;
}
