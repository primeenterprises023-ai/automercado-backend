const nodemailer = require("nodemailer");

let transporter;

async function getTransporter() {
  // Se SMTP estiver configurado, usa o SMTP configurado
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Sem SMTP configurado: cria uma conta Ethereal para testes
  const testAccount = await nodemailer.createTestAccount();

  console.log("📧 Conta de teste Ethereal criada:");
  console.log("   Usuário:", testAccount.user);

  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    transporter = await getTransporter();
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || "Automercado <no-reply@automercado.test>",
    to,
    subject,
    html
  });

  console.log("📧 Email enviado:", info.messageId);

  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log("🔗 VER EMAIL DE TESTE:");
    console.log(previewUrl);
  }

  return info;
}

module.exports = {
  sendEmail
};
