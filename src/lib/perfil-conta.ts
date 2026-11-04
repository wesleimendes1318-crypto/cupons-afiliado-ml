/* PERFIL DA CONTA (Weslei, 04/11): nome, interesses e preferências de compra
   guardados na própria conta (metadados do login), sem tabela nova e sem
   dado sensível (LGPD: nada de CPF, telefone, endereço, data de nascimento).
   Ao entrar, os interesses e as últimas buscas da conta alimentam o perfil
   local que já ordena vitrines, sugestões e complementos. */
import { supabase } from "@/integrations/supabase/client";
import { aplicarInteresses, obterPerfil } from "@/lib/perfil-visitante";

export const INTERESSES = [
  { slug: "eletronicos", nome: "Eletrônicos" },
  { slug: "celulares", nome: "Celulares" },
  { slug: "informatica", nome: "Informática" },
  { slug: "eletrodomesticos", nome: "Eletrodomésticos" },
  { slug: "casa", nome: "Casa e cozinha" },
  { slug: "beleza", nome: "Beleza" },
  { slug: "moda", nome: "Moda" },
  { slug: "brinquedos", nome: "Brinquedos" },
  { slug: "ferramentas", nome: "Ferramentas" },
  { slug: "automotivo", nome: "Automotivo" },
  { slug: "esportes", nome: "Esportes" },
  { slug: "pet", nome: "Pet" },
] as const;

export type Voltagem = "auto" | "127" | "220";

export type PerfilConta = {
  nome: string;
  interesses: string[];
  voltagem: Voltagem;
  freteGratis: boolean;
  avisosEmail: boolean;
  termos: string[];
};

const SLUGS = new Set<string>(INTERESSES.map((i) => i.slug));

export function limparPerfilConta(bruto: unknown): PerfilConta {
  const m = (bruto && typeof bruto === "object" ? bruto : {}) as { nome?: unknown; interesses?: unknown; voltagem?: unknown; freteGratis?: unknown; avisosEmail?: unknown; termos?: unknown };
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    nome: typeof m.nome === "string" ? m.nome.trim().slice(0, 40) : "",
    interesses: lista(m.interesses).filter((s) => SLUGS.has(s)),
    voltagem: m.voltagem === "127" || m.voltagem === "220" ? m.voltagem : "auto",
    freteGratis: m.freteGratis !== false,
    avisosEmail: m.avisosEmail === true,
    termos: lista(m.termos)
      .map((t) => t.slice(0, 120))
      .slice(0, 10),
  };
}

/** Grava na conta, levando junto as últimas buscas deste aparelho. */
export async function salvarPerfilConta(p: Omit<PerfilConta, "termos">) {
  const local = obterPerfil()?.termosRecentes.map((t) => t.termo) ?? [];
  const perfil = limparPerfilConta({ ...p, termos: local });
  const { error } = await supabase.auth.updateUser({ data: { perfil } });
  if (error) return "Não deu para salvar agora. Tente de novo.";
  aplicarInteresses(perfil.interesses, perfil.termos);
  return null;
}

/** Ao entrar: os interesses da conta passam a valer neste aparelho. */
export function aplicarPerfilDaConta(metadados: unknown) {
  const perfil = limparPerfilConta((metadados as { perfil?: unknown } | null)?.perfil);
  aplicarInteresses(perfil.interesses, perfil.termos);
  return perfil;
}

/** Apaga nome, interesses e preferências da conta (direito de exclusão). */
export async function apagarPerfilConta() {
  const { error } = await supabase.auth.updateUser({ data: { perfil: null } });
  return error ? "Não deu para apagar agora. Tente de novo." : null;
}
