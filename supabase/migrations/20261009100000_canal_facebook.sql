-- Página do Facebook (09/10): resultado da publicação de cada oferta do
-- canal (id do post ou o erro, sem token). Aditiva.
ALTER TABLE public.canal_publicacoes ADD COLUMN IF NOT EXISTS facebook_post_id text;
ALTER TABLE public.canal_publicacoes ADD COLUMN IF NOT EXISTS facebook_erro text;
ALTER TABLE public.canal_publicacoes ADD COLUMN IF NOT EXISTS facebook_em timestamptz;
