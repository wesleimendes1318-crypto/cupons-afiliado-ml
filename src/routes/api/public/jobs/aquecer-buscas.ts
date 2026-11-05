import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/* AQUECEDOR (05/11): every 10 min it warms ONE popular search through the
   site's own /api/public/buscar, so the 6 h cache is ready when a customer
   arrives (one full turn about every 7 h). One request at a
   time: no bursts on the catalog. */
const POPULARES = [
  "air fryer", "fone bluetooth", "smartwatch", "celular", "tv 50 polegadas", "caixa de som bluetooth",
  "kit skincare", "hidratante facial", "protetor solar facial", "perfume feminino", "perfume masculino", "secador de cabelo",
  "sandália feminina", "rasteirinha", "tênis feminino", "tênis masculino", "chinelo slide", "papete feminina",
  "colar banhado a ouro", "brinco argola", "pulseira feminina", "relógio masculino", "bolsa feminina", "mochila",
  "legging academia", "conjunto fitness feminino", "biquíni", "garrafa térmica", "copo térmico", "jogo de panelas",
  "aspirador robô", "cafeteira", "liquidificador", "lego", "funko pop", "livro romance",
  /* Themed gifts (05/11): showcases answer from cache instead of a cold read. */
  "star wars", "luminária led 3d star wars", "marvel", "luminária led 3d marvel", "harry potter", "kit skincare presente",
];

export const Route = createFileRoute("/api/public/jobs/aquecer-buscas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const falha = await authenticateCronRequest(request);
        if (falha) return falha;
        const q = POPULARES[Math.floor(Date.now() / 600_000) % POPULARES.length]!;
        const origem = new URL(request.url).origin;
        /* The search keeps running on its own request; we only wait briefly. */
        const pedido = fetch(`${origem}/api/public/buscar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origem },
          body: JSON.stringify({ q }),
        }).catch(() => null);
        await Promise.race([pedido, new Promise((r) => setTimeout(r, 2_500))]);
        return Response.json({ ok: true, aquecida: q });
      },
    },
  },
});
