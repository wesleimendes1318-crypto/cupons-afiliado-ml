# operacao (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Agents team, customer-first queue, account security, guarantees per release, own Supabase DB, publishing, 05/10 fixes.

## Correções graves de 05/10 (tarde)
- APELIDO DA CONTA NUNCA É LOJA (pedido 716, "Vendido por WESLEI.MENDES"
  num parecido): a leitura logada de anúncio pausado pegava o "nickname" de
  quem está logado. Extensão 1.149.0: nomesDoHtml descarta o apelido da
  conta (APELIDOS_DA_CONTA) e só usa "nickname" quando a página tem o bloco
  do vendedor (seller_link); cache v4. Site: afiliado.ts (nomeDeLojaValido)
  apaga esse nome na leitura do pedido.
- ANÚNCIO INDISPONÍVEL/PAUSADO NÃO APARECE (pedido 716: "Este produto está
  indisponível no momento"): resolverVendedorAgora marca
  indisponivelPorItem (RE_INDISPONIVEL); a loja sai da tabela e o parecido
  sai da lista (diag.parecidosIndisponiveis).
- BOTÃO DIRETO SEMPRE (Weslei, 05/10: "não tem o botão de consultar os
  produtos diretamente... eu não vendo nada"): vitrine geral, campanhas e
  brinquedos mostram "Comprar com segurança" com o link de afiliado sempre
  que houver (preço de quando foi comparado, com a data), e "Atualizar
  preço" como ação secundária. Busca guiada: "Comprar com segurança" gera o
  link de afiliado no clique (VerNaLoja / pedir_link_da_loja) e "Comparar
  preço" fica secundário. Substitui o "UM botão só" de 02/10.
- Botão flutuante "Colar link do produto": SUBSTITUÍDO em 10/10 pelo campo
  do link no cabeçalho (ver "Navegação soft"). "O que muda" quebra linha em
  valores longos.
- Comissão ("Ganhos", "Ganhos extras" do hub de afiliados) NUNCA aparece no
  site, bot ou canal. PRIORIDADE POR COMISSÃO (Weslei, 09/10, noite: "melhor taxa
  de comissão vs valor do produto - priorizar itens que pagam mais"): a
  extensão 1.158.0 lê só a TAXA (%) do cartão do hub e manda só ao banco
  (registrar_hub, senha da extensão; hub_recomendados.comissao_pct, tabela
  sem acesso público); a fila do hub vai por taxa x preço, depois mais
  vendido e desconto, até 10 por leitura (lê até 120 cartões), só com nota
  >= 4,5 quando conhecida. Comissão só ORDENA: nunca aprova produto,
  vendedor nem preço. QUALIDADE PRIMEIRO (Weslei, 09/10: "considere sempre
  a qualidade, deve devolver o melhor produto para o cliente sentir
  segurança e voltar a comprar"): entre ofertas do mesmo produto, a loja
  oficial vem antes da mais barata quando não há a oferta destacada do
  catálogo.

## Equipe de agentes (05/10)
- SAÚDE SEM O LOVABLE (16/10: a consulta do Lovable ao banco deu 504 por
  horas): GET /api/public/saude (src/routes/api/public/saude.ts, só leitura,
  limite por endereço, sem link/id/chave/erro bruto) diz se o banco responde
  pelo servidor do site, a extensão (versão, pausa), o último pedido pronto,
  os pedidos de cliente da última hora (falhou, pronto sem link, parados) e
  os brinquedos. /brinquedos sem produto mostra "Estou atualizando os
  brinquedos comparados" com "Comparar um brinquedo" (AvisoSemBrinquedos).
- Weslei, 05/10: "desenvolva agentes pertinentes, que cuidem de TUDO" e
  "mantenha o site totalmente funcionando, validado e com segurança do que é
  mostrado". Papéis, horários e regras em docs/agentes.md (Guardião a cada
  2 h, Pesquisa e oportunidades, Manutenção e configuração, Segurança, Marca/
  layout/melhorias, Dados semanal). Base do Guardião: função
  auditoria_exibicao(p_horas) no banco (só serviço). Problema novo que ela não
  pega vira regra nova na função.

## Cliente primeiro e teto dos agentes (05/10, noite)
- Medido em 05/10: 120 comparações dos agentes x 3 de clientes em 24 h; a
  cota gratuita da Gemini (flash-lite 500/dia, 2.5-flash 20/dia) acabou e
  as comparações seguintes saíram só com o link (sem lojas nem parecidos).
- pedidos_pendentes entrega SEMPRE os pedidos de cliente primeiro; pedido
  interno (origem 'teste') só quando não há cliente esperando, 2 por vez.
- Agentes (sazonal, preparar, brinquedos, busca guiada, hub) enfileiram só
  por pedir_link_agente: teto diário sinc_config.agentes_teto_dia (40, dia
  de Brasília) e nada enquanto a cota do flash-lite estiver esgotada
  (ia_cotas). pedir_link_novo fica para a bateria de testes.
  05/10, noite: com o Gemma 26b conferindo, a fila dos agentes só para
  quando o flash-lite E o gemma-4-26b-a4b-it estão sem cota; teto 200/dia
  (Weslei: "pelo menos 20 itens em cada vitrine sazonal"). Buscas sazonais:
  42 por temporada (Crianças e Natal), termos ampliados (nerf, uno, pokémon,
  boneco, drone; echo dot, air fryer, nespresso, secador, maquiagem,
  havaianas, panelas, taças, nintendo, ps5...), até 24 cartões por seção
  numa FILEIRA com rolagem lateral e setas (Weslei: "as vitrines estão muito
  grande"; GradeOfertas fileira; cartão 206 px no PC, 64% no celular) e
  destaque mais baixo (230 px no PC, faixa de 128 px no celular). A página
  da temporada (/natal, /dia-das-criancas) continua com a grade completa.

## Cliente primeiro na fila (10/10)
- Weslei, 10/10: "Ajuste urgente: está demorando muito para consultar e o
  usuário desiste" (tela: "Pronto em até 10min 05s"; pedido 1208 esperou 2
  pedidos internos e saiu em 120 s). Causas: a previsão contava os 20
  pedidos internos enfileirados de uma vez (3 a 13 min na fila) e a rodada
  interna levava 2 pedidos. Banco (20261010160000_cliente_primeiro_fila.sql):
  tempo_estimado só com pedidos de CLIENTE (P75 ~47 s); pedidos_pendentes
  com 1 interno por rodada; pedir_link_base não duplica o mesmo link já na
  fila/andamento (1208/1209, mesmo link em 4 s); pedidos_pendentes_v2 (com a
  origem) e clientes_esperando (só clientes).
- Extensão 1.165.3: pedido INTERNO em andamento é cortado quando um cliente
  entra na fila (olho de 3 s em clientes_esperando -> interromperVolta,
  resta() = 0, sem links da recomendação); fica incompleto
  (cortadoPorCliente) e a segunda volta refaz depois dos clientes.
- Nunca enfileirar pedidos internos em lote grande de uma vez (20 em
  10/10 às 11:24 seguraram a fila por 13 min). Trava no banco (19/10,
  extensão sem contato por 12 h e 58 internos acumulados):
  pedir_link_agente não enfileira com 20 ou mais internos pendentes
  (sinc_config.agentes_fila_max). expirar_pedidos e limpar_vencidos só
  para o servidor.
- ABA DO GERADOR DORMINDO (10/10): desde 10/10 ~01:00 UTC cada link do
  anúncio colado levava 30-45 s e terminava sempre no segundo :00 (tabela
  geracoes; antes, 1 s; o lote da tabela chegava a 100-300 s): o Chrome só
  acorda uma vez por minuto a aba escondida há mais de 5 min. Extensão
  1.165.5: rodarNoGerador roda a chamada na aba de sempre com prazo de 5 s e,
  sem resposta, numa aba NOVA do gerador (recém-aberta), que fecha em
  seguida. Vale para o link do colado e para o lote. Diagnóstico
  'gerador-lento' (espera, aba ativa, estado da janela, tempo da aba nova).

## Conta e segurança
- Proteger a conta de afiliado: sem rajadas de leitura; freio em captcha.
- Sem janela anônima (Weslei, 26/09): toda leitura é logada, com freio em
  captcha/"tráfego suspeito" e um pedido por vez.
- Não trocar a Gemini pela "Lovable AI" (plano sem crédito: responde 402).
- Nunca pedir nem colocar chaves no código ou no chat (vão nos Secrets do Lovable).
- Banco (27/09): função que GRAVA e é pública exige a senha da extensão
  (p_token) ou fica só para o banco. O site pede com pedir_comparacao /
  pedir_link_da_loja (limite: 15 pedidos novos/min, 150/h) e lê o resultado com
  ver_pedido(id, chave). A vitrine é gravada só pelo gatilho do banco.
  Ver o que os outros pesquisaram é PÚBLICO de propósito (Weslei, 27/09):
  vitrine e consultar_pedido abertos para leitura, SEM prazo (toda pesquisa
  fica registrada). A tela mostra "Comparado há X" SEMPRE com o botão
  "Atualizar comparação" (compara de novo na hora); passada 1 hora, o texto pede
  para atualizar antes de comprar. Proteger só a GRAVAÇÃO.

## Garantia (obrigatório a cada versão)
- O cliente SEMPRE recebe: produto, preço, o link de afiliado e a comparação
  possível. Cada etapa tem plano B: leitura do código da página → aba logada →
  leitura da TELA (preço/loja/título/foto como a pessoa vê).
  Nunca tela vazia: sem dado, o site mostra o que tem com o botão do link.
- Conferência em lotes de até 4 em paralelo; lote que falha (cota, tempo) não
  derruba os outros. Cota gratuita da Gemini: 2.5-flash e flash-latest têm 20
  pedidos/dia (28/09); o flash-lite segura o dia a dia.
- GARIMPO DE VERDADE (Weslei, 27/09: "sempre a melhor opção de verdade, esse
  é meu diferencial"): a conferência pela foto olha 12 anúncios (lotes de 4 em
  paralelo no servidor), escolhidos por escolherParaConferir: PRIMEIRO os mais
  baratos que o colado (achados da busca nas lojas oficiais na frente, depois
  título mais parecido), com 4 vagas para os mais caros (tabela). Buscas
  extras: só entre lojas oficiais (urlDeBusca + "_Loja_all") e pelo menor
  preço na faixa do produto ("_OrderId_PRICE_PriceRange_min-max", 28/09). Dos aprovados, os 5
  mais baratos são abertos: até 5 lojas do mesmo produto na tabela. Caso real:
  agasalho "Basic 3s" x "Woven 3 Listras" da adidas oficial, R$ 83 mais
  barato, sumia em metade das consultas por título pouco parecido.
- Produtos relacionados da página colada (carrosséis do Mercado Livre) viram
  mais uma fonte de candidatos (relacionadosDaPagina), com a mesma conferência
  pela foto: só entram na tabela se forem o mesmo produto (Weslei, 27/09:
  "somente quando for útil de verdade"). SUGESTÕES DO MERCADO LIVRE (Weslei,
  03/10, Akai MPK Mini R$ 568 x M-Vave SMK-25 R$ 339,69 em "Quem viu este
  produto também comprou"): até 3 das vagas dos mais baratos na conferência
  são dos relacionados (do mais barato), porque as cópias do próprio anúncio
  ocupavam todas; nos Parecidos, além dos 5 mais semelhantes, até 2
  sugeridos mais baratos que o colado (sugerido: true), à vista (não
  recolhidos) e com o selo "Sugerido na página do anúncio". Diagnóstico:
  leitura.relacionadosVistos (título | preço). Conferido no pedido 607: o
  M-Vave SMK-25 (R$ 382,10) entrou na conferência. Diferença só de marca e
  modelo (semelhança >= 60) conta como parecido mesmo com parecido=false da
  conferência (soMarcaEModelo; nunca vira igual). As 2 vagas extras não
  repetem marca já listada (sugeridosExtras; pedido 613: três AMW tiravam o
  M-Vave). Cartão do carrossel sem foto (carregamento preguiçoso)
  pega a foto no polycard do mesmo anúncio nos dados da página (pedido 619:
  o M-Vave saiu "sem foto" e ficou fora; diagnóstico relacionadosDiag.semFoto
  e fotoPelosDados). A API oficial não serve de reserva (/items dá 403).
- Anúncio colado que se contradiz (foto de um produto, texto de outro; caso da
  SHOPMASP: foto do conjunto Woven, descrição "malha macia" do Basic 3S
  tricot): o site avisa "a foto e o texto não batem, confirme com o vendedor"
  (original_contradiz da conferência) ou, sem isso, "a foto deste anúncio é a
  mesma de outro produto (...)" quando um parecido tem a MESMA foto.
  Nunca escolher sozinho um dos dois.
- SEMPRE indicar a loja (Weslei, 28/09: "máxima transparência"): tabela,
  recomendação, Melhor alternativa e Parecidos mostram "Vendido por X" (os 5
  parecidos mais próximos têm a página lida). Selos do Mercado Livre quando
  houver: "Loja oficial" e "MercadoLíder Platinum/Gold" (power_seller_status
  do evento do PRÓPRIO anúncio, só se o nome do vendedor do evento bater com
  a loja lida).
- Selo "Loja oficial" IGUAL ao do Mercado Livre. Vem da lista oficial de
  ofertas (API, official_store_id) e dos anúncios achados na busca com o
  filtro "Lojas oficiais" (_Loja_all; conferido em 28/09, pedido 461: veio a
  adidas e nenhum anúncio da SHOPMASP). A leitura pela página está DESLIGADA
  (28/09: a SHOPMASP saiu como oficial duas vezes, mesmo lendo só o evento do
  próprio anúncio); a extensão guarda amostras ("loja-oficial-amostra") para
  acertar a leitura antes de religar. Selo errado é pior que nenhum.
- A busca em outras lojas roda SEMPRE (catálogo oficial + Google/busca), e os
  resultados são juntados. Nunca pular a busca porque o catálogo já achou algo.
- SEMPRE comparação com outras lojas para qualquer produto (Weslei, 26/09):
  as vagas da conferência pela foto que sobram vão para os outros anúncios da
  mesma busca na faixa de preço (Itan MLG-202: só o próprio anúncio passava
  no filtro de título). Sai o mesmo produto (tabela) ou "Parecidos".
- Não desapontar o cliente enquanto não achar opção mais barata ou a análise
  não estiver completa: o resultado sai em até 1 minuto com o link, e a
  comparação incompleta (busca falhou, IA fora do ar, loja sem link) é refeita
  pela "segunda volta" da extensão (até 2 vezes), atualizando a tela sozinha.
  Nunca frase de "não consegui comparar" / "tente de novo" no resultado.
- Antes de publicar a extensão: ferramentas/verificar-extensao.sh (sintaxe,
  variável sem definição/import, testes). Um import esquecido na 1.97 derrubou
  a comparação inteira e "node --check" não pega isso.
- Antes de dizer ao Weslei que está pronto: rodar ferramentas/bateria-de-testes.sql
  (capinha, Eudora, disco de freio, monitor em página de oferta,
  pista dinossauro) na versão nova e conferir todas as metas. Falhou alguma:
  corrigir e rodar de novo. Só então avisar.

## Banco próprio no Supabase (18/10)
- O Lovable Cloud pausou o banco em 16/10 (~09:50 UTC) por falta de crédito
  (348 créditos gastos no ciclo de 200; o uso do banco sai do mesmo saldo).
  Weslei, 17/10: "eu não tenho como colocar sempre os créditos no lovable".
  O banco passou para o Supabase PRÓPRIO dele, plano grátis: projeto
  itgdvxvqbwjcvmglfval (sa-east-1), org do Weslei. O site, o domínio e a
  publicação continuam no Lovable (publicar não gasta crédito: testado em
  17/10).
- Montagem: supabase/base/00_base_lovable.sql (as 6 tabelas e funções antigas
  que o Lovable criou sem arquivo, reconstruídas pelo types.ts e pelas
  chamadas do site e da extensão) + as 88 migrações, aplicadas pelo próprio
  banco a partir do GitHub (public._aplicar_migracoes). Filas de cupom que
  abririam o Mercado Livre (etiquetas, links e vitrines de cupom, condições)
  devolvem vazio no banco novo. Numeração de todas as tabelas a partir de
  1.000.000 para o histórico antigo entrar depois sem bater número.
- Código: src/integrations/supabase/projeto.ts (endereço e chave publicável,
  públicos). A chave de serviço só nos Secrets do Lovable como
  MEU_SUPABASE_SERVICE_ROLE_KEY (os SUPABASE_* do Lovable Cloud apontam para
  o banco pausado). Os clientes gerados pelo Lovable (client.ts,
  client.server.ts, auth-middleware.ts) foram editados para usar projeto.ts:
  se o Lovable regerar, refazer. Se o Secret tiver outro nome, vale o único
  cujo VALOR começa com sb_secret_ (chaveDeServico; /api/public/saude diz só
  como a chave foi achada). Extensão 1.167.1 aponta para o banco novo. A
  senha da extensão (sinc_config 'token') é SÓ DE LETRAS e o campo das
  opções descarta número e espaço ao salvar (18/10: a tecla 9 do notebook
  digita sozinha). Weslei copia do editor de tabelas do Supabase e cola com
  o botão direito.
- Ligado em 18/10 ~14:45 UTC: banco ok, extensão 1.167.1 despausada,
  rotinas religadas. Vitrines recomeçaram do zero: em_alta disparado nas 10
  categorias (88 "mais vendidos"), brinquedos em_alta e mercado; as
  comparações dos agentes refazem a vitrine geral (13 produtos na 1ª hora).
  1ª comparação depois da pausa caiu na verificação do Mercado Livre
  (resolvida pelo Weslei no Chrome do notebook); as seguintes saíram
  completas, todas com meli.la.
- EXTENSÃO RECUSADA 4 DIAS (19/10 02:25 a 23/10): ela estava ligada, mas
  lê a chave publicável no javascript do site, e o
  import.meta.env["..."] (colchetes) embutia o .env inteiro com a chave do
  banco do Lovable; o banco novo respondia 401 (bad_checksum) a tudo e o
  visto_em parou. Acesso a env só com ponto (src/vite-env.d.ts). Extensão
  "parada": antes de culpar o notebook, olhar os 401 nos logs do Supabase
  (edge_logs, prefixo da chave).
- BANCO DO LOVABLE NUNCA MAIS (Weslei, 23/10: "Não usaremos o banco do
  lovable. Não deve usar 1 crédito sequer!"): o histórico antigo NÃO será
  copiado. Proibido qualquer ferramenta do Lovable que toque o banco ou gaste
  crédito: query_database, get_database_status, enable_database,
  send_message, create_project, remix_project. Banco = só o Supabase
  itgdvxvqbwjcvmglfval (mcp__Supabase__*). Do Lovable só list_edits,
  get_project e deploy_project (publicar não gasta crédito, 17/10).

## Publicação
- Branch claude/ml-etiquetas-cupons-k6tgkj e main recebem o mesmo commit.
- Depois do push: esperar list_edits "completed" e chamar deploy_project.
  Sem o deploy_project o site continua na versão anterior (28/09: a vitrine
  ficou sem o selo novo e parecia que a melhoria tinha sumido).
- Mudança na extensão sobe a versão em extensao/manifest.json; o Weslei
  atualiza rodando ferramentas/ATUALIZAR-EXTENSAO.bat.
