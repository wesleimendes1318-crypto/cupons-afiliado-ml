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

/* ------------------------------------------------ conexao da conta (OAuth)

   O caminho oficial: o Weslei abre /api/public/ml-conectar no navegador onde
   esta logado, autoriza o aplicativo dele no Mercado Livre, e o retorno
   (/api/public/ml-retorno) troca o codigo pelo token e guarda no banco. */

export const URL_RETORNO = "https://cupons-afiliado-ml.lovable.app/api/public/ml-retorno";

export function urlDeAutorizacao(state: string) {
  const id = process.env["ML_CLIENT_ID"] ?? "";
  const p = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: URL_RETORNO, state });
  return `https://auth.mercadolivre.com.br/authorization?${p.toString()}`;
}

export async function trocarCodigoPorToken(codigo: string) {
  const id = process.env["ML_CLIENT_ID"];
  const segredo = process.env["ML_CLIENT_SECRET"];
  if (!id || !segredo) throw new Error("faltam ML_CLIENT_ID e ML_CLIENT_SECRET nos Secrets");
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: id, client_secret: segredo,
      code: codigo, redirect_uri: URL_RETORNO,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number; message?: string; error?: string;
  };
  if (!r.ok || !j.access_token) throw new Error(`o Mercado Livre recusou a troca (${r.status}): ${j.message ?? j.error ?? "sem detalhe"}`);
  const ate = Date.now() + Math.max(60, (j.expires_in ?? 21_600) - 300) * 1000;
  tokenMem = { valor: j.access_token, ate };
  await gravarConfig({
    ml_access_token: j.access_token,
    ml_token_ate: String(ate),
    ...(j.refresh_token ? { ml_refresh_token: j.refresh_token } : {}),
  });
  return { temRefresh: Boolean(j.refresh_token) };
}

/** Testa, com o token da conta, quais enderecos da API respondem. So leitura. */
export async function diagnosticoApi(exemplos: { item: string; catalogo: string; termo: string }) {
  const testes: Record<string, string> = {
    conta: "/users/me",
    anuncio: `/items/${exemplos.item}`,
    produto_catalogo: `/products/${exemplos.catalogo}`,
    ofertas_catalogo: `/products/${exemplos.catalogo}/items?limit=3`,
    busca: `/sites/MLB/search?q=${encodeURIComponent(exemplos.termo)}&limit=3`,
  };
  const token = await tokenDeAcesso();
  const saida: Record<string, { status: number; detalhe: string }> = {};
  for (const [nome, caminho] of Object.entries(testes)) {
    try {
      const r = await fetch(`${API}${caminho}`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(8_000),
      });
      const t = await r.text();
      let detalhe = t.slice(0, 160);
      try {
        const j = JSON.parse(t) as Record<string, unknown>;
        if (nome === "conta") detalhe = `apelido=${String(j["nickname"] ?? "?")}`;
        else if (nome === "produto_catalogo") detalhe = `buy_box_winner=${j["buy_box_winner"] ? "sim" : "nao"}`;
        else if (Array.isArray(j["results"])) detalhe = `resultados=${(j["results"] as unknown[]).length}`;
        else if (r.ok) detalhe = "ok";
      } catch { /* fica o texto cru */ }
      saida[nome] = { status: r.status, detalhe };
    } catch (e) {
      saida[nome] = { status: 0, detalhe: (e as Error).message };
    }
  }
  /* Nome da loja de uma oferta do catalogo: e o que liga a oferta ao cupom. */
  try {
    const r = await fetch(`${API}/products/${exemplos.catalogo}/items?limit=1`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(8_000),
    });
    const j = (await r.json()) as { results?: Record<string, unknown>[] };
    const o = j.results?.[0] ?? {};
    const vendedorId = o["seller_id"];
    saida["campos_oferta"] = { status: r.status, detalhe: Object.keys(o).slice(0, 15).join(",") };
    if (vendedorId) {
      const u = await fetch(`${API}/users/${vendedorId}`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(8_000),
      });
      const uj = (await u.json().catch(() => ({}))) as { nickname?: string };
      saida["nome_da_loja"] = { status: u.status, detalhe: `apelido=${uj.nickname ?? "?"}` };
    }
  } catch (e) {
    saida["nome_da_loja"] = { status: 0, detalhe: (e as Error).message };
  }
  /* Token do APLICATIVO (fluxo Client Credentials), sem a conta do Weslei.
     Se as ofertas de catalogo responderem com ele, o servidor renova o proprio
     acesso sozinho e nao depende de renovacao da conta. */
  try {
    const id = process.env["ML_CLIENT_ID"];
    const segredo = process.env["ML_CLIENT_SECRET"];
    if (id && segredo) {
      const t = await fetch(`${API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: segredo }),
        signal: AbortSignal.timeout(10_000),
      });
      const tj = (await t.json().catch(() => ({}))) as { access_token?: string; message?: string };
      if (!tj.access_token) {
        saida["token_do_app"] = { status: t.status, detalhe: tj.message ?? "sem token" };
      } else {
        const o = await fetch(`${API}/products/${exemplos.catalogo}/items?limit=3`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${tj.access_token}` },
          signal: AbortSignal.timeout(8_000),
        });
        const oj = (await o.json().catch(() => ({}))) as { results?: unknown[] };
        saida["token_do_app"] = { status: o.status, detalhe: `ofertas_catalogo=${oj.results?.length ?? 0}` };
      }
    }
  } catch (e) {
    saida["token_do_app"] = { status: 0, detalhe: (e as Error).message };
  }
  await gravarConfig({ ml_diagnostico: JSON.stringify({ quando: new Date().toISOString(), comToken: Boolean(token), saida }) });
  return saida;
}

export { gravarConfig, lerConfig };

/* Teste dos enderecos que a comparacao por identidade usa (24/09/2026).
   So leitura. Usa a propria ficha de catalogo de exemplo para obter um codigo
   de barras real e busca-lo de volta: o teste nao depende de dado inventado. */
export async function testarBuscaDeCatalogo(ex: { catalogo: string; up: string; termo: string }) {
  const saida: Record<string, { status: number; detalhe: string }> = {};
  const token = await tokenDeAcesso();
  const get = async (nome: string, caminho: string, resumo: (j: Record<string, unknown>) => string) => {
    try {
      const r = await fetch(`${API}${caminho}`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(10_000),
      });
      const t = await r.text();
      let detalhe = t.slice(0, 140);
      let j: Record<string, unknown> = {};
      try { j = JSON.parse(t) as Record<string, unknown>; if (r.ok) detalhe = resumo(j); } catch { /* texto cru */ }
      saida[nome] = { status: r.status, detalhe };
      return r.ok ? j : null;
    } catch (e) {
      saida[nome] = { status: 0, detalhe: (e as Error).message };
      return null;
    }
  };

  const ficha = await get("ficha", `/products/${ex.catalogo}`, (j) => `nome=${String(j["name"] ?? "?").slice(0, 60)}`);
  const attrs = (ficha?.["attributes"] as { id?: string; values?: { name?: string }[]; value_name?: string }[] | undefined) ?? [];
  const gtinAttr = attrs.find((a) => a.id === "GTIN");
  const gtin = (gtinAttr?.value_name ?? gtinAttr?.values?.[0]?.name ?? "").replace(/\D/g, "");
  saida["gtin_da_ficha"] = { status: gtin ? 200 : 0, detalhe: gtin || "a ficha de exemplo nao tem codigo de barras" };

  const resumoBusca = (j: Record<string, unknown>) => {
    const res = (j["results"] as { id?: string }[] | undefined) ?? [];
    return `resultados=${res.length} primeiro=${res[0]?.id ?? "-"}`;
  };
  if (gtin) await get("busca_por_codigo", `/products/search?status=active&site_id=MLB&product_identifier=${gtin}`, resumoBusca);
  await get("busca_por_nome", `/products/search?status=active&site_id=MLB&q=${encodeURIComponent(ex.termo)}`, resumoBusca);
  await get("produto_do_vendedor", `/user-products/${ex.up}`, (j) => `catalogo=${String(j["catalog_product_id"] ?? "nenhum")}`);
  await get("lojas_da_ficha", `/products/${ex.catalogo}/items?limit=5`, (j) =>
    `lojas=${((j["results"] as unknown[] | undefined) ?? []).length}`);

  await gravarConfig({ ml_teste_busca: JSON.stringify({ quando: new Date().toISOString(), comToken: Boolean(token), saida }) });
  return saida;
}
