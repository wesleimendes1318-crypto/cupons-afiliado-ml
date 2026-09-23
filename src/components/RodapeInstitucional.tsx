import { Link } from "@tanstack/react-router";

import { abrirPreferencias } from "@/lib/consentimento";

const PAGINAS = [
  { to: "/sobre", rotulo: "Sobre o site" },
  { to: "/guias", rotulo: "Guias" },
  { to: "/divulgacao-de-afiliados", rotulo: "Divulgação de afiliados" },
  { to: "/politica-de-privacidade", rotulo: "Privacidade" },
  { to: "/politica-de-cookies", rotulo: "Cookies" },
  { to: "/termos-de-uso", rotulo: "Termos de uso" },
  { to: "/contato", rotulo: "Contato" },
] as const;

/** Aviso curto de relação comercial. Aparece perto de qualquer lista de ofertas. */
export function AvisoAfiliado({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-secondary-ink"}>
      Este site pode receber comissão por compras feitas através de determinados links. O
      preço que você paga não aumenta por causa disso.{" "}
      <Link to="/divulgacao-de-afiliados" className="font-semibold text-ml-blue hover:underline">
        Saiba como funciona
      </Link>
      .
    </p>
  );
}

export function RodapeInstitucional() {
  return (
    <footer className="mt-12 border-t-2 border-[color-mix(in_oklab,var(--ml-blue)_30%,var(--border))] bg-[color-mix(in_oklab,var(--ml-blue)_5%,var(--card))]">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Páginas institucionais" className="flex flex-wrap gap-x-5 gap-y-2">
          {PAGINAS.map((pagina) => (
            <Link
              key={pagina.to}
              to={pagina.to}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-secondary-ink transition-colors hover:bg-ml-blue hover:text-ml-blue-foreground"
            >
              {pagina.rotulo}
            </Link>
          ))}
          <button
            type="button"
            onClick={abrirPreferencias}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-secondary-ink transition-colors hover:bg-ml-blue hover:text-ml-blue-foreground"
          >
            Preferências de cookies
          </button>
        </nav>

        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <AvisoAfiliado />
          <p className="text-xs text-secondary-ink">
            Site independente, feito por um participante do programa de afiliados. Não é um
            site oficial de nenhuma loja ou marketplace, nem tem vínculo, patrocínio ou
            aprovação de qualquer um deles.
          </p>
          <p className="text-xs text-secondary-ink">
            Preços, estoque, frete e condições de cupom mudam a qualquer momento e devem ser
            conferidos na página da loja antes de comprar.
          </p>
        </div>
      </div>
    </footer>
  );
}
