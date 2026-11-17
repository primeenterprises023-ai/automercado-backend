const supabase = require("../config/supabase");
const {
  HttpError,
  isUuid,
  numberParam,
  parsePagination,
  cleanText,
  searchTokens,
  reasonField,
  validateListingEdit
} = require("./adminValidation");
const { logAdminAction } = require("./adminAuditService");

// ==========================================
// ANÚNCIOS NO PAINEL ADMINISTRATIVO
//
// "Anúncio" = carro (tabela cars) ou aluguer (tabela rentals). A lógica é
// a mesma para os dois; só mudam a tabela, o campo do preço e os estados.
// ==========================================

const TYPES = {
  car: {
    table: "cars",
    imagesTable: "car_images",
    imageFk: "car_id",
    priceCol: "price",
    statuses: ["pending", "approved", "paused", "sold", "rejected", "suspended"],
    listCols: "id, user_id, brand, model, year, price, status, province, location, image_url, views, contacts, created_at"
  },
  rental: {
    table: "rentals",
    imagesTable: "rental_images",
    imageFk: "rental_id",
    priceCol: "price_per_day",
    statuses: ["pending", "approved", "paused", "rented", "rejected", "suspended"],
    listCols: "id, user_id, brand, model, year, price_per_day, status, province, location, image_url, views, contacts, created_at"
  }
};

const STATUS_NAMES = {
  pending: "pendente",
  approved: "aprovado",
  paused: "pausado",
  sold: "vendido",
  rented: "alugado",
  rejected: "rejeitado",
  suspended: "suspenso"
};

// Ações de moderação: de que estados podem partir e para onde vão.
// "paused" é uma decisão do dono, por isso a moderação não o aprova.
const TRANSITIONS = {
  approve: {
    from: ["pending", "rejected"],
    to: "approved",
    reasonRequired: false,
    audit: "listing.approve",
    invalid: "Só é possível aprovar anúncios pendentes ou rejeitados"
  },
  reject: {
    from: ["pending", "approved", "paused"],
    to: "rejected",
    reasonRequired: true,
    audit: "listing.reject",
    invalid: "Só é possível rejeitar anúncios pendentes, aprovados ou pausados"
  },
  suspend: {
    from: ["pending", "approved", "paused"],
    to: "suspended",
    reasonRequired: true,
    audit: "listing.suspend",
    invalid: "Só é possível suspender anúncios pendentes, aprovados ou pausados"
  },
  reactivate: {
    from: ["suspended"],
    to: "approved",
    reasonRequired: false,
    audit: "listing.reactivate",
    invalid: "Só é possível reativar anúncios suspensos"
  }
};

const ALL_STATUSES = Array.from(new Set([].concat(TYPES.car.statuses, TYPES.rental.statuses)));

function typeConfig(type) {
  const cfg = TYPES[type];
  if (!cfg) throw new HttpError(404, "Tipo de anúncio inválido (usa car ou rental)");
  return cfg;
}

function titleOf(row) {
  return [row.brand, row.model, row.year].filter(Boolean).join(" ");
}

function fail(context, error) {
  throw new Error(context + ": " + (error && error.message ? error.message : "erro desconhecido"));
}

async function fetchRow(cfg, id, columns) {
  const { data, error } = await supabase
    .from(cfg.table)
    .select(columns)
    .eq("id", id)
    .limit(1);

  if (error) fail("ler " + cfg.table, error);

  return Array.isArray(data) && data[0] ? data[0] : null;
}

// ---------- listar ----------

function parseListFilters(query) {

  const type = query.type === undefined || query.type === "" ? "all" : query.type;

  if (type !== "all" && type !== "car" && type !== "rental") {
    throw new HttpError(400, "O parâmetro \"type\" tem de ser all, car ou rental");
  }

  const allowedStatuses = type === "all" ? ALL_STATUSES : TYPES[type].statuses;
  const status = query.status === undefined || query.status === "" ? null : query.status;

  if (status !== null && !allowedStatuses.includes(status)) {
    throw new HttpError(400, "Estado inválido. Valores possíveis: " + allowedStatuses.join(", "));
  }

  const minPrice = numberParam(query.min_price, "min_price");
  const maxPrice = numberParam(query.max_price, "max_price");

  if (type === "all" && (minPrice !== undefined || maxPrice !== undefined)) {
    throw new HttpError(400, "Os filtros de preço só funcionam com type=car ou type=rental");
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, "min_price não pode ser maior do que max_price");
  }

  const ownerId = query.owner_id === undefined || query.owner_id === "" ? null : query.owner_id;

  if (ownerId !== null && !isUuid(ownerId)) {
    throw new HttpError(400, "owner_id inválido");
  }

  const sort = query.sort === undefined || query.sort === "" ? "created_at" : query.sort;
  const sortable = type === "all" ? ["created_at", "views", "contacts"] : ["created_at", "views", "contacts", "price"];

  if (!sortable.includes(sort)) {
    throw new HttpError(400, "Ordenação inválida. Valores possíveis: " + sortable.join(", "));
  }

  const dir = query.dir === undefined || query.dir === "" ? "desc" : query.dir;

  if (dir !== "asc" && dir !== "desc") {
    throw new HttpError(400, "O parâmetro \"dir\" tem de ser asc ou desc");
  }

  return {
    type,
    status,
    province: cleanText(query.province),
    brand: cleanText(query.brand),
    model: cleanText(query.model),
    location: cleanText(query.location),
    minPrice,
    maxPrice,
    ownerId,
    sort,
    dir,
    tokens: searchTokens(query.q),
    ...parsePagination(query)
  };

}

// Ids de donos cujo nome/telefone (e email, só quem pode ver utilizadores)
// contém a palavra pesquisada.
async function ownerIdsMatching(token, canSearchEmails) {

  const columns = canSearchEmails ? ["name", "email", "phone"] : ["name", "phone"];

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .or(columns.map((c) => c + ".ilike.*" + token + "*").join(","))
    .limit(200);

  if (error) fail("pesquisar donos", error);

  return (data || []).map((u) => u.id);

}

async function queryType(type, filters, tokenOwners, from, to) {

  const cfg = TYPES[type];

  // Um estado que este tipo não tem (ex.: "sold" nos alugueres) = 0 resultados
  if (filters.status && !cfg.statuses.includes(filters.status)) {
    return { rows: [], count: 0 };
  }

  let q = supabase.from(cfg.table).select(cfg.listCols, { count: "exact" });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.province) q = q.eq("province", filters.province);
  if (filters.brand) q = q.ilike("brand", "%" + filters.brand + "%");
  if (filters.model) q = q.ilike("model", "%" + filters.model + "%");
  if (filters.location) q = q.ilike("location", "%" + filters.location + "%");
  if (filters.ownerId) q = q.eq("user_id", filters.ownerId);
  if (filters.minPrice !== undefined) q = q.gte(cfg.priceCol, filters.minPrice);
  if (filters.maxPrice !== undefined) q = q.lte(cfg.priceCol, filters.maxPrice);

  // Cada palavra tem de bater na marca, no modelo, no ano, no id ou no dono
  filters.tokens.forEach((token, index) => {
    const parts = ["brand.ilike.*" + token + "*", "model.ilike.*" + token + "*"];

    if (/^\d{4}$/.test(token)) parts.push("year.eq." + token);
    if (isUuid(token)) parts.push("id.eq." + token, "user_id.eq." + token);
    if (tokenOwners[index].length > 0) parts.push("user_id.in.(" + tokenOwners[index].join(",") + ")");

    q = q.or(parts.join(","));
  });

  const sortColumn = filters.sort === "price" ? cfg.priceCol : filters.sort;

  q = q
    .order(sortColumn, { ascending: filters.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  const { data, error, count } = await q;

  if (error) fail("listar " + cfg.table, error);

  return { rows: data || [], count: count || 0 };

}

async function ownersById(rows) {

  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("users")
    .select("id, name, phone, plan, account_status")
    .in("id", ids);

  if (error) fail("ler donos", error);

  const map = {};
  (data || []).forEach((u) => { map[u.id] = u; });
  return map;

}

function toListItem(type, row, owners) {

  const cfg = TYPES[type];
  const owner = owners[row.user_id];

  return {
    type,
    id: row.id,
    title: titleOf(row),
    price: row[cfg.priceCol],
    price_unit: type === "rental" ? "day" : "total",
    status: row.status,
    province: row.province || null,
    location: row.location || null,
    image_url: row.image_url || null,
    views: row.views || 0,
    contacts: row.contacts || 0,
    created_at: row.created_at,
    owner: owner
      ? { id: owner.id, name: owner.name, phone: owner.phone || null, plan: owner.plan || null, account_status: owner.account_status || null }
      : { id: row.user_id }
  };

}

async function listListings(query, context) {

  const filters = parseListFilters(query || {});
  const canSearchEmails = Boolean(context && context.canSearchEmails);

  const tokenOwners = await Promise.all(
    filters.tokens.map((token) => ownerIdsMatching(token, canSearchEmails))
  );

  const types = filters.type === "all" ? ["car", "rental"] : [filters.type];
  const offset = (filters.page - 1) * filters.pageSize;

  // Com "all" busca-se, em cada tabela, tudo até ao fim desta página, junta-se,
  // ordena-se e corta-se. Com um só tipo, a base de dados já pagina.
  const from = filters.type === "all" ? 0 : offset;
  const to = filters.page * filters.pageSize - 1;

  const results = await Promise.all(types.map((t) => queryType(t, filters, tokenOwners, from, to)));

  let entries = [];
  results.forEach((result, i) => result.rows.forEach((row) => entries.push({ type: types[i], row })));

  if (filters.type === "all") {
    const key = filters.sort;
    const sign = filters.dir === "asc" ? 1 : -1;

    entries.sort((a, b) => {
      const x = a.row[key] === null || a.row[key] === undefined ? 0 : a.row[key];
      const y = b.row[key] === null || b.row[key] === undefined ? 0 : b.row[key];
      if (x < y) return -1 * sign;
      if (x > y) return 1 * sign;
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      return a.row.id < b.row.id ? -1 : 1;
    });

    entries = entries.slice(offset, offset + filters.pageSize);
  }

  const owners = await ownersById(entries.map((e) => e.row));
  const total = results.reduce((sum, r) => sum + r.count, 0);

  return {
    items: entries.map((e) => toListItem(e.type, e.row, owners)),
    page: filters.page,
    page_size: filters.pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / filters.pageSize))
  };

}

// ---------- detalhe ----------

async function getListing(type, id) {

  const cfg = typeConfig(type);
  const row = await fetchRow(cfg, id, "*");

  if (!row) throw new HttpError(404, "Anúncio não encontrado");

  const [ownerResult, imagesResult, historyResult, reportsResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, phone, province, plan, account_status, created_at")
      .eq("id", row.user_id)
      .limit(1),
    supabase
      .from(cfg.imagesTable)
      .select("id, image_url, created_at")
      .eq(cfg.imageFk, id)
      .order("created_at", { ascending: true }),
    supabase
      .from("admin_activity_log")
      .select("action, admin_name, admin_role, details, created_at")
      .eq("entity_type", type)
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_type", type)
      .eq("target_id", id)
      .eq("status", "open")
  ]);

  if (ownerResult.error) fail("ler dono", ownerResult.error);
  if (imagesResult.error) fail("ler fotografias", imagesResult.error);
  if (historyResult.error) fail("ler histórico", historyResult.error);

  return {
    listing: { type, ...row },
    owner: Array.isArray(ownerResult.data) && ownerResult.data[0] ? ownerResult.data[0] : null,
    images: imagesResult.data || [],
    // Só o essencial: sem emails nem IPs dos administradores
    history: (historyResult.data || []).map((h) => ({
      action: h.action,
      admin_name: h.admin_name || null,
      admin_role: h.admin_role || null,
      created_at: h.created_at,
      reason: h.details && typeof h.details.reason === "string" ? h.details.reason : null
    })),
    // Se a tabela das denúncias ainda não existir, conta como zero
    reports_open: reportsResult.error ? 0 : (reportsResult.count || 0)
  };

}

// ---------- aprovar, rejeitar, suspender, reativar ----------

async function transitionListing({ type, id, action, body, req }) {

  const cfg = typeConfig(type);
  const rule = TRANSITIONS[action];

  const reason = reasonField((body || {}).reason, { required: rule.reasonRequired });
  const row = await fetchRow(cfg, id, "id, user_id, status, brand, model, year");

  if (!row) throw new HttpError(404, "Anúncio não encontrado");

  if (!rule.from.includes(row.status)) {
    throw new HttpError(
      409,
      rule.invalid + " (este está " + (STATUS_NAMES[row.status] || row.status) + ")"
    );
  }

  // Só altera se o estado ainda for o que lemos: protege de dois
  // administradores a mexer ao mesmo tempo no mesmo anúncio.
  const { data, error } = await supabase
    .from(cfg.table)
    .update({ status: rule.to })
    .eq("id", id)
    .eq("status", row.status)
    .select("id, status");

  if (error) fail("atualizar " + cfg.table, error);

  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(409, "O estado do anúncio mudou entretanto. Atualiza a página e tenta de novo.");
  }

  const logged = await logAdminAction(req, {
    action: rule.audit,
    entityType: type,
    entityId: id,
    details: {
      before: row.status,
      after: rule.to,
      reason,
      title: titleOf(row),
      owner_id: row.user_id
    }
  });

  return {
    listing: { type, id, status: rule.to, previous_status: row.status },
    audit_logged: logged
  };

}

// ---------- editar ----------

function sameValue(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  if (typeof b === "number") return Number(a) === b;
  return a === b;
}

async function editListing({ type, id, body, req }) {

  const cfg = typeConfig(type);
  const values = validateListingEdit(type, body);
  const row = await fetchRow(cfg, id, "*");

  if (!row) throw new HttpError(404, "Anúncio não encontrado");

  const changes = {};
  const update = {};

  Object.keys(values).forEach((key) => {
    if (!sameValue(row[key], values[key])) {
      changes[key] = { from: row[key] === undefined ? null : row[key], to: values[key] };
      update[key] = values[key];
    }
  });

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, "Nenhuma alteração: os valores enviados já são os atuais");
  }

  const { data, error } = await supabase
    .from(cfg.table)
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) fail("atualizar " + cfg.table, error);

  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, "Anúncio não encontrado");
  }

  const logged = await logAdminAction(req, {
    action: "listing.edit",
    entityType: type,
    entityId: id,
    details: { title: titleOf({ ...row, ...update }), owner_id: row.user_id, changes }
  });

  return {
    listing: { type, id },
    changed_fields: Object.keys(update),
    audit_logged: logged
  };

}

// ---------- apagar ----------

async function deleteListing({ type, id, body, req }) {

  const cfg = typeConfig(type);
  const input = body || {};

  // Confirmação exigida pelo servidor: quem apaga tem de repetir o id
  if (input.confirm !== id) {
    throw new HttpError(400, "Confirmação em falta: envia {\"confirm\": \"<id do anúncio>\"}");
  }

  const reason = reasonField(input.reason, { required: false });
  const row = await fetchRow(cfg, id, "*");

  if (!row) throw new HttpError(404, "Anúncio não encontrado");

  const { data: images, error: imagesError } = await supabase
    .from(cfg.imagesTable)
    .select("image_url")
    .eq(cfg.imageFk, id);

  if (imagesError) fail("ler fotografias", imagesError);

  // O registo vem ANTES de apagar: se não ficar registado, nada é apagado.
  const logged = await logAdminAction(req, {
    action: "listing.delete",
    entityType: type,
    entityId: id,
    details: {
      reason,
      owner_id: row.user_id,
      snapshot: {
        title: titleOf(row),
        price: row[cfg.priceCol],
        status: row.status,
        province: row.province || null,
        location: row.location || null,
        created_at: row.created_at
      },
      image_urls: (images || []).slice(0, 20).map((i) => i.image_url)
    }
  });

  if (!logged) {
    throw new HttpError(500, "Não foi possível registar a ação no histórico, por isso nada foi apagado");
  }

  const { error } = await supabase.from(cfg.table).delete().eq("id", id);

  if (error) {
    await logAdminAction(req, {
      action: "listing.delete_failed",
      entityType: type,
      entityId: id,
      details: { reason: "erro da base de dados" }
    });
    fail("apagar " + cfg.table, error);
  }

  return { deleted: true, type, id };

}

module.exports = {
  TYPES,
  TRANSITIONS,
  listListings,
  getListing,
  transitionListing,
  editListing,
  deleteListing
};
