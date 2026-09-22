DROP POLICY IF EXISTS "log publico" ON public.sinc_log;
REVOKE ALL PRIVILEGES ON TABLE public.sinc_log FROM anon, authenticated;
GRANT ALL ON TABLE public.sinc_log TO service_role;

DROP POLICY IF EXISTS "Cupons sao publicos para leitura" ON public.cupons;
CREATE POLICY "Cupons publicos validos para leitura"
ON public.cupons
FOR SELECT
TO anon, authenticated
USING (vendedor IS NOT NULL AND btrim(vendedor) <> '');