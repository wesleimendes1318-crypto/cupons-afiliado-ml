import { createFileRoute } from "@tanstack/react-router";

import {
  html,
  linkDoAnuncio,
  mensagemDaComparacao,
  segredoDoWebhook,
  SITE,
  telegram,
} from "@/lib/telegram";

/* BOT DO TELEGRAM (Weslei, 02/10). O cliente manda o link de um anúncio
   (longo ou meli.la) e recebe a mesma comparação do site, pelas MESMAS regras
   (opcoesDaAnalise + decisaoDaTela): melhor preço do mesmo produto pelo total
   com o frete conhecido, Melhor alternativa, loja oficial, Pix x parcelado e
   frete em linha própria. Só entram opções com link de afiliado do Weslei.
   Token em API_TELEGRAM (Secrets); o Telegram assina cada chamada com o
   segredo registrado em /api/public/telegram-setup. */

/* O Telegram reenvia a mesma mensagem se demorarmos: cada update uma vez só. */
const vistos = new Set<number>();

export const Route = createFileRoute("/api/public/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["API_TELEGRAM"];
        if (!token) return new Response("sem token", { status: 503 });
        if (
          request.headers.get("x-telegram-bot-api-secret-token") !== (await segredoDoWebhook(token))
        )
          return new Response("proibido", { status: 403 });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const update = (await request.json().catch(() => null)) as any;
        const msg = update?.message ?? update?.edited_message;
        const chatId = msg?.chat?.id;
        if (!chatId || typeof update?.update_id !== "number") return new Response("OK");
        if (vistos.has(update.update_id)) return new Response("OK");
        vistos.add(update.update_id);
        if (vistos.size > 500) vistos.clear();

        const texto = String(msg.text ?? "").trim();
        const enviar = (t: string, extra: Record<string, unknown> = {}) =>
          telegram(token, "sendMessage", {
            chat_id: chatId,
            text: t,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            ...extra,
          });

        if (/^\/(start|ajuda|help)\b/i.test(texto)) {
          await enviar(
            "👋 <b>Olá! Aqui é o Melhor Escolha.</b>\n\n" +
              "Me mande o link de um produto vendido no Mercado Livre e eu:\n\n" +
              "🔎 procuro o mesmo produto em outras lojas;\n" +
              "📸 confiro pela foto, descrição e características;\n" +
              "💰 mostro o menor preço e a loja oficial (quando houver);\n" +
              "🚚 deixo claro o frete;\n" +
              "🔥 separo parecidos com o que muda.\n\n" +
              "👉 <b>Cole o link do anúncio aqui.</b>",
          );
          return new Response("OK");
        }

        const urlColado = linkDoAnuncio(texto);
        if (!urlColado) {
          await enviar(
            "⚠️ Não achei um link de anúncio na mensagem.\n\nMande o link do produto, por exemplo:\n" +
              "• https://produto.mercadolivre.com.br/...\n• https://meli.la/...",
          );
          return new Response("OK");
        }

        await enviar(
          "🔍 <b>Recebi o link!</b> Estou comparando com outras lojas. Em geral leva menos de 2 minutos.",
        );

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data: novo, error } = await db.rpc("pedir_comparacao", {
          p_url: urlColado,
          p_nova: false,
        });
        const id = novo?.id as number | undefined;
        const chave = novo?.chave as string | undefined;
        if (error || !id || !chave) {
          await enviar(
            /link invalido|loja/i.test(error?.message ?? "")
              ? "⚠️ Esse link não é de um anúncio de produto. Mande o endereço do produto."
              : "⏳ Muitas comparações ao mesmo tempo agora. Tente de novo em 1 minuto.",
          );
          return new Response("OK");
        }

        /* Espera o resultado (até ~50 s); depois disso manda para o site, que
           continua atualizando sozinho. */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let linha: any = null;
        const fim = Date.now() + 50_000;
        while (Date.now() < fim) {
          const { data } = await db.rpc("ver_pedido", { p_id: id, p_chave: chave });
          linha = Array.isArray(data) ? data[0] : data;
          if (linha?.status === "pronto" || linha?.status === "falhou") break;
          await new Promise((r) => setTimeout(r, 2500));
        }

        if (linha?.status === "pronto" && linha.analise) {
          const { texto: resposta, imagem } = mensagemDaComparacao(
            linha.analise,
            linha.link ?? null,
            urlColado,
          );
          if (imagem && /^https:\/\//.test(imagem) && resposta.length <= 1024) {
            const r = await telegram(token, "sendPhoto", {
              chat_id: chatId,
              photo: imagem.replace(/\.webp$/i, ".jpg"),
              caption: resposta,
              parse_mode: "HTML",
            });
            if (r?.ok) return new Response("OK");
          }
          await enviar(resposta);
          return new Response("OK");
        }

        /* Sem resultado ainda: o link de afiliado do anúncio, se já saiu, e a
           comparação completa no site. Nunca link sem afiliado. */
        await enviar(
          "⏳ <b>A comparação ainda está rodando.</b>\n\n" +
            (linha?.link ? `🛒 Link do anúncio que você enviou:\n👉 ${html(linha.link)}\n\n` : "") +
            `🔎 Acompanhe o resultado completo (atualiza sozinho):\n${SITE}/?link=${encodeURIComponent(urlColado)}`,
        );
        return new Response("OK");
      },
    },
  },
});
