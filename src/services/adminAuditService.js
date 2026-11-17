const supabase = require("../config/supabase");

// ==========================================
// HISTÓRICO DE ATIVIDADES ADMINISTRATIVAS
//
// Grava uma linha em admin_activity_log por cada ação importante
// (aprovar, rejeitar, suspender, alterar plano...). A tabela é só de
// acréscimo: um gatilho na base de dados impede editar ou apagar.
//
// Uso numa rota, DEPOIS de a ação ter corrido bem:
//   await logAdminAction(req, {
//     action: "listing.approve",
//     entityType: "car",
//     entityId: car.id,
//     details: { before: "paused", after: "approved" }
//   });
//
// Nunca lança erros: se o registo falhar, devolve false e o erro fica
// nos logs. A rota decide o que fazer com isso.
// ==========================================

// Qualquer chave que contenha uma destas palavras é removida
const SENSITIVE_WORDS = ["password", "senha", "token", "secret", "authorization", "cookie"];

const MAX_DEPTH = 5;
const MAX_TEXT = 500;
const MAX_DETAILS_CHARS = 8000;

function isSensitiveKey(key) {
  const lower = String(key).toLowerCase();
  return SENSITIVE_WORDS.some((word) => lower.includes(word));
}

function cleanDetails(value, depth = 0) {

  if (value === null || value === undefined) return value;

  if (value instanceof Date) return value.toISOString();

  if (depth >= MAX_DEPTH) return "[truncado]";

  if (Array.isArray(value)) {
    return value.map((item) => cleanDetails(item, depth + 1));
  }

  if (typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = isSensitiveKey(key)
        ? "[removido]"
        : cleanDetails(value[key], depth + 1);
    });
    return out;
  }

  if (typeof value === "string" && value.length > MAX_TEXT) {
    return value.slice(0, MAX_TEXT) + "…";
  }

  return value;

}

function buildDetails(details) {

  const cleaned = cleanDetails(details || {});
  const text = JSON.stringify(cleaned);

  if (text && text.length > MAX_DETAILS_CHARS) {
    return { truncated: true, preview: text.slice(0, 1000) };
  }

  return cleaned;

}

async function logAdminAction(req, options) {
  try {

    const { action, entityType, entityId = null, details = {} } = options || {};

    if (!action || !entityType) {
      console.error("adminAuditService: action e entityType são obrigatórios");
      return false;
    }

    const admin = req && req.admin ? req.admin : {};

    // Nome no momento da ação (cópia, para o histórico continuar legível
    // mesmo que a conta mude ou seja apagada). É opcional: se falhar, segue.
    let adminName = null;

    if (admin.id) {
      try {
        const { data } = await supabase
          .from("users")
          .select("name")
          .eq("id", admin.id)
          .limit(1);

        adminName = Array.isArray(data) && data[0] ? data[0].name : null;
      } catch (nameError) {
        adminName = null;
      }
    }

    // Atrás da Render, req.ip só mostra o IP real se o server.js tiver
    // app.set("trust proxy", 1).
    const { error } = await supabase
      .from("admin_activity_log")
      .insert({
        admin_id: admin.id || null,
        admin_name: adminName,
        admin_email: admin.email || null,
        admin_role: admin.role || null,
        action: action,
        entity_type: entityType,
        entity_id: entityId === null || entityId === undefined ? null : String(entityId),
        details: buildDetails(details),
        ip: (req && req.ip) || null
      });

    if (error) {
      console.error("adminAuditService: falha ao registar ação:", error.message);
      return false;
    }

    return true;

  } catch (error) {

    console.error("adminAuditService:", error.message);
    return false;

  }
}

module.exports = { logAdminAction };
