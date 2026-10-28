/* FAIXA DE ARTE DA CATEGORIA (Weslei, 09/10: "todas as vitrines precisam
   de artes; mantenha a identidade das artes"): a arte da categoria
   (src/lib/artes.ts) numa faixa baixa acima dos cartões, sem texto por
   cima (nada de texto sobre foto no celular), com link para a página da
   categoria. 27/10 (nenhuma vitrine sem arte): sem arte da categoria, ou
   com uma arte dada (vitrine geral, busca), a faixa sai sem link; a
   padrão é a neutra de economia. */
import { Link } from "@tanstack/react-router";

import { ARTE_NEUTRA, arteDaCategoria, srcArte, srcSetArte, type Arte } from "@/lib/artes";
import { CATEGORIAS } from "@/content/categorias";

const CLASSE =
  "group relative mt-3 block h-24 overflow-hidden rounded-3xl bg-[#f5f5f7] shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:h-32 ";

export function FaixaArte({
  slug = null,
  arte: dada,
  className = "",
}: {
  slug?: string | null;
  arte?: Arte;
  className?: string;
}) {
  const daCategoria = dada ? null : arteDaCategoria(slug);
  const arte = dada ?? daCategoria ?? ARTE_NEUTRA;
  const cat = daCategoria ? CATEGORIAS.find((c) => c.slug === slug) : undefined;
  const img = (
    <img
      src={arte.src ?? srcArte(arte.id, true)}
      srcSet={arte.src ? undefined : srcSetArte(arte.id)}
      sizes="(min-width: 1280px) 1200px, 100vw"
      alt=""
      width={1280}
      height={720}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
      style={{ objectPosition: arte.foco }}
    />
  );
  return cat ? (
    <Link
      to="/categorias/$slug"
      params={{ slug: cat.slug }}
      aria-label={`Ver a página de ${cat.nome}`}
      className={CLASSE + className}
    >
      {img}
    </Link>
  ) : (
    <div aria-hidden="true" className={CLASSE + className}>
      {img}
    </div>
  );
}
