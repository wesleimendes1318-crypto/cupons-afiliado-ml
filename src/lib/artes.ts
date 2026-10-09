/* ARTES DAS CATEGORIAS E VITRINES (Weslei, 09/10: "ajuste as vitrines e
   categorias, inclua as artes. cuidado com todo design"). Pacote
   ME-Imagens (sem logos): cenas ilustrativas com área livre à esquerda para
   o texto do site e os objetos à direita. Nenhuma arte anuncia preço,
   desconto ou data: isso é sempre texto/dado do site. Celulares e
   Automotivo usam as do acervo original (sem texto), por não haver arte
   nova desses temas.

   Arquivos em public/artes/: <id>.webp (1672 px, a original do pacote,
   WebP 90) e <id>-m.webp (1280 px, WebP 86; celular e miniaturas). "foco" é o object-position que preserva os
   objetos quando o quadro corta; "tom" diz se o texto vai claro ou escuro
   sobre a arte. */

export type ArteId =
  | "tecnologia-games"
  | "home-office"
  | "cozinha"
  | "moda-casual"
  | "beleza-penteadeira"
  | "brinquedos-aprender"
  | "celular-acessorios"
  | "auto-acessorios"
  | "escolhas-bolso";

export type Arte = {
  id: ArteId;
  /* Descrição curta (alt das miniaturas; o banner é decorativo). */
  descricao: string;
  tom: "claro" | "escuro";
  /* object-position no banner largo e no quadro do celular/miniatura. */
  foco: string;
  focoCelular: string;
};

export const ARTES: Record<ArteId, Arte> = {
  "tecnologia-games": {
    id: "tecnologia-games",
    descricao: "Console portátil, teclado e cadeira gamer numa mesa iluminada",
    tom: "escuro",
    foco: "70% 55%",
    focoCelular: "62% 60%",
  },
  "home-office": {
    id: "home-office",
    descricao: "Cadeira ergonômica, mesa e monitor num home office claro",
    tom: "claro",
    foco: "75% 50%",
    focoCelular: "80% 55%",
  },
  cozinha: {
    id: "cozinha",
    descricao: "Panelas e utensílios numa bancada de cozinha",
    tom: "claro",
    foco: "75% 60%",
    focoCelular: "78% 62%",
  },
  "moda-casual": {
    id: "moda-casual",
    descricao: "Jeans, camiseta, bolsa e tênis num sofá da sala",
    tom: "claro",
    foco: "70% 55%",
    focoCelular: "72% 60%",
  },
  "beleza-penteadeira": {
    id: "beleza-penteadeira",
    descricao: "Perfumes, maquiagem e nécessaire numa penteadeira",
    tom: "claro",
    foco: "75% 50%",
    focoCelular: "78% 55%",
  },
  "brinquedos-aprender": {
    id: "brinquedos-aprender",
    descricao: "Brinquedos educativos numa mesinha infantil",
    tom: "claro",
    foco: "75% 50%",
    focoCelular: "80% 55%",
  },
  "celular-acessorios": {
    id: "celular-acessorios",
    descricao: "Celular, capa, carregador, cabo e película",
    tom: "claro",
    foco: "70% 55%",
    focoCelular: "68% 58%",
  },
  "auto-acessorios": {
    id: "auto-acessorios",
    descricao: "Retrovisores, amplificador e escapamento em pedestais",
    tom: "claro",
    foco: "75% 55%",
    focoCelular: "78% 58%",
  },
  "escolhas-bolso": {
    id: "escolhas-bolso",
    descricao: "Porta-moedas, cofrinho e etiquetas em pedestais",
    tom: "claro",
    foco: "72% 50%",
    focoCelular: "72% 55%",
  },
};

export const LARGURA_ARTE = 1672;
export const ALTURA_ARTE = 941;

export const srcArte = (id: ArteId, celular = false) => `/artes/${id}${celular ? "-m" : ""}.webp`;

/* As duas versões para o navegador escolher pela tela (09/10, "melhore a
   qualidade das fotos!"): 1280 px e a original de 1672 px. */
export const srcSetArte = (id: ArteId) =>
  `/artes/${id}-m.webp 1280w, /artes/${id}.webp ${LARGURA_ARTE}w`;

/* Uma arte por categoria do site (src/content/categorias.ts). */
export const ARTE_DA_CATEGORIA: Record<string, ArteId> = {
  eletronicos: "tecnologia-games",
  celulares: "celular-acessorios",
  informatica: "home-office",
  casa: "cozinha",
  moda: "moda-casual",
  beleza: "beleza-penteadeira",
  automotivo: "auto-acessorios",
  brinquedos: "brinquedos-aprender",
};

export const arteDaCategoria = (slug: string | null | undefined): Arte | null => {
  const id = slug ? ARTE_DA_CATEGORIA[slug] : undefined;
  return id ? ARTES[id] : null;
};
