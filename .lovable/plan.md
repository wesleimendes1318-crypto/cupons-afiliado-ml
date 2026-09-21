# Comparador de até 3 cupons + fim do erro 503 na busca com IA

## O problema do 503

A rota de recomendação só funciona se a chave do Gemini estiver disponível no servidor no momento do pedido. A chave já está salva no projeto e aparece no ambiente, mas o serviço que atende o site foi iniciado antes dela existir, então continua respondendo "assistente não configurado" (503).

Em vez de depender de uma chave que o dono precisa manter, a IA passa a usar o serviço de IA já incluído no Lovable, cuja credencial é gerenciada pela plataforma e está sempre disponível. Isso remove a causa do 503 de vez e tira uma configuração manual do caminho.

## 1. Corrigir a busca com IA

- A rota de recomendação passa a chamar o modelo pelo serviço de IA do Lovable.
- Sem chave para o dono configurar, some a resposta "ainda não foi configurado".
- Mesmas regras de hoje: escolhe no máximo 5 cupons, só entre os enviados, nunca inventa loja nem benefício, devolve lista vazia com frase quando nada combina.
- Mesmos limites de uso por minuto, mesma proteção de origem e mensagens de erro legíveis.
- A classificação de lojas e o gerador de texto de venda seguem o mesmo caminho, para não ficarem dependendo de uma chave separada.

## 2. Comparador de até 3 cupons

O site já permite marcar cupons com a caixinha de seleção. Aproveitando isso:

- Com 2 ou 3 cupons marcados, a barra inferior ganha o botão "Comparar economia" (o de pedir os links continua onde está). Com mais de 3 marcados, o botão explica que o comparador aceita no máximo 3.
- Ao clicar, abre um painel "Qual compensa mais" com:
  - uma tabela curta lado a lado: loja, desconto anunciado, economia máxima, compra mínima, quando vence;
  - o veredito da IA: qual oferece a melhor economia e por quê, em linguagem simples;
  - quando fizer diferença, a observação de que a resposta muda conforme o valor da compra (ex.: um cupom ganha em compras pequenas, outro em compras grandes).
- Abaixo do veredito, o botão verde de WhatsApp "PEDIR OS LINKS DESSES {n}", com a mensagem listando os cupons comparados.
- Regras de honestidade mantidas: só usa os dados reais dos cupons, nunca promete desconto acima do teto, nunca diz que o cupom só funciona pelo link do dono, e sempre lembra que a categoria é estimada pelo nome da loja.
- Enquanto a IA responde, aparece um estado de carregamento; se falhar, a tabela comparativa continua visível com uma mensagem de erro discreta.

## Detalhes técnicos

- Nova rota `src/routes/api/public/comparar.ts`: entrada validada com zod (lista de 2 a 3 cupons: id, vendedor, categoria, desconto, teto, compra_min, vence, qualidade), reaproveita `origemPermitida`, `excedeuLimite`, `respostaOptions` e `json` de `src/lib/public-ai-api.ts`.
- Chamada ao modelo via Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/responses`) com o modelo padrão `openai/gpt-6-astra`, em streaming consumido no servidor (o resultado volta ao front como JSON único), esforço de raciocínio baixo e saída em esquema estrito `{ vencedor_id, veredito, observacoes }`.
- `public-ai-api.ts` ganha um helper compartilhado para essa chamada (leitura de `LOVABLE_API_KEY` dentro do handler, propagação do cabeçalho de run id, tratamento por status: 429/5xx com nova tentativa limitada, demais status terminais com mensagem ao usuário).
- `recomendar.ts`, `classificar.ts` e `gerar-texto.ts` passam a usar esse helper; o esquema de saída de cada um permanece igual, então o front não muda.
- Em `src/routes/index.tsx`: estado `comparacao` (carregando, resultado, erro), `cupomSelecionados` limitado a 3 na comparação, componente `ComparadorModal` reutilizando o `Dialog` já existente, e botão novo na barra de seleção.
- Formatos brasileiros (R$ antes do número, vírgula decimal, datas DD/MM/AAAA) e paleta ML mantidos; verde só nos botões de WhatsApp.

## Publicação

Ao final, publicar em https://cupons-afiliado-ml.lovable.app.
