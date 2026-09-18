const express = require("express");

const router = express.Router();


// ==========================================
// TESTE DE ACESSO DE ADMINISTRADOR
// GET /api/admin/ping
// authMiddleware e adminMiddleware já correram antes desta rota (ver
// server.js) — se chegaste aqui, és mesmo um administrador autenticado.
// As rotas reais (stats, users, cars) entram nos próximos passos.
// ==========================================

router.get("/ping", (req, res) => {

  res.json({
    message: "Acesso de administrador confirmado",
    admin: {
      id: req.user.id,
      email: req.user.email
    }
  });

});

module.exports = router;
