# Auditoria do comparador — 28/09/2026 (ciclo 0)

Somente leitura (banco e código). Nenhuma alteração de produção durante a
auditoria. Números medidos em `pedidos_link` (4 dias: 341 pedidos; período
recente, pedido >= 400: 72 pedidos prontos com produto lido).

## Fluxo real (site → extensão → banco → site)

1. **Site** (`src/components/BuscaPorLink.tsx`): RPC `pedir_comparacao`
   (limite 15/min, 150/h) cria a linha em `pedidos_link` e avisa a extensão
   (`postMessage` "pedido-novo"; o alarme cobre a falta dele).
2. **Extensão** (`extensao/background.js`, um pedido por vez, freio de captcha):
   lê o anúncio (worker → aba logada → tela), pede ao servidor
   `/api/public/mesmo-produto` (API oficial: catálogo/ofertas; Google).
3. `mesmoProdutoEmOutrasLojas` tem **dois caminhos**:
   - `soBusca` (a API procurou): `achadosCombinados` = busca normal + lojas
     oficiais (`_Loja_all`) + menor preço na faixa + Google + relacionados da
     página → `escolherParaConferir` (12) → `/api/public/conferir-produto`
     (Gemini/Gemma, lotes de 4, 2ª conferência) → iguais (tabela) e parecidos.
   - **catálogo** (`buy_box_offers` da página /p/): ofertas da ficha →
     `avaliarCandidatos`; a busca só roda se o catálogo não achou nada.
4. `avaliarCandidatos`/`resolverVendedor`: loja, condição, MercadoLíder,
   detalhes (1.130), cupom (legado).
5. Links de afiliado (aba logada, lote; erro 111 → `semAfiliado`/`mesmaPagina`).
6. `montarAnalise` → `marcarComInsistencia` (RPC com `p_token`) grava
   `pedidos_link.analise` (contrato: `outrasLojas`, `referencias`,
   `parecidos`, `buscaFora`, `detalhes`, ...). Análise incompleta: segunda
   volta (até 2).
7. **Banco**: gatilho `registrar_produto_visto` → `produtos_vistos`
   (inclui `alt_*`) e `precos_vistos`; `vitrine()` lê. Caches:
   `ia_vereditos` (vereditos da foto), `comparacoes` (API, 6 h), `ia_cotas`.
8. **Site** lê com `ver_pedido(id, chave)`: Melhor opção, tabela, Melhor
   alternativa, Parecidos, "Ficou em dúvida?" (`/api/public/ajudar-escolher`).

## Falhas medidas e causas

| Causa | Pedidos | Situação |
|---|---|---|
| **Parecidos conferidos somem no caminho do catálogo** (`achados.concat(daBusca)` descarta a propriedade `parecidos`) | 10 de 72 recentes (14%); 74 de 212 em 4 dias | **P0-1, corrigido na 1.130.1** (`juntarAchados` + teste) |
| Catálogo achou loja e a busca nem roda (fere "a busca roda SEMPRE") | não medido ainda (sem marca no diag) | P0-2: medir e corrigir |
| "Igual" aprovado fora da tabela | 11 | Correto: era a mesma loja do link, sem preço menor |
| Leitura do anúncio falhou (`lojaLida=false`) | 17 em 4 dias (1 captcha) | P0-3: classificar os 16 sem diagnóstico |
| Link de perfil colado (não é produto) | 8 | Mensagem já existe; P2 (orientar na tela) |
| IA de conferência indisponível | 27 em 4 dias | Segunda volta refaz; P1 medir recuperação |
| "Nada conferido" | 53 em 4 dias | Todos de versões antigas (<= 1.107); não ocorre mais |
| Tempo | mediana 17,5 s; máximo 118 s | Meta 60 s: P1 investigar a cauda |

## Semelhança, parecidos e Melhor alternativa (como são hoje)

- `semelhanca` (0-100) e `mesmaFoto` vêm da conferência pela foto (prompt
  com `REGRA_NOMES` + `REGRA_CATEGORIAS` + ficha do original). Não há score
  determinístico nem pesos por atributo: é o julgamento do modelo.
- Parecido = `parecido && !igual && !semFoto`, com `muda` (texto livre) e
  `vantagem`. Top 5 por mesma foto → semelhança → preço.
- Melhor alternativa (site e `alternativa_da_analise` no banco): preço <=
  melhor mesmo produto − R$ 2, semelhança >= 85 ou mesma foto, sem frete
  pago, com link, e `muda` sem "vem menos" (`MUDA_NAO_E_ALTERNATIVA`).
- Limites atuais: "desconhecido" não existe (atributo ausente não é
  marcado), confiança e semelhança vêm do mesmo modelo, `muda` é texto livre
  (a regra de "vem menos" depende de palavras), sem benchmark rotulado.

## Arquivos lidos

CLAUDE.md, AGENTS.md, README.md (desatualizado: ainda descreve o app de
cupons), roadmap.md, .lovable/plan.md (antigo), extensao/background.js,
extensao/comparador.js, src/lib/conferir-produto.ts, src/lib/ml-api.ts,
src/components/BuscaPorLink.tsx, src/components/Vitrine.tsx, funções do banco
(`registrar_produto_visto`, `vitrine`, `ver_pedido`),
ferramentas/bateria-de-testes.sql (grava pedidos novos com
`pedir_link_novo`, igual a um cliente; não apaga nem altera dados).

## Checkpoint

- Último commit estável antes da correção: `6602d91` (site) / extensão 1.130.0.
- Próxima tarefa: P0-2 (medir e corrigir a busca pulada no caminho do catálogo).
