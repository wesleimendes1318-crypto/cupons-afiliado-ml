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

export function LinkPronto({ link, className = "" }: { link: string | null | undefined; className?: string }) {
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

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!valido) return null;

  return (
    <div
      className={
        "mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/50 px-3 py-2 " +
        className
      }
      data-link-pronto
    >
      <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Link para comprar com segurança
        </p>
        <a
          href={valido}
          target="_blank"
          rel="noopener sponsored"
          data-origem="link_pronto"
          className="block truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          {valido.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <button
        type="button"
        onClick={() => void copiar(false)}
        aria-live="polite"
        className="vidro-botao inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground"
      >
        {estado === "copiado" ? (
          <>
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            Link copiado
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden="true" />
            {estado === "manual" ? "Toque para copiar" : "Copiar link"}
          </>
        )}
      </button>
    </div>
  );
}
