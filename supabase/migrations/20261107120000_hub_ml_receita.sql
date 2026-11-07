-- "MINHA RECEITA" DO HUB DO ML (Weslei, 07/11/2026; extensão 1.183.0).
-- Print dele: saldo pendente, em revisão, em processo de pagamento, a pagar
-- em <data> e o histórico por período. A extensão lê essa tela e grava em
-- receita (jsonb, null quando a página não abriu). Só a conta mestre lê.

alter table public.metricas_hub_ml add column if not exists receita jsonb;

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
  v_resumo jsonb;
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
    -- Hub do Mercado Livre: cada leitura vira uma linha (histórico).
    if m->>'marketplace' = 'mercadolivre' then
      insert into metricas_hub_ml (comissao_estimada_centavos, comissao_aprovada_centavos, comissao_pendente_centavos,
                                   faturamento_gerado_centavos, pedidos_totais, cliques_totais, taxa_conversao,
                                   top_produtos, trecho_lido, links_portal, itens, tabelas, receita)
      values (nullif(m->>'comissao_centavos', '')::numeric::bigint,
              nullif(m->>'aprovada_centavos', '')::numeric::bigint,
              nullif(m->>'pendente_centavos', '')::numeric::bigint,
              nullif(m->>'faturamento_centavos', '')::numeric::bigint,
              nullif(m->>'pedidos', '')::numeric::int,
              nullif(m->>'cliques', '')::numeric::int,
              nullif(m->>'conversao_pct', '')::numeric(5,2),
              coalesce(m->'top_produtos', '[]'::jsonb),
              coalesce(m->'achados', '[]'::jsonb),
              coalesce(m->'links_portal', '[]'::jsonb),
              coalesce(m->'itens', '[]'::jsonb),
              coalesce(m->'tabelas', '[]'::jsonb),
              m->'receita');
    end if;
  end loop;

  -- O status do pedido fica leve (o /admin consulta a cada 3 s): sem as linhas.
  select coalesce(jsonb_agg(x - 'itens' - 'tabelas'), '[]'::jsonb) into v_resumo
    from jsonb_array_elements(coalesce(p_dados->'marketplaces', '[]'::jsonb)) x;

  if v_cmd is not null then
    update admin_comandos_sinc set
      status = case when v_gravados > 0 or p_dados->>'erro' is null then 'concluido' else 'erro' end,
      etapa = coalesce(left(p_dados->>'erro', 160), 'Concluído'),
      resultado = jsonb_build_object('marketplaces', v_resumo, 'gravados', v_gravados),
      concluido_em = now()
    where id = v_cmd;
  else
    -- Rodada automática (12 h): guarda o resultado para o painel mostrar o estado.
    insert into admin_comandos_sinc (tipo, status, etapa, resultado, iniciado_em, concluido_em)
    values ('sincronizar_vendas_afiliado', 'concluido', 'Leitura automática',
            jsonb_build_object('marketplaces', v_resumo, 'gravados', v_gravados, 'automatica', true),
            now(), now());
  end if;
  return jsonb_build_object('ok', true, 'gravados', v_gravados);
end
$$;
