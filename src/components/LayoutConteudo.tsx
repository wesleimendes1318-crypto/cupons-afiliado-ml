import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { RodapeInstitucional } from "@/components/RodapeInstitucional";

export function LayoutConteudo({
  titulo,
  resumo,
  atualizacao,
  children,
}: {
  titulo: string;
  resumo?: string;
  atualizacao?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm font-semibold text-ml-blue hover:underline">
          ← Voltar para os cupons
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{titulo}</h1>
        {resumo && <p className="mt-2 text-base text-secondary-ink">{resumo}</p>}
        {atualizacao && (
          <p className="mt-2 text-xs text-secondary-ink">Última atualização: {atualizacao}</p>
        )}

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-secondary-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </div>

      <RodapeInstitucional />
    </div>
  );
}
