import { createClient } from "@supabase/supabase-js";
import type { AuthContext } from "@lovable.dev/mcp-js";
import { SUPABASE_CHAVE_PUBLICA_SITE, SUPABASE_URL_SITE } from "@/integrations/supabase/projeto";

/* Banco próprio desde 18/10/2026 (projeto.ts): os SUPABASE_* do Lovable Cloud
   apontam para o banco pausado. */
function url(): string {
  return SUPABASE_URL_SITE;
}

function key(): string {
  return SUPABASE_CHAVE_PUBLICA_SITE;
}

/** Repassa o token verificado: as regras do banco valem como o usuário conectado. */
export function supabaseForUser(ctx: AuthContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("Token de acesso ausente");
  return createClient(url(), key(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
