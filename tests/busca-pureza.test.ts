import { describe, expect, test } from "bun:test";
import { extrairIntencaoRapida, foraDaIntencao } from "@/lib/busca-intencao";

const fora = (q: string, nome: string) => foraDaIntencao(nome, extrairIntencaoRapida(q), q);

/* Search purity (24/11 audit): groceries never leak into clothing or
   electronics searches; real items of the asked type still pass. */
const MERCADO = [
  "Ketchup Heinz Tradicional 397g",
  "Maionese Hellmann's Tradicional 500g",
  "Molho Shoyu Sakura Tradicional 1 Litro",
  "Biscoito Recheado Oreo 90g",
  "Bala Fini Gelatina Dentaduras 90g",
];

const CASOS: Array<[string, string]> = [
  ["camiseta masculina", "Camiseta Masculina Algodão Básica Preta"],
  ["vestido feminino", "Vestido Feminino Midi Estampado"],
  ["calça jeans", "Calça Jeans Masculina Slim Lycra"],
  ["fone bluetooth", "Fone De Ouvido Bluetooth Sem Fio Tws"],
  ["smart tv 50", "Smart Tv 50 Polegadas 4k Uhd"],
  ["notebook", "Notebook Lenovo Ideapad 15.6 8gb 256gb"],
  ["air fryer", "Fritadeira Air Fryer Mondial 4l Preta"],
  ["celular samsung", "Celular Samsung Galaxy A15 128gb"],
];

describe("groceries never leak into clothing or electronics (24/11)", () => {
  for (const [q, real] of CASOS) {
    test(q, () => {
      for (const n of MERCADO) expect(fora(q, n)).toBe(true);
      expect(fora(q, real)).toBe(false);
    });
  }
});
