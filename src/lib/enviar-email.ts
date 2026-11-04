/* Envio de e-mail pelo Resend através do conector do Lovable (o mesmo do
   código de entrada, 04/11): LOVABLE_API_KEY + RESEND_API_KEY nos Secrets.
   Domínio ainda não verificado no Resend: cai no remetente de teste. Só
   servidor. */
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

export function emailConfigurado() {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["RESEND_API_KEY"];
}

export async function enviarEmail(m: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  de?: string | undefined;
}): Promise<{ ok: true } | { ok: false; status: number }> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const resend = process.env["RESEND_API_KEY"];
  if (!lovable || !resend) return { ok: false, status: 503 };
  const oficial = m.de || process.env["RESEND_FROM"] || "Melhor Escolha <login@melhorescolha.io>";
  const mandar = (from: string) =>
    fetch(`${GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${lovable}`,
        "x-connection-api-key": resend,
      },
      body: JSON.stringify({ from, to: [m.para], subject: m.assunto, html: m.html, text: m.texto }),
      signal: AbortSignal.timeout(10000),
    });
  try {
    let r = await mandar(oficial);
    if (r.status === 403 || r.status === 422) {
      console.error(`Remetente oficial recusado [${r.status}]: ${await r.text()}`);
      r = await mandar("Melhor Escolha <onboarding@resend.dev>");
    }
    if (!r.ok) {
      console.error(`Resend recusou [${r.status}]: ${await r.text()}`);
      return { ok: false, status: r.status };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}
