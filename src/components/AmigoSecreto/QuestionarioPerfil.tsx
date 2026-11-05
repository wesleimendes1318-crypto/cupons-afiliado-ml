/* Optional, inclusive profile questionnaire (Weslei, 05/11). Every answer is
   optional; "Tanto faz" is always available; nothing asks for gender, only
   which style of pieces fits the person. */
import { ChevronDown, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { OPCOES_ESTILO, OPCOES_IDADE, perfilVazio, type PerfilAmigo } from "@/lib/amigo-secreto-perfil";

const ROUPAS = ["PP", "P", "M", "G", "GG", "XG"];

export function QuestionarioPerfil({
  nome,
  perfil,
  aoAplicar,
}: {
  nome: string;
  perfil?: PerfilAmigo | undefined;
  aoAplicar: (p: PerfilAmigo) => void;
}) {
  const [aberto, setAberto] = useState(perfilVazio(perfil));
  const [p, setP] = useState<PerfilAmigo>(perfil ?? {});
  useEffect(() => setP(perfil ?? {}), [perfil]);
  const chip = (ativo: boolean) =>
    "min-h-11 rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.97] " +
    (ativo ? "bg-[#0071e3] text-white shadow-sm" : "bg-card text-foreground ring-1 ring-border");

  return (
    <section className="vidro-barra animate-cartao rounded-3xl border border-white/60 p-4 sm:p-5 dark:border-white/10">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <UserRound className="size-5 text-[#0071e3]" aria-hidden="true" />
          <span>
            <span className="block text-[15px] font-bold">Perfil de {nome} (opcional)</span>
            <span className="block text-xs text-secondary-ink">Deixa as sugestões mais certeiras. Responda só o que souber.</span>
          </span>
        </span>
        <ChevronDown className={"size-5 shrink-0 transition-transform " + (aberto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {aberto && (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            aoAplicar(p);
            setAberto(false);
          }}
        >
          <fieldset>
            <legend className="text-xs font-semibold text-secondary-ink">Estilo das peças</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {OPCOES_ESTILO.map((o) => (
                <button key={o.rotulo} type="button" aria-pressed={(p.estilo ?? null) === o.v} onClick={() => setP({ ...p, estilo: o.v })} className={chip((p.estilo ?? null) === o.v)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold text-secondary-ink">Idade</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {OPCOES_IDADE.map((o) => (
                <button key={o.v} type="button" aria-pressed={p.idade === o.v} onClick={() => setP({ ...p, idade: p.idade === o.v ? null : o.v })} className={chip(p.idade === o.v)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-secondary-ink">
              Tamanho de roupa
              <select value={p.roupa ?? ""} onChange={(e) => setP({ ...p, roupa: e.target.value || null })} className="h-11 rounded-xl border border-border bg-card px-3 text-base text-foreground">
                <option value="">Não sei</option>
                {ROUPAS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-secondary-ink">
              Calçado
              <select value={p.calcado ?? ""} onChange={(e) => setP({ ...p, calcado: e.target.value || null })} className="h-11 rounded-xl border border-border bg-card px-3 text-base text-foreground">
                <option value="">Não sei</option>
                {Array.from({ length: 14 }, (_, k) => String(33 + k)).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-secondary-ink">
            Gostos e estilo
            <input
              value={p.gostos ?? ""}
              onChange={(e) => setP({ ...p, gostos: e.target.value.slice(0, 120) })}
              className="h-11 rounded-xl border border-border bg-card px-3 text-base text-foreground"
              placeholder="Ex.: cores neutras, café, yoga, romances de suspense"
            />
          </label>
          <div>
            <button type="submit" className="min-h-11 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white">
              Atualizar sugestões
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
