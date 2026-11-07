/* AJUSTES E PRIVACIDADE (/painel, Weslei 06/11; was /perfil from 04/11):
   name, interests, voltage, CEP region, shipping, e-mail alerts (off by
   default), recent searches and the LGPD art. 18 controls. Data minimization:
   no CPF, RG, phone, birthday, full address or card, ever. */
import { Link } from "@tanstack/react-router";
import { Check, LoaderCircle, LogOut, MapPin, Search, ShieldCheck, Smartphone, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { useRegiaoGuardada } from "@/components/CepDestino";
import { abrirLogin, sair, useConta } from "@/lib/auth-otp";
import { gravarLista } from "@/lib/lista-desejos";
import { idDoNavegador } from "@/lib/navegador";
import { useUltimaSincronia } from "@/lib/sincronia-conta";
import {
  apagarPerfilConta,
  excluirContaInteira,
  INTERESSES,
  prefixoCep,
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

/* Busca por texto na home sem recarregar (BuscaPorLink lê ?link= de texto puro). */
const buscar = (t: string) => ({ link: t }) as never;

export function PainelConfiguracoesLGPD() {
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
  const regiao = useRegiaoGuardada();
  /* Only a CEP the person typed or the device location (never the IP guess). */
  const cep = regiao && !regiao.aproximado ? prefixoCep(regiao.cep) : "";
  const cidadeUf = regiao && !regiao.aproximado && regiao.cidade ? `${regiao.cidade}${regiao.uf ? `/${regiao.uf}` : ""}` : "";
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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
  }, [carregado, nome, interesses, voltagem, freteGratis, avisosEmail, cep, cidadeUf]);

  const alternar = (s: string) =>
    setInteresses((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  async function salvar() {
    setEstado("salvando");
    setErro(null);
    const e = await salvarPerfilConta({ nome, interesses, voltagem, freteGratis, avisosEmail, cep, cidadeUf });
    setErro(e);
    setEstado(e ? "" : "salvo");
  }

  const termos = local?.termosRecentes.map((t) => t.termo) ?? [];
  const favorita = categoriaFavorita(local);
  const base = [...new Set([...interesses, ...(favorita ? [favorita] : [])])];
  const complementos = [...new Set(base.flatMap((s) => COMPLEMENTOS[s] ?? []))].slice(0, 8);

  return (
    <>
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

            <div>
              <p className="text-sm font-semibold">Sua região de entrega</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-4">
                  <MapPin className="size-4 text-[#0071e3]" aria-hidden />
                  {cep ? `${cidadeUf || "CEP"} · ${cep}-xxx` : "Ainda sem CEP"}
                </span>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("abrir-cep"))}
                  className="min-h-10 rounded-full border border-border px-4 hover:bg-muted"
                >
                  {cep ? "Trocar CEP" : "Informar CEP"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-secondary-ink">
                Guardo só os 5 primeiros números do CEP, para frete e voltagem. Nunca rua ou número.
              </p>
            </div>

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
                <Link
                  key={t}
                  to="/"
                  search={buscar(t)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm hover:bg-border"
                >
                  <Search className="size-3.5" aria-hidden /> {t}
                </Link>
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
                <Link
                  key={t}
                  to="/"
                  search={buscar(t)}
                  className="min-h-9 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {t}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-3xl bg-card p-5 text-sm shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-[#0071e3]" aria-hidden /> Sua privacidade
          </h2>
          <p className="text-secondary-ink">
            Guardo só o seu e-mail de acesso, o nome que você escolher, interesses, preferências,
            a região do CEP e o que você mesmo salvou. Nada de CPF, RG, telefone, data de
            nascimento, endereço ou cartão.
          </p>

          <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs">
            <Smartphone className="size-3.5" aria-hidden />
            {usuario ? (
              <>
                <span className="size-2 rounded-full bg-[#34c759]" /> Este aparelho está conectado à
                conta {usuario.email}
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-secondary-ink/50" /> Dados guardados só neste
                aparelho
              </>
            )}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                limparPerfil();
                limparProdutosVistos();
                setAviso("Histórico de buscas e itens vistos apagado.");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 hover:bg-muted"
            >
              <Trash2 className="size-4" aria-hidden /> Limpar histórico de buscas e itens vistos
            </button>
            {usuario && (
              <button
                type="button"
                onClick={() => void sair().then(() => setAviso("Aparelho desconectado da conta."))}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 hover:bg-muted"
              >
                <LogOut className="size-4" aria-hidden /> Desconectar este aparelho
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                limparPerfil();
                if (usuario) await apagarPerfilConta();
                setNome("");
                setInteresses([]);
                setEstado("");
                setAviso("Perfil e preferências apagados.");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 hover:bg-muted"
            >
              <Trash2 className="size-4" aria-hidden /> Apagar perfil e preferências
            </button>
          </div>
          {aviso && (
            <p className="animate-sugestao text-xs text-[#248a3d]" role="status">
              {aviso}
            </p>
          )}

          {usuario && (
            <div className="rounded-2xl border border-destructive/30 p-4">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <TriangleAlert className="size-4" aria-hidden /> Excluir minha conta
              </p>
              <p className="mt-1 text-xs text-secondary-ink">
                Apaga de vez a conta e tudo ligado a ela: preços acompanhados, lista de desejos,
                listas públicas, amigo secreto e o histórico deste aparelho. Não dá para desfazer.
              </p>
              <div className={`gaveta ${confirmarExclusao ? "gaveta-aberta" : ""}`}>
                <div>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    Tem certeza? Tudo some agora e não volta.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={excluindo}
                  onClick={async () => {
                    if (!confirmarExclusao) return setConfirmarExclusao(true);
                    setExcluindo(true);
                    const e = await excluirContaInteira(idDoNavegador());
                    setExcluindo(false);
                    if (e) return setAviso(e);
                    await sair();
                    limparDadosDoAparelho();
                    setConfirmarExclusao(false);
                    setNome("");
                    setInteresses([]);
                    setAviso("Conta e dados excluídos.");
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-destructive px-4 font-semibold text-white disabled:opacity-60"
                >
                  {excluindo && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                  {confirmarExclusao ? "Sim, excluir tudo" : "Excluir permanentemente minha conta e dados"}
                </button>
                {confirmarExclusao && (
                  <button
                    type="button"
                    onClick={() => setConfirmarExclusao(false)}
                    className="min-h-11 rounded-full border border-border px-4 hover:bg-muted"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* Local copies of what the account held (wishlist, Secret Santa, planners,
   taste profile), so nothing comes back on this device after deletion. */
function limparDadosDoAparelho() {
  limparPerfil();
  gravarLista({ itens: [], removidos: {} });
  try {
    for (const k of Object.keys(localStorage))
      if (
        k.startsWith("melhorescolha_amigo_secreto") ||
        k.startsWith("melhorescolha_planejador_v1_")
      )
        localStorage.removeItem(k);
  } catch {
    /* storage blocked: nothing stored either */
  }
}
