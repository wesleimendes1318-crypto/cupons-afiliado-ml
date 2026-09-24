-- Nome (apelido) de cada loja do Mercado Livre pelo numero do vendedor.
-- A comparacao precisa do nome para achar o cupom da loja no banco, e cada
-- nome era uma consulta a API oficial a cada comparacao (429 em 24/09).
-- Guardado aqui, cada loja custa uma consulta so, uma vez.
CREATE TABLE IF NOT EXISTS public.apelidos_ml (
  seller_id bigint PRIMARY KEY,
  apelido text,
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apelidos_ml ENABLE ROW LEVEL SECURITY;
-- Sem politicas: so o servidor (service_role) le e grava.
