-- BATERIA DE TESTES OBRIGATORIA (antes de dizer ao Weslei que uma versao esta pronta)
-- 1) Enfileirar os 5 casos reais que ja deram problema:
select pedir_link('https://www.mercadolivre.com.br/capa-case-anti-impacto-para-motorola-transparente-acrilico/up/MLBU4043026373?pdp_filters=item_id%3AMLB4739054961');
select pedir_link('https://www.mercadolivre.com.br/up/MLBU4376053139?pdp_filters=item_id%3AMLB4927955109');
select pedir_link('https://www.mercadolivre.com.br/eudora-sige-diamond-shampoo-condicionador-nutricao-profunda/p/MLB37269970');
select pedir_link('https://www.mercadolivre.com.br/disco-freio-roda-traseira-honda-nx4-falcon-1999-2000-a-2008/p/MLB2090773060');
select pedir_link('https://www.mercadolivre.com.br/monitor-gamer-portatil-156-1080p-fhd-ips-com-hdmi-usb/up/MLBU3228796835?pdp_filters=deal%3AMLB779362-1');  -- pagina de oferta (deal): preco e loja precisam ser lidos

-- 2) Depois de ~3 min, conferir (troque 100 pelo primeiro id enfileirado):
select id, status,
       extract(epoch from atendido_em - criado_em)::int as segundos,          -- meta: <= 60
       analise->>'versaoExtensao' as versao,
       analise->>'procurouOutra' as comparou,                                  -- meta: true
       analise->'buscaFora'->>'rodou' as busca_rodou,                          -- meta: true (sempre)
       jsonb_array_length(coalesce(analise->'outrasLojas','[]')) as mais_baratas,
       jsonb_array_length(coalesce(analise->'referencias','[]')) as lojas_tabela, -- meta: >= 1 quando existe
       (select count(*) from jsonb_array_elements(coalesce(analise->'referencias','[]')) r where r->>'link' is not null) as refs_com_link,
       link is not null as link_colado,                                        -- meta: true
       coalesce(analise->'buscaFora'->'leitura'->'ia'->>'indisponivel', 'false') as ia_indisponivel
  from pedidos_link where id >= 100 order by id;
