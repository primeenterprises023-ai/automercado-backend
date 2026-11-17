const supabase = require("../config/supabase");
const { TYPES } = require("./adminListingService");
const { HttpError } = require("./adminValidation");

// ==========================================
// DASHBOARD DO PAINEL ADMINISTRATIVO
//
// Todos os números vêm da base de dados real, por contagens exatas (sem
// trazer linhas para o servidor). Se uma parte falhar (por exemplo, a
// coluna account_status ainda não existe porque a migração B não correu),
// essa parte vem a null com um aviso em "warnings" e o resto funciona.
// ==========================================

const ACCOUNT_TYPES = ["comprador", "vendedor", "stand", "rentacar"];
const SELLER_TYPES = ["vendedor", "stand", "rentacar"];

const DAY_MS = 24 * 60 * 60 * 1000;
const LUANDA_OFFSET_MS = 60 * 60 * 1000;   // Angola: UTC+1, sem hora de verão
const MAX_ROWS = 1000;                      // limite por pedido do Supabase
const STATS_TTL_MS = 30 * 1000;

const ALLOWED_DAYS = [7, 30, 90];

// Guarda os números caros durante 30 segundos, para não repetir dezenas de
// contagens se alguém carregar em "Atualizar" várias vezes seguidas.
const cache = new Map();

function resetDashboardCache() {
  cache.clear();
}

async function count(table, apply) {

  let q = supabase.from(table).select("id", { count: "exact", head: true });

  if (apply) q = apply(q);

  const { count: total, error } = await q;

  if (error) throw new Error(error.message || "erro");

  return total || 0;

}

// Executa uma parte do dashboard. Se falhar, devolve null e junta um aviso.
async function attempt(warnings, label, fn) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(label + " indisponível");
    console.error("dashboard — " + label + ":", error.message);
    return null;
  }
}

function localDay(timestamp) {
  return new Date(timestamp + LUANDA_OFFSET_MS).toISOString().slice(0, 10);
}

async function growthRows(table, fromIso) {

  const { data, error } = await supabase
    .from(table)
    .select("created_at")
    .gte("created_at", fromIso)
    .order("created_at", { ascending: true })
    .range(0, MAX_ROWS - 1);

  if (error) throw new Error(error.message || "erro");

  return data || [];

}

async function usersStats(now, warnings) {

  const iso7 = new Date(now - 7 * DAY_MS).toISOString();
  const iso30 = new Date(now - 30 * DAY_MS).toISOString();

  const [total, suspended, verified, sellers, new7, new30, byType] = await Promise.all([
    attempt(warnings, "utilizadores (total)", () => count("users")),
    attempt(warnings, "utilizadores suspensos (corre a migração B)", () =>
      count("users", (q) => q.eq("account_status", "suspended"))),
    // No site, "verificado" = plano diferente de free
    attempt(warnings, "utilizadores verificados", () =>
      count("users", (q) => q.neq("plan", "free"))),
    attempt(warnings, "vendedores (tipo de conta)", () =>
      count("users", (q) => q.in("tipo_conta", SELLER_TYPES))),
    attempt(warnings, "novos utilizadores (7 dias)", () =>
      count("users", (q) => q.gte("created_at", iso7))),
    attempt(warnings, "novos utilizadores (30 dias)", () =>
      count("users", (q) => q.gte("created_at", iso30))),
    attempt(warnings, "utilizadores por tipo de conta", async () => {
      const entries = await Promise.all(
        ACCOUNT_TYPES.map(async (type) => [type, await count("users", (q) => q.eq("tipo_conta", type))])
      );
      return Object.fromEntries(entries);
    })
  ]);

  return {
    total,
    active: total !== null && suspended !== null ? total - suspended : null,
    suspended,
    verified,
    sellers,
    by_account_type: byType,
    new_last_7_days: new7,
    new_last_30_days: new30
  };

}

async function typeStats(type, now, warnings) {

  const cfg = TYPES[type];
  const label = type === "car" ? "automóveis" : "alugueres";
  const iso7 = new Date(now - 7 * DAY_MS).toISOString();
  const iso30 = new Date(now - 30 * DAY_MS).toISOString();

  const [total, byStatus, new7, new30] = await Promise.all([
    attempt(warnings, label + " (total)", () => count(cfg.table)),
    attempt(warnings, label + " por estado", async () => {
      const entries = await Promise.all(
        cfg.statuses.map(async (status) => [status, await count(cfg.table, (q) => q.eq("status", status))])
      );
      return Object.fromEntries(entries);
    }),
    attempt(warnings, "novos " + label + " (7 dias)", () => count(cfg.table, (q) => q.gte("created_at", iso7))),
    attempt(warnings, "novos " + label + " (30 dias)", () => count(cfg.table, (q) => q.gte("created_at", iso30)))
  ]);

  return { total, by_status: byStatus, new7, new30 };

}

function sumOrNull(values) {
  return values.some((v) => v === null || v === undefined) ? null : values.reduce((a, b) => a + b, 0);
}

function listingsStats(cars, rentals) {

  const status = (name) => sumOrNull([
    cars.by_status ? (cars.by_status[name] || 0) : null,
    rentals.by_status ? (rentals.by_status[name] || 0) : null
  ]);

  const carSold = cars.by_status ? (cars.by_status.sold || 0) : null;
  const rentalRented = rentals.by_status ? (rentals.by_status.rented || 0) : null;

  return {
    total: sumOrNull([cars.total, rentals.total]),
    published: status("approved"),
    pending: status("pending"),
    approved: status("approved"),
    rejected: status("rejected"),
    suspended: status("suspended"),
    paused: status("paused"),
    closed: sumOrNull([carSold, rentalRented]),
    cars: { total: cars.total, by_status: cars.by_status },
    rentals: { total: rentals.total, by_status: rentals.by_status },
    // Ainda não existe tabela de peças no marketplace
    parts: null,
    new_last_7_days: sumOrNull([cars.new7, rentals.new7]),
    new_last_30_days: sumOrNull([cars.new30, rentals.new30])
  };

}

async function growth(days, now, warnings) {

  return attempt(warnings, "crescimento", async () => {

    const fromTimestamp = now - (days - 1) * DAY_MS;
    const labels = [];

    for (let i = days - 1; i >= 0; i--) {
      labels.push(localDay(now - i * DAY_MS));
    }

    // Pede um pouco antes para apanhar o início do primeiro dia local
    const fromIso = new Date(fromTimestamp - DAY_MS).toISOString();

    const [users, cars, rentals] = await Promise.all([
      growthRows("users", fromIso),
      growthRows("cars", fromIso),
      growthRows("rentals", fromIso)
    ]);

    const index = {};
    labels.forEach((label, i) => { index[label] = i; });

    const userSeries = labels.map(() => 0);
    const listingSeries = labels.map(() => 0);

    users.forEach((row) => {
      const i = index[localDay(Date.parse(row.created_at))];
      if (i !== undefined) userSeries[i]++;
    });

    [...cars, ...rentals].forEach((row) => {
      const i = index[localDay(Date.parse(row.created_at))];
      if (i !== undefined) listingSeries[i]++;
    });

    return {
      days,
      labels,
      users: userSeries,
      listings: listingSeries,
      truncated: [users, cars, rentals].some((rows) => rows.length >= MAX_ROWS)
    };

  });

}

async function pendingQueue(warnings) {

  return attempt(warnings, "fila de anúncios pendentes", async () => {

    const perType = await Promise.all(["car", "rental"].map(async (type) => {

      const cfg = TYPES[type];

      const { data, error } = await supabase
        .from(cfg.table)
        .select("id, user_id, brand, model, year, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5);

      if (error) throw new Error(error.message || "erro");

      return (data || []).map((row) => ({ type, row }));

    }));

    const oldest = [].concat(...perType)
      .sort((a, b) => (a.row.created_at < b.row.created_at ? -1 : a.row.created_at > b.row.created_at ? 1 : 0))
      .slice(0, 5);

    const ownerIds = Array.from(new Set(oldest.map((e) => e.row.user_id).filter(Boolean)));
    const owners = {};

    if (ownerIds.length > 0) {
      const { data, error } = await supabase.from("users").select("id, name").in("id", ownerIds);
      if (error) throw new Error(error.message || "erro");
      (data || []).forEach((u) => { owners[u.id] = u.name; });
    }

    return oldest.map(({ type, row }) => ({
      type,
      id: row.id,
      title: [row.brand, row.model, row.year].filter(Boolean).join(" "),
      created_at: row.created_at,
      owner_name: owners[row.user_id] || null
    }));

  });

}

async function recentActivity(warnings) {

  return attempt(warnings, "atividade recente", async () => {

    const { data, error } = await supabase
      .from("admin_activity_log")
      .select("id, action, admin_name, admin_role, entity_type, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message || "erro");

    // Sem emails nem IPs: só o essencial para uma linha de "atividade recente"
    return (data || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      admin_name: entry.admin_name || null,
      admin_role: entry.admin_role || null,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      title: entry.details && typeof entry.details.title === "string" ? entry.details.title : null,
      reason: entry.details && typeof entry.details.reason === "string" ? entry.details.reason : null,
      created_at: entry.created_at
    }));

  });

}

async function openReports(warnings) {
  return attempt(warnings, "denúncias abertas", () =>
    count("reports", (q) => q.eq("status", "open")));
}

function parseDays(value) {

  if (value === undefined || value === null || value === "") return 30;

  const days = Number(String(value).trim());

  if (!ALLOWED_DAYS.includes(days)) {
    throw new HttpError(400, "O parâmetro \"days\" tem de ser 7, 30 ou 90");
  }

  return days;

}

async function getDashboard(options = {}) {

  const now = options.now === undefined ? Date.now() : options.now;
  const days = parseDays(options.days);
  const canViewAudit = Boolean(options.canViewAudit);

  const key = "stats:" + days;
  const cached = cache.get(key);

  let stats;

  if (cached && now - cached.at < STATS_TTL_MS && now >= cached.at) {

    stats = cached.value;

  } else {

    const warnings = [];

    const [users, cars, rentals, growthData, queue, reportsOpen] = await Promise.all([
      usersStats(now, warnings),
      typeStats("car", now, warnings),
      typeStats("rental", now, warnings),
      growth(days, now, warnings),
      pendingQueue(warnings),
      openReports(warnings)
    ]);

    const listings = listingsStats(cars, rentals);

    // Se nem utilizadores nem anúncios responderam, a base de dados está em baixo
    if (users.total === null && listings.total === null) {
      throw new Error("a base de dados não respondeu ao dashboard");
    }

    stats = {
      users,
      listings,
      reports: { open: reportsOpen },
      growth: growthData,
      pending_queue: queue,
      warnings
    };

    cache.set(key, { at: now, value: stats });

  }

  const activityWarnings = [];
  const activity = canViewAudit ? await recentActivity(activityWarnings) : null;

  return {
    generated_at: new Date(now).toISOString(),
    ...stats,
    recent_activity: activity,
    warnings: stats.warnings.concat(activityWarnings)
  };

}

// Notificações leves para o sino da barra superior: só duas contagens,
// sem as dezenas de consultas do dashboard completo. Cada número só vem se
// o administrador tiver permissão para ver essa área (senão fica a null).
async function getNotifications(options = {}) {

  const ignored = [];

  const [pending, reports] = await Promise.all([
    options.canSeeListings
      ? attempt(ignored, "anúncios pendentes", async () => {
        const [cars, rentals] = await Promise.all([
          count(TYPES.car.table, (q) => q.eq("status", "pending")),
          count(TYPES.rental.table, (q) => q.eq("status", "pending"))
        ]);
        return cars + rentals;
      })
      : null,
    options.canSeeReports
      ? attempt(ignored, "denúncias abertas", () => count("reports", (q) => q.eq("status", "open")))
      : null
  ]);

  return { pending_listings: pending, open_reports: reports };

}

module.exports = { ACCOUNT_TYPES, SELLER_TYPES, ALLOWED_DAYS, getDashboard, getNotifications, resetDashboardCache };
