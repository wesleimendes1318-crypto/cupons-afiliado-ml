-- Parecidos (nao e o mesmo produto): o veredito da IA guarda se o candidato
-- serve de alternativa, mostrada separada no site com o que muda.
alter table public.ia_vereditos add column if not exists parecido boolean;
