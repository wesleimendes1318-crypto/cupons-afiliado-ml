/* ENVIO DO CÓDIGO DE ENTRADA PELO SITE (04/11): o SMTP do banco recusava o
   envio ("Error sending magic link email"). Aqui o servidor gera o código
   (admin.generateLink devolve email_otp) e manda pelo Resend com o visual do
   site. A pessoa digita o código e o navegador confere com verifyOtp. */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { chaveDeServico, SUPABASE_URL_SITE } from "@/integrations/supabase/projeto";
import { emailConfigurado, enviarEmail } from "@/lib/enviar-email";
import { criarFreio } from "@/lib/freio";

/* Freio do envio (04/11): sem ele, qualquer um usava o site para disparar
   e-mails a qualquer endereço. 5 códigos a cada 10 min por endereço de rede
   e 3 a cada 10 min por e-mail. */
const freioPorIp = criarFreio(5, 10 * 60_000);
const freioPorEmail = criarFreio(3, 10 * 60_000);

function resposta(corpo: object, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/* Padrão dos e-mails (04/11): #f5f5f7, cartão branco com borda #e5e5ea e
   cantos de 24 px, código em caixa mono azul, gráfico do Acompanhar preço,
   aviso de segurança e rodapé de transparência. */
function html(codigo: string, email: string) {
  /* "Copiar código" (04/11): o e-mail não roda script, então o botão abre o
     site com o código, que preenche as caixas e copia (LoginEmailOtp tira o
     código da barra de endereços). Entrar continua exigindo o toque. */
  const abrir = `https://melhorescolha.io/?codigo=${encodeURIComponent(codigo)}&email=${encodeURIComponent(email)}`;
  const caixas = [...codigo]
    .map(
      (d) =>
        `<span style="display:inline-block;background:#ffffff;border-radius:8px;padding:8px 6px;font-size:20px;line-height:24px;font-weight:700;color:#1d1d1f;border:1px solid #d2d2d7;margin:0 2px;min-width:14px;text-align:center;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace">${d}</span>`,
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
<tr><td align="center" style="padding-bottom:20px"><img src="https://melhorescolha.io/logo.png" alt="Melhor Escolha" width="44" height="44" style="display:block;border-radius:12px"></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e5ea;border-radius:24px;padding:28px 24px">
<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0071e3">Entrar sem senha</p>
<h1 style="margin:0 0 10px;font-size:24px;line-height:30px;letter-spacing:-0.3px">Seu código para entrar</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:22px;color:#424245">Digite este código no site para entrar na sua conta. Ele vale por uma hora.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#f5f5f7;border:1px solid #e5e5ea;border-radius:16px;padding:18px 8px">
<span style="user-select:all;-webkit-user-select:all;white-space:nowrap">${caixas}</span>
</td></tr></table>
<a href="${abrir}" style="display:block;margin:16px 0 0;text-align:center;background:#0071e3;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:9999px">Copiar código</a>
<p style="margin:10px 0 0;text-align:center;font-size:12px;line-height:17px;color:#6e6e73">Ao tocar em Copiar código, o site abre com o código já preenchido e copiado para você. Se preferir, toque e segure nos números e escolha Copiar.</p>
<img src="https://melhorescolha.io/email/acompanhar-preco.png" alt="Linha do preço descendo até o seu preço desejado" width="472" style="display:block;width:100%;max-width:472px;height:auto;margin:24px 0 10px;border-radius:16px">
<p style="margin:0;font-size:13px;line-height:19px;color:#424245">Com a conta, seus preços acompanhados aparecem em qualquer aparelho e você pode receber o aviso por e-mail quando o preço cair.</p>
<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #e5e5ea;font-size:12px;line-height:17px;color:#86868b">Segurança: não compartilhe este código com ninguém. Ninguém da Melhor Escolha pede este código. Se você não pediu para entrar, ignore este e-mail: nada muda na sua conta.</p>
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-size:11px;line-height:16px;color:#86868b">Melhor Escolha · melhorescolha.io<br>Site independente que compara preços de produtos vendidos no Mercado Livre, sem vínculo com ele. Os links de compra são de afiliado: o preço é o mesmo para você.</td></tr>
</table></body></html>`;
}

export const Route = createFileRoute("/api/public/enviar-codigo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email = "";
        try {
          const corpo = (await request.json()) as { email?: unknown };
          email = String(corpo.email ?? "")
            .trim()
            .toLowerCase();
        } catch {
          return resposta({ erro: "invalido" }, 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
          return resposta({ erro: "invalido" }, 400);

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "desconhecido";
        if (freioPorIp(ip) || freioPorEmail(email)) return resposta({ erro: "limite" }, 429);

        const { chave } = chaveDeServico();
        if (!chave || !emailConfigurado()) return resposta({ erro: "indisponivel" }, 503);

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
        const envio = await enviarEmail({
          para: email,
          assunto: `${codigo} é o seu código — Melhor Escolha`,
          html: html(codigo, email),
          texto: `Seu código para entrar na Melhor Escolha: ${codigo}. Vale por uma hora.`,
        });
        if (!envio.ok) return resposta({ erro: "envio", status: envio.status }, 200);
        return resposta({ ok: true });
      },
    },
  },
});
