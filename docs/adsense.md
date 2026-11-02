# Google AdSense

**Ligado desde 02/11/2026** com o Publisher ID `ca-pub-5848712376900651`
(padrão em `src/components/Anuncio.tsx`; `VITE_ADSENSE_CLIENT` ainda pode trocar).
O código `adsbygoogle.js` vai no `<head>` de todas as páginas, no HTML do
servidor, logo depois do consentimento negado por padrão, e `/ads.txt` já tem a
linha oficial. Assim o verificador do Google acha o snippet, a meta tag e o ads.txt.

## Como ativar
1. Variáveis de ambiente públicas (build):
   - `VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` (Publisher ID do painel);
   - `VITE_ADSENSE_SLOT_GUIA_MEIO` e `VITE_ADSENSE_SLOT_GUIA_FIM`: ids das duas
     unidades de anúncio **manuais** (criadas em Anúncios > Por bloco de anúncios).
     Padrões em `Anuncio.tsx` (02/11), usados quando a variável está vazia:
     - `2786465840` — bloco "Guia - meio do artigo" (`VITE_ADSENSE_SLOT_GUIA_MEIO`);
     - `7847220834` — bloco "Guia - fim do artigo" (`VITE_ADSENSE_SLOT_GUIA_FIM`).
2. Em `public/ads.txt`, troque a linha comentada pela linha oficial que o painel
   mostra (`google.com, pub-..., DIRECT, f08c47fec0942fa0`). O arquivo é servido
   em `/ads.txt` como `text/plain`.
3. Publique o site.
4. No painel do AdSense, verifique a propriedade do site pelo método da
   **meta tag** (`google-adsense-account`, já no `<head>` de todas as páginas,
   vinda do mesmo `VITE_ADSENSE_CLIENT`) ou pelo **ads.txt**. O método do
   snippet não serve: o script só carrega com consentimento, e o verificador
   do Google não consente, então nunca o veria.

Sem **Publicidade** marcada no aviso de cookies (desmarcada por padrão), o Modo
de Consentimento fica negado e o Google não grava cookies de anúncio. As
unidades manuais só aparecem para quem autorizou; quem revogar deixa de vê-las na hora.
**Não ligue os Anúncios Automáticos** no painel: o posicionamento é só manual.

## Onde aparecem
Só no artigo individual dos Guias (`/guias/<slug>`): um depois do 2º bloco do
texto e um no fim, antes de "Continue lendo". Componente: `src/components/Anuncio.tsx`.

## Por que não em outras páginas
Home, comparação, busca, Meus preços/alertas, categorias, institucionais e todo
o caminho até o link de afiliado ficam **sem anúncio**: anúncio ali tira o
clique do afiliado (que vale mais) e página sem conteúdo editorial próprio
viola a política de posicionamento do AdSense.

## Como desligar
Troque o padrão em `Anuncio.tsx` por `""`, deixe `VITE_ADSENSE_CLIENT` vazio e publique.
