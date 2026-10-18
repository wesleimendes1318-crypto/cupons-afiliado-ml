import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { SUPABASE_PROJETO_SITE } from "@/integrations/supabase/projeto";
import buscarCupons from "./tools/buscar-cupons";

const projectRef = SUPABASE_PROJETO_SITE;

export default defineMcp({
  name: "cupom-afiliado",
  title: "Cupom Afiliado",
  version: "0.1.0",
  instructions:
    "Cupons de lojas conferidos pelo site melhorescolha.io. Use `buscar_cupons` para listar cupons válidos por loja ou categoria. Limites e compra mínima estão em reais.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [buscarCupons],
});
