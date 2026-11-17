const rateLimit = require("express-rate-limit");

// ==========================================
// LIMITES DE PEDIDOS DO PAINEL ADMINISTRATIVO
//
// Estes limites substituem o limite geral do server.js nas rotas
// /api/admin (o limite geral ignora essas rotas).
// ==========================================

// Login do painel: só 10 tentativas FALHADAS por IP em 15 minutos.
// Os logins que correm bem não contam.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas tentativas de login. Tenta novamente dentro de 15 minutos."
  }
});

// Restante API administrativa: folga suficiente para uma pessoa a
// trabalhar no painel, mas trava abusos.
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados pedidos. Tenta novamente daqui a pouco."
  }
});

module.exports = { adminLoginLimiter, adminApiLimiter };
