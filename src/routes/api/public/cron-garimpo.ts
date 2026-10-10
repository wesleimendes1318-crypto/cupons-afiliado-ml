import { createFileRoute } from "@tanstack/react-router";

import { decisaoDaTela, opcoesDaAnalise, type Opcao } from "@/lib/ajudar-escolher";
import { naoEAlternativa } from "@/lib/alternativa";
import { diferencasParaCliente } from "@/lib/diferencas";
import {
  desvantagensDoParecido,
  qualidadeDoParecido,
  textoDaQualidade,
  type Qualidade,
} from "@/lib/qualidade";
import { pecaNoLugarDoAparelho } from "@/lib/conferir-produto";
import { menorPrecoDoColado } from "@/lib/menor-preco";
import { precoMuitoAbaixo, precosDoMesmoProduto } from "@/lib/preco-suspeito";
import { descontoReal } from "@/lib/regra-economia";
import { textoDoPagamento, type Precos } from "@/lib/pagamento";
import { html, linhaDoFrete, telegram } from "@/lib/telegram";
import { chamadaAutorizada, operacaoPausada, registrarExecucao } from "@/lib/segredo-cron";
import { rotuloDa, temporadaDoProduto, type Temporada } from "@/lib/sazonal";
import { linkDoBot } from "@/lib/telegram-publico";
import { facebookConfigurado, publicarNoFacebook, textoSimples } from "@/lib/facebook";
import { fotoOriginalJpeg } from "@/lib/foto";
import { pareceFalso } from "@/lib/falsificado";
import { linhaDasAvaliacoes } from "@/lib/avaliacoes";

/* GARIMPO (Weslei, 05/10): olha as comparações prontas e separa os achados
   que valem divulgar, com as MESMAS regras da tela (opcoesDaAnalise +
   decisaoDaTela):
   - desconto real no produto contra o anúncio comparado (R$ 30, ou R$ 10
     e 20% para produto barato; src/lib/regra-economia.ts);
   - link de afiliado (meli.la) da opção escolhida;
   - frete grátis CONFIRMADO (desconhecido ou pago fica fora; 05/10);
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

const POR_CHAMADA = 2;
const DIAS_SEM_REPETIR = 7;
const FRESCO_MS = 3 * 3600_000;
const CRITERIOS =
  "garimpo-v5 (09/10): >= R$ 30 ou (>= R$ 10 e >= 20%) no produto, meli.la, frete gratis confirmado, conferida <= 3 h, sem preco < 70% da mediana das lojas (salvo loja oficial)";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Achado = {
  chave: string;
  pedido: number;
  /* menor: o próprio anúncio comparado já é o menor preço (05/10). */
  tipo: "mesmo" | "parecido" | "menor";
  /* Lojas mais caras conferidas (tipo menor). */
  lojasMaisCaras?: number;
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
  /* O que tem pior ou a menos que o anúncio comparado (05/10). */
  desvantagens: string[];
  /* Foto do produto da oferta (post com foto grande, 05/10). */
  imagem: string | null;
  /* Temporada que combina com o produto (Dia das Crianças, Natal...). */
  temporada: Temporada | null;
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
  if (!escolha) {
    /* JÁ É O MENOR PREÇO (05/10): sem loja mais barata nem alternativa, o
       próprio anúncio vira o achado quando é o mais barato do mesmo produto
       contra pelo menos 2 lojas mais caras, com desconto real contra a 2ª. */
    const m = menorPrecoDoColado(a);
    if (!m || !/^https:\/\/meli\.la\//i.test(colado.link)) return null;
    if (colado.freteGratis !== true) return null;
    if (pareceFalso(colado.titulo)) return null;
    /* Preço muito abaixo das outras lojas sem loja oficial (09/10). */
    if (!colado.lojaOficial && precoMuitoAbaixo(colado.preco, precosDoMesmoProduto(a))) return null;
    return {
      chave: `${p.url_alvo.split("?")[0]}|${colado.link}|menor`,
      pedido: p.id,
      tipo: "menor",
      lojasMaisCaras: m.lojas,
      titulo: colado.titulo,
      tituloOpcao: colado.titulo,
      loja: colado.loja,
      lojaOficial: colado.lojaOficial,
      preco: colado.preco,
      precoColado: m.segunda,
      economia: m.economia,
      muda: null,
      link: colado.link,
      opcao: colado,
      qualidade: null,
      desvantagens: [],
      imagem: colado.imagem ?? null,
      temporada: temporadaDoProduto(colado.titulo),
    };
  }
  if (!/^https:\/\/meli\.la\//i.test(escolha.link)) return null;
  /* FRETE GRÁTIS CONFIRMADO (Weslei, 05/10, "Grave!!! O frete é pago!":
     Deo Malbec R$ 59,85 saiu sem frete na mensagem e o comprador pagou
     R$ 11,90). Frete desconhecido não é grátis, e frete pago depende do CEP
     de cada leitor do canal: só publica com frete grátis confirmado na
     comparação (shipping.cost 0 da lista oficial ou "grátis" no anúncio). */
  if (escolha.freteGratis !== true) return null;
  if (pecaNoLugarDoAparelho(colado.titulo, escolha.titulo)) return null;
  /* Produto falso nunca vai ao canal (Weslei, 09/10). */
  if (pareceFalso(escolha.titulo) || pareceFalso(colado.titulo)) return null;
  /* PREÇO MUITO ABAIXO DAS OUTRAS LOJAS (09/10, posts 29 e 30: Malbec R$ 200
     x R$ 361/R$ 379 e aspirador R$ 50 x R$ 120/R$ 227, contas novas sem
     selo). O site avisa "confira o vendedor"; o canal não publica, salvo
     loja oficial. Mesma conta da tabela (src/lib/preco-suspeito.ts). */
  if (
    escolha.tipo === "mesmo" &&
    !escolha.lojaOficial &&
    precoMuitoAbaixo(escolha.preco, precosDoMesmoProduto(a))
  )
    return null;
  if (escolha.tipo === "parecido" && naoEAlternativa(escolha.muda)) return null;
  const economia = Math.round((colado.preco - escolha.preco) * 100) / 100;
  if (!descontoReal(economia, colado.preco)) return null;
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
    desvantagens:
      escolha.tipo === "parecido"
        ? desvantagensDoParecido(escolha, { titulo: colado.titulo, detalhes: colado.detalhes })
        : [],
    imagem: escolha.imagem ?? colado.imagem ?? null,
    temporada: temporadaDoProduto(escolha.titulo) ?? temporadaDoProduto(colado.titulo),
  };
}

/* O que muda, como no site: "Campo: o seu X → este Y", sem repetir o mesmo
   campo (a conferência e a ficha às vezes dizem a mesma coisa duas vezes). */
function textoDoMuda(muda: string | null, tituloColado: string) {
  const itens = diferencasParaCliente(muda, tituloColado)
    .slice(0, 3)
    .map((d) =>
      d.campo && d.seu && d.este
        ? `${d.campo}: ${d.seu} → ${d.este}`
        : d.campo && d.este
          ? `${d.campo}: ${d.este}`
          : d.texto,
    )
    .filter(Boolean);
  return itens.length ? itens.join("; ") : muda;
}

/* POST DO CANAL (Weslei, 05/10: "melhore a mensagem, melhore a disposição
   da foto"): foto grande em cima (sendPhoto) e legenda curta em blocos:
   produto, se é o mesmo ou parecido, preço x anúncio comparado, economia,
   frete em linha própria e loja. O link de afiliado vai nos botões (e no
   texto só quando não há foto). Legenda de foto tem limite de 1024
   caracteres. Nunca "R$ X a menos + frete". */
const curto = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

function horaDeBrasilia(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function mensagem(x: Achado & { conferidoEm?: string | null }, comLink = false) {
  const pct = Math.round((x.economia / x.precoColado) * 100);
  /* "no Pix" fica junto do preço; o parcelado (com total e diferença) vai
     em linha própria. */
  const partes = (textoDoPagamento(x.preco, x.opcao.precos as Precos | null) ?? "")
    .split(" · ")
    .map((t) => t.trim())
    .filter(Boolean);
  const noPix = partes.filter((t) => !/^parcelado|^ou |^no cart/.test(t)).join(" · ");
  const parcelado = partes.filter((t) => /^parcelado|^ou |^no cart/.test(t)).join(" · ");
  const hora = horaDeBrasilia(x.conferidoEm ?? null);
  const blocos: Array<Array<string | null>> = [
    [
      x.temporada ? `${x.temporada.emoji} <b>${html(rotuloDa(x.temporada))}</b>` : null,
      `🔥 <b>${html(curto(x.tipo === "parecido" ? x.tituloOpcao : x.titulo, 90))}</b>`,
    ],
    x.tipo === "parecido"
      ? [
          `⚠️ Parecido, não idêntico ao anúncio comparado (${html(curto(x.titulo, 60))})`,
          x.muda ? `🔄 Muda: ${html(curto(textoDoMuda(x.muda, x.titulo) ?? "", 160))}` : null,
          x.qualidade
            ? `${x.qualidade.nivel === "superior" ? "⭐" : "✅"} ${html(
                curto(
                  textoDaQualidade({
                    ...x.qualidade,
                    /* Motivo que só repete o "Muda" sai do post. */
                    motivo:
                      /muda (s[oó]|apenas)|mesmo modelo|mesmo conjunto|mesma categoria/i.test(
                        x.qualidade.motivo ?? "",
                      ) || (x.qualidade.motivo ?? "").length > 70
                        ? null
                        : x.qualidade.motivo,
                  }).replace("à do seu", "à do anúncio comparado"),
                  120,
                ),
              )}`
            : null,
          x.desvantagens.length
            ? `❌ Desvantagens: ${html(curto(x.desvantagens.slice(0, 2).join("; "), 120))}`
            : null,
        ]
      : x.tipo === "menor"
        ? [
            `✅ Já é o menor preço: conferido contra ${x.lojasMaisCaras ?? 2} lojas que vendem o mesmo produto`,
          ]
        : ["✅ Mesmo produto, em outra loja"],
    [
      `💰 <b>${brl(x.preco)}</b>${noPix ? ` ${html(noPix)}` : ""}`,
      parcelado ? `💳 ${html(parcelado.charAt(0).toUpperCase() + parcelado.slice(1))}` : null,
      x.tipo === "menor"
        ? `🏷️ Na 2ª loja mais barata: <s>${brl(x.precoColado)}</s>`
        : `🏷️ Anúncio comparado: <s>${brl(x.precoColado)}</s>`,
      `💸 <b>${brl(x.economia)} a menos no produto${x.tipo === "menor" ? " que a 2ª loja" : ""}</b>${pct >= 1 ? ` (−${pct}%)` : ""}`,
      linhaDoFrete(x.opcao),
    ],
    [
      x.loja ? `🏪 ${html(curto(x.loja, 40))}${x.lojaOficial ? " · ⭐ Loja oficial" : ""}` : null,
      /* Avaliação das pessoas lida no anúncio (10/10). */
      linhaDasAvaliacoes(x.opcao.avaliacoes),
      comLink ? `🛒 Comprar com segurança: ${x.link}` : null,
      `🕒 Preço conferido${hora ? ` às ${hora}` : ""}; pode mudar. Confira antes de comprar.`,
    ],
  ];
  return blocos
    .map((b) => b.filter((l): l is string => l != null).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

/* Foto do Mercado Livre em JPEG e na maior versão (o Telegram não aceita
   webp por URL em sendPhoto): a original de até 1200 px (src/lib/foto.ts,
   09/10: "melhore a qualidade das fotos!"); fora do padrão, a -O. */
function fotoGrande(u: string | null) {
  if (!u || !/^https?:\/\//.test(u)) return null;
  const original = fotoOriginalJpeg(u);
  if (original) return original;
  return u
    .replace(/^http:/, "https:")
    .replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1")
    .replace(/\.webp$/i, ".jpg");
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
  const achados: Array<Achado & { fresco: boolean; conferidoEm: string | null }> = [];
  for (const p of pedidos ?? []) {
    if (!p.url_alvo || !permitidos.has(p.url_alvo) || vistosAqui.has(p.url_alvo)) continue;
    vistosAqui.add(p.url_alvo);
    const x = achadoDoPedido(p);
    if (x)
      achados.push({
        ...x,
        fresco: !!p.atendido_em && Date.now() - Date.parse(p.atendido_em) <= FRESCO_MS,
        conferidoEm: p.atendido_em ?? null,
      });
  }
  /* Temporada na frente (50% a mais na nota); as regras não mudam. */
  const nota = (x: Achado) => x.economia * (x.temporada ? 1.5 : 1);
  achados.sort((a, b) => nota(b) - nota(a));

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
  const facebook: string[] = [];
  if (!simular && canal && token) {
    for (const x of achados) {
      if (publicados.length >= POR_CHAMADA) break;
      if (!x.fresco || jaFoi.has(x.chave)) continue;
      /* Foto grande com legenda; sem foto (ou recusada), texto sem a
         prévia pequena do link. */
      const foto = fotoGrande(x.imagem);
      let r = foto
        ? await telegram(token, "sendPhoto", {
            chat_id: canal,
            photo: foto,
            caption: mensagem(x),
            parse_mode: "HTML",
            reply_markup: teclado(x),
          })
        : null;
      /* Só tenta o texto quando o Telegram RECUSOU a foto (ok=false); sem
         resposta é ambíguo e não manda de novo (evita post duplicado). */
      if (!foto || (r && r.ok === false))
        r = await telegram(token, "sendMessage", {
          chat_id: canal,
          text: mensagem(x, true),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: teclado(x),
        });
      /* Recusado com resposta (ok=false): não publicou, pode tentar depois.
         Sem resposta: ambíguo, registra para não repetir às cegas. */
      if (r && r.ok === false) continue;
      const messageId = (r?.result as { message_id?: number } | undefined)?.message_id ?? null;
      const { data: linha } = await t
        .from("canal_publicacoes")
        .insert({
          chave: x.chave,
          pedido_id: x.pedido,
          tipo: x.tipo,
          titulo: x.tipo === "parecido" ? x.tituloOpcao : x.titulo,
          preco: x.preco,
          economia_produto: x.economia,
          link: x.link,
          message_id: messageId,
          criterios: r ? CRITERIOS : `${CRITERIOS} | resultado ambíguo`,
        })
        .select("id")
        .maybeSingle();
      jaFoi.add(x.chave);
      publicados.push(x.chave);
      /* PÁGINA DO FACEBOOK (09/10): a mesma oferta, depois do canal; falha
         aqui não desfaz nem atrasa o canal (prazo próprio, nunca lança). */
      if (facebookConfigurado()) {
        const fb = await publicarNoFacebook(
          foto,
          `${textoSimples(mensagem(x, true))}\n\n🔎 Compare o seu produto: https://melhorescolha.io`,
        );
        if (fb.ok) facebook.push(x.chave);
        if (linha?.id)
          await t
            .from("canal_publicacoes")
            .update({
              facebook_post_id: fb.ok ? fb.postId : null,
              facebook_erro: fb.ok ? null : fb.erro,
              facebook_em: new Date().toISOString(),
            })
            .eq("id", linha.id);
      }
    }
  }

  return {
    ok: true,
    simular,
    canal: Boolean(canal),
    lidos: pedidos?.length ?? 0,
    encontrados: achados.length,
    publicados: publicados.length,
    facebook: facebookConfigurado() ? facebook.length : "sem configuração",
    destaques: achados.map((x) => ({
      pedido: x.pedido,
      tipo: x.tipo,
      titulo: x.tipo === "parecido" ? x.tituloOpcao : x.titulo,
      temporada: x.temporada?.id ?? null,
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
      foto: simular ? fotoGrande(x.imagem) : undefined,
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
