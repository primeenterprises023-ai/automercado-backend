const supabase = require("../config/supabase");
const { permissionsFor, isValidRole } = require("./roleMiddleware");

// Corre sempre DEPOIS do authMiddleware (precisa de req.user.id já
// definido). Confirma na base de dados se o utilizador tem uma função
// administrativa ativa (tabela admin_users) — nunca confia em nada
// enviado pelo frontend, nem na coluna is_admin da tabela users.
//
// Se estiver tudo certo, deixa em req.admin:
//   { id, email, role, permissions }
// para as rotas seguintes (ver roleMiddleware.js: requirePermission).
//
// Nota: um erro da base de dados responde 500 e fica registado nos logs
// (antes respondia 403 em silêncio, o que escondia falhas reais).
async function adminMiddleware(req, res, next) {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Sessão inválida — inicia sessão novamente"
      });
    }

    // Só aceita o token emitido pelo login do painel (scope "admin",
    // curto). Um token normal do site, mesmo de um administrador, não serve.
    if (req.user.scope !== "admin") {
      return res.status(401).json({
        error: "Sessão de administrador necessária — inicia sessão no painel"
      });
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", req.user.id)
      .limit(1);

    if (error) {
      console.error("adminMiddleware — erro ao ler admin_users:", error.message);
      return res.status(500).json({
        error: "Erro interno do servidor"
      });
    }

    const admin = Array.isArray(data) ? data[0] : null;

    if (!admin || admin.is_active !== true || !isValidRole(admin.role)) {
      return res.status(403).json({
        error: "Acesso negado — esta área é só para administradores"
      });
    }

    req.admin = {
      id: req.user.id,
      email: req.user.email,
      role: admin.role,
      permissions: permissionsFor(admin.role)
    };

    next();

  } catch (error) {

    console.error("adminMiddleware:", error.message);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
}

module.exports = adminMiddleware;
