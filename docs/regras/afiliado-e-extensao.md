# afiliado-e-extensao (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Affiliate links, link recognition, shown price = link price, extension without/paused, ML affiliate lists.

## REGRA Nº 1: SEMPRE DEVOLVER O LINK DE AFILIADO DO WESLEI (10/10)
- Weslei, 10/10: "SEMPRE DEVE DEVOLVER O MEU LINK. Não deve ter dúvidas
  disso, essa é a minha fonte de renda por ser afiliado!". Vale acima de
  qualquer outra regra de exibição, em todo canal: site, vitrines,
  campanhas, brinquedos, busca guiada, busca por foto, Meus preços, bot,
  canal, Facebook e Shorts.
- Todo caminho de compra termina num link de afiliado DELE (Mercado Livre
  só https://meli.la/<código>; Amazon tag=melhoresc0fff-20 ou amzn.to;
  Shopee s.shopee.com.br ou shope.ee). Nunca endereço sem afiliado, nunca
  link de outra pessoa, nunca botão que leva a lugar nenhum.
- Ordem de garantia (VerNaLoja e pedir_link_da_loja, 20261010233000):
  1) link pronto na tela; 2) link já gerado antes para o MESMO anúncio
  (link_conhecido: na hora, sem extensão); 3) link gerado no clique pela
  extensão; 4) sem ele em 6-12 s (extensão parada, pausada, no freio ou fila
  cheia), o link de afiliado da PÁGINA DO PRODUTO (link_de_reserva), com o
  aviso no botão "Abre a página do produto com a oferta em destaque: o preço
  pode ser diferente" (nunca afirma o preço que não entrega); se o link da
  loja sair depois, ele toma o lugar. Barra fixa do celular e cartões de
  brinquedo sem link também geram no clique.
- Link que falha (erro do gerador, 111, captcha) é refeito: 2ª e 3ª
  tentativa na extensão, reparo links_a_refazer (3 a cada 3 min, só sem
  cliente) e o Guardião (auditoria_exibicao: pronto_sem_link e
  link_no_clique_falhou são GRAVES). Ninguém "aceita" um pedido sem link.
- Mudança que toca botão, link, vitrine, bot ou canal: conferir antes de
  publicar que o caminho continua terminando no link dele.

## Reconhecimento universal de links (10/10)
- Weslei, 10/10: "preciso que ele aceite qualquer link e identifique o
  produto... caso seja um link de um player que não estou afiliado,
  identifique o produto e busque no mercado livre". Link nunca vira "link
  inválido".
- src/lib/analisar-link.ts (analisarLink -> AnaliseLink {origem:
  mercadolivre | amazon | shopee | outro_player | invalido, urlLimpa,
  identificador, termoIdentificado, nomeLoja, encurtado}): só o texto, sem
  rede. Nome do endereço como a loja escreveu (decodificado, hífen ->
  espaço, sem código/SKU/rastreio: MLB-, -i.loja.item, -p-, -g-, _JM, SKU
  longo); sem nome no endereço, o texto em volta (título que o app manda,
  sem "Confira este produto", preço nem "na Amazon"). Testes:
  tests/analisar-link.test.ts (os 6 casos do pedido + extras).
- /api/public/identificar-link (src/lib/identificar-link.ts): resolve
  encurtado (amzn.to, a.co, shope.ee, s.shopee.com.br, AliExpress, bit.ly)
  só pelos redirecionamentos, sem abrir a página; loja conhecida sem nome no
  endereço: lê só o título (og:title/<title>, 400 KB, 4,5 s); página de
  verificação não vale (a Amazon devolve "Amazon.com.br" de robô). Só host
  público com nome. Nada guardado. Encurtado que era do Mercado Livre segue
  a comparação de sempre.
- Tela (LinkDeOutraLoja, no lugar do erro): "Loja do link: X" e "Produto
  identificado: Nome". Outra loja (Magalu, KaBuM!, Casas Bahia, Americanas,
  Shein, AliExpress, Temu...): a busca no Mercado Livre começa sozinha
  ("Buscando o melhor preço para você no Mercado Livre..."), cartões da
  busca guiada (ResultadosDaBusca, buscarProdutos em
  src/lib/busca-guiada-cliente.ts) com "Comprar com segurança" (meli.la no
  clique) e "Comparar preço". Amazon: "Comprar com segurança" do produto
  exato (gerarUrlAfiliadoAmazon, tag do Weslei) + "Buscar o mesmo produto"
  sob demanda. Shopee: o nome + busca sob demanda (link de afiliado da
  Shopee só pela extensão). Texto sem link: aviso amigável + "Buscar
  “nome”". Sem nome: campo "Qual é o produto?".
- ?link= (bot e app instalado) aceita qualquer link; o texto todo vai junto.
- Bot: link de outra loja -> mensagemOutraLoja/tecladoOutraLoja
  (src/lib/telegram.ts): loja, produto identificado, "Comprar com
  segurança" (só Amazon com a tag) e "Buscar o mesmo produto" (site).
- Garimpo DENTRO da Amazon/Shopee a partir de um link delas: feito em
  11/10 (ver "Garimpo no player de origem e campeão do nicho").

## Preço mostrado = preço que o link abre (10/10)
- Weslei, 10/10: "o preço indicado foi de R$8. Ao acessar o link, subiu
  para R$13. Isso não pode ocorrer jamais, em nenhum player" (pedido 1215,
  busca por foto, pó facial banana). Causa: o link do anúncio colado saía da
  CANÔNICA da página; numa página de catálogo ela é /p/MLB... SEM o
  anúncio, e o link da ficha abre a oferta destacada (outra loja, R$ 13 com
  frete grátis). O gerador devolve o mesmo link para todas as ofertas da
  ficha (24/09). Em 30 dias, 519 pedidos com anúncio definido saíram assim.
- Extensão 1.165.6: enderecoDaOfertaLida (comparador.js) gera o link do
  anúncio colado e dos achados pelo Google pelo endereço do PRÓPRIO anúncio
  lido (produto.mercadolivre.com.br/MLB-..., o mesmo da tabela e do "gerar
  no clique"); analise.linkDe guarda de onde o link saiu. Nunca a ficha.
- Banco (20261010170000_link_da_oferta.sql): trava pedido_link_da_oferta
  (link_da_ficha pelo registro geracoes) descarta o link da ficha num pedido
  que aponta um anúncio (analise.linkDaFichaDescartado) e a tela gera o link
  do anúncio no clique (VerNaLoja; vitrine também, cartao). Limpeza aplicada:
  541 pedidos, 343 cartões da vitrine, 47 ofertas de campanha (saíram; a
  curadoria as traz de volta) e 1 acompanhamento. Reparo: links_a_refazer +
  pg_cron links-refazer (10 min) põem 3 pedidos "(so link)" internos por vez
  com o endereço do anúncio, só com a extensão 1.165.5+ e sem cliente
  esperando; link_refeito devolve o link novo aos pedidos, à vitrine e ao
  acompanhamento.
- SEM ATUALIZAR A EXTENSÃO (Weslei, 10/10: "não consigo atualizar a
  extensão agora"; 20261010180000_link_da_oferta_sem_atualizar.sql): toda
  geração passa por reservar_geracao antes do gerador. Chave = ficha (/p/
  sem anúncio) e o pedido em andamento aponta um anúncio dela: com o link do
  anúncio já conhecido (link_do_anuncio: geracoes pelo endereço do anúncio
  ou reparo) devolve 'existe' com ele; senão 'ficha' (recusa) e a 1.165.0 cai
  na 2ª tentativa, que gera pelo endereço do anúncio. Testado no banco
  (transação desfeita): sem pedido, 'existe' de sempre; com pedido, 'ficha';
  endereço do anúncio, 'reservado'. A trava nunca troca link bom pelo da
  ficha (mantém o antigo ou usa o do anúncio) e põe o anúncio no reparo; o
  reparo mede o gerador (últimos 3 em < 20 s ou 1.165.5+: 3 por vez; lento:
  1 por vez, só sem cliente nos últimos 15 min) e devolve o link a todo
  pedido pronto sem link daquele anúncio (a marca some quando a extensão
  regrava a análise, pedido 1222); pedido recente entra na vitrine.
  Conferido em 10/10 15:50 na 1.165.0: pedido 1215 e vitrine com
  meli.la/2sfJJDp, gerado pelo endereço MLB-5141126371 em 2 s.
  Ritmo (20261010191000): na 1.165.0 o 1º link de um lote sai em 1-2 s e
  os seguintes em ~50 s (aba do gerador dormindo), então 1 por vez a cada
  5 min; 3 por vez só na 1.165.5+. Recusado pelo programa (111) sai da
  fila. Brinquedos (curadoria_brinquedos exige o link do pedido) na frente.
  1.165.6 instalada em 10/10 23:04 e conferida pela bateria: pedido 1316
  (pó de banana) R$ 8 com meli.la/2sfJJDp pelo MLB-5141126371 em 20 s;
  capinha (1317) pelo MLB-4739054961; pista dinossauro (1310) ficou sem
  link porque o anúncio está indisponível e é recusado (111), o certo.
  Reparo: 3 links por vez, 2-3 s cada.
- Bot: anúncio enviado sem link entra só como referência de preço
  (enviadoSemLink, decisaoDaTela(opcoes, enviado)); sendo o melhor, a compra
  é pelo site. Nunca "R$ 0,00 a menos".
- Busca guiada/por foto: oferta NOVA da lista oficial e "Preço de um
  anúncio do catálogo agora / às HH:MM: pode mudar" (a resposta fica até
  6 h guardada; lidoEm).

## Comparação sem a extensão (19/10)
- Weslei, 19/10 (print "A conferência de links está pausada neste
  momento"): "Isso não pode ocorrer, deve sempre funcionar". A extensão
  ficou sem contato de 02:25 a 16:45 UTC (notebook desligado).
- Com a extensão parada (roboAtivo falso), sem pedido aceito, pedido que
  falhou ou que ninguém pegou em 90 s (NINGUEM_PEGOU_MS), o SERVIDOR compara
  (/api/public/comparar-agora, src/lib/comparar-agora.ts): só a API oficial
  (/products/{id} + /products/{id}/items), nada gravado. Ficha do link (/p/):
  a oferta do anúncio do link ou, sem ele, a oferta em destaque
  (buy_box_winner) e, sem destaque, a mais barata SEGURA (não muito abaixo
  das outras lojas, salvo loja oficial; frete grátis primeiro) é a
  referência; as outras lojas da MESMA ficha (só
  condição nova, uma linha por loja, a mesma loja só com outro anúncio mais
  barato) vão para a tabela com "Mesmo produto, na mesma página de
  catálogo" (sem a frase de conferência pela foto). Links: só o meli.la já
  gerado para o mesmo anúncio (link_do_anuncio); sem ele, VerNaLoja gera no
  clique e cai na reserva. analise.modoServidor: aviso no topo e sem a
  seção dos 3 marketplaces. Anúncio fora da ficha, link sem ficha (anúncio
  avulso) ou API sem resposta: BuscaPeloNome (catálogo pelo nome do
  endereço, "Comprar com segurança" e "Comparar preço"). Testes em
  tests/comparar-agora.test.ts.
- Limite: produto nunca comparado antes, com a extensão parada, não tem
  link de afiliado pronto (o gerador só existe na sessão logada do Chrome);
  o botão fica no "gerar no clique" até a extensão voltar.

## Pausa remota da extensão (10/10)
- Weslei, 10/10: "Pause a extensão por enquanto, não estou com o notebook
  neste momento". A extensão só trabalha com o que o banco entrega
  (20261010200000_pausa_remota_extensao.sql): com
  sinc_config.extensao_pausada = 'true' as filas que ela consulta devolvem
  vazio sem reservar nada (pedidos_pendentes e v2, avaliações, fotos da
  vitrine, lojas, cupons, multiloja, "Acompanhar preço"; as originais ficam
  como *_sem_pausa), pausa_geral = 1 (reservar_geracao recusa todo link),
  operacao_pausada = 'true' (agentes) e o reparo do link para; freio_ate
  daqui a 30 dias faz o site mostrar "A conferência de links está pausada"
  na hora (roboAtivo), e anotar_estado_robo não deixa a extensão limpar esse
  freio. Fica de fora a leitura diária do hub de afiliados (decidida no
  navegador). Auditoria: 'extensao_pausada' (atenção) e sem 'pedido_parado'.
  LIGAR/DESLIGAR: select public.pausar_extensao(true|false) (só servidor).
  Testado em 10/10 20:04 (transação desfeita): filas vazias, reservar
  'bloqueado', freio mantido depois da tentativa de limpar.
  Retomada em 10/10 23:05 (Weslei atualizou para a 1.165.6). Na volta,
  com todas as filas liberadas de uma vez, o Mercado Livre pediu uma
  verificação em 2 leituras (pedidos 1305 e 1306); o freio da extensão
  agiu e as leituras seguintes passaram.

## Listas de afiliado do Mercado Livre (02/11)
- Weslei, 02/11: agente das listas em myaccount.mercadolivre.com.br/
  bookmarks/list ("administrar, atualizar, criar categorias, incluir
  produtos ... qualidade e dados que garantam conversão"). 9 listas
  temáticas Públicas, 60 a 100 produtos cada, nota 4,5+ com 20+ avaliações;
  comissão só desempata; só sai o que o agente incluiu. Detalhes, como
  aplicar e controles em docs/listas-afiliado.md. SQL em
  supabase/manutencao/20261102_listas_afiliado.sql (aplicar no Supabase
  próprio). Extensão 1.174.0 (extensao/listas.js).
