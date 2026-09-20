CREATE TABLE public.cupons (
  id bigint PRIMARY KEY,
  vendedor text NOT NULL,
  desconto text,
  tipo text,
  valor numeric,
  orcamento numeric,
  vence date,
  busca text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cupons_busca_idx ON public.cupons (busca);
CREATE INDEX cupons_vence_idx ON public.cupons (vence);

GRANT SELECT ON public.cupons TO anon;
GRANT SELECT ON public.cupons TO authenticated;
GRANT ALL ON public.cupons TO service_role;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cupons sao publicos para leitura"
ON public.cupons FOR SELECT
TO anon, authenticated
USING (true);