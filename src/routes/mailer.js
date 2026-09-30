/**
 * Envio de email via SMTP (Nodemailer).
 *
 * Variáveis de ambiente necessárias (define-as no .env local E no painel
 * do Render, em Settings → Environment):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL
 *
 * Qualquer fornecedor SMTP serve — só mudas host/porta/user/pass:
 *   - Gmail: smtp.gmail.com, porta 587, precisa de uma "app password"
 *     (não a tua password normal da conta Google)
 *   - Brevo (ex-Sendinblue), SendGrid, Mailgun, Amazon SES: todos dão um
 *     SMTP grátis até um certo volume de emails/mês
 *
 * PARA TESTAR EM DESENVOLVIMENTO sem mandar emails reais:
 *   Cria uma conta grátis em https://ethereal.email — dá-te um SMTP de
 *   teste e um link de "preview" do email em vez de o entregar a sério.
 *   Usa esse host/user/pass nas variáveis acima enquanto testas.
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordResetEmail({ to, name, resetLink }) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"AutoMercado Angola" <no-reply@automercado.ao>',
    to,
    subject: 'Recuperar a tua palavra-passe — AutoMercado Angola',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#b02a2a;">AutoMercado Angola</h2>
        <p>Olá${name ? ' ' + name : ''},</p>
        <p>Recebemos um pedido para redefinires a palavra-passe da tua conta.
           Clica no botão abaixo para escolheres uma nova. Este link expira
           dentro de 1 hora.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${resetLink}"
             style="background:#b02a2a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
            Definir nova palavra-passe
          </a>
        </p>
        <p style="font-size:12px;color:#888;">
          Se não foste tu a pedir isto, ignora este email — a tua palavra-passe
          atual continua válida e nada muda.
        </p>
      </div>
    `,
  });

  // Com Ethereal, isto imprime um link onde podes VER o email recebido —
  // muito útil enquanto testas sem um SMTP real configurado.
  if (nodemailer.getTestMessageUrl(info)) {
    console.log('Pré-visualização do email (Ethereal):', nodemailer.getTestMessageUrl(info));
  }
}

module.exports = { sendPasswordResetEmail };
