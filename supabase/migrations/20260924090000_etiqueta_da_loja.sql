-- Codigo (etiqueta) ja gerado da loja, so leitura: o site mostra pronto para
-- copiar, sem pedir geracao nova. Prefere o proprio cupom; senao, outro cupom
-- valido da mesma loja.
CREATE OR REPLACE FUNCTION public.etiqueta_da_loja(p_cupom_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('codigo', c.codigo_cupom, 'desconto', c.desconto, 'vence', c.vence,
                            'teto', c.teto, 'compra_min', c.compra_min, 'mesmo_cupom', c.id = p_cupom_id)
    FROM public.cupons c
    JOIN public.cupons alvo ON alvo.id = p_cupom_id
   WHERE c.codigo_cupom IS NOT NULL
     AND public.normalizar_nome(c.vendedor) = public.normalizar_nome(alvo.vendedor)
     AND (c.vence IS NULL OR c.vence >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
     AND c.qualidade IS DISTINCT FROM 'armadilha'
   ORDER BY (c.id = p_cupom_id) DESC, c.valor DESC NULLS LAST
   LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.etiqueta_da_loja(bigint) TO anon, authenticated, service_role;
