-- PAUSA REMOTA DA EXTENSÃO (Weslei, 10/10: "Pause a extensão por enquanto,
-- não estou com o notebook neste momento"). A extensão roda no Chrome do
-- notebook e só trabalha com o que o banco entrega; com
-- sinc_config.extensao_pausada = 'true':
--   - as filas que a extensão consulta devolvem vazio (sem reservar nada):
--     pedidos, avaliações, fotos da vitrine, lojas, cupons, Amazon/Shopee e
--     "Acompanhar preço";
--   - limites.pausa_geral = 1: reservar_geracao recusa toda geração de link;
--   - operacao_pausada = 'true': agentes não enfileiram; o reparo do link para;
--   - freio_ate no futuro + freio_motivo: o site mostra "fora do ar" na hora
--     (roboAtivo) em vez de deixar o cliente esperando; a extensão não
--     consegue limpar esse freio enquanto a pausa vale.
-- Fica de fora: a leitura diária do hub de afiliados (decidida no próprio
-- navegador, 1 página por dia). Voltar: select public.pausar_extensao(false).

create or replace function public.extensao_pausada()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select valor from public.sinc_config where chave = 'extensao_pausada'), 'false') = 'true'
$$;
grant execute on function public.extensao_pausada() to anon, authenticated, service_role;

alter function public.pedidos_pendentes(text) rename to pedidos_pendentes_sem_pausa;
create function public.pedidos_pendentes(p_token text)
returns TABLE(id bigint, cupom_id bigint, vendedor text, url_alvo text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.pedidos_pendentes_sem_pausa(p_token);
end
$$;
grant execute on function public.pedidos_pendentes(text) to anon, authenticated, service_role;

alter function public.avaliacoes_pendentes(text, integer) rename to avaliacoes_pendentes_sem_pausa;
create function public.avaliacoes_pendentes(p_token text, p_limite integer DEFAULT 3)
returns TABLE(item text, url text, origem text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.avaliacoes_pendentes_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.avaliacoes_pendentes(text, integer) to anon, authenticated, service_role;

alter function public.vitrine_sem_foto(text, integer) rename to vitrine_sem_foto_sem_pausa;
create function public.vitrine_sem_foto(p_token text, p_limite integer DEFAULT 5)
returns TABLE(chave text, url_produto text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.vitrine_sem_foto_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.vitrine_sem_foto(text, integer) to anon, authenticated, service_role;

alter function public.lojas_pedidas(text) rename to lojas_pedidas_sem_pausa;
create function public.lojas_pedidas(p_token text)
returns TABLE(vendedor text, seller_id text, origem text, cupom_id bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.lojas_pedidas_sem_pausa(p_token);
end
$$;
grant execute on function public.lojas_pedidas(text) to anon, authenticated, service_role;

alter function public.lojas_para_resolver(text, integer) rename to lojas_para_resolver_sem_pausa;
create function public.lojas_para_resolver(p_token text, p_limite integer DEFAULT 20)
returns TABLE(vendedor text, seller_id text, cupons integer, origem text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.lojas_para_resolver_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.lojas_para_resolver(text, integer) to anon, authenticated, service_role;

alter function public.vitrines_para_conferir(text, integer) rename to vitrines_para_conferir_sem_pausa;
create function public.vitrines_para_conferir(p_token text, p_limite integer DEFAULT 40)
returns TABLE(id bigint, link_origem text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.vitrines_para_conferir_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.vitrines_para_conferir(text, integer) to anon, authenticated, service_role;

alter function public.condicoes_pendentes(text, integer) rename to condicoes_pendentes_sem_pausa;
create function public.condicoes_pendentes(p_token text, p_limite integer DEFAULT 150)
returns TABLE(id bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.condicoes_pendentes_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.condicoes_pendentes(text, integer) to anon, authenticated, service_role;

alter function public.links_pendentes(text, integer) rename to links_pendentes_sem_pausa;
create function public.links_pendentes(p_token text, p_limite integer DEFAULT 60)
returns TABLE(id bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.links_pendentes_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.links_pendentes(text, integer) to anon, authenticated, service_role;

alter function public.etiquetas_pendentes(text, integer) rename to etiquetas_pendentes_sem_pausa;
create function public.etiquetas_pendentes(p_token text, p_limite integer DEFAULT 20)
returns TABLE(id bigint, desconto text, pedido boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.etiquetas_pendentes_sem_pausa(p_token, p_limite);
end
$$;
grant execute on function public.etiquetas_pendentes(text, integer) to anon, authenticated, service_role;

alter function public.proximo_monitor(text) rename to proximo_monitor_sem_pausa;
create function public.proximo_monitor(p_token text)
returns TABLE(id bigint, url text, chave text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pausa remota (nada é reservado nem marcado enquanto pausada).
  if public.extensao_pausada() then return; end if;
  return query select * from public.proximo_monitor_sem_pausa(p_token);
end
$$;
grant execute on function public.proximo_monitor(text) to anon, authenticated, service_role;

alter function public.multiloja_pendentes(text) rename to multiloja_pendentes_sem_pausa;
create function public.multiloja_pendentes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.extensao_pausada() then return '[]'::jsonb; end if;
  return public.multiloja_pendentes_sem_pausa(p_token);
end
$$;
grant execute on function public.multiloja_pendentes(text) to anon, authenticated, service_role;

-- A extensão não limpa o freio da pausa (avisarQueEstouLivre a cada 10 min).
create or replace function public.anotar_estado_robo(p_token text, p_chave text, p_valor text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_ok boolean;
BEGIN
  SELECT valor = p_token INTO v_ok FROM sinc_config WHERE chave='token';
  IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'token invalido'; END IF;
  IF p_chave NOT IN ('freio_motivo','freio_ate','visto_em','etiqueta_ultima','versao_extensao') THEN
    RAISE EXCEPTION 'chave nao permitida: %', p_chave;
  END IF;
  IF p_chave IN ('freio_motivo','freio_ate') AND public.extensao_pausada() THEN
    RETURN;
  END IF;
  INSERT INTO sinc_config(chave, valor) VALUES (p_chave, left(coalesce(p_valor,''), 400))
  ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor;
END $function$;

-- Liga/desliga tudo de uma vez (só servidor).
create or replace function public.pausar_extensao(p_pausar boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sinc_config (chave, valor) values ('extensao_pausada', case when p_pausar then 'true' else 'false' end)
  on conflict (chave) do update set valor = excluded.valor;
  insert into public.sinc_config (chave, valor) values ('operacao_pausada', case when p_pausar then 'true' else 'false' end)
  on conflict (chave) do update set valor = excluded.valor;
  update public.limites set valor = case when p_pausar then 1 else 0 end where chave = 'pausa_geral';
  insert into public.sinc_config (chave, valor)
  values ('freio_motivo', case when p_pausar then 'Pausa pedida pelo Weslei (extensão sem supervisão)' else '' end),
         ('freio_ate', case when p_pausar then to_char((now() + interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') else '' end)
  on conflict (chave) do update set valor = excluded.valor;
  return case when p_pausar then 'extensao pausada' else 'extensao liberada' end;
end
$$;
revoke all on function public.pausar_extensao(boolean) from public, anon, authenticated;

-- O reparo do link não enfileira com a pausa.
create or replace function public.refazer_links_fila(p_max integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int[];
  v_rapida boolean;
  v_max int;
  v_abertos int;
  v_n int := 0;
  v_id bigint;
  r record;
begin
  if public.extensao_pausada() then return 0; end if;
  begin
    v_ver := string_to_array((select valor from public.sinc_config where chave = 'versao_extensao'), '.')::int[];
  exception when others then
    v_ver := null;
  end;
  v_rapida := v_ver is not null and v_ver >= array[1, 165, 5];
  v_max := case when v_rapida then p_max else 1 end;
  if exists (select 1 from public.pedidos_link
              where coalesce(origem, '') <> 'teste'
                and (status in ('pendente', 'processando') or criado_em > now() - interval '10 minutes')) then
    return 0;
  end if;
  select count(*) into v_abertos
    from public.links_a_refazer l join public.pedidos_link p on p.id = l.pedido_id
   where l.feito_em is null and p.status in ('pendente', 'processando');
  for r in
    select l.* from public.links_a_refazer l
      left join public.pedidos_link p on p.id = l.pedido_id
     where l.feito_em is null and l.tentativas < 3
       and (l.pedido_id is null
            or (l.enfileirado_em < now() - interval '30 minutes'
                and coalesce(p.status, 'falhou') not in ('pendente', 'processando')))
     order by l.prioridade desc, l.criado_em
     limit greatest(0, v_max - v_abertos)
  loop
    insert into public.pedidos_link (vendedor, url_alvo, status, origem)
    values ('(so link)', r.url_oferta, 'pendente', 'teste')
    returning id into v_id;
    update public.links_a_refazer
       set pedido_id = v_id, enfileirado_em = now(), tentativas = tentativas + 1
     where item = r.item;
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;
revoke all on function public.refazer_links_fila(integer) from public, anon, authenticated;


select public.pausar_extensao(true);
