-- Fim do diagnóstico de 18/10/2026: a senha da extensão 1.167.1 confere no
-- banco próprio. anotar_estado_robo volta a recusar senha errada com erro.
create or replace function public.anotar_estado_robo(p_token text, p_chave text, p_valor text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_ok boolean;
begin
  select valor = p_token into v_ok from sinc_config where chave = 'token';
  if v_ok is not true then raise exception 'token invalido'; end if;
  if p_chave not in ('freio_motivo','freio_ate','visto_em','etiqueta_ultima','versao_extensao') then
    raise exception 'chave nao permitida: %', p_chave;
  end if;
  if p_chave in ('freio_motivo','freio_ate') and public.extensao_pausada() then
    return;
  end if;
  insert into sinc_config(chave, valor) values (p_chave, left(coalesce(p_valor,''), 400))
  on conflict (chave) do update set valor = excluded.valor;
end $function$;

drop table if exists public._tokens_recusados;
