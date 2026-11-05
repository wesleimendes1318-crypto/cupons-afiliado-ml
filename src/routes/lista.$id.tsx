/* PUBLIC SHARED WISHLIST (Weslei, 05/11/2026): what a visitor shared from
   /favoritos. Friends filter by budget, buy through Weslei's link (rule no. 1:
   ComprarComSeguranca with the stored affiliate link, else VerNaLoja, which
   ends in his link), mark an item as bought so nobody repeats the gift, and
   save items to their own list. The price is the one seen when saved, dated. */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, Gift, Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { CompararPreco, ComprarComSeguranca } from "@/components/BotoesCartao";
import { VerNaLoja } from "@/components/BuscaPorLink";
import { LayoutConteudo } from "@/components/LayoutConteudo";
import { SeloMarketplace } from "@/components/SeloMarketplace";
import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeCompra } from "@/lib/afiliado";
import { alternar, mudarLista, useListaDesejos, type ItemDesejo } from "@/lib/lista-desejos";
import {
  FAIXAS,
  SITE,
  lerListaPublica,
  marcarPresente,
  naFaixa,
  presentesDesteAparelho,
  resumoDaLista,
  tituloDaLista,
  type Presente,
} from "@/lib/lista-publica";

export const Route = createFileRoute("/lista/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase.rpc("lista_publica" as never, { p_id: params.id } as never);
    const lista = lerListaPublica(data);
    if (!lista) throw notFound();
    return { lista };
  },
  head: ({ loaderData, params }) => {
    const l = loaderData?.lista;
    const titulo = l ? `${tituloDaLista(l)} — Melhor Escolha` : "Lista de desejos — Melhor Escolha";
    const descricao = l
      ? `${resumoDaLista(l.itens)}. Escolha um presente e marque como comprado para ninguém repetir.`
      : "Lista de presentes compartilhada.";
    const foto = l?.itens.find((i) => i.foto)?.foto;
    const url = `${SITE}/lista/${params.id}`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        ...(foto ? [{ property: "og:image", content: foto }, { name: "twitter:image", content: foto }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: titulo },
        { name: "twitter:description", content: descricao },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PaginaLista,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function PaginaLista() {
  const { lista } = Route.useLoaderData();
  const [faixa, setFaixa] = useState(0);
  const [presentes, setPresentes] = useState<Record<string, Presente>>(lista.presentes);
  const [meus, setMeus] = useState<Set<string>>(new Set());
  useEffect(() => setMeus(presentesDesteAparelho()), []);
  const minha = useListaDesejos();
  const itens = naFaixa(lista.itens, faixa);

  async function aoMarcar(item: string, marcar: boolean, nome: string) {
    const r = await marcarPresente(lista.id, item, marcar, nome);
    if (r) {
      setPresentes(r);
      setMeus(presentesDesteAparelho());
    }
    return r != null;
  }

  return (
    <LayoutConteudo
      titulo={tituloDaLista(lista)}
      {...(lista.ocasiao && lista.ocasiao !== lista.titulo ? { etiqueta: lista.ocasiao } : {})}
      resumo={resumoDaLista(lista.itens)}
    >
      <div
        role="group"
        aria-label="Filtrar por valor"
        className="vidro-barra sticky top-16 z-20 -mx-1 mb-4 flex gap-2 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]"
      >
        {FAIXAS.map((f, k) => (
          <button
            key={f.rotulo}
            type="button"
            aria-pressed={faixa === k}
            onClick={() => setFaixa(k)}
            className={
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] " +
              (faixa === k ? "bg-[#0071e3] text-white" : "bg-card ring-1 ring-border")
            }
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {itens.length === 0 ? (
        <p className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-secondary-ink">
          Nenhum presente nessa faixa. Toque em "Todos" para ver a lista inteira.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
          {itens.map((i, k) => (
            <CartaoPresente
              key={i.id}
              i={i}
              atraso={k}
              presente={presentes[i.id]}
              meu={meus.has(`${lista.id}:${i.id}`)}
              salvo={minha.itens.some((x) => x.id === i.id)}
              aoMarcar={(marcar, nome) => aoMarcar(i.id, marcar, nome)}
            />
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-sm text-secondary-ink">
        Quer montar a sua?{" "}
        <Link to="/favoritos" className="font-semibold text-[#0071e3]">
          Crie sua lista de desejos
        </Link>
      </p>
    </LayoutConteudo>
  );
}

function CartaoPresente({
  i,
  atraso,
  presente,
  meu,
  salvo,
  aoMarcar,
}: {
  i: ItemDesejo;
  atraso: number;
  presente: Presente | undefined;
  meu: boolean;
  salvo: boolean;
  aoMarcar: (marcar: boolean, nome: string) => Promise<boolean>;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const comprado = presente != null;
  const temLink = ehLinkDeCompra(i.linkAfiliado, i.loja);

  async function enviar(marcar: boolean) {
    setEnviando(true);
    setErro(false);
    const ok = await aoMarcar(marcar, nome);
    setEnviando(false);
    if (ok) setAbrindo(false);
    else setErro(true);
  }

  return (
    <li
      className={
        "animate-cartao relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] transition " +
        (comprado ? "opacity-70" : "")
      }
      style={{ animationDelay: `${Math.min(atraso, 8) * 40}ms` }}
    >
      <div className="relative aspect-[4/3] w-full bg-white min-[360px]:aspect-square sm:aspect-[4/3]">
        {i.foto ? (
          <img
            src={i.foto}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-contain p-3"
          />
        ) : (
          <Gift className="absolute inset-0 m-auto size-6 text-[#86868b]" aria-hidden="true" />
        )}
        {comprado && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#34c759] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <Check className="size-3.5" aria-hidden="true" /> Já comprado
          </span>
        )}
      </div>
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
              Preço de quando foi salvo ({dia(i.adicionadoEm)}). Confira na loja.
            </p>
          </>
        )}
        <div className="mt-auto flex flex-col gap-1.5 pt-2.5">
          {comprado ? (
            <p className="rounded-2xl bg-[#34c759]/10 px-3 py-2 text-center text-xs font-semibold text-[#248a3d]">
              {presente.nome ? `${presente.nome} já comprou este presente` : "Alguém já comprou este presente"}
            </p>
          ) : temLink ? (
            /* REGRA Nº 1: link de afiliado guardado ou gerado no clique. */
            <ComprarComSeguranca link={i.linkAfiliado!} origem="lista-publica" />
          ) : i.url ? (
            <VerNaLoja url={i.url} grande />
          ) : null}
          {!comprado && i.loja === "mercadolivre" && i.url && <CompararPreco url={i.url} />}

          {comprado ? (
            meu && (
              <button
                type="button"
                disabled={enviando}
                onClick={() => void enviar(false)}
                className="min-h-11 rounded-full text-xs font-semibold text-[#0071e3] disabled:opacity-50"
              >
                Desfazer: não comprei
              </button>
            )
          ) : abrindo ? (
            <form
              className="flex flex-col gap-1.5 rounded-2xl bg-[#f5f5f7] p-2 dark:bg-white/5"
              onSubmit={(ev) => {
                ev.preventDefault();
                void enviar(true);
              }}
            >
              <label className="text-[11px] text-secondary-ink" htmlFor={`nome-${i.id}`}>
                Seu nome (opcional)
              </label>
              <input
                id={`nome-${i.id}`}
                value={nome}
                maxLength={40}
                onChange={(ev) => setNome(ev.target.value)}
                className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-base"
              />
              <button
                type="submit"
                disabled={enviando}
                className="min-h-11 rounded-full bg-[#34c759] text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirmar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAbrindo(true)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-semibold ring-1 ring-border"
            >
              <Gift className="size-4" aria-hidden="true" /> Marcar como comprado
            </button>
          )}
          {erro && <p className="text-center text-[11px] text-[#d70015]">Não deu agora. Tente de novo.</p>}
          <button
            type="button"
            aria-pressed={salvo}
            onClick={() => mudarLista((l) => alternar(l, i))}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-secondary-ink"
          >
            <Heart
              className={"size-4 " + (salvo ? "fill-[#ff2d55] text-[#ff2d55]" : "")}
              aria-hidden="true"
            />
            {salvo ? "Na sua lista" : "Salvar na minha lista"}
          </button>
        </div>
      </div>
    </li>
  );
}
