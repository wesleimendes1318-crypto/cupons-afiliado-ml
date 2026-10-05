# Equipe de agentes do melhorescolha.io

Pedido do Weslei (05/10/2026): "desenvolva agentes pertinentes, que cuidem de
TUDO: segurança, pesquisa, análise de dados, configurações, manutenção, marca,
layout, melhorias" e "mantenha o site totalmente funcionando, validado e com
segurança do que é mostrado".

Cada agente é uma rotina agendada (Claude Code Routines) que abre uma sessão
nova neste repositório, lê o CLAUDE.md e este arquivo, faz o seu checklist e
termina com um relatório curto. Todos seguem as mesmas regras:

- CLAUDE.md manda. Nunca force-push nem reescrever histórico; branch
  `claude/ml-etiquetas-cupons-k6tgkj` e `main` recebem o mesmo commit; depois
  do push, `list_edits` "completed" e `deploy_project`.
- Banco: projeto Lovable `3f97dce2-5c60-435b-a067-f15be15dbd4a`
  (`mcp__Lovable__query_database`). Migrações só aditivas, com arquivo em
  `supabase/migrations/`.
- Nunca pedir nem escrever chaves. Nunca expor comissão, ganhos, vendas ou
  qualquer dado do painel de afiliados (privado do Weslei).
- Proteger a conta de afiliado: sem rajadas; respeitar os tetos das tarefas
  (`disparar_operacao`), freio de captcha e um pedido por vez.
- Todo botão de compra só com `https://meli.la/...`. Nada inventado: preço,
  frete, loja, "menor preço", "mais vendido" só com dado medido.
- Mudança de código: pequena, validada (tsc, eslint dos arquivos tocados,
  build; extensão com `ferramentas/verificar-extensao.sh` e versão nova no
  manifest), dentro do CLAUDE.md. Mudança grande vira proposta no relatório.
- Ação externa que não se desfaz (apagar post do canal, mexer em dado de
  cliente) só quando a auditoria marca **grave** e a regra do CLAUDE.md é
  clara; sempre registrar o motivo.
- Notificação no celular só para problema grave que precisa do Weslei.

## Os agentes

| Agente | Quando (Brasília) | Cuida de |
|---|---|---|
| Guardião | a cada 2 h, 07:44–23:44 | O que o cliente vê: `select * from auditoria_exibicao(3)`; páginas no ar; pedidos parados; links; canal. Corrige dado errado e defeito pequeno; avisa o grave. |
| Pesquisa e oportunidades | 10:20 e 16:20 | Sinais de mercado, campanhas, brinquedos por idade, busca guiada, garimpo: o que entra na fila de comparação e o que vai para vitrine/canal. |
| Manutenção e configuração | 06:50 | Rotinas do banco (pg_cron), chamadas agendadas, `operacao_execucoes`, versão da extensão, chaves presentes (só se existem), build, dependências, bateria de testes. |
| Segurança | segunda 07:40 | RLS, funções públicas que gravam, dados privados expostos, segredos no código, links sem afiliado, cabeçalhos, dependências vulneráveis. |
| Marca, layout e melhorias | terça e sexta 10:10 | Telas no PC e celular, identidade visual, contraste e teclado, SEO, textos e selos com dado; uma melhoria pequena e validada por vez. |
| Dados (relatório semanal) | segunda 08:45 | Já existia: painel, campanhas, benchmark, decisões da semana. |

## Auditoria automática no banco

`public.auditoria_exibicao(p_horas)` (só serviço) devolve `problema`,
`gravidade` (grave/atencao/interno), `pedido_id` e `detalhe`:

- `vendedor_e_a_conta`: loja com o apelido da conta de afiliado.
- `link_sem_afiliado`, `colado_link_sem_afiliado`: link de compra fora do meli.la.
- `pronto_sem_link`: comparação pronta sem link (interno quando o pedido é do
  próprio agente, origem "teste").
- `pedido_parado`, `pedido_falhou`.
- `entrada_sem_preco`.
- `canal_sem_frete_confirmado`: post no ar sem frete grátis confirmado.
- `execucao_com_erro`, `chamada_agendada_falhou`.

Problema novo que a auditoria não pega: o agente acrescenta a regra na função
(migração aditiva) e anota aqui.
