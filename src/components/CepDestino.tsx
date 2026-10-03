import { useEffect, useState } from "react";

/* CEP AUTOMÁTICO E TRANSPARENTE (Weslei, 02/10). A região sai do IP
   (/api/public/regiao, sem gravar nada) e fica no navegador; o cliente troca
   quando quiser (ViaCEP completa cidade/UF). O CEP vai no pedido e o frete é
   simulado no servidor pela API oficial: a extensão nunca muda endereço nem
   CEP da conta de afiliado. */

export type Regiao = {
  /* Bairro: só com CEP informado ou localização do aparelho. */
  bairro?: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string;
  aproximado: boolean;
  /* Referência nacional (São Paulo) quando o IP não diz a região. */
  padrao?: boolean;
};

/* Sempre há uma região na tela (02/10): sem IP mapeado nem CEP salvo, vale a
   referência nacional, com o aviso para o cliente informar o dele. */
const PADRAO: Regiao = {
  cidade: "São Paulo",
  uf: "SP",
  cep: "01001-000",
  aproximado: true,
  padrao: true,
};

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

/** CEP → bairro, cidade e UF (ViaCEP). */
async function consultarCep(d: string): Promise<Regiao | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
      signal: AbortSignal.timeout(6000),
    });
    const j = (await r.json()) as {
      bairro?: string;
      localidade?: string;
      uf?: string;
      erro?: boolean | string;
    };
    if (!r.ok || j.erro) return null;
    return {
      bairro: j.bairro?.trim() || null,
      cidade: j.localidade ?? null,
      uf: j.uf ?? null,
      cep: formatarCep(d),
      aproximado: false,
    };
  } catch {
    return null;
  }
}

/* LOCALIZAÇÃO DO APARELHO (03/10: "a ideia é o bairro/município/cidade"):
   só quando o cliente toca no botão e permite. As coordenadas viram endereço
   no OpenStreetMap (direto do navegador, nada passa pelo servidor) e o CEP é
   confirmado no ViaCEP. */
async function regiaoPeloAparelho(): Promise<Regiao | null> {
  const pos = await new Promise<GeolocationPosition | null>((ok) => {
    if (!("geolocation" in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition(ok, () => ok(null), {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    });
  });
  if (!pos) return null;
  try {
    const { latitude: lat, longitude: lon } = pos.coords;
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const j = (await r.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = j.address ?? {};
    if ((a["country_code"] ?? "").toLowerCase() !== "br") return null;
    const d = (a["postcode"] ?? "").replace(/\D/g, "");
    const bairro = a["suburb"] ?? a["neighbourhood"] ?? a["quarter"] ?? a["city_district"] ?? null;
    const cidade = a["city"] ?? a["town"] ?? a["municipality"] ?? a["village"] ?? null;
    const uf = (a["ISO3166-2-lvl4"] ?? "").replace(/^BR-/, "") || null;
    if (d.length === 8) {
      const v = await consultarCep(d);
      if (v) return { ...v, bairro: v.bairro || bairro };
    }
    return null;
  } catch {
    return null;
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
        if (!vivo) return;
        if (!j?.cep || j.padrao) {
          /* Padrão não fica salvo: na próxima visita tenta o IP de novo. */
          setRegiao(PADRAO);
          return;
        }
        const r: Regiao = {
          cidade: j.cidade ?? null,
          uf: j.uf ?? null,
          cep: j.cep,
          aproximado: true,
        };
        gravar(r);
        setRegiao(r);
      })
      .catch(() => {
        if (vivo) setRegiao(PADRAO);
      });
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
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro" | "localizando" | "semLocal">(
    "parado",
  );

  async function confirmar() {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) {
      setEstado("erro");
      return;
    }
    setEstado("buscando");
    const v = await consultarCep(d);
    if (!v) {
      setEstado("erro");
      return;
    }
    trocar(v);
    setAberto(false);
    setEstado("parado");
  }

  async function usarLocalizacao() {
    setEstado("localizando");
    const v = await regiaoPeloAparelho();
    if (!v) {
      setEstado("semLocal");
      return;
    }
    trocar(v);
    setAberto(false);
    setEstado("parado");
  }

  const onde = regiao
    ? `${regiao.bairro ? `${regiao.bairro}, ` : ""}${
        regiao.cidade && regiao.uf ? `${regiao.cidade}/${regiao.uf} ` : ""
      }(${regiao.cep})`
    : "informe seu CEP";
  return (
    <div className="mt-2 text-xs text-secondary-ink">
      <span aria-hidden>📍</span> Frete para:{" "}
      <span className="font-semibold text-foreground">{onde}</span>
      {regiao?.padrao ? (
        <span> · padrão, informe o seu</span>
      ) : (
        regiao?.aproximado && <span> · aproximado</span>
      )}{" "}
      ·{" "}
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
          <button
            type="button"
            onClick={() => void usarLocalizacao()}
            disabled={estado === "localizando"}
            className="rounded-md border border-ml-blue px-3 py-1 text-xs font-bold text-ml-blue disabled:opacity-60"
          >
            {estado === "localizando" ? "Localizando..." : "📍 Usar minha localização"}
          </button>
          {estado === "erro" && (
            <span className="text-red-700 dark:text-red-400">CEP não encontrado.</span>
          )}
          {estado === "semLocal" && (
            <span className="text-red-700 dark:text-red-400">
              Não deu para achar sua localização. Digite o CEP.
            </span>
          )}
        </form>
      )}
    </div>
  );
}
