-- Memória do agente dos Mais vendidos (09/10): produto descartado (fora
-- de categoria, peça, sem oferta nova), lista oficial já esgotada e os
-- filhos de cada categoria oficial. Evita gastar o teto de chamadas à API
-- relendo o que já foi visto. Só servidor.
CREATE TABLE IF NOT EXISTS public.em_alta_vistos (
  chave text PRIMARY KEY,
  motivo text,
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.em_alta_vistos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.em_alta_vistos FROM anon, authenticated;
