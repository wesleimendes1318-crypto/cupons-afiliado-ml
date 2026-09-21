/* BuscaPorLink — cole o link do anúncio, receba o link de afiliado do Weslei
   ============================================================================
   Por que existe um vai e vem em vez de uma chamada direta:

   O site NÃO consegue gerar link de afiliado do Mercado Livre. Isso exige a
   sessão logada do afiliado E que o POST saia de dentro de uma página do
   próprio mercadolivre.com.br (eles validam a origem). Nem o navegador do
   visitante nem o servidor conseguem fazer isso.

   Então: o site registra o pedido no banco (pedir_link), a extensão de
   navegador do Weslei pega esse pedido, resolve vendedor/preço/cupom e gera o
   link, devolve para o banco, e aqui a gente consulta até ficar pronto
   (consultar_pedido).

   Regra inegociável: em nenhuma hipótese mostramos a URL original como botão
   de compra. Mostrar a URL crua faria o Weslei perder a comissão. Se o link
   não sair, a pessoa tenta de novo em alguns minutos — nunca compra por fora.

   Não há WhatsApp aqui de propósito: o visitante resolve tudo sozinho, sem
   depender de o Weslei estar online para responder.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const INTERVALO_MS = 3000;
const LIMITE_MS = 90000;

type Cupom = {
  titulo: string | null;
  vence: string | null;
  teto: number | null;
  minimo: number | null;
  economia: number | null;
  bloqueado: boolean | null;
};

type Analise = {
  titulo: string | null;
  preco: number | null;
  vendedor: string | null;
  temCupom: boolean;
  cupom: Cupom | null;
};

type Pedido = {
  status: "pendente" | "pronto" | "falhou";
  link: string | null;
  codigo: string | null;
  erro: string | null;
  analise: Analise | null;
};

type Fase = "parado" | "limpando" | "procurando" | "gerando" | "pronto" | "offline";

const brl = (n: number | null | undefined) =>
  n == null ? null : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : null;
};

const ehLinkML = (u: string) =>
  /^https?:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)(\/|$)/i.test(u.trim());

const TEXTO_FASE: Record<Fase, string> = {
  parado: "",
  limpando: "Limpando o link...",
  procurando: "Procurando cupom real para essa loja...",
  gerando: "Gerando o link seguro...",
  pronto: "",
  offline: "",
};

export default function BuscaPorLink() {
  const [url, setUrl] = useState("");
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const limparTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (prazo.current) clearTimeout(prazo.current);
    faseTimers.current.forEach(clearTimeout);
    timer.current = null;
    prazo.current = null;
    faseTimers.current = [];
  }, []);

  useEffect(() => limparTimers, [limparTimers]);

  const buscar = useCallback(
    async (bruta: string) => {
      const alvo = bruta.trim();
      if (!alvo) return;

      limparTimers();
      setErro(null);
      setPedido(null);
      setCopiado(null);

      if (!ehLinkML(alvo)) {
        setFase("parado");
        setErro("Esse link não é do Mercado Livre. Cole o endereço do anúncio.");
        return;
      }

      setFase("limpando");
      faseTimers.current.push(setTimeout(() => setFase("procurando"), 1200));
      faseTimers.current.push(setTimeout(() => setFase("gerando"), 5000));

      const { data: id, error } = await supabase.rpc("pedir_link", { p_url: alvo });

      if (error || id == null) {
        limparTimers();
        setFase("offline");
        setErro(
          /link invalido/i.test(error?.message ?? "")
            ? "Esse link não é do Mercado Livre. Cole o endereço do anúncio."
            : null,
        );
        return;
      }

      const consultar = async () => {
        const { data } = await supabase.rpc("consultar_pedido", { p_id: id });
        // O tipo gerado do RPC devolve status como string solta; aqui a gente
        // sabe o formato porque a funcao no banco e nossa.
        const bruto = Array.isArray(data) ? data[0] : data;
        if (!bruto) return;
        const linha = bruto as unknown as Pedido;
        if (linha.status === "pronto" && linha.link) {
          limparTimers();
          setPedido(linha);
          setFase("pronto");
        } else if (linha.status === "falhou") {
          limparTimers();
          setFase("offline");
        }
      };

      timer.current = setInterval(consultar, INTERVALO_MS);
      prazo.current = setTimeout(() => {
        limparTimers();
        setFase((f) => (f === "pronto" ? f : "offline"));
      }, LIMITE_MS);
      consultar();
    },
    [limparTimers],
  );

  const copiar = (texto: string, marca: string) => {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(marca);
        setTimeout(() => setCopiado(null), 1600);
      })
      .catch(() => undefined);
  };

  const carregando = fase === "limpando" || fase === "procurando" || fase === "gerando";

  return (
    <section id="colar-link" className="rounded-xl border-2 border-ml-blue/30 bg-ml-blue/5 p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">🔗</span>
        <h2 className="font-semibold">Já sabe o produto? Cole o link</h2>
      </div>
      <p className="mb-3 text-xs text-secondary-ink">
        Eu confiro se a loja tem cupom de verdade, com o limite real de desconto, e devolvo o link
        pronto para comprar.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          id="campo-link-produto"
          rows={2}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            const colado = e.clipboardData.getData("text");
            if (colado && colado.trim().length > 20) {
              setUrl(colado);
              setTimeout(() => buscar(colado), 0);
            }
          }}
          placeholder="Cole aqui o link do anúncio do Mercado Livre"
          aria-label="Link do anúncio do Mercado Livre"
          className="min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ml-blue focus:ring-1 focus:ring-ml-blue"
        />
        <button
          type="button"
          onClick={() => buscar(url)}
          disabled={carregando || !url.trim()}
          className="shrink-0 rounded-md bg-ml-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
        >
          {carregando ? "Conferindo..." : "Conferir cupom"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-danger">{erro}</p>}

      {carregando && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-secondary-ink" aria-live="polite">{TEXTO_FASE[fase]}</p>
          <div className="space-y-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      )}

      {fase === "pronto" && pedido?.link && (
        <Resultado pedido={pedido} copiar={copiar} copiado={copiado} />
      )}

      {fase === "offline" && !erro && <Offline tentar={() => buscar(url)} />}
    </section>
  );
}

/* ---------------------------------------------------------------- resultado */

function Resultado({
  pedido,
  copiar,
  copiado,
}: {
  pedido: Pedido;
  copiar: (t: string, m: string) => void;
  copiado: string | null;
}) {
  const a = pedido.analise;
  const link = pedido.link as string;

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      {a?.titulo && (
        <p className="break-words text-sm font-medium">{a.titulo}</p>
      )}
      {a?.preco != null && (
        <p className="mt-1 text-2xl font-bold tabular-nums">{brl(a.preco)}</p>
      )}
      {a?.vendedor && <p className="mt-1 text-xs text-secondary-ink">Vendido por {a.vendedor}</p>}

      <CondicoesDoCupom analise={a} />

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full rounded-md bg-ml-blue py-3 text-center text-base font-bold text-white transition-colors hover:brightness-95"
      >
        Comprar no Mercado Livre
      </a>

      {pedido.codigo && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
          <p className="text-xs leading-relaxed text-secondary-ink">
            Se o link não abrir no aplicativo, cole este código na busca do Mercado Livre:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1.5 text-sm font-bold tracking-wide">
              {pedido.codigo}
            </code>
            <button
              type="button"
              onClick={() => copiar(pedido.codigo as string, "codigo")}
              className="shrink-0 rounded border border-ml-blue px-3 py-1.5 text-xs font-bold text-ml-blue"
            >
              {copiado === "codigo" ? "copiado" : "copiar"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-secondary-ink">
        A compra é feita direto no Mercado Livre, com a mesma segurança, o mesmo preço e a mesma
        garantia de sempre. Usando meu link eu recebo uma comissão paga pelo vendedor, não sai nada
        do seu bolso.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-secondary-ink/80">
        Sou o Weslei. Estou desempregado e essa comissão tem sido minha fonte de renda. Se este site
        te ajudou, usar meu link já é uma forma de retribuir. Pode colar outro link aqui em cima
        quantas vezes quiser, a qualquer hora.
      </p>
    </div>
  );
}

/* ------------------------------------------------------ condições do cupom

   As condições aparecem SEMPRE, com ou sem cupom. É o motivo do site existir.
   Cada linha só é renderizada quando o dado existe de verdade — nada de
   calcular teto quando não há teto, que é a contradição do modal antigo.
*/

function CondicoesDoCupom({ analise }: { analise: Analise | null | undefined }) {
  const c = analise?.cupom ?? null;

  if (!c) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-sm leading-relaxed text-secondary-ink">
        Não há cupom ativo para essa loja hoje. Prefiro te dizer isso a te empurrar um desconto que
        não existe.
      </div>
    );
  }

  if (c.bloqueado && c.minimo != null) {
    return (
      <div className="mt-3 rounded-md border border-danger bg-danger-soft p-3 text-sm leading-relaxed text-danger">
        Essa loja tem cupom de {c.titulo}, mas ele só vale acima de {brl(c.minimo)}. Neste valor não
        entra.
      </div>
    );
  }

  const valeAPena = analise?.temCupom === true;

  return (
    <div
      className={
        "mt-3 rounded-md p-3 " +
        (valeAPena
          ? "border border-success/40 bg-success/10"
          : "border border-border bg-muted/50")
      }
    >
      <p
        className={
          "text-sm font-bold " + (valeAPena ? "text-success" : "text-foreground")
        }
      >
        {valeAPena
          ? `Cupom de ${c.titulo}${c.economia != null ? ` — cerca de ${brl(c.economia)} de desconto` : ""}`
          : `Cupom de ${c.titulo}, mas o desconto trava em ${brl(c.teto)}. Na prática não muda quase nada.`}
      </p>

      <dl className="mt-2 divide-y divide-border text-sm">
        <Linha rotulo="Desconto do cupom" valor={c.titulo} />
        <Linha
          rotulo="Limite de desconto"
          valor={c.teto == null ? "sem limite de valor" : brl(c.teto)}
          destaque={c.teto == null}
        />
        {c.minimo != null && <Linha rotulo="Compra mínima" valor={brl(c.minimo)} />}
        {c.vence && <Linha rotulo="Válido até" valor={dataBR(c.vence)} />}
      </dl>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string | null;
  destaque?: boolean;
}) {
  if (!valor) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-secondary-ink">{rotulo}</dt>
      <dd className={"text-right font-bold " + (destaque ? "text-ml-blue" : "")}>
        {valor}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ offline

   Nunca oferecer a URL original como botão de compra: a pessoa compraria e o
   Weslei não receberia nada. Sem WhatsApp: o caminho é tentar de novo.
*/

function Offline({ tentar }: { tentar: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
      <p className="text-sm font-medium">A geração automática está fora do ar neste momento.</p>
      <p className="mt-1 text-sm leading-relaxed text-secondary-ink">
        Isso costuma durar poucos minutos. Seu link continua aí no campo: é só tentar de novo.
        Enquanto isso, você pode procurar a loja pelo nome na busca logo abaixo.
      </p>
      <button
        type="button"
        onClick={tentar}
        className="mt-3 w-full rounded-md bg-ml-blue py-2.5 text-center text-sm font-bold text-white transition-colors hover:brightness-95"
      >
        Tentar de novo
      </button>
    </div>
  );
}
