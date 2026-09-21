# Gerador seguro de texto de venda

## O que será feito
- Criar um endpoint de servidor `gerar-texto` que valide vendedor, desconto, teto, compra mínima e canal.
- Manter `GEMINI_API_KEY` exclusivamente nos Secrets do projeto e chamar o Gemini somente pelo servidor.
- Instruir o modelo a escrever até quatro linhas em português, com benefício real, teto e compra mínima, sem inventar detalhes.
- Para cupons marcados como armadilha, devolver diretamente um aviso objetivo, sem chamar o Gemini.
- Adicionar ao modal o seletor WhatsApp/Instagram, botão de gerar, estados de carregamento/erro e botão de copiar.
- Restringir a chamada ao próprio site e adicionar limite básico de requisições para reduzir abuso do endpoint público.

## Detalhes técnicos
- Endpoint HTTP em `/api/public/gerar-texto`, equivalente seguro no servidor deste projeto.
- Validação de entrada e saída, timeout da chamada externa e mensagens de erro legíveis.
- Nenhuma chave, variável `VITE_` ou segredo será incluído no repositório ou enviado ao navegador.
- A integração ficará pronta para uso assim que `GEMINI_API_KEY` for adicionada em Project Settings → Secrets.

## Verificação
- Confirmar que cupons bons geram texto e armadilhas retornam aviso local.
- Confirmar copiar, troca de canal, estados de erro e uso no celular.
- Verificar que o projeto compila e que nenhum segredo aparece no código ou nas respostas.
