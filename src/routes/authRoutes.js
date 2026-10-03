/**
 * Rotas de autenticação — substitui/completa o que já tinhas em produção.
 * Mantém exatamente os mesmos pedidos e respostas que o frontend já espera
 * (confirmado a partir do app.js): nomes de campos em inglês (name, email,
 * password, phone), resposta do login em { token, user }.
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora, para o link de recuperação
const RESET_GENERIC_MESSAGE = 'Se esse email tiver conta, vais receber um link para definires uma nova palavra-passe.';

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, plan: row.plan };
}

// POST /auth/register   { name, email, password, phone }
router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phone = String(req.body.phone || '').trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e palavra-passe são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A palavra-passe tem de ter pelo menos 6 caracteres.' });
    }

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma conta com este email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email, password: passwordHash, phone })
      .select('id, name, email, phone, plan')
      .single();

    if (error) {
      console.error('register:', error);
      return res.status(500).json({ error: 'Não foi possível criar a conta.' });
    }

    return res.status(201).json({ message: 'Conta criada com sucesso.', user: publicUser(user) });
  } catch (err) {
    console.error('register:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /auth/login   { email, password }
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password, phone, plan')
      .eq('email', email)
      .maybeSingle();

    // Mensagem igual para "não existe" e para "password errada" — não
    // revela qual das duas coisas falhou.
    const invalid = () => res.status(401).json({ error: 'Email ou palavra-passe incorretos.' });

    if (error || !user) return invalid();
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return invalid();

    const token = signToken(user.id);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('login:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /auth/profile — dados atuais do utilizador autenticado
router.get('/profile', requireAuth, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, phone, plan')
    .eq('id', req.userId)
    .maybeSingle();

  if (error || !user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
  return res.json({ user: publicUser(user) });
});

// PUT /auth/profile   { name, phone }
router.put('/profile', requireAuth, async (req, res) => {
  const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
  const phone = req.body.phone !== undefined ? String(req.body.phone).trim() : undefined;

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;

  const { data: user, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', req.userId)
    .select('id, name, email, phone, plan')
    .single();

  if (error) { console.error('profile update:', error); return res.status(500).json({ error: 'Não foi possível guardar.' }); }
  return res.json({ user: publicUser(user) });
});

// POST /auth/forgot-password   { email }
// Resposta sempre igual, exista ou não o email — não revela contas.
router.post('/forgot-password', async (req, res) => {
  const respondGeneric = () => res.json({ message: RESET_GENERIC_MESSAGE });
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });

    const { data: user } = await supabase.from('users').select('id, email, name').eq('email', email).maybeSingle();
    if (!user) return respondGeneric();

    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', user.id).is('used_at', null);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: insertErr } = await supabase.from('password_reset_tokens').insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
    if (insertErr) { console.error('forgot-password:', insertErr); return respondGeneric(); }

    const resetLink = `${process.env.FRONTEND_URL}/redefinir-password.html?token=${rawToken}`;
    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetLink });
    } catch (mailErr) {
      console.error('forgot-password email:', mailErr);
    }
    return respondGeneric();
  } catch (err) {
    console.error('forgot-password:', err);
    return respondGeneric();
  }
});

// POST /auth/reset-password   { token, newPassword }
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Pedido inválido.' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: 'A palavra-passe tem de ter pelo menos 6 caracteres.' });

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    const expired = tokenRow && new Date(tokenRow.expires_at) < new Date();
    if (tokenErr || !tokenRow || tokenRow.used_at || expired) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Pede um novo.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const { error: updateErr } = await supabase.from('users').update({ password: passwordHash }).eq('id', tokenRow.user_id);
    if (updateErr) { console.error('reset-password:', updateErr); return res.status(500).json({ error: 'Não foi possível atualizar a palavra-passe.' }); }

    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', tokenRow.id);
    return res.json({ message: 'Palavra-passe atualizada com sucesso.' });
  } catch (err) {
    console.error('reset-password:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
