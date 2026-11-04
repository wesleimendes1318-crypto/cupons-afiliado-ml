/* ACOMPANHAR NO CARTÃO (Weslei, 04/11: "as vitrines e anúncios não têm o
   botão para facilitar o acompanhamento"). O sino do cartão segue o produto
   com 1 toque quando ele já tem comparação pronta (acompanhar_por_link no
   banco). Sem comparação, abre a comparação e o "Acompanhar preço" do
   resultado salva sozinho quando ela termina (marca guardada só nesta aba,
   por 15 min). Nada pessoal: só o id aleatório do navegador. */
import { supabase } from "@/integrations/supabase/client";
import { idDoNavegador } from "@/lib/navegador";

/* Mesma conta de public.chave_do_produto (banco), sem o md5 do fim. */
export function chaveDoProduto(url: string): string {
  const pegar = (re: RegExp) => url.match(re)?.[1] ?? null;
  const achado =
    pegar(/item_id(?:%3A|:)(MLB[0-9]{6,})/i) ??
    pegar(/\/p\/(MLB[0-9]+)/i) ??
    pegar(/\/up\/(MLBU[0-9]+)/i) ??
    url.match(/MLB-[0-9]{6,}/i)?.[0].replace("-", "") ??
    url.split("?")[0] ??
    url;
  return achado.toUpperCase();
}

const CHAVE_DEPOIS = "me_acompanhar_depois";
const VALIDADE_MS = 15 * 60 * 1000;

export function marcarParaDepois(url: string) {
  try {
    sessionStorage.setItem(
      CHAVE_DEPOIS,
      JSON.stringify({ chave: chaveDoProduto(url), em: Date.now() }),
    );
  } catch {
    /* sem armazenamento: o cliente usa o botão do resultado */
  }
}

/* Lê e consome a marca quando é do mesmo produto. */
export function consumirMarca(url: string | null | undefined, agora = Date.now()): boolean {
  if (!url) return false;
  try {
    const bruto = sessionStorage.getItem(CHAVE_DEPOIS);
    if (!bruto) return false;
    const m = JSON.parse(bruto) as { chave?: string; em?: number };
    if (!m.chave || !m.em || agora - m.em > VALIDADE_MS) {
      sessionStorage.removeItem(CHAVE_DEPOIS);
      return false;
    }
    if (m.chave !== chaveDoProduto(url)) return false;
    sessionStorage.removeItem(CHAVE_DEPOIS);
    return true;
  } catch {
    return false;
  }
}

export type ResultadoAcompanhar =
  | { ok: true; monitorId: number | null }
  | { ok: false; motivo: "comparar" | "limite" | "pausado" | "navegador" | "erro"; texto: string };

export function traduzirErro(mensagem: string): ResultadoAcompanhar {
  if (/limite de 20/.test(mensagem))
    return {
      ok: false,
      motivo: "limite",
      texto: "Você já acompanha 20 produtos. Pare algum em Meus preços.",
    };
  if (/limite do teste/.test(mensagem))
    return { ok: false, motivo: "limite", texto: "O acompanhamento está no limite desta fase." };
  if (/desligado/.test(mensagem))
    return { ok: false, motivo: "pausado", texto: "O acompanhamento está pausado no momento." };
  /* Sem comparação pronta (ou a função ainda não existe no banco): compara
     primeiro e salva no fim. */
  if (/sem comparacao|comparacao nao encontrada|Could not find|PGRST202|does not exist/i.test(mensagem))
    return { ok: false, motivo: "comparar", texto: "Comparando primeiro…" };
  return { ok: false, motivo: "erro", texto: "Não deu para salvar agora. Tente em instantes." };
}

export async function acompanharPorLink(url: string): Promise<ResultadoAcompanhar> {
  const navegador = idDoNavegador();
  if (!navegador)
    return {
      ok: false,
      motivo: "navegador",
      texto: "Libere os dados do site no navegador para acompanhar.",
    };
  const { data, error } = await supabase.rpc(
    "acompanhar_por_link" as never,
    { p_url: url, p_navegador: navegador, p_alvo: null } as never,
  );
  if (error) return traduzirErro(`${error.code ?? ""} ${error.message}`);
  return { ok: true, monitorId: typeof data === "number" ? data : null };
}
