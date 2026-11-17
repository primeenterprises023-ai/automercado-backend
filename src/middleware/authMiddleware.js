const jwt = require("jsonwebtoken");
const { getAccountState } = require("../services/moderationGuard");

// Verifica o token e, a seguir, se a conta ainda existe e não está
// suspensa (a suspensão feita no painel vale logo, sem esperar que o
// token expire). Se a base de dados não responder, deixa passar (falha em
// aberto): as próprias rotas voltam a precisar da base de dados.
async function authMiddleware(req, res, next) {

  let decoded;

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token não fornecido"
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        error: "Formato do token inválido"
      });
    }

    const token = parts[1];

    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

  } catch (error) {

    return res.status(401).json({
      error: "Token inválido ou expirado"
    });

  }

  if (!decoded || !decoded.id) {
    return res.status(401).json({
      error: "Token inválido ou expirado"
    });
  }

  const state = await getAccountState(decoded.id);

  if (state === "suspended") {
    return res.status(403).json({
      error: "Conta suspensa. Contacta o suporte."
    });
  }

  if (state === "missing") {
    return res.status(401).json({
      error: "Token inválido ou expirado"
    });
  }

  req.user = decoded;

  next();
}

module.exports = authMiddleware;
