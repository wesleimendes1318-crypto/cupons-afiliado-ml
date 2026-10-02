import { useEffect, useState } from "react";

/* CEP AUTOMÁTICO E TRANSPARENTE (Weslei, 02/10). A região sai do IP
   (/api/public/regiao, sem gravar nada) e fica no navegador; o cliente troca
   quando quiser (ViaCEP completa cidade/UF). O CEP vai no pedido e o frete é
   simulado no servidor pela API oficial: a extensão nunca muda endereço nem
   CEP da conta de afiliado. */

export type Regiao = { cidade: string | null; uf: string | null; cep: string; aproximado: boolean };

const CHAVE = "melhorescolha:cep";

function ler(): Regiao | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Regiao | null;
    return v && /^\d{5}-\d{3}$/.test(v.cep) ? v : null;
  } catch {
    return null;
  }
}

function gravar(r: Regiao) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export const formatarCep = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** Região do cliente: do navegador; senão, a aproximada pelo IP. */
export function useCepDestino(ativo: boolean) {
  const [regiao, setRegiao] = useState<Regiao | null>(null);
  useEffect(() => {
    if (!ativo) return;
    const salva = ler();
    if (salva) {
      setRegiao(salva);
      return;
    }
    let vivo = true;
    fetch("/api/public/regiao")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Partial<Regiao> | null) => {
        if (!vivo || !j?.cep) return;
        const r: Regiao = {
          cidade: j.cidade ?? null,
          uf: j.uf ?? null,
          cep: j.cep,
          aproximado: true,
        };
        gravar(r);
        setRegiao(r);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ativo]);
  const trocar = (r: Regiao) => {
    gravar(r);
    setRegiao(r);
  };
  return { regiao, trocar };
}

/** Selo "📍 Frete para: Cidade/UF (CEP) · Alterar", com a troca do CEP. */
export function SeloCep({
  regiao,
  trocar,
}: {
  regiao: Regiao | null;
  trocar: (r: Regiao) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState("");
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");

  async function confirmar() {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) {
      setEstado("erro");
      return;
    }
    setEstado("buscando");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
        signal: AbortSignal.timeout(6000),
      });
      const j = (await r.json()) as { localidade?: string; uf?: string; erro?: boolean | string };
      if (!r.ok || j.erro) throw new Error("cep");
      trocar({
        cidade: j.localidade ?? null,
        uf: j.uf ?? null,
        cep: formatarCep(d),
        aproximado: false,
      });
      setAberto(false);
      setEstado("parado");
    } catch {
      setEstado("erro");
    }
  }

  const onde = regiao
    ? `${regiao.cidade && regiao.uf ? `${regiao.cidade}/${regiao.uf} ` : ""}(${regiao.cep})`
    : "informe seu CEP";
  return (
    <div className="mt-2 text-xs text-secondary-ink">
      <span aria-hidden>📍</span> Frete para:{" "}
      <span className="font-semibold text-foreground">{onde}</span>
      {regiao?.aproximado && <span> · aproximado</span>} ·{" "}
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className="font-bold text-ml-blue hover:underline"
      >
        {regiao ? "Alterar" : "Informar CEP"}
      </button>
      {aberto && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmar();
          }}
        >
          <label className="sr-only" htmlFor="cep-destino">
            CEP
          </label>
          <input
            id="cep-destino"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => {
              setCep(formatarCep(e.target.value));
              setEstado("parado");
            }}
            className="w-28 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={estado === "buscando"}
            className="rounded-md bg-ml-blue px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            {estado === "buscando" ? "Buscando..." : "Usar este CEP"}
          </button>
          {estado === "erro" && (
            <span className="text-red-700 dark:text-red-400">CEP não encontrado.</span>
          )}
        </form>
      )}
    </div>
  );
}
