import { createFileRoute } from "@tanstack/react-router";

import { aplicarPrazo, dataDoTexto, type PrazoDoItem } from "@/lib/prazo-entrega";
import { itensDaAnalise, prazosDosItens } from "@/lib/prazo-servidor";

import {
  boasVindas,
  html,
  linkDoAnuncio,
  mensagemOutraLoja,
  respostaSemModelo,
  responderConversa,
  VIDEO_COMO_FUNCIONA,
  mensagemDaComparacao,
  mensagemComPrazo,
  cepDoTexto,
  segredoDoWebhook,
  SITE,
  tecladoOutraLoja,
  telegram,
} from "@/lib/telegram";
import { analisarLink, type AnaliseLink } from "@/lib/analisar-link";
import { identificarLink } from "@/lib/identificar-link";
import { origemDoStart } from "@/lib/telegram-publico";
import { ligarAlerta, RE_START_ALERTA } from "@/lib/alertas-telegram";
import { ehLinkDeAfiliado } from "@/lib/afiliado";

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

        const nome =
          typeof msg.from?.first_name === "string" ? msg.from.first_name.slice(0, 40) : null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;

        /* PRIMEIRO ACESSO (Weslei, 02/10): boas-vindas e o vídeo do site só
           na primeira conversa (e sempre que pedir /start ou /ajuda). */
        const { data: conversa } = await db
          .from("telegram_chats")
          .select("chat_id,ia_dia,ia_usos,cep")
          .eq("chat_id", chatId)
          .maybeSingle();
        const primeiro = !conversa;
        await db
          .from("telegram_chats")
          .upsert(
            { chat_id: chatId, ultimo_em: new Date().toISOString() },
            { onConflict: "chat_id" },
          );
        /* Aviso de preço (05/10): "/start alerta_<codigo>" vindo do site. */
        const alerta = RE_START_ALERTA.exec(texto);
        if (alerta?.[1]) {
          await ligarAlerta(supabaseAdmin, token, chatId, alerta[1].toLowerCase());
          return new Response("OK");
        }
        /* Comando pelo primeiro token: "/start", "/start topo" (deep link do
           site, ?start=<origem>) e "/start@AfiliadosMELI_bot" caem aqui. */
        const pediuAjuda = /^\/(start|ajuda|help)\b/i.test(texto);
        /* De onde veio a conversa: gravado só no primeiro contato. */
        const origem = primeiro ? origemDoStart(texto) : null;
        if (origem)
          await db
            .from("telegram_chats")
            .update({ origem })
            .eq("chat_id", chatId)
            .is("origem", null);
        let urlColado = linkDoAnuncio(texto);
        /* Link de outra loja (10/10): identifica o produto (encurtado e
           título resolvidos no servidor). Encurtado do Mercado Livre segue a
           comparação de sempre. */
        let outraLoja: AnaliseLink | null = null;
        if (!urlColado && /https?:\/\/|www\./i.test(texto)) {
          const a = await identificarLink(texto).catch(() => analisarLink(texto));
          if (a.origem === "mercadolivre" && linkDoAnuncio(a.urlLimpa)) urlColado = a.urlLimpa;
          else if (a.origem !== "invalido") outraLoja = a;
        }
        if (primeiro || pediuAjuda) {
          await enviar(boasVindas(nome));
          await telegram(token, "sendVideo", {
            chat_id: chatId,
            video: VIDEO_COMO_FUNCIONA,
            caption: "🎬 Veja em 28 segundos como funciona",
            supports_streaming: true,
          });
          if (!urlColado && !outraLoja) {
            await enviar("👉 <b>Quando quiser, é só colar aqui o link do produto.</b>");
            return new Response("OK");
          }
        }

        if (outraLoja) {
          await enviar(mensagemOutraLoja(outraLoja), { reply_markup: tecladoOutraLoja(outraLoja) });
          return new Response("OK");
        }

        if (!urlColado) {
          /* Sem link: entende a mensagem e responde (até 30 por conversa por
             dia; depois disso, ou sem modelo, a resposta pronta). */
          const hoje = new Date().toISOString().slice(0, 10);
          const usos = conversa?.ia_dia === hoje ? (conversa?.ia_usos ?? 0) : 0;
          let resposta: string | null = null;
          if (usos < 30 && texto) {
            await telegram(token, "sendChatAction", { chat_id: chatId, action: "typing" });
            resposta = await responderConversa(texto, nome).catch(() => null);
            await db
              .from("telegram_chats")
              .update({ ia_dia: hoje, ia_usos: usos + 1 })
              .eq("chat_id", chatId);
          }
          await enviar(resposta ?? respostaSemModelo(nome));
          return new Response("OK");
        }

        await enviar(
          "🔍 <b>Recebi o link!</b> Estou comparando com outras lojas. Em geral leva menos de 2 minutos.",
        );

        /* "Receber até" (06/10): data e CEP no texto; o CEP fica guardado na
           conversa para as próximas. */
        const limite = dataDoTexto(texto);
        const cepNovo = cepDoTexto(texto);
        if (cepNovo) await db.from("telegram_chats").update({ cep: cepNovo }).eq("chat_id", chatId);
        const cep: string | null = cepNovo ?? conversa?.cep ?? null;
        if (limite && !cep)
          await enviar(
            "📦 Para filtrar pela data de entrega, mande junto o seu CEP (ex.: <i>link + até 10/10 + CEP 01001-000</i>). Vou comparar sem a data por enquanto.",
          );

        const { data: novo, error } = await db.rpc(
          "pedir_comparacao",
          cep
            ? { p_url: urlColado, p_nova: false, p_cep: cep }
            : { p_url: urlColado, p_nova: false },
        );
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
          let msg = mensagemDaComparacao(linha.analise, linha.link ?? null, urlColado);
          if (limite && cep) {
            const { data: alvo } = await db
              .from("pedidos_link")
              .select("url_alvo")
              .eq("id", id)
              .maybeSingle();
            const mapa = itensDaAnalise(linha.analise, alvo?.url_alvo ?? urlColado);
            const porItem = await prazosDosItens(Object.values(mapa), cep).catch(
              () => ({}) as Record<string, PrazoDoItem>,
            );
            const prazos: Record<string, PrazoDoItem> = {};
            for (const [k, item] of Object.entries(mapa)) prazos[k] = porItem[item] ?? null;
            msg = mensagemComPrazo(
              linha.analise,
              linha.link ?? null,
              urlColado,
              aplicarPrazo(linha.analise, prazos, limite),
              limite,
              cep,
            );
          }
          const { texto: resposta, imagem } = msg;
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
            (ehLinkDeAfiliado(linha?.link)
              ? `🛒 Link do anúncio que você enviou:\n👉 ${html(linha.link)}\n\n`
              : "") +
            `🔎 Acompanhe o resultado completo (atualiza sozinho):\n${SITE}/?link=${encodeURIComponent(urlColado)}`,
        );
        return new Response("OK");
      },
    },
  },
});
