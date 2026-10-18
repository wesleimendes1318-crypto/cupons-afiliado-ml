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
