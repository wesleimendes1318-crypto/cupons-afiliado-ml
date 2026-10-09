/* BUSCA POR FOTO (Weslei, 09/10). A pessoa tira ou escolhe uma foto do
   produto; o navegador reduz (máx. 1024 px, JPEG 80%) e manda para
   /api/public/buscar-foto. Aqui:
   1. o modelo de visão (Cheaper Inference -> GPT -> Gemini/Gemma) diz o que
      é: nome para busca, marca, modelo, categoria e o texto lido na foto,
      com a confiança. Nada é inventado: sem certeza, diz que não sabe;
   2. o nome vai ao catálogo oficial (buscarNoCatalogo) e voltam os produtos
      com anúncio ativo;
   3. só compara SOZINHO quando é certeza (confiança >= 85, marca e modelo
      lidos e os dois no nome do 1º produto do catálogo). Senão a pessoa
      escolhe entre até 4 ("Qual destes é o seu?"): produto parecido
      apresentado como igual é o pior erro possível.
   A foto não é guardada nem registrada em lugar nenhum. */
import { buscarNoCatalogo, type ResultadoBusca } from "@/lib/busca-guiada";
import { perguntarAoLlm } from "@/lib/cheaper-inference";
import { gerarComModelos, lerJson } from "@/lib/conferir-produto";

export type Identificacao = {
  produto: string;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  textoLido: string | null;
  confianca: number;
};

export type ResultadoFoto = {
  identificado: Identificacao | null;
  candidatos: ResultadoBusca[];
  /* Comparar sozinho o 1º candidato (certeza). */
  confiante: boolean;
};

const PROMPT = `Voce identifica produtos a partir de uma FOTO para um comprador no Brasil.
Olhe a foto com cuidado: formato, cor, logotipo, textos e codigos impressos (leia o que estiver visivel).
Responda SO com JSON:
{"e_produto": true|false, "produto": "nome curto para buscar no catalogo (marca + linha + modelo + variacao essencial, 2 a 8 palavras)", "marca": "ou null", "modelo": "codigo/nome do modelo ou null", "categoria": "ou null", "texto_lido": "textos e codigos lidos na foto ou null", "confianca": 0-100}
Regras: nunca invente marca ou modelo que nao da para ver ou deduzir com seguranca; na duvida use null e baixe a confianca.
Foto de pessoa, documento, tela de conversa ou algo que nao e produto a venda: e_produto false.`;

const txt = (v: unknown, max = 80) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && !/^null$/i.test(s) ? s.slice(0, max) : null;
};

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export async function identificarPelaFoto(base64: string): Promise<Identificacao | null> {
  let bruto: string | null = null;
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const llm = await perguntarAoLlm(PROMPT, 16_000, [dataUrl], "high");
  if (llm.ok) bruto = llm.texto;
  else {
    const r = await gerarComModelos(
      [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: base64 } }],
      { prazo: 15_000 },
    );
    if (r.ok) bruto = r.texto;
  }
  if (!bruto) return null;
  const j = lerJson<Record<string, unknown>>(bruto);
  if (!j || j["e_produto"] === false) return null;
  const produto = txt(j["produto"], 90);
  if (!produto || /https?:|www\./i.test(produto)) return null;
  const c = Number(j["confianca"]);
  return {
    produto,
    marca: txt(j["marca"], 40),
    modelo: txt(j["modelo"], 40),
    categoria: txt(j["categoria"], 60),
    textoLido: txt(j["texto_lido"], 160),
    confianca: Number.isFinite(c) ? Math.max(0, Math.min(100, Math.round(c))) : 0,
  };
}

/** Certeza para comparar sozinho: marca e modelo lidos, confiança alta e
    os dois no nome do produto do catálogo. */
export function ehCerteza(id: Identificacao, nomeDoCatalogo: string) {
  if (id.confianca < 85 || !id.marca || !id.modelo) return false;
  const nome = normal(nomeDoCatalogo);
  const marca = normal(id.marca);
  const modelo = normal(id.modelo);
  return marca.length >= 2 && modelo.length >= 2 && nome.includes(marca) && nome.includes(modelo);
}

export async function buscarPelaFoto(base64: string): Promise<ResultadoFoto> {
  const identificado = await identificarPelaFoto(base64);
  if (!identificado) return { identificado: null, candidatos: [], confiante: false };
  const buscas = [
    identificado.produto,
    [identificado.marca, identificado.modelo].filter(Boolean).join(" "),
  ].filter((b, i, l) => b.trim().length >= 3 && l.indexOf(b) === i);
  const candidatos = await buscarNoCatalogo(buscas, { max: 4, porBusca: 3 });
  const confiante = candidatos.length > 0 && ehCerteza(identificado, candidatos[0]!.nome);
  return { identificado, candidatos, confiante };
}
