/* FAIXA DE ARTE DA CATEGORIA (Weslei, 09/10: "todas as vitrines precisam
   de artes; mantenha a identidade das artes"): a arte da categoria
   (src/lib/artes.ts) numa faixa baixa acima dos cartões, sem texto por
   cima (nada de texto sobre foto no celular), com link para a página da
   categoria. Sem arte cadastrada, não aparece. */
import { Link } from "@tanstack/react-router";

import { arteDaCategoria, srcArte, srcSetArte } from "@/lib/artes";
import { CATEGORIAS } from "@/content/categorias";

export function FaixaArte({ slug, className = "" }: { slug: string | null; className?: string }) {
  const arte = arteDaCategoria(slug);
  const cat = CATEGORIAS.find((c) => c.slug === slug);
  if (!arte || !cat) return null;
  return (
    <Link
      to="/categorias/$slug"
      params={{ slug: cat.slug }}
      aria-label={`Ver a página de ${cat.nome}`}
      className={
        "group relative mt-3 block h-24 overflow-hidden rounded-3xl bg-[#f5f5f7] shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:h-32 " +
        className
      }
    >
      <img
        src={srcArte(arte.id, true)}
        srcSet={srcSetArte(arte.id)}
        sizes="(min-width: 1280px) 1200px, 100vw"
        alt=""
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
        style={{ objectPosition: arte.foco }}
      />
    </Link>
  );
}
