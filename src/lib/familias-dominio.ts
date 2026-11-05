/* DOMAIN FAMILIES (Weslei, 05/11: "assertividade em TODAS as categorias").
   The official domain prediction gives ONE narrow domain for apparel and
   jewelry ("short academia" -> MLB-SPORT_SHORTS), but the catalog files the
   same pieces under siblings (MLB-SPORTSWEAR_SETS, MLB-CLOTHING_LOTS...), so
   the text search came back with 2-3 cards. A predicted domain inside a
   family brings its siblings; the product type still has to be in the name
   (tipoDaBusca), so a gym handle never passes as a short. */

const FAMILIAS: string[][] = [
  [
    "MLB-SPORT_SHORTS",
    "MLB-SHORTS",
    "MLB-LEGGINGS",
    "MLB-SPORTSWEAR_SETS",
    "MLB-CLOTHING_LOTS",
    "MLB-SPORT_T_SHIRTS",
    "MLB-T_SHIRTS",
    "MLB-SPORTS_BRAS",
    "MLB-TOPS",
    "MLB-CROP_TOPS",
    "MLB-TANK_TOPS",
    "MLB-SPORT_PANTS",
    "MLB-PANTS",
    "MLB-JUMPSUITS",
    "MLB-SWEATSHIRTS",
    "MLB-JACKETS_AND_COATS",
    "MLB-BERMUDAS",
  ],
  [
    "MLB-RINGS",
    "MLB-EARRINGS",
    "MLB-NECKLACES",
    "MLB-BRACELETS",
    "MLB-CHARMS",
    "MLB-PENDANTS",
    "MLB-JEWELRY_SETS",
    "MLB-ANKLETS",
  ],
  ["MLB-SNEAKERS", "MLB-SPORT_SHOES", "MLB-SANDALS", "MLB-SLIPPERS", "MLB-FLIP_FLOPS", "MLB-BOOTS", "MLB-LOAFERS"],
  ["MLB-HANDBAGS", "MLB-BACKPACKS", "MLB-WALLETS", "MLB-SHOULDER_BAGS", "MLB-TOTE_BAGS", "MLB-CLUTCHES", "MLB-FANNY_PACKS"],
];

const POR_DOMINIO = new Map<string, string[]>();
for (const f of FAMILIAS) for (const d of f) POR_DOMINIO.set(d, f);

export function ampliarDominios(s: Set<string> | null): Set<string> | null {
  if (!s) return s;
  const out = new Set(s);
  for (const d of s) for (const irmao of POR_DOMINIO.get(d) ?? []) out.add(irmao);
  return out;
}
