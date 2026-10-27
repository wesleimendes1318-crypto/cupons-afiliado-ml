/* SELO DA LOJA NO CARTÃO (Weslei, 27/10): de qual marketplace é a oferta
   que o botão abre, só em texto e tipografia neutra (sem logotipo nem cor
   da marca). Com ofertas confirmadas em mais de um marketplace, também
   "Disponível em 2+ lojas". */
import { marketplaceDe, type Marketplace } from "@/lib/afiliado";

const NOME: Record<Marketplace, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon Brasil",
  shopee: "Shopee",
};

const BASE =
  "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight ";
const SELO = BASE + "bg-[#f5f5f7] text-[#424245] ring-1 ring-black/5";
const SELO_LOJAS = BASE + "bg-[#0071e3]/10 text-[#0058b0]";

/** links: o da oferta do botão primeiro; os outros, de ofertas confirmadas. */
export function SeloMarketplace({
  links,
  prime = false,
}: {
  links: Array<string | null | undefined>;
  prime?: boolean;
}) {
  const players = [...new Set(links.map(marketplaceDe).filter((m): m is Marketplace => !!m))];
  const principal = players[0];
  if (!principal) return null;
  return (
    <>
      <span className={SELO}>{NOME[principal]}</span>
      {principal === "amazon" && prime && <span className={SELO}>Prime</span>}
      {players.length > 1 && <span className={SELO_LOJAS}>Disponível em 2+ lojas</span>}
    </>
  );
}
