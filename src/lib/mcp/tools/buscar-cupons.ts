import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const CAMPOS =
  "id, vendedor, desconto, tipo, valor, compra_min, teto, sem_teto, vence, qualidade, categoria, codigo_cupom, link_afiliado";

type Linha = {
  id: number;
  vendedor: string | null;
  desconto: string | null;
  tipo: string | null;
  valor: number | null;
  compra_min: number | null;
  teto: number | null;
  sem_teto: boolean | null;
  vence: string | null;
  qualidade: string | null;
  categoria: string | null;
  codigo_cupom: string | null;
  link_afiliado: string | null;
};

// teto vem em centavos no banco; compra mínima já em reais.
const paraJson = (c: Linha) => ({
  id: c.id,
  loja: c.vendedor,
  desconto: c.desconto,
  tipo: c.tipo,
  valor: c.valor,
  compra_minima_reais: c.compra_min,
  limite_reais: c.sem_teto ? null : c.teto != null ? c.teto / 100 : null,
  sem_limite: Boolean(c.sem_teto),
  vence: c.vence,
  qualidade: c.qualidade,
  categoria: c.categoria,
  codigo: c.codigo_cupom,
  link_afiliado: c.link_afiliado,
});

export default defineTool({
  name: "buscar_cupons",
  title: "Buscar cupons",
  description: "Lista cupons válidos, opcionalmente filtrando por loja, categoria ou qualidade.",
  inputSchema: {
    loja: z.string().trim().optional().describe("Parte do nome da loja."),
    categoria: z.string().trim().optional().describe("Categoria, ex.: Beleza, Casa."),
    somente_bons: z.boolean().optional().describe("Só cupons aprovados (padrão: true)."),
    limite: z.number().int().min(1).max(100).optional().describe("Quantidade máxima (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ loja, categoria, somente_bons, limite }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado");
    const hoje = new Date().toISOString().slice(0, 10);
    let q = supabaseForUser(ctx)
      .from("cupons")
      .select(CAMPOS)
      .or(`vence.is.null,vence.gte.${hoje}`)
      .order("valor", { ascending: false })
      .limit(limite ?? 20);
    if (somente_bons !== false) q = q.eq("qualidade", "bom");
    if (loja) q = q.ilike("vendedor", `%${loja}%`);
    if (categoria) q = q.ilike("categoria", `%${categoria}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const cupons = ((data ?? []) as Linha[]).map(paraJson);
    return {
      content: [{ type: "text", text: JSON.stringify(cupons) }],
      structuredContent: { cupons },
    };
  },
});
