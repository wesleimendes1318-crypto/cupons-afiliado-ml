/* PRODUTO FALSO NÃO É INDICADO (Weslei, 09/10: "Não indique produtos
   falsos"). Pelo título:
   - assumido: réplica, "1:1", primeira linha, linha AAA, inspirado,
     contratipo, "similar ao original", clone;
   - clone de modelo famoso SEM a marca: "AirPods"/"i12 TWS"/fone "Pro 4"
     de marca nenhuma, smartwatch "Series 10"/"S10"/"Ultra 9" sem Apple
     (casos de 09/10 nos mais vendidos). Com a marca de verdade no título,
     passa (a conferência pela foto continua valendo).
   Vale para mais vendidos, vitrine, campanhas e canal. */
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ASSUMIDO =
  /\breplicas?\b|\b1:1\b|\bprimeira linha\b|\b1a linha\b|\blinha (premium )?a{3}\b|\ba{3}\+? premium\b|\binspirad[oa]s?\b|\bcontratipos?\b|\bsimilar (ao|a|com) (o )?original\b|\btipo original\b|\bclones?\b|\bfirst line\b/;
const MARCAS_FONE =
  /\b(apple|samsung|galaxy|jbl|xiaomi|redmi|anker|soundcore|sony|lg|motorola|huawei|edifier|philips|qcy|haylou|baseus|lenovo|realme|oneplus|nothing|beats|bose|sennheiser|jabra|skullcandy|i2go|multilaser|pulse|elg|hrebos|kz)\b/;
const MARCAS_RELOGIO =
  /\b(apple|samsung|galaxy|xiaomi|redmi|amazfit|huawei|garmin|haylou|mibro|motorola|positivo|multilaser|casio|mondaine|technos|orient|polar|honor)\b/;

export function pareceFalso(titulo: string | null | undefined): boolean {
  const t = semAcento(titulo ?? "");
  if (!t) return false;
  if (ASSUMIDO.test(t)) return true;
  if (/\bair ?pods?\b/.test(t) && !/\bapple\b/.test(t)) return true;
  if (/\bi\d{1,2}s? ?tws\b/.test(t)) return true;
  if (
    /\b(fone|earbuds?|tws|auricular)\b/.test(t) &&
    /\bpro ?[3-9]\b/.test(t) &&
    !MARCAS_FONE.test(t)
  )
    return true;
  if (
    /\b(smartwatch|relogio inteligente|smart watch)\b/.test(t) &&
    /\b(series ?\d{1,2}|serie ?\d{1,2}|s\d{1,2}|ultra ?\d|w\d{2})\b/.test(t) &&
    !MARCAS_RELOGIO.test(t)
  )
    return true;
  return false;
}
