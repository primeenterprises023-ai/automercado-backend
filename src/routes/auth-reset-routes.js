/**
 * Rotas de recuperação de palavra-passe.
 *
 * ⚠️ ASSUME (ajusta se for diferente no teu projeto):
 *   - Tabela "users" com colunas: id (uuid), email, password (hash bcrypt), name
 *   - Já tens `bcryptjs` instalado (usas para o /auth/register e /auth/login)
 *
 * PRECISA DE UM CLIENTE SUPABASE COM A SERVICE ROLE KEY — NÃO a anon key.
 * A tabela password_reset_tokens não tem políticas de RLS para
 * anon/authenticated de propósito (ver o ficheiro .sql), por isso só um
 * cliente com a service role consegue ler/escrever nela. Cria esse cliente
 * separado do que já usas no resto da app (que provavelmente usa a anon key):
 *
 *   const { createClient } = require('@supabase/supabase-js');
 *   const supabaseAdmin = createClient(
 *     process.env.SUPABASE_URL,
 *     process.env.SUPABASE_SERVICE_ROLE_KEY  // Project Settings → API
 *   );
 *
 * COMO MONTAR ISTO no teu server.js / app.js:
 *
 *   const authResetRoutes = require('./auth-reset-routes')(supabaseAdmin);
 *   app.use('/api/auth', authResetRoutes);
 *
 * Isto cria POST /api/auth/forgot-password e POST /api/auth/reset-password
 * ao lado das rotas /api/auth/login e /api/auth/register que já tens.
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendPasswordResetEmail } = require('./mailer');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const GENERIC_MESSAGE = 'Se esse email tiver conta, vais receber um link para definires uma nova palavra-passe.';

module.exports = function (supabaseAdmin) {
  const router = express.Router();

  // POST /forgot-password   body: { email }
  // Responde sempre com a MESMA mensagem, exista ou não o email — é assim
  // que se evita que alguém descubra quais emails têm conta, só por tentativa.
  router.post('/forgot-password', async (req, res) => {
    const respondGeneric = () => res.json({ message: GENERIC_MESSAGE });

    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });

      const { data: user, error: userErr } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .maybeSingle();

      if (userErr) {
        console.error('forgot-password: erro a procurar utilizador', userErr);
        return respondGeneric();
      }
      if (!user) return respondGeneric(); // email não existe — mesma resposta

      // Invalida pedidos anteriores ainda por usar, para não acumular
      // vários links válidos ao mesmo tempo para a mesma conta.
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('used_at', null);

      // O token "em bruto" só existe neste momento e vai no link do email —
      // na base de dados só fica o hash dele, nunca o valor original
      // (o mesmo princípio de nunca guardar a password em texto simples).
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

      const { error: insertErr } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });

      if (insertErr) {
        console.error('forgot-password: erro a gravar token', insertErr);
        return respondGeneric();
      }

      const resetLink = `${process.env.FRONTEND_URL}/redefinir-password.html?token=${rawToken}`;
      try {
        await sendPasswordResetEmail({ to: user.email, name: user.name, resetLink });
      } catch (mailErr) {
        // Mesmo se o envio do email falhar (SMTP em baixo, etc.), a resposta
        // ao cliente mantém-se genérica — não revelamos detalhes de infra.
        console.error('forgot-password: erro a enviar email', mailErr);
      }

      return respondGeneric();
    } catch (err) {
      console.error('forgot-password: erro inesperado', err);
      return respondGeneric();
    }
  });

  // POST /reset-password   body: { token, newPassword }
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Pedido inválido.' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'A palavra-passe tem de ter pelo menos 6 caracteres.' });
      }

      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

      const { data: tokenRow, error: tokenErr } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      const isExpired = tokenRow && new Date(tokenRow.expires_at) < new Date();
      if (tokenErr || !tokenRow || tokenRow.used_at || isExpired) {
        return res.status(400).json({ error: 'Link inválido ou expirado. Pede um novo.' });
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);

      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ password: passwordHash })
        .eq('id', tokenRow.user_id);

      if (updateErr) {
        console.error('reset-password: erro a atualizar password', updateErr);
        return res.status(500).json({ error: 'Não foi possível atualizar a palavra-passe. Tenta novamente.' });
      }

      // Marca o token como usado — nunca mais pode ser reaproveitado,
      // mesmo que alguém o tenha visto (ex.: num proxy de email).
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenRow.id);

      return res.json({ message: 'Palavra-passe atualizada com sucesso.' });
    } catch (err) {
      console.error('reset-password: erro inesperado', err);
      return res.status(500).json({ error: 'Erro interno. Tenta novamente.' });
    }
  });

  return router;
};
