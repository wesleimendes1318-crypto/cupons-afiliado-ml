/* Banco do site desde 18/10/2026: o Supabase próprio do Weslei
   (itgdvxvqbwjcvmglfval, plano grátis). O banco do Lovable Cloud foi pausado
   em 16/10 por falta de crédito, e o crédito do Lovable não segura o banco.

   Endereço e chave publicável são públicos (vão no javascript do site, como
   antes). A chave de serviço nunca fica no código: só nos Secrets do Lovable,
   com o nome MEU_SUPABASE_SERVICE_ROLE_KEY. Os SUPABASE_* que o Lovable Cloud
   injeta continuam apontando para o banco pausado e não são mais lidos. */
export const SUPABASE_URL_SITE = "https://itgdvxvqbwjcvmglfval.supabase.co";
export const SUPABASE_CHAVE_PUBLICA_SITE = "sb_publishable_Y5TUpxpFEO9rsUj-8cYa4g_EWq3NYPY";
export const SUPABASE_PROJETO_SITE = "itgdvxvqbwjcvmglfval";
export const NOME_SECRET_SERVICO = "MEU_SUPABASE_SERVICE_ROLE_KEY";

/* Chave de serviço do banco próprio. O nome certo é NOME_SECRET_SERVICO; se o
   Secret foi salvo com outro nome (18/10: "deixei como sb_secret_"), vale o
   único Secret cujo VALOR é uma chave secreta nova do Supabase (sb_secret_),
   fora o SUPABASE_SERVICE_ROLE_KEY que o Lovable Cloud injeta para o banco
   pausado. Nunca devolve nem registra o valor fora do servidor. */
const NOMES_ALTERNATIVOS = ["SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY"];

function chaveDesteProjeto(v: string): boolean {
  if (v.startsWith("sb_secret_")) return true;
  try {
    const corpo = v.split(".")[1];
    if (!corpo) return false;
    const json = JSON.parse(atob(corpo.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.ref === SUPABASE_PROJETO_SITE && json?.role === "service_role";
  } catch {
    return false;
  }
}

export function chaveDeServico(env: Record<string, string | undefined> = process.env) {
  const direta = env[NOME_SECRET_SERVICO]?.trim();
  if (direta) return { chave: direta, origem: "nome" as const };
  /* 07/11: common alternative names, accepted only when the value is a key
     of THIS project (sb_secret_ or a legacy JWT whose ref is ours), so a key
     of the paused Lovable Cloud DB is never picked up by mistake. */
  for (const nome of NOMES_ALTERNATIVOS) {
    const v = env[nome]?.trim();
    if (v && chaveDesteProjeto(v)) return { chave: v, origem: "nome" as const };
  }
  const candidatas = Object.entries(env).filter(
    ([nome, valor]) =>
      nome !== "SUPABASE_SERVICE_ROLE_KEY" && (valor ?? "").trim().startsWith("sb_secret_"),
  );
  const unica = candidatas.length === 1 ? candidatas[0]?.[1]?.trim() : undefined;
  if (unica) return { chave: unica, origem: "valor" as const };
  return {
    chave: undefined,
    origem: candidatas.length ? ("varias" as const) : ("ausente" as const),
  };
}
