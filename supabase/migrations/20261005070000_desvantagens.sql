-- DESVANTAGENS (Weslei, 05/10: "precisa ter a indicacao de desvantagens,
-- quando houver"): a conferencia lista o que o candidato tem pior ou a menos
-- que o original, olhando foto, titulo, ficha e descricao como comprador.
-- Guardado junto do veredito (lista de textos curtos).
ALTER TABLE public.ia_vereditos ADD COLUMN IF NOT EXISTS desvantagens jsonb;
