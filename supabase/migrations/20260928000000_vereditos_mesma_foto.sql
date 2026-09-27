-- Conferencia do mesmo produto (27/09, roupa com a mesma foto): o veredito
-- guardado passa a dizer se a foto do candidato e a mesma do original e o
-- quanto ele se parece (0-100), para revisar e ordenar os "Parecidos".
alter table public.ia_vereditos add column if not exists mesma_foto boolean not null default false;
alter table public.ia_vereditos add column if not exists semelhanca smallint;
