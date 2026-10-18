-- Temporário (18/10/2026): por que a senha da extensão não confere no banco
-- próprio. anotar_estado_robo guarda só o FORMATO do que chegou (tamanho, se
-- tem número, se confere tirando números ou espaços) e a versão que a
-- extensão anuncia; nunca a senha. Senha errada continua sem gravar nada.
create table if not exists public._tokens_recusados (
  id bigserial primary key,
  em timestamptz not null default now(),
  chave text,
  versao text,
  tamanho int,
  so_letras boolean,
  tem_digitos boolean,
  igual_sem_digitos boolean,
  igual_sem_espacos boolean
);
alter table public._tokens_recusados enable row level security;

create or replace function public.anotar_estado_robo(p_token text, p_chave text, p_valor text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_ok boolean; v_tok text;
begin
  select valor = p_token, valor into v_ok, v_tok from sinc_config where chave = 'token';
  if v_ok is not true then
    insert into _tokens_recusados (chave, versao, tamanho, so_letras, tem_digitos,
                                   igual_sem_digitos, igual_sem_espacos)
    values (left(p_chave, 40),
            case when p_chave = 'versao_extensao' then left(p_valor, 20) end,
            length(p_token), p_token ~ '^[A-Za-z]+$', p_token ~ '[0-9]',
            regexp_replace(coalesce(p_token, ''), '[^A-Za-z]', '', 'g') = v_tok,
            btrim(coalesce(p_token, '')) = v_tok);
    delete from _tokens_recusados where id < (select max(id) - 50 from _tokens_recusados);
    return;
  end if;
  if p_chave not in ('freio_motivo','freio_ate','visto_em','etiqueta_ultima','versao_extensao') then
    raise exception 'chave nao permitida: %', p_chave;
  end if;
  if p_chave in ('freio_motivo','freio_ate') and public.extensao_pausada() then
    return;
  end if;
  insert into sinc_config(chave, valor) values (p_chave, left(coalesce(p_valor,''), 400))
  on conflict (chave) do update set valor = excluded.valor;
end $function$;
