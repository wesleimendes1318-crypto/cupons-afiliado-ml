-- Diagnostico enviado pela extensao (ex.: trecho da pagina de busca quando a
-- leitura de anuncios vem vazia). Guardado 7 dias. So a extensao grava.
CREATE TABLE IF NOT EXISTS public.diagnosticos (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL,
  dados jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.gravar_diagnostico(p_token text, p_tipo text, p_dados jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF p_token IS NULL OR p_token <> (SELECT valor FROM public.sinc_config WHERE chave = 'token') THEN
    RAISE EXCEPTION 'token invalido';
  END IF;
  INSERT INTO public.diagnosticos (tipo, dados) VALUES (left(p_tipo, 40), p_dados);
  DELETE FROM public.diagnosticos WHERE criado_em < now() - interval '7 days';
END $f$;
GRANT EXECUTE ON FUNCTION public.gravar_diagnostico(text, text, jsonb) TO anon, authenticated, service_role;
