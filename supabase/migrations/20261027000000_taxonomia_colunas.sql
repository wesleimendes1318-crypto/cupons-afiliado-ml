-- 27/10 (Weslei: "reestruturação inteligente de categorias e subcategorias").
-- Só ACRESCENTA colunas (nada é apagado nem alterado): o domínio oficial do
-- Mercado Livre para o produto (domain_discovery ou /products/{id}), o nó
-- da taxonomia do site (src/content/taxonomia.ts) e a confiança da
-- classificação. categoria_site continua como está (cotas do agente e abas).
ALTER TABLE public.em_alta_catalogo
  ADD COLUMN IF NOT EXISTS dominio_ml text,
  ADD COLUMN IF NOT EXISTS categoria_ml_folha text,
  ADD COLUMN IF NOT EXISTS categoria_no text,
  ADD COLUMN IF NOT EXISTS confianca_categoria text
    CHECK (confianca_categoria IS NULL OR confianca_categoria IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS classificacao_motivo text,
  ADD COLUMN IF NOT EXISTS classificado_em timestamptz;

CREATE INDEX IF NOT EXISTS em_alta_catalogo_categoria_no_idx
  ON public.em_alta_catalogo (categoria_no, posicao);

-- Caminho oficial da categoria folha no Mercado Livre ("Informática >
-- Armazenamento > ..."), lido de /categories/{id} (público).
ALTER TABLE public.em_alta_catalogo ADD COLUMN IF NOT EXISTS categoria_ml_caminho text;
