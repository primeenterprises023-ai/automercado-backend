const PLAN_LIMITS = {
  free: 3,
  basico: 10,
  basic: 10,
  premium: 30,
  profissional: 50,
  enterprise: null
};

const PLAN_RANK = {
  free: 0,
  basico: 1,
  basic: 1,
  premium: 2,
  profissional: 3,
  enterprise: 4
};

module.exports = { PLAN_LIMITS, PLAN_RANK };
