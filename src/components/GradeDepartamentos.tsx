/* EXPLORE POR CATEGORIA NA HOME (Weslei, 27/10: vitrine com critério
   objetivo). Os departamentos da árvore em ordem de quantos produtos têm
   agora (em_alta_contagem_nos), os 10 maiores; departamento vazio não
   aparece. Enquanto a contagem não chega, a ordem da árvore. Brinquedos
   abre a página própria (/brinquedos, por idade). */
import { useEffect, useState } from "react";

import { CartaoCategoria } from "@/components/CartaoCategoria";
import { DEPARTAMENTOS, subarvore } from "@/content/taxonomia";
import { supabase } from "@/integrations/supabase/client";

const MAXIMO = 10;

export function GradeDepartamentos() {
  const [contagem, setContagem] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    void supabase.rpc("em_alta_contagem_nos" as never).then(({ data }) => {
      if (Array.isArray(data))
        setContagem(
          Object.fromEntries(
            (data as Array<{ categoria_no: string; total: number }>).map((r) => [
              r.categoria_no,
              r.total,
            ]),
          ),
        );
    });
  }, []);
  const total = (slug: string) =>
    contagem ? subarvore(slug).reduce((s, x) => s + (contagem[x] ?? 0), 0) : 0;
  const lista = contagem
    ? DEPARTAMENTOS.filter((d) => total(d.slug) > 0).sort((a, b) => total(b.slug) - total(a.slug))
    : DEPARTAMENTOS;

  return (
    <ul className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
      {lista.slice(0, MAXIMO).map((d) => (
        <li key={d.slug} className="w-[42%] shrink-0 snap-start sm:w-auto">
          <CartaoCategoria
            slug={d.slug}
            nome={d.nome}
            paginaPropria={d.slug === "brinquedos"}
            total={contagem ? total(d.slug) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
