import { Link } from "@tanstack/react-router";

import { AUTOR_CARGO, AUTOR_NOME } from "@/lib/autor";

/** Visible author line on editorial pages (E-E-A-T, 13/11/2026). */
export function AssinaturaAutor({
  publicado,
  atualizado,
  verificado,
}: {
  publicado?: string | undefined;
  atualizado?: string | undefined;
  /** Date the prices in the text were captured, when the page has prices. */
  verificado?: string | undefined;
}) {
  return (
    <div className="not-prose flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradiente-conteudo)] text-sm font-extrabold text-white"
      >
        WM
      </span>
      <div className="min-w-0 text-xs leading-relaxed text-secondary-ink">
        <p>
          Por{" "}
          <Link to="/sobre" className="font-bold text-foreground hover:text-ml-blue">
            {AUTOR_NOME}
          </Link>
          , {AUTOR_CARGO.charAt(0).toLowerCase() + AUTOR_CARGO.slice(1)}
        </p>
        <p>
          {publicado && <>Publicado em {publicado}</>}
          {publicado && atualizado && atualizado !== publicado && (
            <> · Atualizado em {atualizado}</>
          )}
          {verificado && <> · Última verificação de preços: {verificado}</>}
        </p>
      </div>
    </div>
  );
}
