/* API oficial do Mercado Livre (api.mercadolibre.com), usada pelo SERVIDOR do
   site para comparar o mesmo produto entre lojas.

   Por que aqui e não na extensão: a extensão lia páginas públicas usando a
   sessão de afiliado do Weslei, e esse volume coincidiu com captcha, 403 e o
   sumiço do menu de cupons. A API oficial é o caminho que o próprio Mercado
   Livre oferece para programas consultarem anúncios, com limite de uso
   conhecido, e não passa pela conta de afiliado.

   Credenciais (Lovable Cloud → Secrets), de um aplicativo criado em
   developers.mercadolivre.com.br:
     ML_CLIENT_ID, ML_CLIENT_SECRET e, se o app usar autorização de usuário,
     ML_REFRESH_TOKEN (o primeiro; os seguintes ficam guardados no banco).
   Sem credenciais, as chamadas saem sem token: parte dos endereços responde,
   parte devolve 401/403, e a comparação avisa que não conseguiu. */

const API = "https://api.mercadolibre.com";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function lerConfig(chaves: string[]) {
  const db = await admin();
  const { data } = await db.from("sinc_config").select("chave,valor").in("chave", chaves);
  return Object.fromEntries((data ?? []).map((l) => [l.chave, l.valor])) as Record<string, string>;
}

async function gravarConfig(pares: Record<string, string>) {
  const db = await admin();
  await db.from("sinc_config").upsert(Object.entries(pares).map(([chave, valor]) => ({ chave, valor })));
}

let tokenMem: { valor: string; ate: number } | null = null;

/** Token de acesso válido, ou null quando não há credencial configurada. */
async function tokenDeAcesso(forcarNovo = false): Promise<string | null> {
  if (!forcarNovo && tokenMem && Date.now() < tokenMem.ate) return tokenMem.valor;

  const id = process.env["ML_CLIENT_ID"];
  const segredo = process.env["ML_CLIENT_SECRET"];
  if (!id || !segredo) return null;

  const cfg = await lerConfig(["ml_access_token", "ml_token_ate", "ml_refresh_token"]);
  const ate = Number(cfg["ml_token_ate"] ?? 0);
  if (!forcarNovo && cfg["ml_access_token"] && Date.now() < ate) {
    tokenMem = { valor: cfg["ml_access_token"], ate };
    return tokenMem.valor;
  }

  /* O refresh token do Mercado Livre vale uma vez só: cada renovação devolve
     um novo, que precisa ser guardado. O do secret é só o primeiro. */
  const refresh = cfg["ml_refresh_token"] || process.env["ML_REFRESH_TOKEN"] || "";
  const corpo = new URLSearchParams(
    refresh
      ? { grant_type: "refresh_token", client_id: id, client_secret: segredo, refresh_token: refresh }
      : { grant_type: "client_credentials", client_id: id, client_secret: segredo },
  );
  try {
    const r = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      console.warn("[ml-api] token recusado:", r.status);
      return null;
    }
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    const novoAte = Date.now() + Math.max(60, (j.expires_in ?? 21_600) - 300) * 1000;
    tokenMem = { valor: j.access_token, ate: novoAte };
    await gravarConfig({
      ml_access_token: j.access_token,
      ml_token_ate: String(novoAte),
      ...(j.refresh_token ? { ml_refresh_token: j.refresh_token } : {}),
    });
    return j.access_token;
  } catch (e) {
    console.warn("[ml-api] falha ao pedir token:", (e as Error).message);
    return null;
  }
}

export class ErroApiMl extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** GET na API oficial. Um 401 renova o token e tenta uma vez mais. */
export async function mlGet<T>(caminho: string): Promise<T> {
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const token = await tokenDeAcesso(tentativa > 0);
    const r = await fetch(`${API}${caminho}`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(8_000),
    });
    if (r.ok) return (await r.json()) as T;
    if (r.status === 401 && tentativa === 0 && token) continue;
    throw new ErroApiMl(r.status, `API do Mercado Livre respondeu ${r.status} em ${caminho.split("?")[0]}`);
  }
  throw new ErroApiMl(401, "sem autorização na API do Mercado Livre");
}

export function temCredencialMl() {
  return Boolean(process.env["ML_CLIENT_ID"] && process.env["ML_CLIENT_SECRET"]);
}
