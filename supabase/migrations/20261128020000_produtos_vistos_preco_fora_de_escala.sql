-- 28/11: a page read stored prices x1000 (PS5 R$ 4.664,55 as 4664550,
-- perfume 279000, TV 98919) and the showcase showed "R$ 3.588.570,00".
-- No product compared here costs more than R$ 50.000 (largest real: sauna
-- R$ 26.833). Such a row is never written: a new one is skipped, an update
-- keeps the previous reading. Additive: existing rows are untouched (the
-- site hides them with precoAbsurdo in src/lib/preco-suspeito.ts).
CREATE OR REPLACE FUNCTION public.produtos_vistos_sem_preco_fora_de_escala()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(NEW.preco, 0) > 50000
     OR coalesce(NEW.melhor_preco, 0) > 50000
     OR coalesce(NEW.alt_preco, 0) > 50000 THEN
    IF TG_OP = 'UPDATE' THEN RETURN OLD; END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produtos_vistos_preco_fora_de_escala ON public.produtos_vistos;
CREATE TRIGGER produtos_vistos_preco_fora_de_escala
  BEFORE INSERT OR UPDATE ON public.produtos_vistos
  FOR EACH ROW EXECUTE FUNCTION public.produtos_vistos_sem_preco_fora_de_escala();

REVOKE ALL ON FUNCTION public.produtos_vistos_sem_preco_fora_de_escala() FROM PUBLIC, anon, authenticated;
