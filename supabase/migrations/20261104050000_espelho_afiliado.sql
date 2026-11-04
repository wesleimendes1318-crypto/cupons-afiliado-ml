-- ESPELHO DE AFILIADO (Weslei, 04/11/2026; extensão 1.177.0, espelho.js).
-- A extensão lê, na sessão logada do Weslei, o resumo dos portais de
-- afiliado (Mercado Livre, Amazon, Shopee) e grava aqui com a senha dela.
-- Só a conta mestre lê (RLS de afiliado_vendas_espelho/admin_comandos_sinc).
-- Os portais mostram o acumulado do mês: uma linha por marketplace e mês
-- (data = dia 1), regravada a cada leitura.

-- Entrega à extensão o pedido do botão "Sincronizar vendas agora".
-- Pedido em execução há mais de 10 min (extensão fechada no meio) volta.
create or replace function public.afiliado_comando_pendente(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean; v_id bigint;
begin
  select valor = p_token into v_ok from sinc_config where chave = 'token';
  if v_ok is not true then raise exception 'token invalido'; end if;
  if public.extensao_pausada() then return null; end if;
  update admin_comandos_sinc set status = 'erro', concluido_em = now(),
         etapa = 'A extensão não respondeu. Tente de novo.'
   where tipo = 'sincronizar_vendas_afiliado' and status = 'pendente'
     and criado_em < now() - interval '30 minutes';
  select id into v_id from admin_comandos_sinc
   where tipo = 'sincronizar_vendas_afiliado'
     and (status = 'pendente' or (status = 'executando' and iniciado_em < now() - interval '10 minutes'))
   order by id limit 1 for update skip locked;
  if v_id is null then return null; end if;
  update admin_comandos_sinc set status = 'executando', iniciado_em = now(),
         etapa = 'Começando a leitura...' where id = v_id;
  return jsonb_build_object('id', v_id);
end
$$;

-- p_dados: { comando_id?, etapa?, fim?, erro?, marketplaces?: [{ marketplace,
--   status, comissao_centavos, pedidos, cliques, achados, pagina, erro }] }
create or replace function public.gravar_metricas_afiliado(p_token text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_cmd bigint := nullif(p_dados->>'comando_id', '')::bigint;
  v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  m jsonb;
  v_gravados int := 0;
begin
  select valor = p_token into v_ok from sinc_config where chave = 'token';
  if v_ok is not true then raise exception 'token invalido'; end if;

  if not coalesce((p_dados->>'fim')::boolean, false) then
    if v_cmd is not null then
      update admin_comandos_sinc set etapa = left(p_dados->>'etapa', 120) where id = v_cmd;
    end if;
    return jsonb_build_object('ok', true);
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_dados->'marketplaces', '[]'::jsonb)) loop
    continue when m->>'marketplace' not in ('mercadolivre', 'amazon', 'shopee') or m->>'status' <> 'lido';
    insert into afiliado_vendas_espelho (data, marketplace, pedidos_gerados, comissao_estimada_centavos,
                                         cliques_registrados, status, capturado_em)
    values (v_mes, m->>'marketplace',
            nullif(m->>'pedidos', '')::numeric::int,
            nullif(m->>'comissao_centavos', '')::numeric::bigint,
            nullif(m->>'cliques', '')::numeric::int,
            'acumulado_mes', now())
    on conflict (data, marketplace) do update set
      pedidos_gerados = excluded.pedidos_gerados,
      comissao_estimada_centavos = excluded.comissao_estimada_centavos,
      cliques_registrados = excluded.cliques_registrados,
      status = excluded.status, capturado_em = now();
    v_gravados := v_gravados + 1;
  end loop;

  if v_cmd is not null then
    update admin_comandos_sinc set
      status = case when v_gravados > 0 or p_dados->>'erro' is null then 'concluido' else 'erro' end,
      etapa = coalesce(left(p_dados->>'erro', 160), 'Concluído'),
      resultado = jsonb_build_object('marketplaces', coalesce(p_dados->'marketplaces', '[]'::jsonb), 'gravados', v_gravados),
      concluido_em = now()
    where id = v_cmd;
  else
    -- Rodada automática (12 h): guarda o resultado para o painel mostrar o estado.
    insert into admin_comandos_sinc (tipo, status, etapa, resultado, iniciado_em, concluido_em)
    values ('sincronizar_vendas_afiliado', 'concluido', 'Leitura automática',
            jsonb_build_object('marketplaces', coalesce(p_dados->'marketplaces', '[]'::jsonb), 'gravados', v_gravados, 'automatica', true),
            now(), now());
  end if;
  return jsonb_build_object('ok', true, 'gravados', v_gravados);
end
$$;

revoke all on function public.afiliado_comando_pendente(text) from public;
revoke all on function public.gravar_metricas_afiliado(text, jsonb) from public;
grant execute on function public.afiliado_comando_pendente(text) to anon, authenticated;
grant execute on function public.gravar_metricas_afiliado(text, jsonb) to anon, authenticated;
