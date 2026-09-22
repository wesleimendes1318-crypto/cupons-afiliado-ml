import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  /* Queda de rede não pode virar "site fora do ar": cada consulta tenta de
     novo sozinha, com espera crescente, e volta a tentar quando a conexão
     retorna ou a aba é reaberta. Os dados já carregados continuam na tela
     enquanto isso. */
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 6,
        retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 15_000),
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        networkMode: "always",
      },
      mutations: { retry: 2, networkMode: "always" },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
