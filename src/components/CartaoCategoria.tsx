/* Cartão de categoria com a arte (09/10): miniatura enquadrada nos objetos
   da arte e o nome abaixo. Usado em "Explore por categoria" (home), na
   lista de categorias e em "Outras categorias". Sem arte, ícone neutro. */
import { Link } from "@tanstack/react-router";
import { ChevronRight, ShoppingBag } from "lucide-react";

import { arteDaCategoria, srcArte } from "@/lib/artes";

export function CartaoCategoria({
  slug,
  nome,
  /* Brinquedos tem página própria (/brinquedos, por idade). */
  paginaPropria = false,
  className = "",
}: {
  slug: string;
  nome: string;
  paginaPropria?: boolean;
  className?: string;
}) {
  const arte = arteDaCategoria(slug);
  const classe =
    "group flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
    className;
  const conteudo = (
    <>
      <span className="relative block aspect-[4/3] overflow-hidden bg-[#f5f5f7] dark:bg-white/5">
        {arte ? (
          <img
            src={srcArte(arte.id, true)}
            width={1280}
            height={720}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
            style={{ objectPosition: arte.focoCelular }}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[#7547E8]">
            <ShoppingBag className="size-8" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2 px-3.5 py-3">
        <span className="text-sm font-bold leading-snug text-foreground sm:text-[15px]">
          {nome}
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-[#7547E8] transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </>
  );
  return paginaPropria ? (
    <Link to="/brinquedos" className={classe}>
      {conteudo}
    </Link>
  ) : (
    <Link to="/categorias/$slug" params={{ slug }} className={classe}>
      {conteudo}
    </Link>
  );
}
