# canais (moved verbatim from CLAUDE.md on 2026-11-04)

Scope: Telegram bot, price tracking, YouTube Shorts.

## Bot do Telegram (02/10)
- /api/public/telegram-webhook: o cliente manda o link (longo ou meli.la) e
  recebe a comparação com as MESMAS regras da tela (src/lib/telegram.ts usa
  opcoesDaAnalise + decisaoDaTela): melhor preço do mesmo produto (pelo total
  com o frete conhecido), Melhor alternativa com o que muda, loja oficial,
  Pix x parcelado (src/lib/pagamento.ts, igual ao site), frete em linha
  própria e só links de afiliado. Pedido por pedir_comparacao; espera até
  ~50 s e, sem resultado, manda o link de afiliado (se já saiu) e o site
  (/?link=..., que abre a comparação sozinho).
- Token em API_TELEGRAM (Secrets). /api/public/telegram-setup registra o
  webhook com um segredo derivado do token; o webhook recusa chamada sem ele.
- PRIMEIRO ACESSO (Weslei, 02/10): boas-vindas amigáveis com o "como funciona"
  e o vídeo do site (public/video/como-funciona-v4-vertical.mp4) só na
  primeira conversa (tabela telegram_chats) e em /start ou /ajuda.
- Mensagem SEM link: o modelo entende e responde (GPT primeiro; reserva
  flash-lite/Gemma, que não disputam a cota dos modelos maiores da
  conferência), curto, sem inventar preço/loja, sem prometer cupom, sem citar
  IA e sem mandar link (resposta com link é descartada). Até 30 por conversa
  por dia; sem modelo, resposta pronta pedindo o link e como copiá-lo.

- CANAL DE OFERTAS (05/10): @melhorescolha_ofertas (Secret
  TELEGRAM_CANAL_ID); o bot @AfiliadosMELI_bot é admin do canal só com
  "Publicar mensagens". Posts do garimpo com teclado: "Comprar com segurança"
  (afiliado) e "Comparar o meu produto" (bot ?start=canal).
  POST COM FOTO (Weslei, 05/10: "melhore a mensagem, melhore a disposição
  da foto"): sendPhoto com a foto grande do produto (mlstatic -O.jpg) e
  legenda em blocos (produto; mesmo/parecido, muda, qualidade, desvantagens;
  preço, anúncio comparado riscado, economia no produto com %, frete em
  linha própria; loja e hora da conferência). Link de afiliado nos botões;
  foto recusada (ok=false) -> texto com o link e sem prévia; sem resposta
  -> não reenvia (evita post duplicado).
- CONVITE NO SITE: nomes só em src/lib/telegram-publico.ts; componente
  ConviteTelegram (pilula no topo, cartao abaixo do resultado pronto / na
  home com a caixa parada / em /meus-precos, linha no rodapé) e página
  /telegram (no rodapé e no sitemap). Nunca na BarraFixa nem carregando.
  Deep link t.me/AfiliadosMELI_bot?start=<origem>; origens válidas: topo,
  home, resultado, meus_precos, rodape, pagina_telegram, canal (gravada em
  telegram_chats.origem só no primeiro contato).

## Acompanhar preço (teste, 28/09)
- Botão "Acompanhar preço" no resultado (preço-alvo opcional) e página
  /meus-precos (aba "Meus preços" no topo, de volta em 02/10 a pedido do
  Weslei; histórico, "caiu R$ X", "chegou no seu preço", link de
  afiliado). Sem cadastro: id aleatório do navegador (lib/navegador.ts),
  limite de 20 por navegador e 200 produtos no total; aviso só no site.
- SEM SerpAPI e sem pedido de comparação (Weslei: "não gaste meus créditos da
  api do serpapi"): a extensão (monitorarPrecos) abre só a página do produto,
  no máximo 1 leitura a cada 10 min, com a extensão parada e sem freio de
  captcha. O banco (proximo_monitor/gravar_monitor) decide o intervalo: 3 h
  se mexeu ou está perto do alvo, 6 h parado, 12 h parado 3 vezes, 2 h com
  erro; pesquisa do site nas últimas 3 h conta como leitura (precos_vistos).
- AVISO NO TELEGRAM (05/10): "Avisar no Telegram" no "Acompanhar preço" e em
  /meus-precos (AvisoTelegram). alerta_telegram(navegador, monitor) só para
  quem segue o produto -> t.me/AfiliadosMELI_bot?start=alerta_<codigo>; o bot
  liga (ligar_alerta_telegram, só servidor). Gatilho monitor_para_telegram:
  preço lido no alvo (ou, sem alvo, 1% abaixo do último aviso) marca
  pendente e chama operacao?tarefa=alertas (src/lib/alertas-telegram.ts):
  mensagem com preço agora/antes, alvo, frete "confira no anúncio" em linha
  própria e botões (compra só meli.la; senão comparar no site). Tabela
  monitor_telegram (só serviço).
- Liga/desliga: sinc_config.monitor_ativo. Tabelas monitor_precos e
  monitor_seguidores (só funções security definer; leitura pelo navegador).

## Shorts no YouTube (10/10)
- Weslei, 10/10: "PROMPT MESTRE: AUTOMAÇÃO DE SHORTS ULTRA-REALISTAS".
  Pacote Python scripts/automacao_shorts/ (roda no computador do Weslei;
  LEIAME.md com a instalação): radar_produtos (campanhas_ativas, só
  "mesmo"/"menor", preço conferido < 24 h, sem repetir em 14 dias, regras
  de falso/usado/peça/desconto real portadas em regras.py), gerador_roteiro
  (gancho, valor, comparação, CTA, loop; nenhum valor em reais além dos 3
  conferidos; nada de "testei"/"neste vídeo"; frete em frase própria;
  polimento opcional só se passar na validação; SEO com título <= 70 e
  #Shorts, 3-4 hashtags, 8-12 tags sem "review"/"unboxing"),
  higgsfield_video (API oficial api.higgsfield.ai, imagem->vídeo da foto
  real, estúdio clean por padrão), voz_narracao (ElevenLabs com tempos;
  reserva OpenAI TTS), editor_video (ffmpeg/imageio-ffmpeg, 1080x1920,
  legendas ASS, cartão de preço com o comparado riscado, loop pelo 1º
  quadro), youtube_publisher (OAuth persistente em credenciais/, fora do
  git; cota local; containsSyntheticMedia = true; comentário com o link).
- Limites: a API não fixa comentário (fixar no Studio); link em Shorts não
  é clicável; privado por padrão (SHORTS_PRIVACIDADE).
