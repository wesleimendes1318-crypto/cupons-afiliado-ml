-- Cota diaria da Gemini (28/09): modelo que respondeu 429 de cota DIARIA
-- fica fora da fila ate "ate", valendo para todas as instancias do servidor
-- (a memoria de uma instancia so nao bastava: cada uma tentava de novo).
create table if not exists public.ia_cotas (
  modelo text primary key,
  ate timestamptz not null
);
alter table public.ia_cotas enable row level security;
-- Sem politica: so o servidor (service role) le e grava.
