-- Outros marketplaces (09/10): resultado da comparação com Amazon e Shopee
-- por pedido (6 h), para não repetir a busca e a conferência a cada visita.
-- Só servidor. Aditiva.
CREATE TABLE IF NOT EXISTS public.multiloja_resultados (
  pedido_id bigint PRIMARY KEY,
  resultado jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS multiloja_resultados_criado ON public.multiloja_resultados (criado_em DESC);
ALTER TABLE public.multiloja_resultados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.multiloja_resultados FROM anon, authenticated;
