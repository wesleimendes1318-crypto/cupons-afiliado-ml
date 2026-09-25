-- Vereditos da Gemini (mesmo produto pela foto) guardados por par de
-- anuncios: a mesma conferencia nao gasta cota da API duas vezes.
CREATE TABLE IF NOT EXISTS public.ia_vereditos (
  chave_original text NOT NULL,
  chave_candidato text NOT NULL,
  igual boolean NOT NULL,
  confianca integer NOT NULL DEFAULT 0,
  motivo text,
  modelo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chave_original, chave_candidato)
);
ALTER TABLE public.ia_vereditos ENABLE ROW LEVEL SECURITY;
-- Sem politicas: so o servidor (service role) le e grava.
