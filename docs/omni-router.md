# Rota de IA do Melhor Escolha

O adaptador `src/lib/omni-router.ts` lê as configurações apenas no servidor.
A chave `OMNI_ROUTER` nunca vai para o navegador. OmniRoute é um serviço
que hospedamos; OpenRouter é outro provedor. Suas chaves não são intercambiáveis.

## Configuração do backend

Escolha o provedor que emitiu a credencial já cadastrada nos Secrets do Lovable.
Não copie o valor da chave para este repositório, para o chat ou para variáveis `VITE_*`.

| Variável no servidor | OmniRoute | OpenRouter |
| --- | --- | --- |
| `OMNI_ROUTER` | Chave criada no painel do OmniRoute | Chave da conta OpenRouter |
| `OMNI_ROUTER_PROVIDER` | `omniroute` (padrão) | `openrouter` |
| `OMNI_ROUTER_BASE_URL` | URL HTTPS do serviço, terminando em `/v1` | `https://openrouter.ai/api/v1` (padrão ao selecionar este provedor) |
| `OMNI_ROUTER_MODELS` | `auto/cheap` ou modelos/combos configurados no painel | `openai/gpt-4o-mini,google/gemini-2.5-flash` (padrão) |
| `OMNI_ROUTER_VISION_MODELS` | Modelos/combos com visão confirmados no painel (obrigatório para fotos) | `openai/gpt-4o-mini,google/gemini-2.5-flash` (padrão) |
| `OMNI_ROUTER_MAX_TOKENS` | `1600` (padrão; entre 128 e 4096) | Mesmo limite |

As listas aceitam até três modelos, na ordem de tentativa. O identificador precisa
existir na conta e aceitar os recursos pedidos. Modelos de texto, como Haiku quando
disponível no catálogo do provedor, devem ficar na lista de texto; não se presume
capacidade visual. A disponibilidade e a cobrança dependem da conta conectada.
Um combo visual no OmniRoute deve conter somente modelos com visão.

Sem provedor/endereço válidos, a rota fica desabilitada e os caminhos anteriores
continuam funcionando. Não se deduz o destinatário pelo formato da chave.
O adaptador acrescenta `/chat/completions` à base; também aceita o endpoint completo.
Envia `HTTP-Referer`, `X-Title` e `X-OpenRouter-Title`, bloqueia redirecionamentos
e exige HTTPS em produção. HTTP local só é aceito no desenvolvimento.

## Comportamento

### Cheaper Inference

A rota também aceita `OMNI_ROUTER_PROVIDER=cheaperinference`, usando por padrão
`https://api.cheaperinference.com/v1` e o modelo de texto `gpt-5.6-luna`, documentado
pelo provedor. A chave emitida por ele deve ser cadastrada em `OMNI_ROUTER` nos
Secrets do backend. Não é necessário hospedar um OmniRoute para usar essa opção.
Para fotos, configure `OMNI_ROUTER_VISION_MODELS` com um modelo visual disponível
na conta e valide uma imagem real antes de publicar; não há modelo visual presumido.
O saldo dessa conta paga chamadas do site, não créditos de edição do Lovable
nem a cota do ChatGPT Work/Codex. A integração não cria saldo nem faz recargas.
Referência: https://www.cheaperinference.com/docs.

### Ordem das chamadas

- Busca Guiada, Me Ajude a Escolher e atendimento de texto do Telegram usam
  `perguntarAoGpt`: OpenAI direto → OmniRoute/OpenRouter → fallback já existente
  no chamador. Na análise visual, as fotos são preservadas em ordem.
- Os endpoints que usam `chamarIa` fazem Gemini direto → OmniRoute/OpenRouter →
  gateway anterior. Com a rota configurada, uma resposta 429/5xx do Gemini
  passa imediatamente ao fallback, sem esperar novas tentativas diretas.
- Cada chamada da rota tem prazo total, até três modelos e limite de saída.
  Resposta vazia, erro dentro de HTTP 200 ou JSON inválido não contam como sucesso.
  Erros de autenticação ou saldo não repetem a mesma credencial em outros modelos.
- A conferência de igualdade do produto por fotos continua com as regras
  Gemini/Gemma de `conferir-produto.ts`. Preços, equivalência e links de afiliado
  continuam sendo decididos pelos dados e regras existentes.

## Instalação permanente do OmniRoute

O backend do site não hospeda o processo do OmniRoute. Ele precisa de um servidor
Linux com Node 24 compatível com a versão fixada, acesso HTTPS e armazenamento
persistente. A instalação feita no ambiente de desenvolvimento não fornece
um endereço permanente para o site.

No servidor escolhido, instale a versão verificada nesta integração:

```sh
sudo useradd --system --home-dir /var/lib/omniroute --shell /usr/sbin/nologin omniroute
sudo env OMNIROUTE_SKIP_POSTINSTALL=1 npm install --prefix /opt/omniroute omniroute@3.8.51 --no-audit --no-fund
sudo install -m 600 ops/omniroute/.env.example /etc/omniroute.env
```

Preencha os quatro segredos vazios de `/etc/omniroute.env` com valores aleatórios
independentes, gerados no próprio servidor (32 bytes em hexadecimal para cada
chave de criptografia). O arquivo é lido pelo systemd, fora do pacote npm, e não
deve ser sobrescrito durante atualizações. Depois:

```sh
sudo install -m 644 ops/omniroute/omniroute.service /etc/systemd/system/omniroute.service
sudo systemctl daemon-reload
sudo systemctl enable --now omniroute
curl --fail http://127.0.0.1:20128/api/health
```

O Node deve estar disponível no PATH do systemd. Configure o proxy HTTPS do
servidor para encaminhar o domínio escolhido a `127.0.0.1:20128`, preservando
o cabeçalho `Authorization`. Mantenha `REQUIRE_API_KEY=true`. O acesso direto
à API sem uma chave válida deve retornar 401. O painel deve ser acessado por
HTTPS, porque os cookies de autenticação estão configurados como seguros.

No painel, conecte uma conta de provedor autorizada, configure os modelos/combos
e crie uma chave de API para o site. Cadastre essa chave em `OMNI_ROUTER` e o
endereço em `OMNI_ROUTER_BASE_URL` nos Secrets do backend. A senha do painel
e as chaves de criptografia do serviço não são a chave da API do site.

Preserve `/var/lib/omniroute` e `/etc/omniroute.env` juntos nos backups. O serviço
reinicia em falhas e sobe com o servidor. Atualizações são deliberadas: confira
a nova versão, faça backup, atualize o pacote e repita as verificações antes de
religar o tráfego. Não use atualização automática para uma versão desconhecida.

## Diagnóstico e validação

`GET /api/public/ajudar-escolher` inclui `omni: true` quando há configuração
válida. Esse indicador não prova saldo, conectividade nem autorização do modelo.

Uma chamada feita à rota grava o último resultado em `sinc_config`, chave
`omni_router_diagnostico`: horário, provedor, status, modelo efetivo (ou última
tentativa), duração e erro resumido. Nenhum prompt, imagem ou credencial é salvo.
Repetições do mesmo estado são limitadas a uma escrita por 30 segundos por
instância. A escrita tem prazo de 500 ms e falhas de diagnóstico não derrubam
a resposta ao comprador. Consulta administrativa:

```sql
select valor::jsonb
from sinc_config
where chave = 'omni_router_diagnostico';
```

Validação local, sem consumir saldo nem enviar mensagens:

```sh
node ferramentas/testar-omni-router.mjs
npx tsc --noEmit
npm run build
```

O script usa Node 24 e o TypeScript já presente no projeto. Testa os módulos reais
com HTTP e banco simulados: falhas de cota, prazos, JSON inválido, cabeçalhos,
texto, visão, configuração e telemetria. A liberação em produção ainda exige
conectar a conta real, verificar uma requisição de texto e outra com foto,
conferir o diagnóstico e cumprir a bateria de produto prevista em `CLAUDE.md`.
Nenhum serviço consegue garantir ausência de falhas se todas as contas estiverem
sem saldo ou indisponíveis.

## Skills aplicadas

`.agents/skills/ponytail` orienta as alterações de código, reaproveitando funções
existentes e evitando dependências desnecessárias. `.agents/skills/agent-skills`
é um guia local que aplica a especificação aberta e o validador oficial de
referência. Ambas foram usadas nesta integração e estão referenciadas em
`AGENTS.md` para acompanhar as próximas versões. Nenhuma é dependência do runtime
do site. O reconhecimento automático depende do agente/editor usado.

Fontes: [OmniRoute](https://github.com/diegosouzapw/OmniRoute/tree/v3.8.51),
[OpenRouter](https://openrouter.ai/docs/quickstart),
[Ponytail](https://github.com/DietrichGebert/ponytail),
[Agent Skills](https://github.com/agentskills/agentskills).
