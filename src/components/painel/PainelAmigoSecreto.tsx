/* Secret Santa on this device (same state as /amigo-secreto, which also syncs
   it with the account). Only names and progress here; choosing gifts stays on
   the full page, where every buy button carries the affiliate link. */
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Gift } from "lucide-react";
import { useEffect, useState } from "react";

import { BarraProgresso } from "@/components/painel/animacao";
import { lerLocal } from "@/lib/amigo-secreto-estado";
import type { EstadoAmigoSecreto } from "@/lib/amigo-secreto-tipos";

export function useAmigoSecreto(): EstadoAmigoSecreto | null {
  const [e, setE] = useState<EstadoAmigoSecreto | null>(null);
  useEffect(() => setE(lerLocal()), []);
  return e;
}

export function PainelAmigoSecreto({ estado }: { estado: EstadoAmigoSecreto | null }) {
  if (estado == null) return null;
  const amigos = estado.amigos;
  if (!amigos.length)
    return (
      <div className="animate-cartao rounded-3xl bg-[#f5f5f7] p-5 text-center dark:bg-white/5">
        <p className="font-semibold text-foreground">Nenhum amigo secreto ainda.</p>
        <p className="mt-1">Cole o que a pessoa gosta e eu monto as vitrines dentro do orçamento.</p>
        <Link
          to="/amigo-secreto"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white"
        >
          Começar amigo secreto
        </Link>
      </div>
    );
  const comprados = amigos.filter((a) => a.comprado).length;
  return (
    <div className="space-y-3">
      <div className="animate-cartao rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">
          {comprados} de {amigos.length} presentes comprados
        </p>
        <div className="mt-2">
          <BarraProgresso pct={(comprados / amigos.length) * 100} cor="#34c759" rotulo="Presentes comprados" />
        </div>
        {estado.dataFesta && (
          <p className="mt-2 text-xs">
            Festa em {new Date(`${estado.dataFesta}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
      <ul className="!ml-0 !list-none !pl-0 grid gap-2 sm:grid-cols-2">
        {amigos.map((a, k) => (
          <li key={a.id} className="animate-cartao" style={{ animationDelay: `${(k + 1) * 50}ms` }}>
            <Link
              to="/amigo-secreto"
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:bg-muted active:scale-[0.99]"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${a.comprado ? "bg-[#34c759] text-white" : "bg-[#f5f5f7] text-[#0071e3] dark:bg-white/10"}`}
              >
                {a.comprado ? <Check className="size-4" aria-hidden /> : <Gift className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{a.nome || "Sem nome"}</span>
                <span className="block text-xs">
                  {a.comprado
                    ? "Presente comprado"
                    : `${a.favoritos?.length ?? 0} ${(a.favoritos?.length ?? 0) === 1 ? "ideia salva" : "ideias salvas"}`}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
