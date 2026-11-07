import { describe, expect, test } from "bun:test";

import { caiuHoje } from "@/components/painel/PainelResumo";
import { limparPerfilConta, prefixoCep } from "@/lib/perfil-conta";

describe("perfil da conta (LGPD)", () => {
  test("CEP vira só o prefixo de 5 dígitos", () => {
    expect(prefixoCep("13010-000")).toBe("13010");
    expect(prefixoCep("1301")).toBe("");
    expect(prefixoCep(12345678)).toBe("");
  });
  test("perfil sanitizado: aviso por e-mail desligado por padrão, sem campo extra", () => {
    const p = limparPerfilConta({ cep: "01310-100", cidadeUf: "São Paulo/SP<script>", cpf: "123", telefone: "11" });
    expect(p.avisosEmail).toBe(false);
    expect(p.cep).toBe("01310");
    expect(p.cidadeUf).toBe("São Paulo/SPscript");
    expect(Object.keys(p).sort()).toEqual(
      ["avisosEmail", "cep", "cidadeUf", "freteGratis", "interesses", "nome", "termos", "voltagem"],
    );
  });
});

describe("caiuHoje", () => {
  const hoje = new Date("2026-11-07T15:00:00");
  const item = (historico: { p: number; em: string }[]) => ({ historico }) as never;
  test("queda numa leitura de hoje conta", () => {
    expect(caiuHoje(item([{ p: 100, em: "2026-11-06T10:00:00" }, { p: 90, em: "2026-11-07T09:00:00" }]), hoje)).toBe(true);
  });
  test("subida hoje ou queda de ontem não conta", () => {
    expect(caiuHoje(item([{ p: 90, em: "2026-11-06T10:00:00" }, { p: 95, em: "2026-11-07T09:00:00" }]), hoje)).toBe(false);
    expect(caiuHoje(item([{ p: 100, em: "2026-11-05T10:00:00" }, { p: 90, em: "2026-11-06T09:00:00" }]), hoje)).toBe(false);
  });
});
