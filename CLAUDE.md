# Regras do projeto (Weslei Mendes, melhorescolha.io)

Leia também AGENTS.md (nunca force-push nem reescrever histórico publicado).

## Produto
- O site é um COMPARADOR de preços do Mercado Livre. Por enquanto só Mercado Livre.
- Todo link colado precisa ser comparado com o MESMO produto em outras lojas.
- Só mostrar outra loja quando a Gemini confirmou pela foto que é o mesmo produto.
  Produto parecido apresentado como igual é o pior erro possível.
- Todo link de compra precisa ser o link de afiliado do Weslei.
- A consulta do cliente deve terminar em até 1 minuto. Previsões de tempo na tela
  vêm de medição real (função tempo_estimado), nunca inventadas.

## Texto e visual
- Botão de compra NUNCA leva o nome da loja: usar texto de compra segura
  ("Comprar com segurança"). Sempre oferecer compartilhar no WhatsApp.
- Não escrever "Mercado Livre" no texto do site (marca / AdSense).
- Textos curtos. Não prometer cupom. Sempre mostrar foto do produto.

## Conta e segurança
- Proteger a conta de afiliado: sem rajadas de leitura; freio em captcha.
- Se o Mercado Livre responder "tráfego suspeito", parar a leitura anônima.
- Não trocar a Gemini pela "Lovable AI" (plano sem crédito: responde 402).
- Nunca pedir nem colocar chaves no código ou no chat (vão nos Secrets do Lovable).

## Publicação
- Branch claude/ml-etiquetas-cupons-k6tgkj e main recebem o mesmo commit.
- Depois do push: esperar list_edits "completed" e chamar deploy_project.
- Mudança na extensão sobe a versão em extensao/manifest.json; o Weslei
  atualiza rodando ferramentas/ATUALIZAR-EXTENSAO.bat.
