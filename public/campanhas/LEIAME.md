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

## Artes de estúdio (Weslei, 05/10, noite)
- estudio-criancas.webp, estudio-natal.webp, estudio-black_friday.webp: a parte
  do estúdio (fundo ripado, pedestais, cartão de comparação) recortada das artes
  enviadas, sem o texto. Ligadas em TEMAS_VISUAIS[tema].imagem com estudio: true.
- public/sazonal/*.jpg: as artes completas (com texto e marca), 1200x675, só
  como imagem de compartilhamento (og:image).
