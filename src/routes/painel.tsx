/* PAINEL DO VISITANTE (Weslei, 06/11/2026): one place for everything the
   visitor saved. Resumo is new; Preços, Desejos and Ajustes are the same
   screens as /meus-precos, /favoritos and the old /perfil (shared
   components); Planejadores and Amigo secreto show progress and open the
   full pages. Works without login (device data); the e-mail login card on
   top brings the same data to every device. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, Gift, Heart, LayoutGrid, ListChecks, Settings, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { LayoutConteudo } from "@/components/LayoutConteudo";
import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import { PainelAlertasPreco, useMeusPrecos } from "@/components/painel/PainelAlertasPreco";
import { PainelAmigoSecreto, useAmigoSecreto } from "@/components/painel/PainelAmigoSecreto";
import { PainelConfiguracoesLGPD } from "@/components/painel/PainelConfiguracoesLGPD";
import { PainelListasDesejos } from "@/components/painel/PainelListasDesejos";
import { PainelPlanejadores, usePlanosAtivos } from "@/components/painel/PainelPlanejadores";
import { PainelResumo } from "@/components/painel/PainelResumo";
import { useConta } from "@/lib/auth-otp";
import { useListaDesejos } from "@/lib/lista-desejos";

const ABAS = [
  { id: "resumo", rotulo: "Resumo", Icone: LayoutGrid },
  { id: "precos", rotulo: "Preços", Icone: Bell },
  { id: "desejos", rotulo: "Desejos", Icone: Heart },
  { id: "planejadores", rotulo: "Planejadores", Icone: ListChecks },
  { id: "amigo", rotulo: "Amigo secreto", Icone: Gift },
  { id: "ajustes", rotulo: "Ajustes e privacidade", Icone: Settings },
] as const;
type Aba = (typeof ABAS)[number]["id"];
const ehAba = (v: unknown): v is Aba => ABAS.some((a) => a.id === v);

export const Route = createFileRoute("/painel")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => (ehAba(s["aba"]) ? { aba: s["aba"] } : {}),
  head: () => ({
    meta: [
      { title: "Meu painel — Melhor Escolha" },
      {
        name: "description",
        content: "Seus preços acompanhados, lista de desejos, planejadores, amigo secreto e privacidade num lugar só.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { aba = "resumo" } = Route.useSearch();
  const navigate = useNavigate({ from: "/painel" });
  const usuario = useConta();
  const precos = useMeusPrecos();
  const desejos = useListaDesejos().itens.length;
  const planos = usePlanosAtivos();
  const amigo = useAmigoSecreto();
  const barra = useRef<HTMLDivElement>(null);
  const [pilula, setPilula] = useState<{ x: number; w: number } | null>(null);
  const [entrar, setEntrar] = useState(false);
  /* Content slides in from the side of the tab you came from. */
  const indice = ABAS.findIndex((a) => a.id === aba);
  const anterior = useRef(indice);
  const lado = indice >= anterior.current ? "painel-da-direita" : "painel-da-esquerda";
  useEffect(() => {
    anterior.current = indice;
  }, [indice]);

  /* Blue pill glides under the active tab (measured, no layout library). */
  useLayoutEffect(() => {
    const medir = () => {
      const b = barra.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (b) setPilula({ x: b.offsetLeft, w: b.offsetWidth });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aba]);

  const irPara = (id: string) =>
    ehAba(id) && void navigate({ search: id === "resumo" ? {} : { aba: id }, replace: true, resetScroll: false });

  /* Keeps the active tab visible in the scrollable bar on small screens. */
  useEffect(() => {
    barra.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [aba]);

  const nome = (usuario?.user_metadata?.["perfil"] as { nome?: string } | undefined)?.nome;
  let conteudo: ReactNode;
  if (aba === "precos") conteudo = <PainelAlertasPreco dados={precos} />;
  else if (aba === "desejos") conteudo = <PainelListasDesejos noPainel />;
  else if (aba === "planejadores") conteudo = <PainelPlanejadores planos={planos} />;
  else if (aba === "amigo") conteudo = <PainelAmigoSecreto estado={amigo} />;
  else if (aba === "ajustes") conteudo = <PainelConfiguracoesLGPD />;
  else
    conteudo = (
      <PainelResumo
        precos={precos.itens}
        desejos={desejos}
        planos={planos?.length ?? 0}
        amigos={amigo?.amigos.length ?? 0}
        irPara={irPara}
      />
    );

  return (
    <LayoutConteudo
      titulo={nome ? `Olá, ${nome}` : "Meu painel"}
      resumo="Seus preços, desejos e listas num lugar só. Tudo pode ser apagado quando você quiser."
    >
      {/* Not signed in: everything works on this device; the drawer brings it to any device. */}
      {!usuario && (
        <div className="animate-cartao rounded-3xl border border-[#0071e3]/15 bg-[#0071e3]/[0.04] p-3">
          <button
            type="button"
            onClick={() => setEntrar((v) => !v)}
            aria-expanded={entrar}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="painel-pop grid size-9 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white" style={{ animationDelay: "200ms" }}>
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <strong className="block text-foreground">Veja tudo em qualquer aparelho</strong>
              Entre com seu e-mail, sem senha.
            </span>
            <ChevronDown className={`size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${entrar ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <div className={`gaveta ${entrar ? "gaveta-aberta" : ""}`}>
            <div>{entrar && <div className="flex justify-center pt-3"><LoginEmailOtp embutido /></div>}</div>
          </div>
        </div>
      )}

      <div
        ref={barra}
        role="tablist"
        aria-label="Seções do painel"
        className="vidro-barra sticky top-16 z-20 -mx-2 flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pilula && (
          <span
            aria-hidden="true"
            className="painel-pilula pointer-events-none absolute left-0 top-1 h-10 rounded-full bg-[#0071e3] shadow-[0_6px_18px_-8px_rgba(0,113,227,0.7)]"
            style={{ transform: `translateX(${pilula.x}px)`, width: pilula.w }}
          />
        )}
        {ABAS.map(({ id, rotulo, Icone }) => {
          const ativa = id === aba;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls="painel-conteudo"
              onClick={() => irPara(id)}
              className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 motion-reduce:transition-none ${
                ativa ? `text-white ${pilula ? "" : "bg-[#0071e3]"}` : "text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Icone className="size-4" aria-hidden />
              {rotulo}
            </button>
          );
        })}
      </div>

      <div id="painel-conteudo" role="tabpanel" key={aba} className={`${lado} space-y-6`}>
        {conteudo}
      </div>
    </LayoutConteudo>
  );
}
