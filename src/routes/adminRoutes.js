const express = require("express");
const supabase = require("../config/supabase");
const adminListingRoutes = require("./adminListingRoutes");
const { requirePermission, hasPermission } = require("../middleware/roleMiddleware");
const { getDashboard, getNotifications } = require("../services/adminDashboardService");
const { HttpError } = require("../services/adminValidation");

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
      email: req.user.email,
      role: req.admin ? req.admin.role : undefined
    }
  });

});


// ==========================================
// QUEM SOU EU (identidade e permissões)
// GET /api/admin/me
// O painel chama isto logo a seguir ao login para saber a função do
// administrador e montar o menu só com o que ele pode usar. A segurança
// real continua no servidor: cada rota volta a verificar a permissão.
// ==========================================

router.get("/me", async (req, res) => {

  if (!req.admin) {
    return res.status(403).json({
      error: "Acesso negado — esta área é só para administradores"
    });
  }

  let name = null;

  try {

    const { data } = await supabase
      .from("users")
      .select("name")
      .eq("id", req.admin.id)
      .limit(1);

    name = Array.isArray(data) && data[0] ? data[0].name : null;

  } catch (error) {

    // O nome é só para mostrar no painel; sem ele a resposta segue na mesma
    console.error("GET /api/admin/me — erro ao ler o nome:", error.message);

  }

  res.json({
    admin: {
      id: req.admin.id,
      email: req.admin.email,
      name: name,
      role: req.admin.role,
      permissions: req.admin.permissions
    }
  });

});

// ==========================================
// DASHBOARD
// GET /api/admin/dashboard?days=30   (days: 7, 30 ou 90)
// Números reais da base de dados. A atividade administrativa recente só
// vem para quem pode ver o histórico (audit:view).
// ==========================================

router.get("/dashboard", requirePermission("dashboard:view"), async (req, res) => {

  try {

    res.json(await getDashboard({
      days: req.query && req.query.days,
      canViewAudit: hasPermission(req.admin, "audit:view")
    }));

  } catch (error) {

    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("GET /api/admin/dashboard:", error.message);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }

});


// ==========================================
// NOTIFICAÇÕES (sino da barra superior)
// GET /api/admin/notifications
// Só devolve os números a que a função tem direito (os outros vêm a null).
// ==========================================

router.get("/notifications", requirePermission("dashboard:view"), async (req, res) => {

  try {

    res.json(await getNotifications({
      canSeeListings: hasPermission(req.admin, "listings:view"),
      canSeeReports: hasPermission(req.admin, "reports:view")
    }));

  } catch (error) {

    console.error("GET /api/admin/notifications:", error.message);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }

});


// ==========================================
// ANÚNCIOS (carros e alugueres)
// /api/admin/listings/...  (ver adminListingRoutes.js)
// ==========================================

router.use("/listings", adminListingRoutes);

module.exports = router;
