// Limites e ordem de destaque por plano — usado em carRoutes.js e
// rentalRoutes.js. Mantém isto sincronizado com ACCOUNT_PLANS no app.js
// do frontend (é lá que os limites são mostrados ao utilizador).
const PLAN_LIMITS = {
  free: 5,
  individual: 10,
  pro: 20,
  stand: null,
  concessionaria: null,
  empresarial: null
};

// Quanto maior, mais acima aparece nos resultados (benefício de
// "anúncios em destaque" anunciado nos planos pagos).
const PLAN_RANK = {
  free: 0,
  individual: 1,
  pro: 2,
  stand: 2,
  concessionaria: 3,
  empresarial: 4
};

module.exports = { PLAN_LIMITS, PLAN_RANK };
