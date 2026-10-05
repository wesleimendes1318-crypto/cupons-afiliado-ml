-- Vitrine lê até 300 produtos (05/10, noite): com o reforço das vitrines
-- sazonais (Weslei: "pelo menos 20 itens em cada vitrine sazonal") a leitura
-- de 120 já cortava produtos válidos mais antigos.
do $$
declare d text;
begin
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'vitrine';
  execute replace(d, 'least(coalesce(p_limite, 60), 120)', 'least(coalesce(p_limite, 60), 300)');
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'vitrine_menor_preco';
  execute replace(d, 'least(coalesce(p_limite, 60), 120)', 'least(coalesce(p_limite, 60), 300)');
end $$;
