# Vídeos de divulgação (27/09/2026)

## Comercial (28 s, estilo Apple) — o principal

    cd ferramentas/video && npm install
    python3 trilha.py trilha.wav        # trilha original (precisa de numpy)
    PAGINA=comercial.html AUDIO=trilha.wav node render.js <ffmpeg-com-libx264> v comercial-vertical.mp4
    PAGINA=comercial.html AUDIO=trilha.wav node render.js <ffmpeg-com-libx264> h comercial-horizontal.mp4

Roteiro e legenda: `roteiro-comercial.md`.

## Tutorial longo (49 s, sem áudio) — primeira versão

Vídeo de 49 s em dois formatos, gerado quadro a quadro a partir de `video.html`
(tudo depende só do tempo, então o resultado é sempre igual).

Para gerar de novo:

    cd ferramentas/video
    npm install            # fonte Inter (@fontsource/inter)
    node render.js <caminho-do-ffmpeg-com-libx264> v melhor-escolha-vertical.mp4
    node render.js <caminho-do-ffmpeg-com-libx264> h melhor-escolha-horizontal.mp4

Precisa do Playwright (Chromium). Se ele estiver instalado fora da pasta,
defina PLAYWRIGHT_MODULE com o caminho do módulo.

Regras seguidas: exemplos reais medidos em 26/09 (com a data na tela), lojas
sem nome, sem citar IA, sem prometer cupom, "Mercado Livre" só descritivo e
aviso de site independente e de comissão na chamada final.
Roteiro, narração sugerida e legenda da postagem: `roteiro-narracao.md`.
