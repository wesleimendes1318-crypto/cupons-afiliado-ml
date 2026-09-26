import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";

function destinoSeguro(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: destinoSeguro(s.next) }),
  head: () => ({
    meta: [
      { title: "Entrar | Cupom Afiliado" },
      { name: "description", content: "Entre para conectar um assistente aos cupons do site." },
      { property: "og:title", content: "Entrar | Cupom Afiliado" },
      { property: "og:description", content: "Entre para conectar um assistente aos cupons do site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    setOcupado(true);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${next}`,
    });
    if (r.error) {
      setOcupado(false);
      setErro(r.error.message);
      return;
    }
    if (!("redirected" in r && r.redirected)) window.location.href = next;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
      <p className="text-muted-foreground">Use sua conta Google para continuar.</p>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      <Button disabled={ocupado} onClick={entrar}>Entrar com Google</Button>
    </main>
  );
}
