# Shorts automáticos do Melhor Escolha

Radar (produtos já comparados no site) → roteiro (português coloquial, sem
número inventado) → narração → cenas no Higgsfield (a partir da foto real do
anúncio) → montagem 9:16 com legendas → upload no YouTube com o primeiro
comentário.

## 1. Instalar (uma vez)

```bat
cd C:\caminho\cupons-afiliado-ml
python -m pip install -r scripts\automacao_shorts\requirements.txt
```

O ffmpeg vem pelo pacote `imageio-ffmpeg` (já com legendas). Se preferir o do
sistema, ponha o caminho em `FFMPEG_BIN`.

## 2. Chaves (só em variável de ambiente, nunca no código nem no git)

No Windows, uma vez por chave (abre um novo terminal depois):

```bat
setx HF_API_KEY_ID "..."            & rem Higgsfield Console > API keys
setx HF_API_KEY_SECRET "..."
setx ELEVENLABS_API_KEY "..."
setx ELEVENLABS_VOICE_ID "..."      & rem voz brasileira expressiva da biblioteca
setx OPENAI_API_KEY "..."           & rem opcional: voz reserva e polimento do roteiro
```

Opcionais: `SHORTS_PRIVACIDADE` (private | unlisted | public; padrão
private), `SHORTS_MAX_VIDEOS_DIA` (padrão 4, máximo 5), `SHORTS_CENAS`
(padrão 4), `SHORTS_DURACAO_CENA` (5 ou 10; padrão 10), `SHORTS_ESTILO`
(estudio | ambiente), `SHORTS_TRILHA` (mp3 com licença de uso),
`SHORTS_POLIR=1` (reescrita do roteiro pelo modelo, só se passar na mesma
validação), `SHORTS_MODELO_VIDEO` (padrão `kling-video/v2.6/pro/image-to-video`).

## 3. YouTube (uma vez)

1. Google Cloud Console → novo projeto → ative **YouTube Data API v3**.
2. Tela de consentimento OAuth: tipo Externo, seu e-mail como usuário.
   Depois de testar, mude o status para **Em produção** (no modo "Teste" o
   Google invalida o token em 7 dias e o upload automático para).
3. Credenciais → ID do cliente OAuth → **App para computador** → baixe o JSON
   e salve como `credenciais\client_secrets.json` (a pasta está no
   .gitignore).
4. Autorize o canal:
   `python -m scripts.automacao_shorts.youtube_publisher --autorizar`
   (abre o navegador; o token fica em `credenciais\youtube_token.json` e
   renova sozinho).

## 4. Rodar

```bat
rem Sem custo: só confere produtos, roteiros, títulos e descrições (pasta saida\)
python -m scripts.automacao_shorts.pipeline_principal --simular --max 3

rem Gera o vídeo completo e não envia
python -m scripts.automacao_shorts.pipeline_principal --max 1 --sem-upload

rem Gera e envia (privado até SHORTS_PRIVACIDADE=public)
python -m scripts.automacao_shorts.pipeline_principal --max 1

rem Vídeo que subiu privado: depois de publicar, poste o comentário
python -m scripts.automacao_shorts.pipeline_principal --comentar scripts\automacao_shorts\saida\20261010_MLB123

rem Gasto de cota de hoje
python -m scripts.automacao_shorts.youtube_publisher --cota
```

Agendar: Agendador de Tarefas do Windows, 3 a 4 vezes por dia, ação
`rodar_shorts.bat`.

## Regras que o código garante

- Produto só das campanhas do site (curadoria: meli.la, sem usado/defeito,
  sem peça, desconto real, frete grátis confirmado, vendedor confiável) e,
  aqui, só "mesmo produto" ou "menor preço", com preço conferido nas
  últimas 24 h e nunca repetido em 14 dias. Parecido fica fora (precisa do
  "o que muda").
- Nenhum valor em reais além dos 3 conferidos (comparado, achado e a
  diferença); nenhum outro número fora do título, da ficha e das avaliações.
- Nada de "testei", "uso há", "neste vídeo", "revolucionário"... (o vídeo
  compara preço, não testa o produto). Sem "review" nem "unboxing" nas tags.
- Frete em frase própria; sem confirmação: "frete a consultar no anúncio".
- Link só de afiliado: meli.la; Amazon com `tag=melhoresc0fff-20` ou amzn.to;
  Shopee s.shopee.com.br ou shope.ee.
- Descrição com "Participamos de programas de afiliados..." e a data do preço.

## Limites da plataforma (conferidos em 10/10)

- **A API do YouTube não fixa comentário.** O comentário sai pelo script; o
  "fixar" é 1 toque no YouTube Studio.
- **Link em Shorts não é clicável** (descrição e comentários, desde
  31/08/2023): a pessoa copia. Ponha o site como link do perfil do canal.
- **Conteúdo realista gerado por ferramenta precisa ser declarado**: o
  upload vai com `containsSyntheticMedia = true` (campo oficial). Isso não
  muda o alcance; não declarar pode tirar o vídeo do ar.
- Cota: 10.000 unidades/dia (upload 1.600, comentário 50). O script para
  antes de gastar crédito do Higgsfield se o upload de hoje não couber.
- Higgsfield cobra por cena (4 cenas de 10 s por vídeo no padrão).

## Itens da Amazon/Shopee (opcional)

`--entrada itens.json` com uma lista de objetos:

```json
[{"chave": "amazon:B0ABCDEFGH", "marketplace": "amazon", "titulo": "...",
  "imagem": "https://m.media-amazon.com/...jpg", "preco": 199.9, "antes": 259.9,
  "link": "https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20",
  "frete_gratis": null, "conferido_em": "2026-10-10T12:00:00-03:00",
  "caracteristicas": ["Bateria: 30 h"]}]
```

Preço e "antes" só se você conferiu; `frete_gratis` null vira "frete a
consultar no anúncio".

## Testes

`python -m unittest discover -s scripts/automacao_shorts/testes -t .`
