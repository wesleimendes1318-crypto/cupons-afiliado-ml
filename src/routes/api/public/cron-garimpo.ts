import { createFileRoute } from "@tanstack/react-router";

import { decisaoDaTela, opcoesDaAnalise, totalDaOpcao, type Opcao } from "@/lib/ajudar-escolher";
import { naoEAlternativa } from "@/lib/alternativa";
import { pecaNoLugarDoAparelho } from "@/lib/conferir-produto";
import { html, linhaDoFrete, telegram } from "@/lib/telegram";
import { linkDoBot } from "@/lib/telegram-publico";

/* GARIMPO (Weslei, 05/10): olha as comparações prontas das últimas 24 h e
   separa os achados que valem divulgar, com as MESMAS regras da tela
   (opcoesDaAnalise + decisaoDaTela):
   - economia >= R$ 30 no produto contra o anúncio comparado;
   - link de afiliado (meli.la) da opção escolhida;
   - frete grátis ou com valor conhecido (frete pago desconhecido fica fora);
   - nada de peça no lugar do aparelho nem alternativa que "vem menos";
   - só produto permitido na vitrine (produtos_vistos já filtra).
   Com TELEGRAM_CANAL_ID nos Secrets, publica no canal até 3 achados novos
   por chamada (cada achado uma vez por 7 dias). ?simular=1 só lista.
   Chamada por agendador externo com o cabeçalho x-cron-secret igual a
   CRON_SECRET (ou, sem ele, ao token do bot). */

const ECONOMIA_MINIMA = 30;
const POR_CHAMADA = 3;
const DIAS_SEM_REPETIR = 7;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mesmoSegredo(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type Achado = {
  chave: string;
  pedido: number;
  tipo: "mesmo" | "parecido";
  titulo: string;
  tituloOpcao: string;
  loja: string | null;
  lojaOficial: boolean;
  preco: number;
  precoColado: number;
  economia: number;
  muda: string | null;
  link: string;
  opcao: Opcao;
};

function achadoDoPedido(p: {
  id: number;
  url_alvo: string | null;
  link: string | null;
  analise: unknown;
}): Achado | null {
  const a = p.analise as Record<string, unknown> | null;
  if (!a || !p.url_alvo || !p.link) return null;
  const { colado, melhorMesmo, alternativa } = decisaoDaTela(opcoesDaAnalise(a, p.link));
  if (!colado) return null;
  const escolha = alternativa ?? (melhorMesmo?.tipo === "mesmo" ? melhorMesmo : null);
  if (!escolha) return null;
  if (!/^https:\/\/meli\.la\//i.test(escolha.link)) return null;
  if (escolha.freteGratis !== true && totalDaOpcao(escolha) == null) return null;
  if (pecaNoLugarDoAparelho(colado.titulo, escolha.titulo)) return null;
  if (escolha.tipo === "parecido" && naoEAlternativa(escolha.muda)) return null;
  const economia = Math.round((colado.preco - escolha.preco) * 100) / 100;
  if (!(economia >= ECONOMIA_MINIMA)) return null;
  return {
    chave: `${p.url_alvo.split("?")[0]}|${escolha.link}`,
    pedido: p.id,
    tipo: escolha.tipo === "parecido" ? "parecido" : "mesmo",
    titulo: colado.titulo,
    tituloOpcao: escolha.titulo,
    loja: escolha.loja,
    lojaOficial: escolha.lojaOficial,
    preco: escolha.preco,
    precoColado: colado.preco,
    economia,
    muda: escolha.muda,
    link: escolha.link,
    opcao: escolha,
  };
}

/* Preço e frete em linhas separadas; nunca "R$ X a menos + frete". */
function mensagem(x: Achado) {
  const linhas = [
    "🔥 <b>Achado comparado hoje</b>",
    `📦 ${html(x.tipo === "parecido" ? x.tituloOpcao : x.titulo)}`,
    x.tipo === "parecido"
      ? `⚠️ Parecido com "${html(x.titulo)}", não é idêntico.${x.muda ? ` Muda: ${html(x.muda)}` : ""}`
      : "✅ Mesmo produto, em outra loja",
    `💰 <b>${brl(x.preco)}</b> (anúncio comparado: ${brl(x.precoColado)})`,
    `💸 ${brl(x.economia)} a menos no produto`,
    linhaDoFrete(x.opcao),
    x.loja ? `🏪 Vendido por ${html(x.loja)}${x.lojaOficial ? " ⭐ (Loja oficial)" : ""}` : null,
    "",
    `🛒 Comprar com segurança: ${x.link}`,
    "🕒 Preço de quando foi comparado; confira antes de comprar.",
  ];
  return linhas.filter((l) => l != null).join("\n");
}

/* Botões do post: compra (link de afiliado) e, na linha de baixo, a volta
   para o bot comparar o produto de quem está lendo o canal. */
function teclado(x: Achado) {
  return {
    inline_keyboard: [
      [{ text: "🛒 Comprar com segurança", url: x.link }],
      [{ text: "🔎 Comparar o meu produto", url: linkDoBot("canal") }],
    ],
  };
}

async function garimpar(request: Request) {
  const segredo = process.env["CRON_SECRET"] || process.env["API_TELEGRAM"];
  if (!segredo)
    return Response.json({ ok: false, erro: "sem segredo configurado" }, { status: 503 });
  const enviado = request.headers.get("x-cron-secret") ?? "";
  if (!mesmoSegredo(enviado, segredo))
    return Response.json({ ok: false, erro: "não autorizado" }, { status: 403 });

  const simular = new URL(request.url).searchParams.get("simular") === "1";
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [{ data: pedidos, error: erroPedidos }, { data: vistos }] = await Promise.all([
    db
      .from("pedidos_link")
      .select("id,url_alvo,link,analise")
      .eq("status", "pronto")
      .not("link", "is", null)
      .gte("atendido_em", desde)
      .order("id", { ascending: false })
      .limit(20),
    db.from("produtos_vistos").select("url_produto").gte("visto_em", desde).limit(500),
  ]);
  if (erroPedidos)
    return Response.json({ ok: false, erro: "leitura dos pedidos" }, { status: 502 });

  const permitidos = new Set((vistos ?? []).map((v) => v.url_produto).filter(Boolean));
  const vistosAqui = new Set<string>();
  const achados: Achado[] = [];
  for (const p of pedidos ?? []) {
    if (!p.url_alvo || !permitidos.has(p.url_alvo) || vistosAqui.has(p.url_alvo)) continue;
    vistosAqui.add(p.url_alvo);
    const x = achadoDoPedido(p);
    if (x) achados.push(x);
  }
  achados.sort((a, b) => b.economia - a.economia);

  /* Publicação no canal (opcional), sem repetir o mesmo achado na semana. */
  const canal = process.env["TELEGRAM_CANAL_ID"];
  const token = process.env["API_TELEGRAM"];
  const publicados: string[] = [];
  if (!simular && canal && token && achados.length) {
    const { data: cfg } = await db
      .from("sinc_config")
      .select("valor")
      .eq("chave", "garimpo_enviados")
      .maybeSingle();
    let enviados: Record<string, string> = {};
    try {
      enviados = cfg?.valor ? (JSON.parse(cfg.valor) as Record<string, string>) : {};
    } catch {
      enviados = {};
    }
    const limite = Date.now() - DIAS_SEM_REPETIR * 24 * 3600_000;
    for (const [k, quando] of Object.entries(enviados))
      if (!(Date.parse(quando) > limite)) delete enviados[k];
    for (const x of achados) {
      if (publicados.length >= POR_CHAMADA) break;
      if (enviados[x.chave]) continue;
      const r = await telegram(token, "sendMessage", {
        chat_id: canal,
        text: mensagem(x),
        parse_mode: "HTML",
        reply_markup: teclado(x),
      });
      if (r?.ok) {
        enviados[x.chave] = new Date().toISOString();
        publicados.push(x.chave);
      }
    }
    await db
      .from("sinc_config")
      .upsert([{ chave: "garimpo_enviados", valor: JSON.stringify(enviados) }]);
  }

  await db.from("sinc_config").upsert([
    {
      chave: "garimpo_ultimo",
      valor: JSON.stringify({
        quando: new Date().toISOString(),
        lidos: pedidos?.length ?? 0,
        encontrados: achados.length,
        publicados: publicados.length,
        canal: Boolean(canal),
        simular,
      }),
    },
  ]);

  return Response.json({
    ok: true,
    encontrados: achados.length,
    publicados: publicados.length,
    destaques: achados.map((x) => ({
      pedido: x.pedido,
      tipo: x.tipo,
      titulo: x.tipo === "parecido" ? x.tituloOpcao : x.titulo,
      loja: x.loja,
      preco: x.preco,
      precoColado: x.precoColado,
      economiaNoProduto: x.economia,
      freteGratis: x.opcao.freteGratis,
      custoFrete: x.opcao.custoFrete ?? null,
      link: x.link,
      mensagem: simular ? mensagem(x) : undefined,
      teclado: simular ? teclado(x) : undefined,
      publicado: publicados.includes(x.chave),
    })),
  });
}

export const Route = createFileRoute("/api/public/cron-garimpo")({
  server: {
    handlers: {
      GET: async ({ request }) => garimpar(request),
      POST: async ({ request }) => garimpar(request),
    },
  },
});
