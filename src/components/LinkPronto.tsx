/* LINK DE AFILIADO DEVOLVIDO E COPIADO (Weslei, 02/11: "sempre que o link
   for colado pelo usuário, deve devolver o link afiliado no próprio site e
   já copiar automaticamente o meu link afiliado"). Mostra o link pronto
   (só link de afiliado: meli.la, Amazon com a tag, Shopee do painel) e
   copia uma vez por link assim que ele chega. O navegador pode recusar a
   cópia sem toque (Safari): aí fica o botão "Copiar link". */
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { ehLinkDeCompra } from "@/lib/afiliado";

const jaCopiados = new Set<string>();

type Estado = "copiado" | "manual" | "copiar";

export function LinkPronto({
  link,
  className = "",
}: {
  link: string | null | undefined;
  className?: string;
}) {
  const valido = ehLinkDeCompra(link) ? link : null;
  const [estado, setEstado] = useState<Estado>("copiar");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copiar(auto: boolean) {
    if (!valido) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sem");
      await navigator.clipboard.writeText(valido);
      setEstado("copiado");
      if (!auto) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setEstado("copiar"), 2500);
      }
    } catch {
      setEstado(auto ? "manual" : "copiar");
    }
  }

  useEffect(() => {
    if (!valido) return;
    if (jaCopiados.has(valido)) {
      setEstado("copiar");
      return;
    }
    jaCopiados.add(valido);
    void copiar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valido]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!valido) return null;

  /* Inline pill (13/11 redesign): the link and the copy button, no heavy box. */
  return (
    <div
      className={
        "mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/60 py-1 pl-3 pr-1 ring-1 ring-border/60 " +
        className
      }
      data-link-pronto
    >
      <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <a
        href={valido}
        target="_blank"
        rel="noopener sponsored"
        data-origem="link_pronto"
        aria-label={`Link para comprar com segurança: ${valido.replace(/^https?:\/\//, "")}`}
        className="min-w-0 truncate text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        {valido.replace(/^https?:\/\//, "")}
      </a>
      <button
        type="button"
        onClick={() => void copiar(false)}
        aria-live="polite"
        aria-label={estado === "copiado" ? "Link copiado" : "Copiar link"}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      >
        {estado === "copiado" ? (
          <>
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden="true" />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}
