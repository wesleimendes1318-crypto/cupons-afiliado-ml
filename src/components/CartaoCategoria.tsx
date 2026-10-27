/* Cartão de categoria com a arte (09/10): miniatura enquadrada nos objetos
   da arte e o nome abaixo. Usado em "Explore por categoria" (home), na
   lista de categorias e em "Outras categorias".
   27/10 (Weslei: "nenhuma categoria deve exibir o ícone roxo vazio"): sem
   arte própria, a foto real do produto mais vendido do departamento, em
   quadro branco; sem produto, a arte neutra. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { NOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";
import { ARTE_NEUTRA, arteDaCategoria, arteSalva, srcArte } from "@/lib/artes";
import { useArteSalva } from "@/lib/artes-salvas";
import { propsFotoCartao } from "@/lib/foto";

/* Foto do 1º da lista de mais vendidos do nó (undefined: lendo). */
function useFotoDoNo(slug: string, ativo: boolean) {
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void supabase
      .rpc("em_alta_por_no" as never, { p_nos: subarvore(slug), p_limite: 1 } as never)
      .then(({ data }) => {
        const p = Array.isArray(data) ? (data as Array<{ imagem: string | null }>)[0] : null;
        if (vivo) setFoto(p?.imagem ?? null);
      });
    return () => {
      vivo = false;
    };
  }, [slug, ativo]);
  return foto;
}

export function CartaoCategoria({
  slug,
  nome,
  /* Brinquedos tem página própria (/brinquedos, por idade). */
  paginaPropria = false,
  total,
  className = "",
}: {
  slug: string;
  nome: string;
  paginaPropria?: boolean;
  /* Quantos produtos a categoria tem (lista de categorias, 27/10). */
  total?: number | undefined;
  className?: string;
}) {
  /* Arte do acervo; senão a gerada para o departamento; senão a foto real. */
  const salva = useArteSalva(`dep:${slug}`);
  const propria =
    arteDaCategoria(slug) ?? (salva ? arteSalva(salva, NOS[slug]?.nome ?? nome) : null);
  const foto = useFotoDoNo(slug, !propria);
  const arte = propria ?? (foto === null ? ARTE_NEUTRA : null);
  const classe =
    "group flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] " +
    className;
  const conteudo = (
    <>
      <span className="relative block aspect-[4/3] overflow-hidden bg-[#f5f5f7] dark:bg-white/5">
        {arte ? (
          <img
            src={arte.src ?? srcArte(arte.id, true)}
            width={1280}
            height={720}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
            style={{ objectPosition: arte.focoCelular }}
          />
        ) : foto ? (
          <span className="absolute inset-0 bg-white">
            <img
              {...propsFotoCartao(foto)}
              width={300}
              height={300}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
            />
          </span>
        ) : (
          <span className="absolute inset-0 animate-pulse bg-white" aria-hidden="true" />
        )}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2 px-3.5 py-3">
        <span className="text-sm font-bold leading-snug text-foreground sm:text-[15px]">
          {nome}
          {total ? (
            <span className="block text-xs font-normal text-secondary-ink">
              {total.toLocaleString("pt-BR")} produtos
            </span>
          ) : null}
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
