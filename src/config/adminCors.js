// ==========================================
// CORS DO PAINEL ADMINISTRATIVO
//
// O painel só pode chamar /api/admin a partir dos endereços listados na
// variável de ambiente ADMIN_ORIGINS (separados por vírgula), por exemplo:
//
//   ADMIN_ORIGINS=https://automercado-admin.vercel.app
//
// Sem ADMIN_ORIGINS, nenhum site consegue chamar /api/admin a partir do
// browser (é o padrão seguro). Pedidos sem cabeçalho Origin (curl,
// Postman, servidor a servidor) não são afetados pelo CORS: o que os
// protege é o token de administrador.
//
// O resto da API (/api/cars, /api/auth...) continua com o CORS de sempre.
// ==========================================

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function buildAdminCorsOptions(adminOrigins) {

  const allowed = parseOrigins(adminOrigins);

  return {
    origin: function (origin, callback) {

      // Sem Origin = não é um browser a chamar de outro site
      if (!origin) {
        return callback(null, true);
      }

      return callback(null, allowed.includes(normalizeOrigin(origin)));

    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  };

}

module.exports = { parseOrigins, buildAdminCorsOptions };
