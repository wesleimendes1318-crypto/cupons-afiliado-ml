import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { lerLista } from "@/lib/lista-desejos";
import { excedeuLimite, json, origemPermitida, respostaOptions } from "@/lib/public-ai-api";

/* PUBLIC SHARED WISHLIST (Weslei, 05/11/2026). The only writer of
   listas_compartilhadas (service role; the table has RLS and no policies).
   - salvar: creates a list (returns id + secret edit key) or updates it when
     the key matches. Items are re-checked with lerLista: only Weslei's
     affiliate links or Mercado Livre addresses survive (rule no. 1).
   - presente: marks/unmarks an item as bought; only the device that marked
     it (same token) can undo the mark. */

const salvarSchema = z.object({
  acao: z.literal("salvar"),
  id: z.string().regex(/^[A-Za-z0-9]{10}$/).optional(),
  chave: z.string().min(20).max(80).optional(),
  titulo: z.string().trim().max(60),
  ocasiao: z.string().trim().max(40),
  itens: z.array(z.unknown()).min(1).max(100),
});
const presenteSchema = z.object({
  acao: z.literal("presente"),
  id: z.string().regex(/^[A-Za-z0-9]{10}$/),
  item: z.string().min(1).max(80),
  marcar: z.boolean(),
  nome: z.string().trim().max(40).optional(),
  quem: z.string().min(20).max(80),
});
const entradaSchema = z.discriminatedUnion("acao", [salvarSchema, presenteSchema]);

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function aleatorio(n: number) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
}
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
const semQuem = (s: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { nome: v["nome"] ?? "", em: v["em"] }]));

export const Route = createFileRoute("/api/public/lista-compartilhada")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => respostaOptions(request),
      POST: async ({ request }) => {
        if (!origemPermitida(request))
          return json(request, { erro: "Origem da solicitação não permitida." }, 403);
        if (excedeuLimite(request, 20, "lista-pub:"))
          return json(request, { erro: "Muitas tentativas. Aguarde um minuto." }, 429);
        let e: z.infer<typeof entradaSchema>;
        try {
          e = entradaSchema.parse(await request.json());
        } catch {
          return json(request, { erro: "Pedido inválido." }, 400);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tabela = () => (supabaseAdmin as any).from("listas_compartilhadas");

        if (e.acao === "salvar") {
          const itens = lerLista({ itens: e.itens }).itens;
          if (!itens.length) return json(request, { erro: "Nenhum item com link seguro." }, 400);
          const dados = { titulo: e.titulo, ocasiao: e.ocasiao, itens, updated_at: new Date().toISOString() };
          if (e.id && e.chave) {
            const { data } = await tabela().select("chave_hash").eq("id", e.id).maybeSingle();
            if (data && data.chave_hash === (await sha(e.chave))) {
              const { error } = await tabela().update(dados).eq("id", e.id);
              if (error) return json(request, { erro: "Não deu para salvar agora." }, 502);
              return json(request, { id: e.id, chave: e.chave });
            }
          }
          const id = aleatorio(10);
          const chave = aleatorio(32);
          const { error } = await tabela().insert({ id, chave_hash: await sha(chave), ...dados });
          if (error) return json(request, { erro: "Não deu para salvar agora." }, 502);
          return json(request, { id, chave });
        }

        const { data } = await tabela().select("itens,status_presentes").eq("id", e.id).maybeSingle();
        if (!data) return json(request, { erro: "Lista não encontrada." }, 404);
        if (!(data.itens as { id: string }[]).some((i) => i.id === e.item))
          return json(request, { erro: "Item não está na lista." }, 400);
        // shortcut: read-modify-write, two marks in the same second can lose one; move to a SQL function if lists get busy.
        const status = { ...(data.status_presentes as Record<string, Record<string, unknown>>) };
        const quem = await sha(e.quem);
        const atual = status[e.item];
        if (e.marcar) {
          if (!atual) status[e.item] = { nome: e.nome ?? "", em: new Date().toISOString(), quem };
        } else if (atual && atual["quem"] === quem) {
          delete status[e.item];
        } else {
          return json(request, { erro: "Só quem marcou pode desmarcar.", presentes: semQuem(status) }, 403);
        }
        const { error } = await tabela().update({ status_presentes: status }).eq("id", e.id);
        if (error) return json(request, { erro: "Não deu para salvar agora." }, 502);
        return json(request, { presentes: semQuem(status) });
      },
    },
  },
});
