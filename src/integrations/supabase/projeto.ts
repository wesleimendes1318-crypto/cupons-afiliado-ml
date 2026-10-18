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
export function chaveDeServico(env: Record<string, string | undefined> = process.env) {
  const direta = env[NOME_SECRET_SERVICO]?.trim();
  if (direta) return { chave: direta, origem: "nome" as const };
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
