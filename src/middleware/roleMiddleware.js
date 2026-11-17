// ==========================================
// FUNÇÕES E PERMISSÕES DO PAINEL ADMINISTRATIVO
//
// A função de cada administrador vem SEMPRE da base de dados (tabela
// admin_users, lida pelo adminMiddleware) — nunca do frontend. Este
// ficheiro só define "que função pode fazer o quê".
//
// Para criar uma permissão nova: acrescenta-a a ALL_PERMISSIONS e, se o
// admin ou o moderator a devem ter, à lista dessa função. O superadmin
// recebe sempre todas.
//
// Uso nas rotas (depois de authMiddleware e adminMiddleware):
//   router.post("/cars/:id/approve", requirePermission("listings:review"), handler);
// ==========================================

const ROLES = ["superadmin", "admin", "moderator"];

const ALL_PERMISSIONS = [
  "dashboard:view",

  "listings:view",
  "listings:review",   // aprovar e rejeitar
  "listings:suspend",  // suspender e reativar
  "listings:edit",
  "listings:delete",

  "users:view",
  "users:suspend",     // suspender e reativar contas
  "users:verify",
  "users:delete",

  "plans:view",
  "plans:change",

  "reports:view",
  "reports:resolve",

  "analytics:view",    // página de relatórios
  "audit:view",        // histórico de atividades
  "admins:manage",
  "settings:manage"
];

const PERMISSIONS_BY_ROLE = {

  superadmin: ALL_PERMISSIONS,

  admin: [
    "dashboard:view",
    "listings:view",
    "listings:review",
    "listings:suspend",
    "listings:edit",
    "listings:delete",
    "users:view",
    "users:suspend",
    "users:verify",
    "reports:view",
    "reports:resolve",
    "analytics:view",
    "audit:view"
  ],

  moderator: [
    "dashboard:view",
    "listings:view",
    "listings:review",
    "listings:suspend",
    "reports:view",
    "reports:resolve"
  ]

};

// Rede de segurança: um erro de escrita numa lista de permissões faz o
// servidor falhar ao arrancar (e a Render manter a versão anterior),
// em vez de ficar silenciosamente errado.
Object.keys(PERMISSIONS_BY_ROLE).forEach((role) => {
  PERMISSIONS_BY_ROLE[role].forEach((permission) => {
    if (!ALL_PERMISSIONS.includes(permission)) {
      throw new Error(
        "roleMiddleware: permissão desconhecida \"" + permission +
        "\" na função " + role
      );
    }
  });
});

function isValidRole(role) {
  return ROLES.includes(role);
}

// Devolve uma cópia, para ninguém alterar a tabela por engano
function permissionsFor(role) {
  return isValidRole(role) ? [...PERMISSIONS_BY_ROLE[role]] : [];
}

function hasPermission(admin, permission) {
  return Boolean(
    admin &&
    Array.isArray(admin.permissions) &&
    admin.permissions.includes(permission)
  );
}

// Exige TODAS as permissões indicadas. Falha sempre fechada: se o
// adminMiddleware não correu (sem req.admin), responde 403.
function requirePermission(...needed) {

  if (needed.length === 0) {
    throw new Error("requirePermission: indica pelo menos uma permissão");
  }

  needed.forEach((permission) => {
    if (!ALL_PERMISSIONS.includes(permission)) {
      throw new Error(
        "requirePermission: permissão desconhecida \"" + permission + "\""
      );
    }
  });

  return function (req, res, next) {

    if (!req.admin || !needed.every((p) => hasPermission(req.admin, p))) {
      return res.status(403).json({
        error: "Não tens permissão para esta ação"
      });
    }

    next();

  };

}

// Exige que a função seja uma das indicadas (ex.: só superadmin)
function requireRole(...roles) {

  if (roles.length === 0) {
    throw new Error("requireRole: indica pelo menos uma função");
  }

  roles.forEach((role) => {
    if (!isValidRole(role)) {
      throw new Error("requireRole: função desconhecida \"" + role + "\"");
    }
  });

  return function (req, res, next) {

    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({
        error: "Não tens permissão para esta ação"
      });
    }

    next();

  };

}

module.exports = {
  ROLES,
  ALL_PERMISSIONS,
  isValidRole,
  permissionsFor,
  hasPermission,
  requirePermission,
  requireRole
};
