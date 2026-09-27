# Regras do projeto (Weslei Mendes, melhorescolha.io)

Leia também AGENTS.md (nunca force-push nem reescrever histórico publicado).

## Produto
- O site é um COMPARADOR de preços do Mercado Livre. Por enquanto só Mercado Livre.
- Todo link colado precisa ser comparado com o MESMO produto em outras lojas.
- Só mostrar outra loja quando a Gemini confirmou pela foto que é o mesmo produto.
  Produto parecido apresentado como igual é o pior erro possível.
  - Todo "igual" passa por DUAS conferências (a segunda foto com foto, de
    preferência por outro modelo) e qualquer diferença listada reprova.
  - Gemma (mesma chave) só quando a Gemini não der (cota, fora do ar, tempo),
    sempre depois de todos os Gemini e com confiança mínima de 90
    (autorizado pelo Weslei em 25/09).
  - A foto não precisa ser idêntica (cada vendedor faz a sua): conta o PRODUTO.
    Diferença é o que contradiz o original (marca, cor/borda, modelo, tamanho,
    quantidade, acessório junto), não fundo/ângulo/montagem.
  - Contradição é o que os DOIS anúncios dizem de forma diferente. Nome de
    linha/abreviação que só um título tem não reprova ("Basic 3s" x "Woven 3
    Listras", mesma foto oficial: a loja R$ 83 mais barata tinha ido para
    Parecidos, 27/09). Roupa: peças, cor de cada parte, listras/estampa, logo,
    gola/capuz/zíper, modelagem, gênero; tecido só se os dois informam; tamanho
    da grade não conta. A IA diz mesma_foto e semelhança (0-100). Reprovado com
    a MESMA foto é revisto na segunda conferência (outro modelo) e só vira
    igual com igual + mesma foto + confiança >= 90. Vereditos guardados antes
    de 28/09 00:00 UTC não valem.
  - Parecidos em ordem de semelhança (mesma foto, semelhança, preço), com o
    aviso "Mesma foto do anúncio colado" quando for o caso.
  - "Parecidos" (mesmo tipo e compatibilidade, muda marca/detalhe) aparecem
    SEPARADOS, com aviso "não é o mesmo produto" e o que muda, cada um com o
    link de afiliado (Weslei, 25/09).
  - O Adapta One não oferece API das IAs (central de ajuda deles): não serve
    para o comparador.
- Todo link de compra precisa ser o link de afiliado do Weslei. SEMPRE devolver o
  link de afiliado dele, inclusive do anúncio que o cliente colou; se a geração
  falhar, tentar de novo e oferecer o botão que gera o link no clique.
- Sempre mostrar a "Melhor opção", mesmo quando é o próprio anúncio colado.
- Mostrar TODAS as lojas comparadas (tabela zebrada), cada uma com o link de
  afiliado próprio (gerado pelo endereço do anúncio da loja, não da ficha).
- A consulta do cliente deve terminar em até 1 minuto (meta interna). Para o
  público o texto é "em menos de 2 minutos" (Weslei, 27/09: não prometer 1
  minuto; medido 24–27/09 nos pedidos do site com tempo registrado: 89 de 91
  com o 1º resultado em menos de 2 min, metade em até 32 s). Previsões de tempo na tela vêm de medição real (função
  tempo_estimado), nunca inventadas.

- Frete conta: loja com frete PAGO nunca vira "mais barata"/recomendação
  (R$ 57 + R$ 32,99 de frete saía mais caro que R$ 86,90 com frete grátis).
  Na tabela aparece "Frete grátis" ou "Sem frete grátis".
  Frete é o que o COMPRADOR paga (26/09): free_shipping/has_free_shipping
  false só diz que o vendedor não banca. Fonte certa: shipping.cost da lista
  oficial de ofertas (0 = grátis, > 0 = pago; Baba Black R$ 57 cost 44,92) e o
  texto "grátis" no cartão da busca. Sem isso, "não sei" (a tela não afirma).
  Nunca deduzir pela regra geral de R$ 19 (errou no Baba Black).
- Mesma loja do link colado entra na comparação só com OUTRO anúncio dela
  mais barato ("Mesma loja, outro anúncio"; Camelo R$ 78,54 x R$ 86,90).
- UMA recomendação só: é sempre a mesma linha que leva o selo "Mais barato"
  na tabela (Advocate, 26/09: tabela e recomendação apontavam lojas diferentes).
- SEMPRE o link de afiliado do Weslei em todo botão (26/09: "foi para isso
  que eu criei o site"). Nunca endereço sem afiliado.
- Anúncio que o programa recusa ("URL not allowed", erro 111): pela ficha o
  gerador devolve o mesmo link do anúncio colado (um link por ficha), que abre
  na oferta principal (medido em 26/09, Advocate). A extensão tenta a forma
  MLB-...-_JM; não dando, a loja fica na tabela com o link da ficha e o aviso
  "escolha esta loja em Outras opções de compra" (semAfiliado), e a
  recomendação é a mais barata com link PRÓPRIO e frete grátis (Weslei, 26/09).
  O cadastro não chama o gerador de novo para anúncio recusado há menos de 24 h.
- Economia sempre contra o preço que a página mostra ao cliente (a API pode
  trazer outro: Advocate R$ 169,90 na API x R$ 147,81 na página).
- Busca dos links SEM teto diário (o teto era dos cupons). Fica só o freio de
  captcha/tráfego suspeito e o ritmo de um pedido por vez.

- Link repetido (mesmo link, análise completa há menos de 1 h) volta na hora
  (pedir_link). A bateria de testes usa pedir_link_novo, que sempre busca.

## Texto e visual
- Botão de compra NUNCA leva o nome da loja: usar texto de compra segura
  ("Comprar com segurança"). Sempre oferecer compartilhar no WhatsApp.
- "Mercado Livre" só de forma DESCRITIVA e com moderação (Weslei, 26/09, para
  a busca no Google: "comparador de preços do Mercado Livre"), sempre com o
  aviso de site independente, sem vínculo. Nunca logo, cores ou visual da marca,
  nem em botão de compra.
- Textos curtos. Não prometer cupom. Sempre mostrar foto do produto.
- Não citar IA/inteligência artificial nos textos do site nem nos guias
  (monetização: diretrizes do Google Ads e do programa de afiliados).
- Guias com exemplos REAIS (dados medidos nos pedidos, com data), sem nome de
  vendedor.
- Vídeo "Como funciona" (27/09): comercial de 28 s junto da caixa do link.
  1º acesso toca sozinho (mudo, com "Ativar som"); depois vira botão. UM
  exemplo só no vídeo (kit com 2 óleos capilares, 25/09: R$ 428,90 → R$ 291,95,
  "R$ 136,95 a menos") para não misturar preços. No vídeo (Weslei, 27/09):
  sem citar cupom, sem citar Mercado Livre, "em menos de 2 minutos", sem marca
  do produto e link ilustrativo em example.com (domínio reservado). Frete:
  "Frete pago não passa na frente / Frete grátis conta a favor" (vale em todo
  caso do código). Mesmo estilo e trilha; só os exemplos mudam.
  Fonte em ferramentas/video/ (comercial.html, trilha.py); arquivos em
  public/video/ (WebM + MP4, 720p).

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
  (capinha, travesseiro, Eudora, disco de freio, monitor em página de oferta,
  pista dinossauro) na versão nova e conferir todas as metas. Falhou alguma:
  corrigir e rodar de novo. Só então avisar.

## Publicação
- Branch claude/ml-etiquetas-cupons-k6tgkj e main recebem o mesmo commit.
- Depois do push: esperar list_edits "completed" e chamar deploy_project.
- Mudança na extensão sobe a versão em extensao/manifest.json; o Weslei
  atualiza rodando ferramentas/ATUALIZAR-EXTENSAO.bat.
