/* Texto de pagamento (Pix x parcelado) comum ao site e ao bot do Telegram. */

export type Precos = {
  cheio: number | null;
  pix: number | null;
  parcelas?: {
    vezes: number;
    valor: number | null;
    total: number | null;
    semJuros: boolean;
  } | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export /* PAGAMENTO COMO O ANÚNCIO DIZ (Weslei, 02/10: "não deve inventar nada,
   sempre indique o valor parcelado se sai mais caro"). Só números lidos do
   evento do próprio anúncio (precosDoItem: cheio, Pix, parcelas e total).
   Parcelado que sai mais caro que o preço mostrado sempre aparece com o total
   e quanto custa a mais; sem o dado, não afirma. */
function textoDoPagamento(preco: number | null | undefined, p: Precos | null | undefined) {
  if (!p || preco == null) return null;
  const perto = (x: number | null | undefined) => x != null && Math.abs(x - preco) < 0.5;
  const partes: string[] = [];
  if (p.pix != null && perto(p.pix)) partes.push("no Pix");
  else if (p.pix != null && p.pix < preco - 0.5) partes.push(`${brl(p.pix)} no Pix`);
  const pc = p.parcelas;
  if (pc) {
    const total = pc.total ?? p.cheio;
    const cada = pc.valor != null ? `${pc.vezes}x de ${brl(pc.valor)}` : `${pc.vezes}x`;
    if (total != null && total > preco + 0.5)
      partes.push(
        `parcelado: ${cada}${pc.semJuros ? " sem juros" : " com juros"} = ${brl(total)} (${brl(total - preco)} a mais)`,
      );
    else partes.push(`ou ${cada}${pc.semJuros ? " sem juros" : ""}`);
  } else if (p.cheio != null && p.cheio > preco + 0.5) {
    partes.push(`no cartão: ${brl(p.cheio)} (${brl(p.cheio - preco)} a mais)`);
  }
  return partes.length ? partes.join(" · ") : null;
}
