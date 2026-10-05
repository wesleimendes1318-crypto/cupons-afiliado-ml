-- "Ver detalhes" nos cartões da vitrine (Weslei, 05/10: "dê a opção de
-- expandir o anúncio para analisar detalhes, descrição, características").
-- Leitura pública (a vitrine já é pública de propósito): só o que a
-- comparação leu no anúncio (características, destaques, descrição), o
-- título, a foto e quando foi comparado. Nada de link, loja ou dado interno.
create or replace function public.detalhes_da_vitrine(p_chave text)
returns table(titulo text, imagem text, detalhes jsonb, comparado_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.titulo, p.analise->>'imagem', p.analise->'detalhes', coalesce(p.atendido_em, p.criado_em)
    from public.pedidos_link p
   where p_chave ~ '^MLB[0-9]{5,}$'
     and p.status = 'pronto'
     and jsonb_typeof(p.analise->'detalhes') = 'object'
     and (p.url_alvo like '%' || p_chave || '%' or p.analise->>'chave' = p_chave)
   order by p.id desc
   limit 1;
$$;

revoke all on function public.detalhes_da_vitrine(text) from public;
grant execute on function public.detalhes_da_vitrine(text) to anon, authenticated;
