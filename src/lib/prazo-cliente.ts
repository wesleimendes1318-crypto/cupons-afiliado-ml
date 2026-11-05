/* DATA DE ENTREGA NOS CARTÕES (05/11), lado do navegador. Cada cartão pede
   o seu anúncio; os pedidos da mesma tela se juntam em lotes de 20 para
   /api/public/prazo-itens. Guarda por CEP+anúncio enquanto a página vive. */
import { useEffect, useState } from "react";

import { useRegiaoGuardada } from "@/components/CepDestino";
import type { ResumoEntrega } from "@/lib/prazo-entrega";

/* undefined = ainda consultando; null = sem data confirmada. */
const guardados = new Map<string, ResumoEntrega | null>();
const pedidos = new Set<string>();
const ouvintes = new Set<() => void>();
const fila = new Map<string, Set<string>>();
let agendado: ReturnType<typeof setTimeout> | null = null;

const chave = (cep: string, item: string) => `${cep}|${item}`;

async function enviar(cep: string, itens: string[]) {
  let prazos: Record<string, ResumoEntrega | null> = {};
  try {
    const r = await fetch("/api/public/prazo-itens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens, cep }),
    });
    if (r.ok) prazos = ((await r.json()) as { prazos?: typeof prazos }).prazos ?? {};
  } catch {
    /* falha de rede: fica "Frete e prazo no anúncio" */
  }
  for (const it of itens) guardados.set(chave(cep, it), prazos[it] ?? null);
  ouvintes.forEach((f) => f());
}

function pedir(cep: string, item: string) {
  const k = chave(cep, item);
  if (pedidos.has(k)) return;
  pedidos.add(k);
  if (!fila.has(cep)) fila.set(cep, new Set());
  fila.get(cep)!.add(item);
  agendado ??= setTimeout(() => {
    agendado = null;
    for (const [c, itens] of fila) {
      const lista = [...itens];
      for (let i = 0; i < lista.length; i += 20) void enviar(c, lista.slice(i, i + 20));
    }
    fila.clear();
  }, 60);
}

/** CEP que vale para prazo: digitado ou pela localização do aparelho. O
    aproximado pelo IP não basta para prometer data. */
export function useCepDoPrazo(): string | null {
  const r = useRegiaoGuardada();
  return r && !r.padrao && r.aproximado === false ? r.cep : null;
}

/** Prazos dos anúncios para o CEP da tela. Sem CEP: mapa vazio. */
export function usePrazosDosItens(itens: (string | null | undefined)[]): {
  cep: string | null;
  prazos: Map<string, ResumoEntrega | null>;
} {
  const cep = useCepDoPrazo();
  const [, setVersao] = useState(0);
  const lista = [...new Set(itens.filter((i): i is string => !!i && /^MLB\d{6,}$/.test(i)))];
  const assinatura = lista.join(",");
  useEffect(() => {
    const f = () => setVersao((v) => v + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  useEffect(() => {
    if (cep) for (const it of lista) pedir(cep, it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, assinatura]);
  const prazos = new Map<string, ResumoEntrega | null>();
  if (cep)
    for (const it of lista) {
      const k = chave(cep, it);
      if (guardados.has(k)) prazos.set(it, guardados.get(k)!);
    }
  return { cep, prazos };
}

/** Abre a troca de CEP do topo (CepTopo). */
export function abrirCepTopo() {
  window.dispatchEvent(new Event("abrir-cep"));
}
