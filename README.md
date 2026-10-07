# Melhor Escolha

Comparador inteligente de preços de produtos vendidos no Mercado Livre, com curadoria assistida por inteligência artificial. Cole o link de um anúncio e o site mostra o mesmo produto em outras lojas dentro do Mercado Livre, do mais barato ao mais caro e com a loja oficial (quando houver), conferindo foto, descrição e características para garantir que é o mesmo produto. Produtos parecidos aparecem separados, com a descrição do que muda.

**Site**: https://melhorescolha.io

## Visão geral

- **Comparação por link**: cole o endereço de um anúncio e receba a tabela completa de lojas, com melhor opção, alternativas e aviso de preço muito abaixo da mediana.
- **Conferência por foto (IA)**: cada candidato a "mesmo produto" passa por duas conferências visuais e por regras de categoria; produto parecido apresentado como igual é o pior erro possível.
- **Regras de frete e total**: o melhor preço é decidido pelo custo real (produto + frete para o CEP do cliente, detectado de forma transparente). Frete pago nunca passa na frente.
- **Prazo de entrega**: filtro por data limite ("receber até"), consultado na API oficial de envios por CEP.
- **Preço no Pix x parcelado**: mostra o preço à vista e o total parcelado quando sai mais caro.
- **Busca guiada**: pesquisa em linguagem natural que usa o catálogo oficial do Mercado Livre.
- **Vitrines e campanhas**: produtos já comparados, seções sazonais (Dia das Crianças, Black Friday, Natal) e brinquedos por faixa de idade.
- **Acompanhar preço**: monitoramento sem cadastro, com alerta no Telegram quando o preço cai.
- **Extensão Chrome**: leitura logada dos anúncios, geração de links de afiliado e segunda volta da comparação.
- **Bot do Telegram**: a mesma comparação, com as mesmas regras da tela, direto na conversa.
- **PWA**: app instalável que recebe links compartilhados do app do Mercado Livre e compara sozinho (Web Share Target).

## Stack tecnológica

- **Front-end**: React 19, TanStack Start (roteamento em arquivo, server functions), Vite 7, Tailwind CSS v4.
- **Back-end**: Lovable Cloud (Supabase/Postgres) com RLS, funções `security definer` e rotinas agendadas (`pg_cron`).
- **Inteligência**: conferência por foto em lote com fallback em cascata entre modelos, nunca inventando dados.
- **Distribuição**: extensão Chrome, bot do Telegram, PWA e páginas estáticas com SEO (sitemap, robots, JSON-LD, Open Graph).

## Funcionalidades principais

1. **Resultado da comparação**: produto, preço, loja, frete em linha própria, link de afiliado em todo botão de compra e comparação possível — nunca tela vazia.
2. **Melhor opção e melhor alternativa**: recomendação única, com qualidade equivalente ou superior, desvantagens e o que muda para o cliente.
3. **Transparência**: loja sempre indicada, economia pelo custo real, aviso quando a foto e o texto do anúncio não batem.
4. **Privacidade**: localização pelo CEP com consentimento, perfil de interesse anônimo (só com consentimento de análise) e nenhuma métrica financeira exposta ao público.
5. **Acompanhamento**: histórico de preços por navegador, sem cadastro, com alerta via Telegram.

## Como contribuir

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Antes de enviar mudanças:

- Rode a bateria de testes (`ferramentas/bateria-de-testes.sql`) e, se a extensão mudar, `ferramentas/verificar-extensao.sh` e o teste unitário dela.
- Todo link de compra deve ser link de afiliado (`meli.la`) — há trava no código (`src/lib/afiliado.ts`).
- Nunca invente dados: o que não foi medido não aparece.
- Commits iguais em `claude/ml-etiquetas-cupons-k6tgkj` e `main`, sem force-push.

## Configuração administrativa do Telegram

Após publicar, configure o webhook com `POST /api/public/telegram-setup` e o
cabeçalho `x-cron-secret`, usando o segredo das rotinas administrativas
(`CRON_SECRET` ou `sinc_config.cron_segredo`). A credencial deve ser enviada
somente por ferramenta administrativa, nunca pelo navegador público ou na URL.
Abrir esse endereço no navegador retorna HTTP 405. O destino é fixo em
`https://melhorescolha.io/api/public/telegram-webhook`, e as mensagens pendentes
são preservadas. A configuração exige `API_TELEGRAM` e acesso administrativo
ao Supabase no servidor.

Teste de regressão local, com banco e Telegram simulados:

```sh
node_modules/.bin/tsx --test tests/telegram-setup.test.ts
```

## Aviso

Site independente, sem vínculo com o Mercado Livre. "Mercado Livre" aparece de forma descritiva e sempre com o aviso de independência.

This project was built with [Lovable](https://lovable.dev).

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
