const express = require("express");
const { requirePermission, hasPermission } = require("../middleware/roleMiddleware");
const service = require("../services/adminListingService");
const { HttpError, isUuid } = require("../services/adminValidation");

const router = express.Router();

// ==========================================
// ANÚNCIOS (carros e alugueres) — /api/admin/listings
//
// O :type é "car" ou "rental". Cada rota exige a sua permissão (ver
// roleMiddleware.js); o authMiddleware e o adminMiddleware já correram.
// ==========================================

// Transforma erros esperados (HttpError) em respostas claras e qualquer
// outro erro num 500 genérico, sem mostrar detalhes internos.
function handle(fn) {
  return async function (req, res) {
    try {

      await fn(req, res);

    } catch (error) {

      if (error instanceof HttpError) {
        const body = { error: error.message };
        if (error.fields) body.fields = error.fields;
        return res.status(error.status).json(body);
      }

      console.error("adminListings:", error.message);

      res.status(500).json({
        error: "Erro interno do servidor"
      });

    }
  };
}

function target(req) {

  const { type, id } = req.params;

  if (type !== "car" && type !== "rental") {
    throw new HttpError(404, "Tipo de anúncio inválido (usa car ou rental)");
  }

  if (!isUuid(id)) {
    throw new HttpError(400, "ID de anúncio inválido");
  }

  return { type, id };

}

function moderation(action) {
  return handle(async (req, res) => {
    const { type, id } = target(req);
    res.json(await service.transitionListing({ type, id, action, body: req.body, req }));
  });
}


// GET /api/admin/listings?type=&status=&q=&province=&brand=&model=&location=
//     &min_price=&max_price=&owner_id=&sort=&dir=&page=&page_size=
router.get("/", requirePermission("listings:view"), handle(async (req, res) => {
  res.json(await service.listListings(req.query, {
    canSearchEmails: hasPermission(req.admin, "users:view")
  }));
}));

// GET /api/admin/listings/:type/:id
router.get("/:type/:id", requirePermission("listings:view"), handle(async (req, res) => {
  const { type, id } = target(req);
  res.json(await service.getListing(type, id));
}));

// POST /api/admin/listings/:type/:id/approve   (pendente ou rejeitado → aprovado)
router.post("/:type/:id/approve", requirePermission("listings:review"), moderation("approve"));

// POST /api/admin/listings/:type/:id/reject    (motivo obrigatório)
router.post("/:type/:id/reject", requirePermission("listings:review"), moderation("reject"));

// POST /api/admin/listings/:type/:id/suspend   (motivo obrigatório)
router.post("/:type/:id/suspend", requirePermission("listings:suspend"), moderation("suspend"));

// POST /api/admin/listings/:type/:id/reactivate (suspenso → aprovado)
router.post("/:type/:id/reactivate", requirePermission("listings:suspend"), moderation("reactivate"));

// PATCH /api/admin/listings/:type/:id          (só os campos permitidos)
router.patch("/:type/:id", requirePermission("listings:edit"), handle(async (req, res) => {
  const { type, id } = target(req);
  res.json(await service.editListing({ type, id, body: req.body, req }));
}));

// DELETE /api/admin/listings/:type/:id         ({ "confirm": "<id>", "reason": "..." })
router.delete("/:type/:id", requirePermission("listings:delete"), handle(async (req, res) => {
  const { type, id } = target(req);
  res.json(await service.deleteListing({ type, id, body: req.body, req }));
}));

module.exports = router;
