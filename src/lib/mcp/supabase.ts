import { createClient } from "@supabase/supabase-js";
import type { AuthContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: readonly string[]): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  for (const name of names) {
    const v = runtime.process?.env?.[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

function url(): string {
  const u = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? import.meta.env["VITE_SUPABASE_URL"];
  if (!u) throw new Error("SUPABASE_URL is required");
  return u;
}

function key(): string {
  const k =
    env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) ??
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!k) throw new Error("SUPABASE_PUBLISHABLE_KEY is required");
  return k;
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
