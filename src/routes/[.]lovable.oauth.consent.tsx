import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Resp = { data: any; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Resp>;
  approveAuthorization: (id: string) => Promise<Resp>;
  denyAuthorization: (id: string) => Promise<Resp>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Autorizar conexão | Cupom Afiliado" },
      { name: "description", content: "Autorize um assistente a consultar os cupons do site." },
      { property: "og:title", content: "Autorizar conexão | Cupom Afiliado" },
      { property: "og:description", content: "Autorize um assistente a consultar os cupons do site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização ausente");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-foreground">
      Não foi possível carregar este pedido: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nome = details?.client?.name ?? "um aplicativo";

  async function decidir(aprovar: boolean) {
    setBusy(true);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setErro(error.message); return; }
    const alvo = data?.redirect_url ?? data?.redirect_to;
    if (!alvo) { setBusy(false); setErro("Sem endereço de retorno."); return; }
    window.location.href = alvo;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-foreground">Conectar {nome} à sua conta</h1>
      <p className="text-muted-foreground">Isso permite que {nome} consulte os cupons do site em seu nome.</p>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => decidir(true)}>Aprovar</Button>
        <Button variant="outline" disabled={busy} onClick={() => decidir(false)}>Recusar</Button>
      </div>
    </main>
  );
}
