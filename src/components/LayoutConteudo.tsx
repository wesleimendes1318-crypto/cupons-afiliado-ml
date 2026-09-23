import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3 } from "lucide-react";
import type { ReactNode } from "react";

import { RodapeInstitucional } from "@/components/RodapeInstitucional";

export function LayoutConteudo({
  titulo,
  resumo,
  atualizacao,
  etiqueta,
  trilha,
  children,
}: {
  titulo: string;
  resumo?: string;
  atualizacao?: string;
  /** Rótulo curto exibido acima do título, dentro de uma pílula. */
  etiqueta?: string;
  /** Links de navegação exibidos logo abaixo do título, dentro da faixa. */
  trilha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fundo-conteudo min-h-screen">
      <header className="faixa-conteudo">
        <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Voltar para os cupons
            </Link>
          </div>

          {etiqueta && (
            <p className="animate-conteudo mt-5 inline-block rounded-full bg-ml-yellow px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ml-yellow-foreground">
              {etiqueta}
            </p>
          )}

          <h1 className="animate-conteudo mt-3 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            {titulo}
          </h1>

          {resumo && (
            <p
              className="animate-conteudo mt-3 max-w-2xl text-base text-white/90"
              style={{ animationDelay: "60ms" }}
            >
              {resumo}
            </p>
          )}

          <div
            className="animate-conteudo mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/80"
            style={{ animationDelay: "110ms" }}
          >
            {atualizacao && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                Última atualização: {atualizacao}
              </span>
            )}
            {trilha}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
        <div
          className="animate-conteudo -mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8"
          style={{ animationDelay: "150ms" }}
        >
          <div className="space-y-6 text-sm leading-relaxed text-secondary-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:marker:font-bold [&_ol]:marker:text-ml-blue [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-ml-blue">
            {children}
          </div>
        </div>
      </main>

      <RodapeInstitucional />
    </div>
  );
}
