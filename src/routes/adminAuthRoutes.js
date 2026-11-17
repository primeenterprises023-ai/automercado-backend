const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const { adminLoginLimiter } = require("../middleware/adminRateLimiters");
const { isValidRole, permissionsFor } = require("../middleware/roleMiddleware");
const { logAdminAction } = require("../services/adminAuditService");
const { getAccountState } = require("../services/moderationGuard");

const router = express.Router();

// Sessão do painel: curta (8 horas) e marcada com scope "admin".
// Um token normal do site (7 dias, sem scope) NÃO serve para /api/admin.
const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;

// A mesma mensagem para email inexistente, password errada ou conta que
// não é de administrador: assim ninguém descobre que contas existem.
const GENERIC_LOGIN_ERROR = "Email ou password incorretos";

// Hash falso: quando o email não existe, comparamos na mesma com ele para
// gastar o mesmo tempo e não denunciar que o email não existe.
const DUMMY_HASH = bcrypt.hashSync("password-falsa-so-para-igualar-o-tempo", 10);


// Regista tentativas falhadas, mas só em contas que SÃO de administrador
// (para não encher o histórico com ruído de quem testa emails ao acaso).
async function logFailedAdminLogin(req, user) {
  try {

    const { data } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", user.id)
      .limit(1);

    const row = Array.isArray(data) ? data[0] : null;

    if (row && row.is_active === true && isValidRole(row.role)) {
      await logAdminAction(
        { admin: { id: user.id, email: user.email, role: row.role }, ip: req.ip },
        { action: "admin.login_failed", entityType: "admin", entityId: user.id }
      );
    }

  } catch (error) {
    console.error("adminLogin — erro ao registar tentativa falhada:", error.message);
  }
}


// ==========================================
// LOGIN DO PAINEL ADMINISTRATIVO
// POST /api/admin/auth/login
// ==========================================

router.post("/login", adminLoginLimiter, async (req, res) => {
  try {

    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({
        error: "Email e password são obrigatórios"
      });
    }

    if (email.length > 254 || password.length > 200) {
      return res.status(400).json({
        error: "Dados inválidos"
      });
    }

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, name, email, password")
      .eq("email", email.trim())
      .limit(1);

    if (userError) {
      console.error("adminLogin — erro ao ler users:", userError.message);
      return res.status(500).json({
        error: "Erro interno do servidor"
      });
    }

    const user = Array.isArray(users) ? users[0] : null;
    const hasHash = Boolean(user && typeof user.password === "string");

    const matches = await bcrypt.compare(password, hasHash ? user.password : DUMMY_HASH);

    if (!hasHash || !matches) {

      if (user) {
        await logFailedAdminLogin(req, user);
      }

      return res.status(401).json({
        error: GENERIC_LOGIN_ERROR
      });

    }

    // Conta suspensa pela moderação: nem os administradores entram
    // (mesma mensagem genérica, para não revelar o estado da conta).
    if ((await getAccountState(user.id)) === "suspended") {
      return res.status(401).json({
        error: GENERIC_LOGIN_ERROR
      });
    }

    const { data: rows, error: adminError } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", user.id)
      .limit(1);

    if (adminError) {
      console.error("adminLogin — erro ao ler admin_users:", adminError.message);
      return res.status(500).json({
        error: "Erro interno do servidor"
      });
    }

    const adminRow = Array.isArray(rows) ? rows[0] : null;

    if (!adminRow || adminRow.is_active !== true || !isValidRole(adminRow.role)) {
      return res.status(401).json({
        error: GENERIC_LOGIN_ERROR
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("adminLogin — JWT_SECRET não está definido");
      return res.status(500).json({
        error: "Erro interno do servidor"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        scope: "admin"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: ADMIN_TOKEN_TTL_SECONDS
      }
    );

    await logAdminAction(
      { admin: { id: user.id, email: user.email, role: adminRow.role }, ip: req.ip },
      { action: "admin.login", entityType: "admin", entityId: user.id }
    );

    res.json({
      message: "Login de administrador realizado com sucesso!",
      token,
      expires_in: ADMIN_TOKEN_TTL_SECONDS,
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: adminRow.role,
        permissions: permissionsFor(adminRow.role)
      }
    });

  } catch (error) {

    console.error("adminLogin:", error.message);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});

module.exports = router;
