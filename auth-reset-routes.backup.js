const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('./mailer');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

const GENERIC_MESSAGE =
  'Se esse email tiver conta, vais receber um link para definires uma nova palavra-passe.';

module.exports = function (supabaseAdmin) {
  const router = express.Router();

  // =========================================================
  // POST /forgot-password
  // =========================================================
  router.post('/forgot-password', async (req, res) => {
    const respondGeneric = () => {
      return res.json({ message: GENERIC_MESSAGE });
    };

    try {
      const email = String(req.body.email || '').trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          error: 'Email é obrigatório.'
        });
      }

      // Procurar utilizador
      const { data: user, error: userErr } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .maybeSingle();

      if (userErr) {
        console.error(
          'forgot-password: erro a procurar utilizador',
          userErr
        );

        return respondGeneric();
      }

      // Não revelar se o email existe
      if (!user) {
        return respondGeneric();
      }

      // Invalidar tokens anteriores
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({
          used_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .is('used_at', null);

      // Criar token
      const rawToken = crypto.randomBytes(32).toString('hex');

      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const expiresAt = new Date(
        Date.now() + TOKEN_TTL_MS
      ).toISOString();

      // Guardar apenas o hash
      const { error: insertErr } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt
        });

      if (insertErr) {
        console.error(
          'forgot-password: erro a gravar token',
          insertErr
        );

        return respondGeneric();
      }

      // Link que vai para o frontend
      const resetLink =
        `${process.env.FRONTEND_URL}/redefinir-password.html?token=${rawToken}`;

      // Enviar email
      try {
        await sendEmail({
          to: email,
          subject: 'Recuperação da sua senha',
          html: `
            <h2>Recuperação de senha</h2>

            <p>Olá ${user.name || ''},</p>

            <p>
              Clique no link abaixo para criar uma nova senha:
            </p>

            <p>
              <a href="${resetLink}">
                Redefinir minha senha
              </a>
            </p>

            <p>
              Este link expira em 1 hora.
            </p>
          `
        });

        console.log(
          'forgot-password: email enviado para',
          email
        );

      } catch (emailErr) {
        console.error(
          'forgot-password: erro ao enviar email',
          emailErr
        );
      }

      return respondGeneric();

    } catch (err) {
      console.error(
        'forgot-password: erro inesperado',
        err
      );

      return respondGeneric();
    }
  });


  // =========================================================
  // POST /reset-password
  // =========================================================
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          error: 'Pedido inválido.'
        });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({
          error: 'A palavra-passe tem de ter pelo menos 6 caracteres.'
        });
      }

      // Hash do token recebido
      const tokenHash = crypto
        .createHash('sha256')
        .update(String(token))
        .digest('hex');

      // Procurar token
      const { data: tokenRow, error: tokenErr } =
        await supabaseAdmin
          .from('password_reset_tokens')
          .select(
            'id, user_id, expires_at, used_at'
          )
          .eq('token_hash', tokenHash)
          .maybeSingle();

      const isExpired =
        tokenRow &&
        new Date(tokenRow.expires_at) < new Date();

      if (
        tokenErr ||
        !tokenRow ||
        tokenRow.used_at ||
        isExpired
      ) {
        return res.status(400).json({
          error: 'Link inválido ou expirado. Pede um novo.'
        });
      }

      // Criar novo hash da palavra-passe
      const passwordHash = await bcrypt.hash(
        String(newPassword),
        10
      );

      // Atualizar password do utilizador
      const { error: updateUserErr } =
        await supabaseAdmin
          .from('users')
          .update({
            password: passwordHash
          })
          .eq('id', tokenRow.user_id);

      if (updateUserErr) {
        console.error(
          'reset-password: erro ao atualizar password',
          updateUserErr
        );

        return res.status(500).json({
          error: 'Não foi possível alterar a palavra-passe.'
        });
      }

      // Marcar token como utilizado
      const
