import { createFileRoute } from "@tanstack/react-router";

import { decisaoDaTela, opcoesDaAnalise, totalDaOpcao, type Opcao } from "@/lib/ajudar-escolher";
import { naoEAlternativa } from "@/lib/alternativa";
import { diferencasParaCliente } from "@/lib/diferencas";
import { qualidadeDoParecido, textoDaQualidade, type Qualidade } from "@/lib/qualidade";
import { pecaNoLugarDoAparelho } from "@/lib/conferir-produto";
import { html, linhaDoFrete, telegram } from "@/lib/telegram";
import { chamadaAutorizada, operacaoPausada, registrarExecucao } from "@/lib/segredo-cron";
import { linkDoBot } from "@/lib/telegram-publico";

/* GARIMPO (Weslei, 05/10): olha as comparações prontas e separa os achados
   que valem divulgar, com as MESMAS regras da tela (opcoesDaAnalise +
   decisaoDaTela):
   - economia >= R$ 30 no produto contra o anúncio comparado;
   - link de afiliado (meli.la) da opção escolhida;
   - frete grátis ou com valor conhecido (frete pago desconhecido fica fora);
   - nada de peça no lugar do aparelho nem alternativa que "vem menos";
   - só produto permitido na vitrine (produtos_vistos já filtra);
   - OFERTA CONFERIDA NA HORA: só publica comparação feita nas últimas 3 h
     (o preparo, /api/public/operacao?tarefa=preparar, compara de novo as
     melhores economias ~1 h antes). Mais velha que isso vira rascunho.
   Publica até 2 por chamada (cada achado uma vez por 7 dias, tabela
   canal_publicacoes), com pausa em sinc_config.operacao_pausada. Resultado
   ambíguo do Telegram (sem resposta) conta como publicado, para não repetir
   às cegas. ?simular=1 só lista. Chamada pelas tarefas do banco (pg_cron)
   com o cabeçalho x-cron-secret. */

const ECONOMIA_MINIMA = 30;
const POR_CHAMADA = 2;
const DIAS_SEM_REPETIR = 7;
const FRESCO_MS = 3 * 3600_000;
const CRITERIOS =
  "garimpo-v2 (05/10): >= R$ 30 no produto, meli.la, frete conhecido, conferida <= 3 h";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  /* Qualidade x o anúncio comparado (premissa de 05/10). */
  qualidade: Qualidade | null;
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
    qualidade:
      escolha.tipo === "parecido"
        ? qualidadeDoParecido(escolha, { titulo: colado.titulo, detalhes: colado.detalhes })
        : null,
  };
}

/* O que muda, como no site: "Campo: o seu X → este Y", sem repetir o mesmo
   campo (a conferência e a ficha às vezes dizem a mesma coisa duas vezes). */
function textoDoMuda(muda: string | null, tituloColado: string) {
  const itens = diferencasParaCliente(muda, tituloColado)
    .slice(0, 3)
    .map((d) =>
      d.campo && d.seu && d.este
        ? `${d.campo}: o seu ${d.seu} → este ${d.este}`
        : d.campo && d.este
          ? `${d.campo}: ${d.este}`
          : d.texto,
    )
    .filter(Boolean);
  return itens.length ? itens.join("; ") : muda;
}

/* Preço e frete em linhas separadas; nunca "R$ X a menos + frete". */
function mensagem(x: Achado) {
  const linhas = [
    "🔥 <b>Achado conferido há pouco</b>",
    `📦 ${html(x.tipo === "parecido" ? x.tituloOpcao : x.titulo)}`,
    x.tipo === "parecido"
      ? `⚠️ Parecido com "${html(x.titulo)}", não é idêntico.${x.muda ? ` Muda: ${html(textoDoMuda(x.muda, x.titulo))}` : ""}`
      : "✅ Mesmo produto, em outra loja",
    x.qualidade
      ? `${x.qualidade.nivel === "superior" ? "⭐" : "✅"} ${html(textoDaQualidade(x.qualidade))}`
      : null,
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
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const negado = await chamadaAutorizada(request, db);
  if (negado) return negado;
  const simular = new URL(request.url).searchParams.get("simular") === "1";
  if (!simular && (await operacaoPausada(db))) return Response.json({ ok: true, pausada: true });
  const resumo = await registrarExecucao(db, simular ? "garimpo_simulado" : "garimpo", () =>
    garimparAgora(db, simular),
  );
  return Response.json(resumo, { status: resumo["ok"] === false && resumo["erro"] ? 502 : 200 });
}

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function garimparAgora(db: Db, simular: boolean): Promise<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db as any;
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ data: pedidos, error: erroPedidos }, { data: vistos }] = await Promise.all([
    db
      .from("pedidos_link")
      .select("id,url_alvo,link,analise,atendido_em")
      .eq("status", "pronto")
      .not("link", "is", null)
      .gte("atendido_em", desde)
      .order("id", { ascending: false })
      .limit(30),
    db.from("produtos_vistos").select("url_produto").gte("visto_em", desde).limit(500),
  ]);
  if (erroPedidos) return { ok: false, erro: "leitura dos pedidos" };

  const permitidos = new Set((vistos ?? []).map((v) => v.url_produto).filter(Boolean));
  const vistosAqui = new Set<string>();
  const achados: Array<Achado & { fresco: boolean }> = [];
  for (const p of pedidos ?? []) {
    if (!p.url_alvo || !permitidos.has(p.url_alvo) || vistosAqui.has(p.url_alvo)) continue;
    vistosAqui.add(p.url_alvo);
    const x = achadoDoPedido(p);
    if (x)
      achados.push({
        ...x,
        fresco: !!p.atendido_em && Date.now() - Date.parse(p.atendido_em) <= FRESCO_MS,
      });
  }
  achados.sort((a, b) => b.economia - a.economia);

  /* Já publicados na semana (não repetir). */
  const limite = new Date(Date.now() - DIAS_SEM_REPETIR * 24 * 3600_000).toISOString();
  const { data: publicadosAntes } = await t
    .from("canal_publicacoes")
    .select("chave")
    .gte("publicado_em", limite)
    .limit(500);
  const jaFoi = new Set(((publicadosAntes ?? []) as Array<{ chave: string }>).map((p) => p.chave));

  const canal = process.env["TELEGRAM_CANAL_ID"];
  const token = process.env["API_TELEGRAM"];
  const publicados: string[] = [];
  if (!simular && canal && token) {
    for (const x of achados) {
      if (publicados.length >= POR_CHAMADA) break;
      if (!x.fresco || jaFoi.has(x.chave)) continue;
      const r = await telegram(token, "sendMessage", {
        chat_id: canal,
        text: mensagem(x),
        parse_mode: "HTML",
        reply_markup: teclado(x),
      });
      /* Recusado com resposta (ok=false): não publicou, pode tentar depois.
         Sem resposta: ambíguo, registra para não repetir às cegas. */
      if (r && r.ok === false) continue;
      const messageId = (r?.result as { message_id?: number } | undefined)?.message_id ?? null;
      await t.from("canal_publicacoes").insert({
        chave: x.chave,
        pedido_id: x.pedido,
        tipo: x.tipo,
        titulo: x.tipo === "parecido" ? x.tituloOpcao : x.titulo,
        preco: x.preco,
        economia_produto: x.economia,
        link: x.link,
        message_id: messageId,
        criterios: r ? CRITERIOS : `${CRITERIOS} | resultado ambíguo`,
      });
      jaFoi.add(x.chave);
      publicados.push(x.chave);
    }
  }

  return {
    ok: true,
    simular,
    canal: Boolean(canal),
    lidos: pedidos?.length ?? 0,
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
      situacao: publicados.includes(x.chave)
        ? "publicado"
        : jaFoi.has(x.chave)
          ? "ja_publicado_na_semana"
          : x.fresco
            ? "pronto_para_publicar"
            : "rascunho_preco_velho",
      mensagem: simular ? mensagem(x) : undefined,
      teclado: simular ? teclado(x) : undefined,
    })),
  };
}

export const Route = createFileRoute("/api/public/cron-garimpo")({
  server: {
    handlers: {
      GET: async ({ request }) => garimpar(request),
      POST: async ({ request }) => garimpar(request),
    },
  },
});
