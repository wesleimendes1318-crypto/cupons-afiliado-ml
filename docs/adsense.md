# Google AdSense

Tudo vem **desligado**. Sem Publisher ID, nenhum script do Google é baixado e
nenhum espaço de anúncio aparece ou ocupa altura.

## Como ativar
1. Variáveis de ambiente públicas (build):
   - `VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` (Publisher ID do painel);
   - `VITE_ADSENSE_SLOT_GUIA_MEIO` e `VITE_ADSENSE_SLOT_GUIA_FIM`: ids das duas
     unidades de anúncio **manuais** (criadas em Anúncios > Por bloco de anúncios).
     Sem slot, o espaço correspondente não aparece.
2. Em `public/ads.txt`, troque a linha comentada pela linha oficial que o painel
   mostra (`google.com, pub-..., DIRECT, f08c47fec0942fa0`). O arquivo é servido
   em `/ads.txt` como `text/plain`.
3. Publique o site.
4. No painel do AdSense, verifique a propriedade do site pelo método da
   **meta tag** (`google-adsense-account`, já no `<head>` de todas as páginas,
   vinda do mesmo `VITE_ADSENSE_CLIENT`) ou pelo **ads.txt**. O método do
   snippet não serve: o script só carrega com consentimento, e o verificador
   do Google não consente, então nunca o veria.

O script só carrega para quem marcou **Publicidade** no aviso de cookies
(desmarcada por padrão). Quem revogar deixa de ver anúncios na hora.
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
O ID ca-pub-5848712376900651 está como padrão em `src/components/Anuncio.tsx`
(`PUBLISHER_PADRAO`), porque o arquivo `.env` é gerado pela plataforma. Para
desligar, esvazie `PUBLISHER_PADRAO` (e `VITE_ADSENSE_CLIENT`, se definida) e
publique. Nada mais é carregado.
