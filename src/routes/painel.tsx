/* PAINEL DO VISITANTE (Weslei, 06/11/2026): one place for everything the
   visitor saved. Resumo is new; Preços, Desejos and Ajustes are the same
   screens as /meus-precos, /favoritos and the old /perfil (shared
   components); Planejadores and Amigo secreto show progress and open the
   full pages. Works without login (device data); the e-mail login card on
   top brings the same data to every device. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Gift, Heart, LayoutGrid, ListChecks, Settings } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

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

  const irPara = (id: string) =>
    ehAba(id) && void navigate({ search: id === "resumo" ? {} : { aba: id }, replace: true, resetScroll: false });

  /* Keeps the active tab visible in the scrollable bar on small screens. */
  useEffect(() => {
    barra.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [aba]);

  const nome = (usuario?.user_metadata?.["perfil"] as { nome?: string } | undefined)?.nome;
  let conteudo: ReactNode;
  if (aba === "precos") conteudo = <PainelAlertasPreco dados={precos} />;
  else if (aba === "desejos") conteudo = <PainelListasDesejos />;
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
      <div
        ref={barra}
        role="tablist"
        aria-label="Seções do painel"
        className="vidro-barra sticky top-16 z-20 -mx-2 flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 motion-reduce:transition-none ${
                ativa ? "bg-[#0071e3] text-white shadow-[0_6px_18px_-8px_rgba(0,113,227,0.7)]" : "text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Icone className="size-4" aria-hidden />
              {rotulo}
            </button>
          );
        })}
      </div>

      <div id="painel-conteudo" role="tabpanel" key={aba} className="animate-conteudo space-y-6">
        {conteudo}
        {/* Not signed in: the data stays on this device; the card brings it to any device. */}
        {!usuario && aba === "resumo" && (
          <div className="animate-cartao flex justify-center" style={{ animationDelay: "360ms" }}>
            <LoginEmailOtp embutido />
          </div>
        )}
      </div>
    </LayoutConteudo>
  );
}
