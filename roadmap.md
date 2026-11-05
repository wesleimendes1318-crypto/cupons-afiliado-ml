# Roadmap

- [x] Sincronizar as novas colunas de cupons
- [x] Substituir a tabela por cards responsivos no estilo Mercado Livre
- [x] Adicionar selos, abas, novos filtros e ordenação por teto
- [x] Criar modal de condições com resumo e texto oficial
- [x] Validar desktop, celular e os 187 registros
- [x] Criar endpoint seguro gerar-texto com Gemini
- [x] Adicionar seletor de canal, geração e cópia no modal
- [x] Validar erros, responsividade e ausência de chave no navegador
- [x] Publicar a versão com o gerador seguro
- [x] Adicionar contagem regressiva por hora no fuso de São Paulo
- [x] Direcionar todos os cupons ao contato por WhatsApp
- [x] Validar contadores, contato, responsividade e publicação
- [ ] Recomendar apenas cupons bons na entrada e revelar armadilhas encontradas na busca
- [ ] Calcular e ordenar por melhores oportunidades reais
- [ ] Adicionar classificação estimada de categorias no servidor
- [ ] Adicionar filtros multiescolha de categoria e economia
- [ ] Adicionar assistente de recomendações com IA
- [ ] Validar integrações, telas e publicar
- [x] Migrar as rotas de IA para o AI Gateway do Lovable (fim do 503)
- [x] Criar comparador de até 3 cupons com veredito da IA
- [x] Salvar o secret GEMINI_API_KEY pelo formulário seguro
- [x] Tratar tetos irreais (ex.: 99.999.999) como "sem limite informado" em cards, modal, score e mensagens
- [x] Deixar o contato WhatsApp mais estratégico (CTA perto dos resultados e no estado vazio)
- [x] Ligar as rotas de IA à GEMINI_API_KEY (Gemini) e validar

- [x] Revisar concordância e regras de português (pt-BR) em todos os textos da interface
- [x] Trocar exportação CSV por Excel (.xlsx) com a descrição do cupom
- [x] Corrigir o comparador (resposta em HTML / lentidão): reserva no serviço de IA da plataforma
- [x] Incluir na planilha o perfil da loja com o link de afiliado (config AFILIADO)
- [x] Adicionar calculadora de desconto em tempo real aos cards
- [x] Adicionar cópia do cupom e abertura segura do link de afiliado
- [x] Validar microinterações e layout da calculadora no celular
- [x] Usar este cupom: um clique gera o código, copia e abre a loja pelo link de indicação
- [x] Busca por link: gerar na hora o código do cupom encontrado nos 9k
- [x] Garantir que a busca de outra loja com cupom para o mesmo produto funcione
- [x] Varredura ponta a ponta do produto contra todos os cupons do hub (extensao 1.21.0)
- [x] Corrigir "Usar este cupom": o codigo aparece mesmo se a vitrine demorar
- [x] Renomear titulo para "Cupons de Lojas Afiliadas"

## Plataforma profissional (set/2026)
- [x] Consentimento de cookies funcional (LGPD)
- [x] Espacos de publicidade desligados ate haver Publisher ID
- [x] Paginas institucionais: sobre, contato, termos, privacidade, cookies, divulgacao de afiliados
- [x] Guias editoriais (/guias e /guias/$slug)
- [x] Categorias com conteudo proprio (/categorias/$slug)
- [x] sitemap.xml, robots.txt, ads.txt
- [x] Rodape institucional e aviso de afiliado na home
- [x] Avaliar Python: responder se ajuda ou nao neste projeto (runtime e edge)
- [x] Escolher tecnologias duraveis para hoje e futuro; justificar ao usuario

- [x] Redesign da home: header roxo + amarelo suave, barra de categorias e bloco de guias em posicoes melhores (base: layout atual + padroes de sites de cupom)
- [x] Unificar identidade visual (roxo + amarelo) entre home e paginas internas
- [x] Manter branco/azul/cinza/verde existentes; roxo apenas nas faixas de topo

- [x] Padronizar o card de cupom da home em todas as secoes (categorias etc.)

- [ ] Manter os cupons mais vantajosos primeiro e os menos vantajosos no final

# Roadmap — Comparação por máxima semelhança e menor custo

Princípio: preservar → medir → melhorar → validar → ativar aos poucos.
Auditoria do ciclo 0: `docs/auditoria-2026-09-28.md`. Cupons: legado mantido
(tabelas, RPCs e campos continuam; nada é removido sem prova de que ninguém usa).

## P0 — confiabilidade do que já existe
- [x] P0-1 Parecidos conferidos sumiam no caminho do catálogo (10 de 72 pedidos recentes) — `juntarAchados`, extensão 1.130.1, teste e meta na bateria
  - Conferido na 1.131.0 (28/09, pedidos 478-487): 10 de 10 com parecidos na tela quando a leitura achou; capinha 0 → 5
- [ ] P0-2 Caminho do catálogo pula a busca quando a ficha já tem loja (regra: a busca roda SEMPRE) — corrigido na 1.132.0 (busca com prazo próprio, diag.catalogoAchou/buscaRodou); falta conferir na bateria
- [ ] P0-3 Classificar as 16 leituras de anúncio sem diagnóstico (lojaLida=false) e dar plano B a cada causa
- [ ] P0-4 Cauda de tempo (máx. 118 s; meta 60 s): onde o tempo vai nos pedidos acima de 60 s
- [ ] P0-5 Medir a segunda volta quando a IA de conferência cai (27 em 4 dias): quantas se recuperam
- [ ] P0-6 Conferir a geração de link afiliado nos parecidos e nas lojas da tabela (links que ficam sem gerar)

## P1 — matching V2 (sempre em shadow mode, atrás de flag)
- [ ] Benchmark rotulado com casos reais (mesmo produto, parecido certo, parecido inadequado, quantidade, capacidade, modelo, condição, mesma foto/outro produto, título diferente/mesmo produto)
- [ ] Medir a V1 contra o benchmark (falso positivo de "mesmo produto" é o erro mais grave)
- [ ] Atributos estruturados por categoria (essenciais, importantes, secundários) extraídos da ficha (`detalhes`) + "desconhecido" explícito
- [ ] Restrições rígidas determinísticas (capacidade, quantidade/kit, voltagem, condição, lado, veículo)
- [ ] Separar semelhança de confiança da análise
- [ ] Score V2 gravado ao lado do V1 (campos novos na análise: `matching_version`, `similarity_v2`, `confidence_v2`, `matched_attributes`, `different_attributes`, `unknown_attributes`), sem mudar a tela
- [ ] Ranking semelhança × economia (sem alternativas dominadas; pesos documentados e configuráveis)
- [ ] Explicação: mantém / muda / perde / ganha / economiza
- [ ] Gate de promoção: benchmark sem regressão, falso positivo não aumenta, tempo aceitável, afiliado ok, flag de volta à V1

## P2 — experiência e medição
- [ ] Métricas V1×V2 (falso positivo/negativo, precisão dos parecidos, economia, cliques de afiliado, falhas, duração), sem dados pessoais
- [ ] Orientar na tela quando o link colado é de perfil/loja
- [ ] Feedback do cliente ("esta alternativa serve?")
- [ ] Atualizar README.md (ainda descreve o app de cupons)

## P3 — futuro
- [ ] Monitoramento de preço — TESTE no ar em 28/09 (Acompanhar preço, /meus-precos, extensão 1.133.0); validar: leituras/dia, captcha, cliques de afiliado vindos de /meus-precos
- [ ] Expansão (outras lojas/categorias)

## Resultado da comparação (01/11)
- [x] Quadro do veredito não pode esticar junto com os detalhes do colado (tamanhos proporcionais)
- [x] Veredito executivo: o seu x a recomendação, um CTA verde só
- [x] Lojas: as 3 melhores à vista e "Ver outras N lojas"
- [x] Envio internacional: selo, tributos estimados no custo e nunca vencer o nacional sem custo completo
- [x] Testes de tributos/custo internacional
- [x] Acabamento: nada saindo dos quadros (moldura da Melhor escolha nos 3 marketplaces, faixa das lojas, campo do link cortado, parecido único, botões que quebravam)

- [x] Perfil da conta salvo e atualizado sozinho (buscas, gosto, preferências) entre aparelhos
- [x] Botão de entrar mais visível em celular, tablet e computador

## Amigo Secreto e buscas (05/11)
- [x] Amigo Secreto: frete a calcular / subir valor, ideias da época, questionário, WhatsApp sigiloso, sugestões pelos favoritos
- [x] Melhorar precisão das buscas em todas as categorias do site
- [x] Brinquedos ficam quando batem com a marca/franquia pedida
- [x] Amigo Secreto: valor em aberto (sem faixa fixa 80-100)
- [x] Ver mais da busca: não limitar e não mexer a tela
- [x] Franquias: Homem-Aranha é Marvel, vitrine conjunta mantida; franquia não pedida barrada
- [x] Amigo Secreto: data da festa (entrega por CEP), ordenação, frete grátis e detalhes

- [x] Amigo Secreto: melhores marcas primeiro (skincare, bijuterias, calçados)
- [x] Curadoria única em toda busca (curador), mais rápido, aquecedor das buscas populares
- [x] Amigo Secreto usa tudo o que o site já faz (mesma curadoria e cards)
