-- Segunda foto real do catálogo nos "Mais vendidos agora" (09/10): o cartão
-- alterna entre as duas no mouse/toque. Aditiva: coluna nova e leitura v2.
alter table public.em_alta_catalogo add column if not exists imagem2 text;

create or replace function public.em_alta_da_categoria_v2(p_categoria text, p_limite int default 24)
returns table(produto text, categoria_site text, posicao int, nome text, imagem text, imagem2 text,
              preco numeric, frete_gratis boolean, loja_oficial boolean, url text, atualizado_em timestamptz)
language sql stable security definer set search_path to 'public' as $f$
  select e.produto, e.categoria_site, e.posicao, e.nome, e.imagem, e.imagem2, e.preco, e.frete_gratis,
         e.loja_oficial, e.url, e.atualizado_em
    from public.em_alta_catalogo e
   where (p_categoria is null or e.categoria_site = p_categoria)
     and e.atualizado_em > now() - interval '3 days'
     and e.url like 'https://www.mercadolivre.com.br/p/MLB%'
   order by e.categoria_site, e.posicao nulls last
   limit least(greatest(coalesce(p_limite, 24), 1), 200);
$f$;
revoke all on function public.em_alta_da_categoria_v2(text, int) from public;
grant execute on function public.em_alta_da_categoria_v2(text, int) to anon, authenticated;
