
async function sendPasswordResetEmail({ to, name, resetLink }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || "AutoMercado Angola";

  if (!apiKey || !senderEmail) {
    throw new Error("Configuração da API Brevo incompleta.");
  }

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [{ email: to, name: name || to }],
        subject: "Recuperar a tua palavra-passe — AutoMercado Angola",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
            <h2>AutoMercado Angola</h2>
            <p>Olá ${escapeHtml(name || "")},</p>
            <p>Recebemos um pedido para redefinir a tua palavra-passe.</p>
            <p>
              <a href="${resetLink}"
                 style="background:#b02a2a;color:white;padding:12px 22px;
                 text-decoration:none;border-radius:8px">
                Definir nova palavra-passe
              </a>
            </p>
            <p>Se não fizeste este pedido, ignora este email.</p>
            <p>O link expira dentro de uma hora.</p>
          </div>
        `
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Erro da API Brevo:", response.status, result);
    throw new Error(`Falha no envio pela Brevo: HTTP ${response.status}`);
  }

  console.log("Email aceite pela API Brevo:", result.messageId);
  return result;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

module.exports = { sendPasswordResetEmail };

