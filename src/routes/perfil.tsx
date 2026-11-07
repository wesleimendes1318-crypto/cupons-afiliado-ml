/* /perfil moved into the visitor hub (Weslei, 06/11): old links land on the
   "Ajustes e privacidade" tab of /painel. */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil")({
  beforeLoad: () => {
    throw redirect({ to: "/painel", search: { aba: "ajustes" }, replace: true });
  },
});
