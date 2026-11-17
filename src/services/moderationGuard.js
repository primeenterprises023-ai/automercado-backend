const supabase = require("../config/supabase");

// ==========================================
// GUARDAS DE MODERAÇÃO (usados pelas rotas públicas)
//
// O painel administrativo pode suspender ou rejeitar anúncios e suspender
// contas. Para isso valer na prática, as rotas públicas têm de respeitar
// esses estados:
//   - o dono não pode desfazer uma suspensão/rejeição (editar, mudar o
//     estado ou apagar);
//   - anúncios suspensos/rejeitados, ou de contas suspensas, não aparecem
//     ao público;
//   - contas suspensas não entram nem usam a API.
//
// Todas as verificações de contas FALHAM EM ABERTO: se a coluna
// users.account_status ainda não existir (migração B por correr) ou a
// base de dados der erro, nada é bloqueado e o site funciona como antes.
// ==========================================

// Estados que só a moderação pode alterar
const MODERATED_STATUSES = ["suspended", "rejected"];

function isModerated(status) {
  return MODERATED_STATUSES.includes(status);
}

function moderatedMessage(status) {
  return status === "rejected"
    ? "Este anúncio foi rejeitado pela moderação. Contacta o suporte."
    : "Este anúncio foi suspenso pela moderação. Contacta o suporte.";
}

// Evita encher os logs com o mesmo aviso a cada pedido
let lastWarning = 0;

function warnOncePerMinute(message) {
  const now = Date.now();

  if (now - lastWarning > 60 * 1000) {
    lastWarning = now;
    console.warn(message);
  }
}

// "active" | "suspended" | "missing" (utilizador já não existe) | "unknown"
async function getAccountState(userId) {
  try {

    if (!userId) {
      return "unknown";
    }

    const { data, error } = await supabase
      .from("users")
      .select("account_status")
      .eq("id", userId)
      .limit(1);

    if (error) {
      warnOncePerMinute(
        "moderationGuard: não foi possível ler account_status " +
        "(a migração B já correu?): " + error.message
      );
      return "unknown";
    }

    if (!Array.isArray(data) || data.length === 0) {
      return "missing";
    }

    return data[0].account_status === "suspended" ? "suspended" : "active";

  } catch (error) {

    warnOncePerMinute("moderationGuard: " + error.message);
    return "unknown";

  }
}

async function isOwnerSuspended(userId) {
  return (await getAccountState(userId)) === "suspended";
}

// Conjunto (Set) com os ids, de entre os recebidos, cujas contas estão suspensas
async function getSuspendedOwnerIds(ids) {
  try {

    if (!Array.isArray(ids) || ids.length === 0) {
      return new Set();
    }

    const { data, error } = await supabase
      .from("users")
      .select("id")
      .in("id", ids)
      .eq("account_status", "suspended");

    if (error) {
      warnOncePerMinute(
        "moderationGuard: não foi possível ler account_status " +
        "(a migração B já correu?): " + error.message
      );
      return new Set();
    }

    return new Set((data || []).map((user) => user.id));

  } catch (error) {

    warnOncePerMinute("moderationGuard: " + error.message);
    return new Set();

  }
}

module.exports = {
  MODERATED_STATUSES,
  isModerated,
  moderatedMessage,
  getAccountState,
  isOwnerSuspended,
  getSuspendedOwnerIds
};
