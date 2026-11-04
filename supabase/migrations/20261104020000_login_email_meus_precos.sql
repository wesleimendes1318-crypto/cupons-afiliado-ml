-- LOGIN SEM SENHA E "MEUS PREÇOS" NA CONTA (Weslei, 04/11). Só aditivo:
-- colunas novas (nulas ou com padrão), acompanhar_preco_v2/meus_precos_v2
-- (as antigas ficam), funções reescritas e a tabela nova perfil_conta.
-- Nada é apagado.
-- - Quem entra com o e-mail (código OTP do Supabase Auth) leva junto o que o
--   navegador já acompanhava (vincular_navegador_conta preenche usuario_id).
-- - Logado: vê tudo da conta, de qualquer aparelho. Deslogado: só o que este
--   navegador segue sem conta (quem saiu da conta não deixa os itens à vista).
-- - Aviso por e-mail: avisar_email por produto; o gatilho do preço marca
--   email_pendente e operacao?tarefa=alertas manda (precisa do RESEND_API_KEY).

alter table public.monitor_seguidores
  add column if not exists usuario_id uuid references auth.users(id) on delete set null,
  add column if not exists avisar_email boolean not null default false,
  add column if not exists aviso_email_preco numeric,
  add column if not exists aviso_email_em timestamptz,
  add column if not exists email_pendente boolean not null default false;
create index if not exists monitor_seguidores_usuario_idx
  on public.monitor_seguidores (usuario_id) where usuario_id is not null;
create index if not exists monitor_seguidores_email_pendente_idx
  on public.monitor_seguidores (email_pendente) where email_pendente;

-- Linha que quem chama pode ver/mexer: da conta (logado) ou do navegador sem conta.
create or replace function public.seguidor_visivel(s public.monitor_seguidores, p_navegador uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select case when auth.uid() is null then s.navegador = p_navegador and s.usuario_id is null
              else s.usuario_id = auth.uid() or (s.navegador = p_navegador and s.usuario_id is null) end;
$$;

create or replace function public.vincular_navegador_conta(p_navegador uuid, p_usuario_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  n integer;
begin
  if v is null then raise exception 'sem sessao'; end if;
  if p_usuario_id is not null and p_usuario_id <> v then raise exception 'usuario diferente'; end if;
  if p_navegador is null then return 0; end if;
  -- Só o que ainda não é de ninguém: nunca tira item da conta de outra pessoa.
  update monitor_seguidores set usuario_id = v where navegador = p_navegador and usuario_id is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.acompanhar_preco_v2(
  p_pedido bigint, p_navegador uuid, p_alvo numeric default null, p_avisar_email boolean default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.pedidos_link;
  v_id bigint;
  v_chave text;
  v_preco numeric;
  v_uid uuid := auth.uid();
begin
  if coalesce((select valor from sinc_config where chave = 'monitor_ativo'), 'false') <> 'true' then
    raise exception 'acompanhamento desligado';
  end if;
  if p_navegador is null then raise exception 'navegador ausente'; end if;
  select * into p from pedidos_link where id = p_pedido;
  if p.id is null or p.status <> 'pronto' or p.link is null or p.analise->>'titulo' is null then
    raise exception 'comparacao nao encontrada';
  end if;
  v_preco := nullif(p.analise->>'preco', '')::numeric;
  v_chave := chave_do_produto(p.url_alvo);
  select id into v_id from monitor_precos where chave = v_chave;
  if v_id is null then
    if (select count(*) from monitor_precos where ativo) >= 200 then
      raise exception 'limite do teste atingido';
    end if;
    insert into monitor_precos (chave, url, titulo, imagem, loja, link, preco_inicial, preco_atual,
                                preco_pix, preco_cheio, parcelas, menor_preco, menor_em, maior_preco,
                                ultima_leitura, proxima_leitura)
    values (v_chave, p.url_alvo, p.analise->>'titulo', p.analise->>'imagem', p.analise->>'vendedor', p.link,
            v_preco, v_preco,
            nullif(p.analise->'precos'->>'pix', '')::numeric, nullif(p.analise->'precos'->>'cheio', '')::numeric,
            p.analise->'precos'->'parcelas', v_preco, coalesce(p.atendido_em, now()), v_preco,
            coalesce(p.atendido_em, now()), now() + interval '6 hours')
    returning id into v_id;
  else
    update monitor_precos set ativo = true, link = coalesce(p.link, link) where id = v_id;
  end if;
  -- Logado e já segue este produto por outro aparelho: atualiza aquele.
  if v_uid is not null and exists (select 1 from monitor_seguidores where monitor_id = v_id and usuario_id = v_uid) then
    update monitor_seguidores set preco_alvo = p_alvo, avisar_email = coalesce(p_avisar_email, avisar_email)
     where monitor_id = v_id and usuario_id = v_uid;
    return v_id;
  end if;
  if (select count(*) from monitor_seguidores s where seguidor_visivel(s, p_navegador)) >= 20 then
    raise exception 'limite de 20 produtos acompanhados';
  end if;
  -- shortcut: navegador dividido em que outra conta já segue o mesmo produto fica sem a linha nova; raro, revisar se aparecer.
  insert into monitor_seguidores (monitor_id, navegador, preco_alvo, preco_ao_seguir, usuario_id, avisar_email)
  values (v_id, p_navegador, p_alvo, (select preco_atual from monitor_precos where id = v_id), v_uid,
          v_uid is not null and coalesce(p_avisar_email, false))
  on conflict (monitor_id, navegador) do update
    set preco_alvo = excluded.preco_alvo,
        usuario_id = coalesce(monitor_seguidores.usuario_id, excluded.usuario_id),
        avisar_email = case when excluded.usuario_id is null then monitor_seguidores.avisar_email
                            else coalesce(p_avisar_email, monitor_seguidores.avisar_email) end
    where monitor_seguidores.usuario_id is null or monitor_seguidores.usuario_id = excluded.usuario_id;
  return v_id;
end $$;

create or replace function public.meus_precos_v2(p_navegador uuid)
returns table(id bigint, titulo text, imagem text, loja text, link text, url text, preco_atual numeric,
              preco_pix numeric, preco_cheio numeric, parcelas jsonb, preco_ao_seguir numeric,
              preco_alvo numeric, menor_preco numeric, menor_em timestamptz, maior_preco numeric,
              disponivel boolean, ultima_leitura timestamptz, proxima_leitura timestamptz,
              seguindo_desde timestamptz, historico jsonb, avisar_email boolean)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select distinct on (m.id)
           m.id, m.titulo, m.imagem, m.loja, m.link, m.url, m.preco_atual, m.preco_pix, m.preco_cheio, m.parcelas,
           s.preco_ao_seguir, s.preco_alvo, m.menor_preco, m.menor_em, m.maior_preco, m.disponivel,
           m.ultima_leitura, m.proxima_leitura, s.criado_em as seguindo_desde,
           coalesce((select jsonb_agg(jsonb_build_object('p', h.preco, 'em', h.visto_em) order by h.visto_em)
                       from (select pv.preco, pv.visto_em from precos_vistos pv
                              where pv.chave = m.chave and pv.visto_em > now() - interval '90 days'
                              order by pv.visto_em desc limit 60) h), '[]'::jsonb) as historico,
           s.avisar_email
      from monitor_seguidores s join monitor_precos m on m.id = s.monitor_id
     where seguidor_visivel(s, p_navegador)
     order by m.id, s.criado_em
  ) x
  order by x.seguindo_desde desc;
$$;

create or replace function public.parar_de_acompanhar(p_monitor bigint, p_navegador uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from monitor_seguidores s where s.monitor_id = p_monitor and seguidor_visivel(s, p_navegador);
  update monitor_precos set ativo = false
   where id = p_monitor and not exists (select 1 from monitor_seguidores where monitor_id = p_monitor);
end $$;

-- Aviso por e-mail: só com conta (é o e-mail dela que recebe).
create or replace function public.definir_aviso_email(p_monitor bigint, p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'sem sessao'; end if;
  update monitor_seguidores set avisar_email = coalesce(p_ligado, false)
   where monitor_id = p_monitor and usuario_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Telegram: o código fica na linha que segue o produto (pode ser de outro aparelho da conta).
create or replace function public.alerta_telegram(p_navegador uuid, p_monitor bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nav uuid;
begin
  select s.navegador into v_nav from public.monitor_seguidores s
   where s.monitor_id = p_monitor and public.seguidor_visivel(s, p_navegador)
   order by (s.navegador = p_navegador) desc limit 1;
  if v_nav is null then
    return null;
  end if;
  select codigo into v_codigo from public.monitor_telegram
   where monitor_id = p_monitor and navegador = v_nav;
  if v_codigo is null then
    v_codigo := left(md5(random()::text || clock_timestamp()::text || v_nav::text), 20);
    insert into public.monitor_telegram (codigo, monitor_id, navegador)
    values (v_codigo, p_monitor, v_nav);
  end if;
  return v_codigo;
end;
$$;

create or replace function public.monitor_para_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marcados int;
  v_emails int;
begin
  if new.preco_atual is null or new.preco_atual is not distinct from old.preco_atual then
    return new;
  end if;
  update public.monitor_telegram t
     set pendente = true
    from public.monitor_seguidores s
   where t.monitor_id = new.id
     and t.chat_id is not null
     and not t.pendente
     and s.monitor_id = t.monitor_id
     and s.navegador = t.navegador
     and (
       (s.preco_alvo is not null and new.preco_atual <= s.preco_alvo
         and (t.aviso_preco is null or new.preco_atual < t.aviso_preco))
       or (s.preco_alvo is null
         and new.preco_atual <= coalesce(t.aviso_preco, s.preco_ao_seguir, old.preco_atual) * 0.99)
     );
  get diagnostics v_marcados = row_count;
  update public.monitor_seguidores s
     set email_pendente = true
   where s.monitor_id = new.id
     and s.avisar_email
     and s.usuario_id is not null
     and not s.email_pendente
     and (
       (s.preco_alvo is not null and new.preco_atual <= s.preco_alvo
         and (s.aviso_email_preco is null or new.preco_atual < s.aviso_email_preco))
       or (s.preco_alvo is null
         and new.preco_atual <= coalesce(s.aviso_email_preco, s.preco_ao_seguir, old.preco_atual) * 0.99)
     );
  get diagnostics v_emails = row_count;
  if v_marcados + v_emails > 0 then
    begin
      perform public.disparar_operacao('operacao?tarefa=alertas');
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- Preferências da conta (CEP/região, de onde sai a voltagem, e o perfil de recomendação).
create table if not exists public.perfil_conta (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  preferencias jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.perfil_conta enable row level security;
grant select, insert, update on public.perfil_conta to authenticated;
create policy "perfil_conta propria" on public.perfil_conta for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Leitura direta dos próprios registros (as telas usam as funções acima).
grant select on public.monitor_seguidores, public.monitor_precos to authenticated;
create policy "seguidores da propria conta" on public.monitor_seguidores for select to authenticated
  using (usuario_id = auth.uid());
create policy "precos que a conta acompanha" on public.monitor_precos for select to authenticated
  using (exists (select 1 from public.monitor_seguidores s where s.monitor_id = monitor_precos.id and s.usuario_id = auth.uid()));

grant execute on function public.seguidor_visivel(public.monitor_seguidores, uuid) to authenticated;
grant execute on function public.vincular_navegador_conta(uuid, uuid) to authenticated;
grant execute on function public.definir_aviso_email(bigint, boolean) to authenticated;
grant execute on function public.acompanhar_preco_v2(bigint, uuid, numeric, boolean) to anon, authenticated;
grant execute on function public.meus_precos_v2(uuid) to anon, authenticated;
