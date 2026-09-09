const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      error: "Token inválido ou expirado"
    });

  }
}

module.exports = authMiddleware;
