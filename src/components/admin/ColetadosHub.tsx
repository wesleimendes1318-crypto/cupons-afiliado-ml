/* /admin: what the hub collector sent and where each item landed
   (Weslei 07/11/2026). Founder-only data (hub_coletados_fundador). */
import { ExternalLink, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  carregarColetados,
  contarPorStatus,
  ondeNoSite,
  ORDEM_STATUS,
  precoBR,
  STATUS,
  type Coletado,
  type StatusColetado,
} from "@/lib/hub-coletados";

const PAGINA = 40;

export function ColetadosHub() {
  const [lista, setLista] = useState<Coletado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusColetado | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [ver, setVer] = useState(PAGINA);

  const carregar = useCallback(() => {
    setErro(null);
    carregarColetados()
      .then(setLista)
      .catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const contagem = useMemo(() => contarPorStatus(lista ?? []), [lista]);
  const vistos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista ?? []).filter(
      (c) =>
        (filtro === "todos" || c.status === filtro) &&
        (!t || `${c.titulo ?? ""} ${c.item}`.toLowerCase().includes(t)),
    );
  }, [lista, filtro, busca]);

  return (
    <section className="mt-4 min-w-0 rounded-3xl bg-white p-5 shadow-sm animate-cartao">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#1d1d1f]">Coletados do Hub</h2>
          <p className="text-xs text-[#86868b]">
            Tudo o que o coletor enviou: status, seu link meli.la e onde aparece no site.
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          aria-label="Atualizar lista"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0071e3] transition hover:bg-[#e8e8ed] active:scale-95"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {erro ? (
        <p className="mt-4 rounded-2xl bg-[#ff3b30]/10 px-4 py-3 text-sm text-[#c4281c]">
          Não consegui ler a lista: {erro}
        </p>
      ) : !lista ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#6e6e73]">
          <LoaderCircle className="size-4 animate-spin" /> Carregando…
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por status">
            <Chip ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
              Todos · {lista.length}
            </Chip>
            {ORDEM_STATUS.filter((s) => contagem[s] > 0).map((s) => (
              <Chip
                key={s}
                ativo={filtro === s}
                onClick={() => setFiltro(s)}
                titulo={STATUS[s].dica}
              >
                {STATUS[s].rotulo} · {contagem[s]}
              </Chip>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-full border border-[#e5e5ea] px-3 py-1.5 focus-within:border-[#0071e3]">
            <Search className="size-3.5 text-[#86868b]" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setVer(PAGINA);
              }}
              placeholder="Buscar por nome ou MLB…"
              aria-label="Buscar nos coletados"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          {filtro !== "todos" && (
            <p className="mt-2 text-xs text-[#6e6e73]">{STATUS[filtro].dica}</p>
          )}

          {!vistos.length ? (
            <p className="mt-6 text-sm text-[#6e6e73]">Nada por aqui.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#f0f0f2]">
              {vistos.slice(0, ver).map((c) => (
                <LinhaColetado key={c.item} c={c} />
              ))}
            </ul>
          )}
          {vistos.length > ver && (
            <button
              type="button"
              onClick={() => setVer((v) => v + PAGINA)}
              className="mt-3 w-full rounded-full bg-[#f5f5f7] py-2 text-sm font-semibold text-[#0071e3] transition hover:bg-[#e8e8ed]"
            >
              Mostrar mais ({vistos.length - ver})
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Chip({
  ativo,
  onClick,
  titulo,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={ativo}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
        ativo ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
      }`}
    >
      {children}
    </button>
  );
}

function LinhaColetado({ c }: { c: Coletado }) {
  const s = STATUS[c.status];
  const site = ondeNoSite(c);
  const meta = [
    c.avaliacao != null && `★ ${String(c.avaliacao).replace(".", ",")}`,
    c.vendidos,
    c.comissao_pct != null && `ganhos ${String(c.comissao_pct).replace(".", ",")}%`,
    c.mais_vendido && "mais vendido",
  ].filter(Boolean);
  return (
    <li className="flex min-w-0 gap-3 py-3">
      {c.imagem ? (
        <img
          src={c.imagem}
          alt=""
          loading="lazy"
          className="size-14 shrink-0 rounded-2xl bg-[#f5f5f7] object-contain"
        />
      ) : (
        <div className="size-14 shrink-0 rounded-2xl bg-[#f5f5f7]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 break-words text-sm font-medium text-[#1d1d1f]">
            {c.titulo ?? c.item}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cor}`}
            title={s.dica}
          >
            {s.rotulo}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[#6e6e73]">
          <span className="font-semibold text-[#1d1d1f]">{precoBR(c.preco)}</span>
          {c.desconto_pct ? ` · ${c.desconto_pct}% OFF` : ""}
          {meta.length ? ` · ${meta.join(" · ")}` : ""}
        </p>
        {c.status === "falhou" && c.erro && (
          <p className="mt-0.5 break-words text-xs text-[#c4281c]">{c.erro.slice(0, 160)}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
          {site && (
            <>
              <Externo href={site.resultado}>Ver no site</Externo>
              <Externo href={site.vitrine}>Vitrine: {site.nomeVitrine}</Externo>
            </>
          )}
          {c.link && <Externo href={c.link}>{c.link.replace("https://", "")}</Externo>}
          <Externo href={c.url} cinza>
            {c.item}
          </Externo>
        </div>
      </div>
    </li>
  );
}

function Externo({
  href,
  cinza,
  children,
}: {
  href: string;
  cinza?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 ${cinza ? "text-[#86868b]" : "text-[#0071e3]"} hover:underline`}
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}
