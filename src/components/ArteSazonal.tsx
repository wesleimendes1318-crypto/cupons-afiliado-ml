/* VITRINE DE FOTOS DAS CAMPANHAS (Weslei, 05/10: "mantenha clean", "está
   feio com essas artes", "melhore a dimensão das artes dos produtos"; a
   referência de produtos em pedestais é para os PRODUTOS). No lugar das
   ilustrações, as fotos reais dos produtos já comparados da campanha, cada
   uma num disco branco com sombra suave (o "pedestal"), o maior no centro.
   Sem produto, nada (sem arte genérica). Só decoração (aria-hidden): o
   produto de verdade, com preço e botão, está logo abaixo na grade. */

const foto = (u: string) =>
  u.replace(/^http:/, "https:").replace(/-[A-Z](\.(?:webp|jpg|jpeg|png))$/i, "-O$1");

export function VitrineDeFotos({
  fotos,
  className = "",
}: {
  fotos: Array<string | null | undefined>;
  className?: string;
}) {
  const lista = fotos.filter((f): f is string => !!f && /^https?:\/\//.test(f)).slice(0, 3);
  if (!lista.length) return null;
  /* Com 3, a primeira (maior economia) fica no centro e maior. */
  const ordem = lista.length === 3 ? [lista[1]!, lista[0]!, lista[2]!] : lista;
  const centro = lista.length === 3 ? 1 : 0;
  return (
    <div
      className={`pointer-events-none relative flex items-end justify-center ${className}`}
      aria-hidden="true"
    >
      <span className="absolute bottom-0 left-1/2 h-4 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/15 blur-md" />
      {ordem.map((src, i) => (
        <span
          key={src + i}
          className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5 ${
            i === centro
              ? "campanha-flutua z-10 size-32 lg:size-36"
              : "-mx-3 mb-1 size-20 lg:size-24"
          }`}
        >
          <img
            src={foto(src)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-[78%] object-contain"
          />
        </span>
      ))}
    </div>
  );
}
