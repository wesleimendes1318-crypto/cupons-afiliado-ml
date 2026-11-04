/* ENVIO DO CÓDIGO DE ENTRADA PELO SITE (04/11): o SMTP do banco recusava o
   envio ("Error sending magic link email"). Aqui o servidor gera o código
   (admin.generateLink devolve email_otp) e manda pelo Resend com o visual do
   site. A pessoa digita o código e o navegador confere com verifyOtp. */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { chaveDeServico, SUPABASE_URL_SITE } from "@/integrations/supabase/projeto";

const GATEWAY = "https://connector-gateway.lovable.dev/resend";

function resposta(corpo: object, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function html(codigo: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;padding:32px">
<tr><td><img src="https://melhorescolha.io/logo.png" width="48" height="48" alt="Melhor Escolha" style="border-radius:12px;display:block"></td></tr>
<tr><td style="padding-top:20px;font-size:22px;font-weight:600">Seu código para entrar</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#6e6e73">Digite este código no site para entrar na sua conta. Ele vale por uma hora.</td></tr>
<tr><td align="center" style="padding:24px 0"><div style="display:inline-block;background:#f5f5f7;border-radius:16px;padding:16px 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0071e3">${codigo}</div></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6e6e73">Se você não pediu este código, ignore este e-mail. Ninguém da Melhor Escolha pede este código.</td></tr>
</table>
<p style="font-size:12px;color:#86868b;margin-top:16px">Melhor Escolha · melhorescolha.io</p>
</td></tr></table></body></html>`;
}

export const Route = createFileRoute("/api/public/enviar-codigo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email = "";
        try {
          const corpo = (await request.json()) as { email?: unknown };
          email = String(corpo.email ?? "").trim().toLowerCase();
        } catch {
          return resposta({ erro: "invalido" }, 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
          return resposta({ erro: "invalido" }, 400);

        const { chave } = chaveDeServico();
        const lovable = process.env['LOVABLE_API_KEY'];
        const resend = process.env['RESEND_API_KEY'];
        if (!chave || !lovable || !resend) return resposta({ erro: "indisponivel" }, 503);

        const admin = createClient(SUPABASE_URL_SITE, chave, { auth: { persistSession: false } });

        let gerado = await admin.auth.admin.generateLink({ type: "magiclink", email });
        if (gerado.error && /not.*found|no user/i.test(gerado.error.message)) {
          const criado = await admin.auth.admin.createUser({ email, email_confirm: true });
          if (criado.error) return resposta({ erro: "indisponivel" }, 503);
          gerado = await admin.auth.admin.generateLink({ type: "magiclink", email });
        }
        if (gerado.error || !gerado.data.properties?.email_otp) {
          console.error("generateLink falhou:", gerado.error?.message);
          return resposta({ erro: "indisponivel" }, 503);
        }

        const codigo = gerado.data.properties.email_otp;
        const remetente = process.env['RESEND_FROM'] || "Melhor Escolha <onboarding@resend.dev>";
        const envio = await fetch(`${GATEWAY}/emails`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${lovable}`,
            "x-connection-api-key": resend,
          },
          body: JSON.stringify({
            from: remetente,
            to: [email],
            subject: "Seu código para entrar — Melhor Escolha",
            html: html(codigo),
            text: `Seu código para entrar na Melhor Escolha: ${codigo}. Vale por uma hora.`,
          }),
        });
        if (!envio.ok) {
          console.error(`Resend recusou [${envio.status}]: ${await envio.text()}`);
          return resposta({ erro: "envio", status: envio.status }, 502);
        }
        return resposta({ ok: true });
      },
    },
  },
});
