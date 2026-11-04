/* MEU PERFIL (Weslei, 04/11): nome, interesses, preferências, últimas buscas
   e complementos. Só o necessário (LGPD); tudo pode ser apagado. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, LoaderCircle, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { abrirLogin, useConta } from "@/lib/auth-otp";
import { useUltimaSincronia } from "@/lib/sincronia-conta";
import {
  apagarPerfilConta,
  INTERESSES,
  limparPerfilConta,
  salvarPerfilConta,
  type Voltagem,
} from "@/lib/perfil-conta";
import {
  categoriaFavorita,
  limparPerfil,
  limparProdutosVistos,
  usePerfilVisitante,
} from "@/lib/perfil-visitante";

export const Route = createFileRoute("/perfil")({
  component: Perfil,
  head: () => ({
    meta: [
      { title: "Meu perfil e preferências — Melhor Escolha" },
      {
        name: "description",
        content: "Seus interesses, preferências de compra e últimas buscas para comparar mais rápido.",
      },
      { property: "og:title", content: "Meu perfil — Melhor Escolha" },
      { property: "og:description", content: "Personalize as comparações do seu jeito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* O que costuma completar cada categoria (sugestão fixa, nunca preço). */
const COMPLEMENTOS: Record<string, string[]> = {
  celulares: ["capinha", "película", "carregador turbo", "fone bluetooth"],
  informatica: ["mouse sem fio", "teclado", "suporte notebook", "ssd"],
  eletronicos: ["caixa de som bluetooth", "smartwatch", "fone bluetooth"],
  eletrodomesticos: ["filtro de linha", "air fryer", "aspirador vertical"],
  casa: ["organizador", "jogo de panelas", "potes herméticos"],
  beleza: ["secador de cabelo", "prancha", "kit skincare"],
  moda: ["tênis", "mochila", "relógio"],
  brinquedos: ["blocos de montar", "jogo de tabuleiro", "massinha"],
  ferramentas: ["jogo de brocas", "parafusadeira", "trena laser"],
  automotivo: ["aspirador automotivo", "suporte celular carro", "calibrador"],
  esportes: ["garrafa térmica", "tapete yoga", "elástico extensor"],
  pet: ["comedouro", "cama pet", "arranhador"],
};

const buscar = (t: string) => `/?link=${encodeURIComponent(t)}`;

function Perfil() {
  const usuario = useConta();
  const local = usePerfilVisitante();
  const [nome, setNome] = useState("");
  const [interesses, setInteresses] = useState<string[]>([]);
  const [voltagem, setVoltagem] = useState<Voltagem>("auto");
  const [freteGratis, setFreteGratis] = useState(true);
  const [avisosEmail, setAvisosEmail] = useState(false);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo">("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const sincronizadoEm = useUltimaSincronia();

  useEffect(() => {
    if (!usuario || carregado) return;
    const p = limparPerfilConta(usuario.user_metadata?.["perfil"]);
    setNome(p.nome);
    setInteresses(p.interesses);
    setVoltagem(p.voltagem);
    setFreteGratis(p.freteGratis);
    setAvisosEmail(p.avisosEmail);
    setCarregado(true);
  }, [usuario, carregado]);

  /* Salva sozinho 1 s depois de cada mudança (sem precisar do botão). */
  useEffect(() => {
    if (!carregado) return;
    const t = setTimeout(() => void salvar(), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, nome, interesses, voltagem, freteGratis, avisosEmail]);

  const alternar = (s: string) =>
    setInteresses((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  async function salvar() {
    setEstado("salvando");
    setErro(null);
    const e = await salvarPerfilConta({ nome, interesses, voltagem, freteGratis, avisosEmail });
    setErro(e);
    setEstado(e ? "" : "salvo");
  }

  const termos = local?.termosRecentes.map((t) => t.termo) ?? [];
  const favorita = categoriaFavorita(local);
  const base = [...new Set([...interesses, ...(favorita ? [favorita] : [])])];
  const complementos = [...new Set(base.flatMap((s) => COMPLEMENTOS[s] ?? []))].slice(0, 8);

  return (
    <LayoutConteudo titulo={nome ? `Olá, ${nome}` : "Meu perfil"} resumo="Diga do que você gosta e eu mostro primeiro o que combina com você.">
      <div className="mx-auto max-w-2xl space-y-5 py-6">
        {usuario && (
          <p className="flex items-center gap-2 text-xs text-secondary-ink" aria-live="polite">
            <span className={`size-2 rounded-full ${estado === "salvando" ? "animate-pulse bg-[#0071e3]" : "bg-[#34c759]"}`} />
            {estado === "salvando"
              ? "Salvando na sua conta…"
              : sincronizadoEm || estado === "salvo"
                ? "Tudo salvo na sua conta e igual em todos os seus aparelhos"
                : "Sua conta guarda suas buscas e preferências sozinha"}
          </p>
        )}

        {!usuario && (
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <p className="text-sm">
              Entre com seu e-mail para guardar suas preferências em qualquer aparelho. Sem senha.
            </p>
            <button
              type="button"
              onClick={abrirLogin}
              className="mt-3 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Entrar com e-mail
            </button>
          </div>
        )}

        {usuario && (
          <section className="space-y-5 rounded-3xl bg-card p-5 shadow-sm">
            <label className="block">
              <span className="text-sm font-semibold">Como quer ser chamado?</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value.slice(0, 40))}
                placeholder="Seu primeiro nome ou apelido"
                autoComplete="given-name"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold">Seus interesses</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTERESSES.map((i) => {
                  const on = interesses.includes(i.slug);
                  return (
                    <button
                      key={i.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => alternar(i.slug)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition ${
                        on
                          ? "border-[#0071e3] bg-[#0071e3] text-white"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                      {i.nome}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold">Voltagem da sua casa</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["auto", "Pela minha região (CEP)"],
                    ["127", "127 V"],
                    ["220", "220 V"],
                  ] as const
                ).map(([v, t]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={voltagem === v}
                    onClick={() => setVoltagem(v)}
                    className={`min-h-10 rounded-full border px-4 text-sm ${
                      voltagem === v
                        ? "border-[#0071e3] bg-[#0071e3] text-white"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={freteGratis}
                  onChange={(e) => setFreteGratis(e.target.checked)}
                  className="size-5"
                />
                Prefiro ofertas com frete grátis
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={avisosEmail}
                  onChange={(e) => setAvisosEmail(e.target.checked)}
                  className="size-5"
                />
                Quero receber por e-mail quando um preço que acompanho cair
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={salvar}
                disabled={estado === "salvando"}
                className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {estado === "salvando" && <LoaderCircle className="size-4 animate-spin" />}
                Salvar preferências
              </button>
              {estado === "salvo" && (
                <span className="text-sm text-secondary-ink">Pronto, salvo na sua conta.</span>
              )}
              {erro && <span className="text-sm text-destructive">{erro}</span>}
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Suas últimas buscas</h2>
            {termos.length > 0 && (
              <button
                type="button"
                onClick={() => limparProdutosVistos()}
                className="text-xs text-secondary-ink underline"
              >
                Limpar produtos vistos
              </button>
            )}
          </div>
          {termos.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {termos.map((t) => (
                <a
                  key={t}
                  href={buscar(t)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm hover:bg-border"
                >
                  <Search className="size-3.5" aria-hidden /> {t}
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-secondary-ink">
              Ainda não há buscas neste aparelho. <Link to="/" className="underline">Fazer uma busca</Link>
            </p>
          )}
        </section>

        {complementos.length > 0 && (
          <section className="rounded-3xl bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Pode completar o que você busca</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {complementos.map((t) => (
                <a
                  key={t}
                  href={buscar(t)}
                  className="min-h-9 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {t}
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-card p-5 text-sm shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-[#0071e3]" aria-hidden /> Seus dados
          </h2>
          <p className="mt-2 text-secondary-ink">
            Guardo só o nome que você escolher, seus interesses e preferências. Nada de CPF,
            telefone ou endereço. Você pode apagar tudo quando quiser.
          </p>
          <button
            type="button"
            onClick={async () => {
              limparPerfil();
              if (usuario) await apagarPerfilConta();
              setNome("");
              setInteresses([]);
              setEstado("");
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 hover:bg-muted"
          >
            <Trash2 className="size-4" aria-hidden /> Apagar meu perfil e histórico
          </button>
        </section>
      </div>
    </LayoutConteudo>
  );
}
