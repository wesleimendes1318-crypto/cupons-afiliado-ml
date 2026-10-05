# Artes salvas das campanhas

Arte gerada uma vez e reutilizada em todas as visitas (nada de gerar a cada
carregamento). Para usar uma imagem no lugar da cena vetorial de um tema:

1. Salve o arquivo aqui (WebP ou PNG, de preferência 1200 x 900, fundo da cor
   do tema), por exemplo `criancas.webp`.
2. Em `src/lib/campanha-visual.ts`, no tema, preencha
   `imagem: { src: "/campanhas/criancas.webp", largura: 1200, altura: 900 }`.

Artes geradas no Canva em 05/10/2026 (abrir e exportar em PNG):
- Dia das Crianças: https://www.canva.com/M/MAHXJ3w9jZw
- Natal: https://www.canva.com/M/MAHXJ_kWMww
- Tecnologia: https://www.canva.com/M/MAHXJyK4fCQ
- Casa e decoração: https://www.canva.com/M/MAHXJ_tNnsI
- Marca (neutro): https://www.canva.com/M/MAHXJyLrkag

## Artes enviadas pelo Weslei (05/10, noite)
- criancas.webp, natal.webp, black_friday.webp: recortes sem fundo (render 3D
  realista), ligados em TEMAS_VISUAIS[tema].imagem com recorte: true
  (object-contain, sem moldura). Têm prioridade sobre a arte gerada.
- public/sazonal/natal.jpg e black-friday.jpg: banners 1200x675 com a marca,
  usados como imagem de compartilhamento (og:image), nunca na vitrine (o texto
  da arte repetiria o título do HTML).
