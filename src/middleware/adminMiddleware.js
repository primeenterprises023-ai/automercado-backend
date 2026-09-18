const supabase = require("../config/supabase");

// Corre sempre DEPOIS do authMiddleware (precisa de req.user.id já
// definido). Confirma na base de dados se o utilizador é administrador —
// nunca confia em nada enviado pelo frontend, só no que está gravado na
// coluna is_admin da tabela users.
async function adminMiddleware(req, res, next) {
  try {

    const { data: user, error } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", req.user.id)
      .single();

    if (error || !user || !user.is_admin) {
      return res.status(403).json({
        error: "Acesso negado — esta área é só para administradores"
      });
    }

    next();

  } catch (error) {

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
}

module.exports = adminMiddleware;
