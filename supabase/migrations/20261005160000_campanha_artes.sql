-- ARTES REALISTAS DAS CAMPANHAS (05/10): geradas uma vez por tema no
-- servidor e salvas no armazenamento público; a vitrine só lê o arquivo.
insert into storage.buckets (id, name, public)
values ('campanhas', 'campanhas', true)
on conflict (id) do nothing;

create table if not exists public.campanha_artes (
  tema text primary key,
  url text not null,
  versao int not null default 1,
  modelo text,
  bytes int,
  gerada_em timestamptz not null default now()
);
alter table public.campanha_artes enable row level security;
revoke all on public.campanha_artes from anon, authenticated;

create or replace function public.artes_campanhas()
returns table(tema text, url text, versao int)
language sql stable security definer set search_path to 'public' as $$
  select tema, url, versao from public.campanha_artes;
$$;
grant execute on function public.artes_campanhas() to anon, authenticated;

create or replace function public.disparar_operacao(p_caminho text)
 returns bigint language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_segredo text;
BEGIN
  IF p_caminho NOT IN ('operacao?tarefa=mercado', 'operacao?tarefa=preparar', 'cron-garimpo', 'cron-garimpo?simular=1')
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
$function$;
