/* LISTA DE DESEJOS (Weslei, 05/11/2026): what the visitor hearted anywhere
   on the site, with selective WhatsApp share. RULE NO. 1: every buy button
   and every link in the shared text is Weslei's affiliate link; an item whose
   link is not known yet is looked up (link_de_reserva) and stays out of the
   text until it has one. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Heart, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CompararPreco, ComprarComSeguranca, SinoAcompanhar } from "@/components/BotoesCartao";
import { VerDetalhesVitrine } from "@/components/DetalhesVitrine";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { CompartilharListaPublica } from "@/components/CompartilharListaPublica";
import { BotaoCoracao } from "@/components/CoracaoDesejo";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { SeloMarketplace } from "@/components/SeloMarketplace";
import { ehLinkDeCompra } from "@/lib/afiliado";
import { abrirLogin, useConta } from "@/lib/auth-otp";
import {
  buscarLinkAfiliado,
  linkWhatsApp,
  mudarLista,
  remover,
  textoWhatsApp,
  useListaDesejos,
  type ItemDesejo,
} from "@/lib/lista-desejos";

export const Route = createFileRoute("/favoritos")({
  component: Favoritos,
  head: () => ({
    meta: [
      { title: "Lista de desejos — Melhor Escolha" },
      {
        name: "description",
        content: "Os produtos que você salvou, para comprar depois ou mandar no WhatsApp.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const temLink = (i: ItemDesejo) => ehLinkDeCompra(i.linkAfiliado, i.loja);

function Favoritos() {
  const lista = useListaDesejos();
  const usuario = useConta();
  const itens = lista.itens;
  /* Everything starts selected: one tap shares the whole list. */
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const tentados = useRef(new Set<string>());

  /* Missing links, one at a time (no request bursts). */
  useEffect(() => {
    const faltam = itens.filter((i) => !temLink(i) && i.url && !tentados.current.has(i.id));
    if (!faltam.length) return;
    let ativo = true;
    void (async () => {
      for (const i of faltam) {
        if (!ativo) return;
        tentados.current.add(i.id);
        setBuscando((s) => new Set(s).add(i.id));
        const link = await buscarLinkAfiliado(i);
        setBuscando((s) => {
          const n = new Set(s);
          n.delete(i.id);
          return n;
        });
        if (link)
          mudarLista((l) => ({
            ...l,
            itens: l.itens.map((x) => (x.id === i.id ? { ...x, linkAfiliado: link } : x)),
          }));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [itens]);

  const selecionados = useMemo(
    () => itens.filter((i) => !desmarcados.has(i.id)),
    [itens, desmarcados],
  );
  const prontos = selecionados.filter(temLink);
  const semLink = selecionados.length - prontos.length;
  const texto = prontos.length ? textoWhatsApp(prontos) : "";
  const todos = itens.length > 0 && selecionados.length === itens.length;

  const alternarSel = (id: string) =>
    setDesmarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* no clipboard permission: WhatsApp button still works */
    }
  }

  const botao =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] disabled:opacity-50";

  return (
    <LayoutConteudo
      titulo="Lista de desejos"
      resumo="Toque no coração de qualquer produto do site para guardar aqui. Escolha os que quiser e mande no WhatsApp."
    >
      {usuario ? (
        <p className="mb-5 rounded-2xl bg-card px-4 py-3 text-sm text-secondary-ink">
          Salva na sua conta: <strong className="text-foreground">{usuario.email}</strong>
        </p>
      ) : (
        <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-secondary-ink">
            <strong className="text-foreground">Sua lista fica neste aparelho.</strong> Entre com
            seu e-mail, sem senha, para ver em qualquer lugar.
          </p>
          <button
            type="button"
            onClick={abrirLogin}
            className={botao + " shrink-0 bg-[#0071e3] text-white"}
          >
            Entrar com e-mail
          </button>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="animate-cartao flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
          <span className="grid size-14 place-items-center rounded-full bg-[#ff2d55]/10">
            <Heart className="size-7 text-[#ff2d55]" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold">Sua lista está vazia</p>
          <p className="max-w-sm text-sm text-secondary-ink">
            Toque no coração no canto da foto de qualquer produto e ele aparece aqui.
          </p>
          <Link to="/" className={botao + " mt-1 bg-[#0071e3] text-white"}>
            Ver ofertas
          </Link>
        </div>
      ) : (
        <>
          <div className="vidro-barra sticky top-16 z-20 mb-4 flex flex-col gap-3 rounded-3xl border border-white/60 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={todos}
                onChange={() => setDesmarcados(todos ? new Set(itens.map((i) => i.id)) : new Set())}
                className="size-5 accent-[#0071e3]"
              />
              {selecionados.length} de {itens.length}{" "}
              {itens.length === 1 ? "selecionado" : "selecionados"}
            </label>
            <div className="flex gap-2">
              {prontos.length > 0 ? (
                <a
                  href={linkWhatsApp(texto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    botao +
                    " min-w-0 flex-1 bg-[#25D366] px-3 text-white hover:brightness-95 sm:flex-none sm:px-4"
                  }
                >
                  <IconeWhatsApp />
                  <span>
                    <span className="hidden min-[400px]:inline">Enviar no </span>WhatsApp
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={
                    botao + " min-w-0 flex-1 bg-[#25D366] px-3 text-white sm:flex-none sm:px-4"
                  }
                >
                  <IconeWhatsApp />
                  <span>
                    <span className="hidden min-[400px]:inline">Enviar no </span>WhatsApp
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void copiar()}
                disabled={!prontos.length}
                aria-label="Copiar o texto da lista"
                className={
                  botao +
                  " w-11 shrink-0 border border-border bg-card px-0 min-[400px]:w-auto min-[400px]:px-3"
                }
              >
                {copiado ? (
                  <Check className="size-4 text-[#34c759]" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                <span className="hidden min-[400px]:inline">{copiado ? "Copiado" : "Copiar"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  mudarLista((l) =>
                    remover(
                      l,
                      selecionados.map((i) => i.id),
                    ),
                  );
                  setDesmarcados(new Set());
                }}
                disabled={!selecionados.length}
                aria-label="Tirar os selecionados da lista"
                className={
                  botao +
                  " w-11 shrink-0 border border-border bg-card px-0 min-[400px]:w-auto min-[400px]:px-3 text-[#d70015]"
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span className="hidden min-[400px]:inline">Remover</span>
              </button>
            </div>
            <div className="sm:basis-full">
              <CompartilharListaPublica itens={selecionados} />
            </div>
            {semLink > 0 && (
              <p className="text-xs text-secondary-ink sm:basis-full">
                {semLink === 1 ? "1 item ainda está" : `${semLink} itens ainda estão`} sem link
                seguro de compra e {semLink === 1 ? "fica" : "ficam"} fora da mensagem por enquanto.
              </p>
            )}
          </div>

          <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {itens.map((i, k) => (
              <CartaoDesejo
                key={i.id}
                i={i}
                atraso={k}
                marcado={!desmarcados.has(i.id)}
                buscando={buscando.has(i.id)}
                aoMarcar={() => alternarSel(i.id)}
              />
            ))}
          </ul>
        </>
      )}
    </LayoutConteudo>
  );
}

function CartaoDesejo({
  i,
  atraso,
  marcado,
  buscando,
  aoMarcar,
}: {
  i: ItemDesejo;
  atraso: number;
  marcado: boolean;
  buscando: boolean;
  aoMarcar: () => void;
}) {
  return (
    <li
      className={
        "animate-cartao relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] ring-2 transition " +
        (marcado ? "ring-[#0071e3]/70" : "ring-transparent")
      }
      style={{ animationDelay: `${Math.min(atraso, 8) * 40}ms` }}
    >
      <label className="absolute left-2 top-2 z-10 grid size-9 cursor-pointer place-items-center rounded-full vidro-botao shadow-sm">
        <input
          type="checkbox"
          checked={marcado}
          onChange={aoMarcar}
          aria-label={`Incluir na mensagem: ${i.titulo}`}
          className="size-[18px] accent-[#0071e3]"
        />
      </label>
      <div className="absolute right-2 top-2 z-10">
        <BotaoCoracao
          ativo
          compacto
          rotulo={`Tirar da lista de desejos: ${i.titulo}`}
          aoTocar={() => mudarLista((l) => remover(l, [i.id]))}
        />
      </div>
      <VerDetalhesVitrine
        chave={i.id}
        titulo={i.titulo}
        imagem={i.foto}
        preco={i.preco}
        link={i.linkAfiliado}
        urlProduto={i.url}
        vistoEm={i.adicionadoEm}
        className="relative aspect-[4/3] w-full bg-white min-[360px]:aspect-square sm:aspect-[4/3]"
        gatilho={
          i.foto ? (
            <img
              src={i.foto}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain p-3"
            />
          ) : (
            <Heart className="absolute inset-0 m-auto size-6 text-[#86868b]" />
          )
        }
      />
      <div className="flex flex-1 flex-col border-t border-border/60 p-2.5 sm:p-3">
        <p className="min-h-5">
          <SeloMarketplace links={[i.linkAfiliado ?? i.url]} />
        </p>
        <p className="mt-1 line-clamp-2 min-h-[2lh] text-[13px] font-semibold leading-snug sm:text-sm">
          {i.titulo}
        </p>
        {i.preco != null && (
          <>
            <p className="mt-1 text-lg font-extrabold leading-tight tabular-nums">{brl(i.preco)}</p>
            <p className="text-[10px] text-secondary-ink/80">
              Preço de quando salvou ({dia(i.adicionadoEm)})
            </p>
          </>
        )}
        <div className="mt-auto flex flex-col gap-1.5 pt-2.5">
          {/* REGRA Nº 1: link de afiliado guardado ou gerado no clique. */}
          {temLink(i) ? (
            <ComprarComSeguranca link={i.linkAfiliado!} origem="favoritos" />
          ) : i.url ? (
            <VerNaLoja url={i.url} grande />
          ) : null}
          {i.loja === "mercadolivre" && i.url && (
            <SinoAcompanhar url={i.url} titulo={i.titulo}>
              <div className="flex min-w-0 flex-1">
                <CompararPreco url={i.url} />
              </div>
            </SinoAcompanhar>
          )}
          {buscando && (
            <p className="flex items-center justify-center gap-1 text-[10px] text-secondary-ink">
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> Preparando o link
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8zm8.4-18.2C18.2 1.3 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.6-8.4z" />
    </svg>
  );
}
