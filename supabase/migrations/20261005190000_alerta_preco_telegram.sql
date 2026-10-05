-- ALERTA DE PREÇO NO TELEGRAM (05/10). Quem segue um preço no site
-- ("Acompanhar preço") pode ligar o aviso no bot: o site pede um código
-- (alerta_telegram, só para o navegador que segue o produto) e abre
-- t.me/AfiliadosMELI_bot?start=alerta_<codigo>; o bot liga o aviso
-- (ligar_alerta_telegram, só servidor). Quando a leitura do preço chega no
-- preço-alvo (ou, sem alvo, cai 1% ou mais desde o último aviso), o gatilho
-- marca o aviso como pendente e chama operacao?tarefa=alertas, que manda a
-- mensagem com o link de afiliado (só meli.la) ou o link do site.

create table if not exists public.monitor_telegram (
  codigo text primary key,
  monitor_id bigint not null references public.monitor_precos(id) on delete cascade,
  navegador uuid not null,
  chat_id bigint,
  criado_em timestamptz not null default now(),
  ligado_em timestamptz,
  aviso_preco numeric,
  aviso_em timestamptz,
  pendente boolean not null default false
);
create unique index if not exists monitor_telegram_seguidor_idx
  on public.monitor_telegram (monitor_id, navegador);
create index if not exists monitor_telegram_pendente_idx
  on public.monitor_telegram (pendente) where pendente;
alter table public.monitor_telegram enable row level security;
revoke all on public.monitor_telegram from anon, authenticated;

-- Código do aviso para um produto que ESTE navegador segue.
create or replace function public.alerta_telegram(p_navegador uuid, p_monitor bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  if not exists (
    select 1 from public.monitor_seguidores
     where monitor_id = p_monitor and navegador = p_navegador
  ) then
    return null;
  end if;
  select codigo into v_codigo from public.monitor_telegram
   where monitor_id = p_monitor and navegador = p_navegador;
  if v_codigo is null then
    v_codigo := left(md5(random()::text || clock_timestamp()::text || p_navegador::text), 20);
    insert into public.monitor_telegram (codigo, monitor_id, navegador)
    values (v_codigo, p_monitor, p_navegador);
  end if;
  return v_codigo;
end;
$$;
revoke all on function public.alerta_telegram(uuid, bigint) from public;
grant execute on function public.alerta_telegram(uuid, bigint) to anon, authenticated;

-- O bot liga o aviso na conversa (só o servidor chama).
create or replace function public.ligar_alerta_telegram(p_codigo text, p_chat bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  update public.monitor_telegram
     set chat_id = p_chat, ligado_em = now()
   where codigo = p_codigo
  returning monitor_id, navegador into r;
  if r.monitor_id is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'titulo', m.titulo, 'preco', m.preco_atual, 'alvo', s.preco_alvo, 'url', m.url)
      from public.monitor_precos m
      left join public.monitor_seguidores s
        on s.monitor_id = m.id and s.navegador = r.navegador
     where m.id = r.monitor_id
  );
end;
$$;
revoke all on function public.ligar_alerta_telegram(text, bigint) from public, anon, authenticated;
grant execute on function public.ligar_alerta_telegram(text, bigint) to service_role;

-- Preço novo lido: marca os avisos que valem e chama a tarefa que envia.
create or replace function public.monitor_para_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marcados int;
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
  if v_marcados > 0 then
    begin
      perform public.disparar_operacao('operacao?tarefa=alertas');
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists monitor_para_telegram on public.monitor_precos;
create trigger monitor_para_telegram
  after update of preco_atual on public.monitor_precos
  for each row execute function public.monitor_para_telegram();

-- Allowlist da operação com a tarefa de alertas.
create or replace function public.disparar_operacao(p_caminho text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'operacao?tarefa=alertas', 'cron-garimpo', 'cron-garimpo?simular=1')
     AND p_caminho !~ '^operacao\?tarefa=remover&publicacao=[0-9]{1,9}$'
     AND p_caminho !~ '^operacao\?tarefa=sazonal(&temporada=(criancas|black_friday|natal))?(&max=[0-9]{1,2})?$'
     AND p_caminho !~ '^operacao\?tarefa=brinquedos(&alvo=(em_alta|bebe|3a5|6a8|9a12|doacao))?$'
     AND p_caminho !~ '^operacao\?tarefa=arte&tema=(criancas|natal|black_friday|tecnologia|casa|beleza|neutro)(&forcar=1)?$' THEN
    RAISE EXCEPTION 'caminho nao permitido';
  END IF;
  SELECT valor INTO v_segredo FROM public.sinc_config WHERE chave = 'cron_segredo';
  IF v_segredo IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(
    url := 'https://melhorescolha.io/api/public/' || p_caminho,
    headers := jsonb_build_object('x-cron-secret', v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;
