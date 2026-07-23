// ==========================================
// email.js - Envio de e-mails transacionais (via Resend)
//
// Escolhi a Resend porque a API é só um POST simples (dá pra chamar com
// fetch, sem precisar de biblioteca) e ela tem um plano gratuito que cobre
// tranquilamente o volume de um app de uso doméstico.
//
// Pra funcionar em produção, configure (ver README/instruções de deploy):
//   1. wrangler secret put RESEND_API_KEY   → sua chave de API da Resend
//   2. EMAIL_REMETENTE no wrangler.toml     → um endereço do seu domínio
//      verificado na Resend (ex: "Cadimus <nao-responda@seudominio.com>")
//   3. FRONTEND_URL no wrangler.toml        → a URL onde o frontend roda,
//      pra montar o link que vai dentro do e-mail
// ==========================================

export async function enviarEmail(env, { para, assunto, html }) {
  if (!env.RESEND_API_KEY) {
    // Sem chave configurada ainda: não derruba a aplicação, só avisa no log
    // do Worker (visível em `wrangler tail`). Isso permite testar o resto do
    // fluxo antes de configurar o envio de e-mail de verdade.
    console.error("RESEND_API_KEY não configurada — e-mail não enviado. Configure com `wrangler secret put RESEND_API_KEY`.");
    return { ok: false, motivo: "email_nao_configurado" };
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE || "Cadimus <onboarding@resend.dev>",
      to: [para],
      subject: assunto,
      html,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("Falha ao enviar e-mail via Resend:", resposta.status, detalhe);
    return { ok: false, motivo: "falha_no_envio" };
  }

  return { ok: true };
}

export function templateRecuperacaoSenha(link) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Recuperação de senha — Cadimus</h2>
      <p>Foi solicitada a redefinição da sua senha. Clique no botão abaixo para criar uma senha nova:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #111; color: #fff; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Redefinir senha
        </a>
      </p>
      <p style="color: #666; font-size: 0.85rem;">Esse link expira em 30 minutos. Se você não pediu essa alteração, pode ignorar este e-mail com segurança — sua senha continua a mesma.</p>
    </div>
  `;
}
