const supabase = require("../config/supabase");

/**
 * requireAccountType('vendedor', 'stand') — só deixa passar se o tipo de
 * conta do utilizador autenticado (req.user.id, já validado pelo
 * authMiddleware) for um dos indicados.
 *
 * Vai sempre buscar o tipo_conta à base de dados em vez de confiar no
 * token ou em nada que venha do pedido — o token só prova QUEM é o
 * utilizador, nunca o que ele tem permissão para fazer. Isto impede que
 * alguém obtenha mais permissões só por editar o pedido no browser.
 *
 * Usar sempre DEPOIS de authMiddleware na cadeia de middlewares, porque
 * precisa de req.user.id já preenchido.
 */
function requireAccountType(...tiposPermitidos) {
  return async function (req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: "Sessão necessária"
        });
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("tipo_conta")
        .eq("id", req.user.id)
        .single();

      if (error && (error.code === "42703" || /tipo_conta/i.test(error.message || ""))) {
        // A coluna tipo_conta não existe: a migração SQL (tipos-de-conta.sql)
        // ainda não foi corrida. Falha fechada (ninguém passa), mas com um
        // erro claro para quem administra o servidor.
        console.log("ERRO: coluna users.tipo_conta em falta — corre a migração tipos-de-conta.sql");

        return res.status(500).json({
          error: "Configuração em falta no servidor (tipo de conta). Contacta o administrador."
        });
      }

      if (error || !user) {
        return res.status(401).json({
          error: "Conta não encontrada"
        });
      }

      if (!tiposPermitidos.includes(user.tipo_conta)) {
        return res.status(403).json({
          error: "A tua conta não tem permissão para esta ação",
          tipo_conta: user.tipo_conta,
          tipos_permitidos: tiposPermitidos
        });
      }

      req.accountType = user.tipo_conta;
      next();

    } catch (error) {
      console.log("ERRO accountTypeMiddleware:", error);

      res.status(500).json({
        error: "Erro interno do servidor"
      });
    }
  };
}

module.exports = requireAccountType;
