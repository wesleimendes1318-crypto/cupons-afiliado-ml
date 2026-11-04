import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoginEmailOtp } from "@/components/LoginEmailOtp";
import { supabase } from "@/integrations/supabase/client";

function destinoSeguro(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: destinoSeguro(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Entrar | Cupom Afiliado" },
      { name: "description", content: "Entre com seu e-mail, sem senha." },
      { property: "og:title", content: "Entrar | Cupom Afiliado" },
      { property: "og:description", content: "Entre com seu e-mail, sem senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

/* Login por e-mail sem senha (04/11): o Google saiu. Com a sessão aberta
   (já estava ou acabou de entrar), segue para ?next= (ex.: /admin). */
function Login() {
  const { next } = Route.useSearch();
  const router = useRouter();

  useEffect(() => {
    const seguir = () => router.history.replace(next);
    void supabase.auth.getSession().then(({ data }) => data.session && seguir());
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN") setTimeout(seguir, 900);
    });
    return () => data.subscription.unsubscribe();
  }, [next, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-10">
      <LoginEmailOtp embutido />
    </main>
  );
}
