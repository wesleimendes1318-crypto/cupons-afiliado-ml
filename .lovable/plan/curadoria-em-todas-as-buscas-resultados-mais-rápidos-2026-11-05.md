# Curadoria em todas as buscas + resultados mais rápidos

## O que muda para o cliente
- A mesma curadoria do Amigo Secreto passa a valer na busca principal, nas categorias, nas vitrines da home e nas campanhas:
  - nada de brinquedo em beleza, nem roupa infantil quando a busca é de adulto, nem peça masculina na vitrine feminina;
  - melhores marcas primeiro (skincare, bijuterias, calçados, eletrônicos, casa);
  - o mesmo modelo em outra cor aparece uma vez só; o resto abre em "Comparar preço";
  - estação do ano influencia a ordem (agora: verão e Natal).
- Os primeiros cards aparecem em cerca de 1 s, e o restante vai entrando aos poucos (hoje a busca principal leva cerca de 5,5 s).

## Os "agentes"
1. **Curador (em tempo real, em toda busca)**: regras de categoria, marca, gênero, idade, estação e repetição. Rápido e gratuito, sem atrasar a tela.
2. **Revisor de vitrines (rotina diária)**: roda as buscas e vitrines mais usadas, aponta cards que fogem da categoria e guarda as correções na lista de bloqueio. Segue as regras de docs/agentes.md (sem rajadas, sem gastar créditos).
3. **Aquecedor (rotina a cada 6 h)**: deixa prontas as buscas e vitrines mais populares, para abrirem na hora.

## Velocidade
- Mostrar a 1ª leva assim que chegar e completar o resto em segundo plano.
- Guardar resultados prontos das buscas populares e das vitrines (o Aquecedor).
- Vitrines do Amigo Secreto: só carregar as que estão à vista na tela.

## Detalhes técnicos
- Novo `src/lib/curadoria.ts` (extraído de `amigo-secreto-curadoria.ts`): `aprovado(titulo, contexto)`, `pesoDeMarca`, `assinaturaDoModelo` e uma tabela de marcas por domínio. Aplicado em `busca-guiada.ts` (ordenação e filtro), nas categorias, nas vitrines e no Amigo Secreto.
- Resposta da busca em duas etapas: a 1ª página sai do cache ou do 1º termo, e o restante chega pelo cursor que já existe.
- O Revisor e o Aquecedor viram rotinas agendadas no `docs/agentes.md` (que só leem buscas públicas), mais uma tabela de bloqueios lida pelo Curador.
- Testes: um por regra (brinquedo em beleza, gênero, repetição, marca primeiro).
