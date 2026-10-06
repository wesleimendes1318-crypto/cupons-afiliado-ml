// Node 24+: executa os módulos reais, sem rede, saldo de IA ou mensagens no Telegram.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const raiz = new URL('../', import.meta.url);
const registros = [];
globalThis.__omniRegistrosTeste = registros;
registerHooks({
  resolve(id, contexto, proximo) {
    if (id === '@/integrations/supabase/client.server') return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent('export const supabaseAdmin = {from: () => ({upsert: (row) => {globalThis.__omniRegistrosTeste.push(row); return {then: (resolve) => resolve({error:null}), abortSignal: async () => ({error:null})};}})};'),
    };
    if (id.startsWith('@/')) return { shortCircuit: true, url: new URL(`src/${id.slice(2)}.ts`, raiz).href };
    return proximo(id, contexto);
  },
  load(url, contexto, proximo) {
    if (url.startsWith(raiz.href + 'src/') && url.endsWith('.ts')) return {
      shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return proximo(url, contexto);
  },
});

const { perguntarAoOmniRouter, omniRouterConfigurado } = await import('../src/lib/omni-router.ts');
const { perguntarAoGpt } = await import('../src/lib/gpt.ts');
const { chamarIa } = await import('../src/lib/public-ai-api.ts');
const envOriginal = { ...process.env };
const fetchOriginal = globalThis.fetch;
const variaveis = ['OMNI_ROUTER', 'OMNI_ROUTER_PROVIDER', 'OMNI_ROUTER_BASE_URL', 'OMNI_ROUTER_MODELS', 'OMNI_ROUTER_VISION_MODELS', 'OMNI_ROUTER_MAX_TOKENS', 'OPENAI_API_KEY', 'OPENAI_KEY', 'GPT_API_KEY', 'CHATGPT_API_KEY', 'CHAT_GPT_API_KEY', 'CHAT_GPT_KEY', 'OPEN_AI_API_KEY', 'ASTRA_API_KEY', 'ASTRA_GPT_API_KEY', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'LOVABLE_API_KEY'];
const ok = (texto = '{"resposta":"ok"}', model = 'modelo-real') => Response.json({ model, choices: [{ message: { content: texto } }] });
let casos = 0;
async function caso(nome, executar) {
  for (const v of variaveis) delete process.env[v];
  process.env['OMNI_ROUTER'] = 'credencial-ficticia-do-teste';
  process.env['OMNI_ROUTER_PROVIDER'] = 'openrouter';
  globalThis.fetch = async () => { throw new Error('Rede inesperada no teste'); };
  await executar();
  casos += 1;
  console.log(`OK ${nome}`);
}

try {
  await caso('chave OmniRoute sem endereço não é enviada ao OpenRouter', async () => {
    delete process.env['OMNI_ROUTER_PROVIDER'];
    assert.equal(omniRouterConfigurado(), false);
    assert.equal((await perguntarAoOmniRouter('JSON')).ok, false);
  });
  await caso('endereço inválido é recusado antes da rede', async () => {
    process.env['OMNI_ROUTER_BASE_URL'] = 'https://usuario:senha@example.com/v1';
    assert.equal(omniRouterConfigurado(), false);
    process.env['OMNI_ROUTER_BASE_URL'] = 'http://example.com/v1';
    assert.equal(omniRouterConfigurado(), false);
  });
  await caso('endpoint, cabeçalhos, limite e modelo efetivo', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers['HTTP-Referer'], 'https://melhorescolha.io');
      assert.equal(init.headers['X-Title'], 'Melhor Escolha');
      assert.equal(JSON.parse(init.body).max_tokens, 1600);
      return ok();
    };
    assert.equal((await perguntarAoOmniRouter('JSON')).modelo, 'modelo-real');
  });
  await caso('modelo removido tenta o próximo', async () => {
    const modelos = [];
    globalThis.fetch = async (_, init) => {
      modelos.push(JSON.parse(init.body).model);
      return modelos.length === 1 ? Response.json({}, { status: 404 }) : ok();
    };
    assert.equal((await perguntarAoOmniRouter('JSON')).ok, true);
    assert.deepEqual(modelos, ['openai/gpt-4o-mini', 'google/gemini-2.5-flash']);
  });
  await caso('JSON inválido e erro dentro de HTTP 200 não viram sucesso', async () => {
    let chamadas = 0;
    globalThis.fetch = async () => ++chamadas === 1 ? ok('texto sem JSON') : Response.json({ error: { code: 429 } });
    const r = await perguntarAoOmniRouter('JSON');
    assert.equal(r.ok, false);
    assert.equal(r.status, 502);
    assert.equal(chamadas, 2);
  });
  await caso('401 e 402 não repetem nem vazam corpo de erro', async () => {
    for (const status of [401, 402]) {
      let chamadas = 0;
      globalThis.fetch = async () => { chamadas++; return Response.json({ error: { message: process.env['OMNI_ROUTER'] } }, { status }); };
      const r = await perguntarAoOmniRouter('JSON');
      assert.equal(r.status, status);
      assert.equal(chamadas, 1);
      assert.equal(JSON.stringify(r).includes(process.env['OMNI_ROUTER']), false);
    }
  });
  await caso('timeout deixa prazo para o segundo modelo e termina', async () => {
    let chamadas = 0;
    globalThis.fetch = async (_, init) => {
      chamadas++;
      return new Promise((_, rejeitar) => {
        const timer = setTimeout(() => rejeitar(new Error('simulação')), 1000);
        init.signal.addEventListener('abort', () => { clearTimeout(timer); rejeitar(new Error('timeout')); }, { once: true });
      });
    };
    const inicio = Date.now();
    const r = await perguntarAoOmniRouter('JSON', { prazo: 300 });
    assert.equal(r.status, 504);
    assert.equal(chamadas, 2);
    assert.ok(Date.now() - inicio < 800);
  });
  await caso('visão mantém imagens e não aceita domínio parecido com mlstatic', async () => {
    const imagens = ['https://http2.mlstatic.com/D_NQ_NP_123.jpg'];
    globalThis.fetch = async (_, init) => {
      const conteudo = JSON.parse(init.body).messages[0].content;
      assert.equal(conteudo[1].image_url.url, imagens[0]);
      return ok();
    };
    assert.equal((await perguntarAoOmniRouter('JSON', { imagens })).ok, true);
    assert.equal((await perguntarAoOmniRouter('JSON', { imagens: ['https://evilmlstatic.com/foto.jpg'] })).status, 400);
  });
  await caso('OmniRoute exige seleção explícita de modelo visual', async () => {
    process.env['OMNI_ROUTER_PROVIDER'] = 'omniroute';
    process.env['OMNI_ROUTER_BASE_URL'] = 'https://ia.example.com/v1/';
    const imagens = ['https://http2.mlstatic.com/foto.jpg'];
    assert.equal((await perguntarAoOmniRouter('JSON', { imagens })).status, 503);
    process.env['OMNI_ROUTER_VISION_MODELS'] = 'comparador-visual';
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://ia.example.com/v1/chat/completions');
      assert.equal(JSON.parse(init.body).model, 'comparador-visual');
      return ok();
    };
    assert.equal((await perguntarAoOmniRouter('JSON', { imagens })).ok, true);
  });
  await caso('OpenAI 429 aciona OmniRouter na chamada compartilhada', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-ficticia';
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return urls.length === 1 ? Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }) : ok();
    };
    assert.equal((await perguntarAoGpt('JSON')).ok, true);
    assert.deepEqual(urls, ['https://api.openai.com/v1/chat/completions', 'https://openrouter.ai/api/v1/chat/completions']);
  });
  await caso('sem chave OpenAI ainda usa a rota e preserva as fotos', async () => {
    globalThis.fetch = async (_, init) => {
      assert.equal(JSON.parse(init.body).messages[0].content.length, 2);
      return ok();
    };
    assert.equal((await perguntarAoGpt('JSON', 1000, ['https://http2.mlstatic.com/foto.jpg'])).ok, true);
  });
  await caso('Gemini 429 passa imediatamente à rota com esquema e contexto', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-ficticia';
    const urls = [];
    globalThis.fetch = async (url, init) => {
      urls.push(url);
      if (urls.length === 1) return Response.json({}, { status: 429 });
      const body = JSON.parse(init.body);
      assert.equal(body.response_format.type, 'json_schema');
      assert.equal(body.messages[0].role, 'system');
      return ok();
    };
    assert.equal((await chamarIa('JSON', { formato: { nome: 'resultado', schema: { type: 'object' } } })).ok, true);
    assert.equal(urls.length, 2);
    assert.ok(urls[1].startsWith('https://openrouter.ai/'));
  });
  await caso('texto simples não é forçado a JSON', async () => {
    globalThis.fetch = async (_, init) => {
      assert.equal(JSON.parse(init.body).response_format, undefined);
      return ok('Uma resposta em texto.');
    };
    assert.equal((await chamarIa('Explique o site')).texto, 'Uma resposta em texto.');
  });
  await new Promise(setImmediate);
  assert.ok(registros.some((r) => r.chave === 'omni_router_diagnostico'));
  assert.ok(!JSON.stringify(registros).includes('credencial-ficticia-do-teste'));
  console.log(`${casos} verificações passaram; telemetria sem credenciais.`);
} finally {
  globalThis.fetch = fetchOriginal;
  for (const v of variaveis) {
    if (envOriginal[v] === undefined) delete process.env[v];
    else process.env[v] = envOriginal[v];
  }
}
