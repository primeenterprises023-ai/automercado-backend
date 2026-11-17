// ==========================================
// VALIDAÇÃO E AJUDANTES DA API ADMINISTRATIVA
//
// Tudo o que chega do painel é validado aqui antes de tocar na base de
// dados: nada é aceite só porque o painel o enviou.
// ==========================================

// Erro com código HTTP e mensagem para o painel mostrar. As rotas
// transformam-no em resposta; qualquer outro erro vira um 500 genérico.
class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

// Inteiro vindo da query string (?page=2). Vazio = valor por omissão.
function intParam(value, name, { min, max, def }) {

  if (value === undefined || value === null || value === "") {
    return def;
  }

  const text = String(value).trim();

  if (!/^-?\d+$/.test(text)) {
    throw new HttpError(400, "O parâmetro \"" + name + "\" tem de ser um número inteiro");
  }

  const number = Number(text);

  if (number < min || number > max) {
    throw new HttpError(400, "O parâmetro \"" + name + "\" tem de estar entre " + min + " e " + max);
  }

  return number;

}

// Número (pode ter casas decimais) vindo da query string. Vazio = undefined.
function numberParam(value, name) {

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const text = String(value).trim().replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new HttpError(400, "O parâmetro \"" + name + "\" tem de ser um número");
  }

  return Number(text);

}

function parsePagination(query) {
  return {
    page: intParam(query.page, "page", { min: 1, max: 100000, def: 1 }),
    pageSize: intParam(query.page_size, "page_size", { min: 1, max: 100, def: 20 })
  };
}

// Texto de um filtro (marca, localização...): sem caracteres que tenham
// significado especial nos filtros da base de dados.
function cleanText(value, maxLength = 60) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[%_\\*,()"'`;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

// Pesquisa livre: até 4 palavras, só letras, números e @ . _ + -
function searchTokens(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}@._+-]/gu, "").slice(0, 40))
    .filter(Boolean)
    .slice(0, 4);
}

// Motivo de uma ação (rejeitar, suspender...)
function reasonField(value, { required }) {

  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new HttpError(400, "Indica o motivo (pelo menos 3 caracteres)");
    }
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "O motivo tem de ser texto");
  }

  const text = value.trim();

  if (required && text.length < 3) {
    throw new HttpError(400, "Indica o motivo (pelo menos 3 caracteres)");
  }

  if (text.length > 500) {
    throw new HttpError(400, "O motivo pode ter no máximo 500 caracteres");
  }

  return text || null;

}

// ---------- campos editáveis de um anúncio ----------

const str = (max, required = false) => ({ kind: "string", max, required });
const int = (min, max, required = false) => ({ kind: "int", min, max, required });
const num = (min, max, required = false) => ({ kind: "number", min, max, required });

function editableFields() {

  const nextYear = new Date().getFullYear() + 1;

  return {
    car: {
      brand: str(60, true),
      model: str(80, true),
      year: int(1950, nextYear, true),
      price: num(0, 1e12, true),
      mileage: int(0, 5000000),
      location: str(120),
      province: str(60),
      description: str(5000),
      fuel: str(40),
      transmission: str(40),
      engine_size: num(0, 20),
      body_type: str(40),
      color: str(40),
      doors: int(1, 9),
      usage_type: str(40),
      condition: str(40),
      equipment: { kind: "stringArray", max: 60, items: 60 }
    },
    rental: {
      brand: str(60, true),
      model: str(80, true),
      year: int(1950, nextYear, true),
      price_per_day: num(0, 1e9, true),
      location: str(120),
      province: str(60),
      transmission: str(40),
      fuel: str(40),
      seats: int(1, 60),
      description: str(5000)
    }
  };

}

// Valida os campos enviados para editar um anúncio. Só aceita campos da
// lista (nunca status, dono, contadores...). Devolve os valores limpos.
function validateListingEdit(type, body) {

  const specs = editableFields()[type];
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : null;

  if (!input || Object.keys(input).length === 0) {
    throw new HttpError(400, "Indica pelo menos um campo para alterar");
  }

  const values = {};
  const errors = {};

  Object.keys(input).forEach((key) => {

    const spec = Object.prototype.hasOwnProperty.call(specs, key) ? specs[key] : null;
    const raw = input[key];

    if (!spec) {
      errors[key] = "Este campo não pode ser alterado aqui";
      return;
    }

    if (raw === null || raw === "") {
      if (spec.required) {
        errors[key] = "Obrigatório";
      } else {
        values[key] = null;
      }
      return;
    }

    if (spec.kind === "string") {
      if (typeof raw !== "string") { errors[key] = "Tem de ser texto"; return; }
      const text = raw.trim();
      if (!text) {
        if (spec.required) errors[key] = "Obrigatório"; else values[key] = null;
        return;
      }
      if (text.length > spec.max) { errors[key] = "No máximo " + spec.max + " caracteres"; return; }
      values[key] = text;
      return;
    }

    if (spec.kind === "int" || spec.kind === "number") {
      const number = typeof raw === "number" ? raw : (typeof raw === "string" && raw.trim() !== "" ? Number(raw.trim().replace(",", ".")) : NaN);
      if (!Number.isFinite(number)) { errors[key] = "Tem de ser um número"; return; }
      if (spec.kind === "int" && !Number.isInteger(number)) { errors[key] = "Tem de ser um número inteiro"; return; }
      if (number < spec.min || number > spec.max) { errors[key] = "Tem de estar entre " + spec.min + " e " + spec.max; return; }
      values[key] = number;
      return;
    }

    if (spec.kind === "stringArray") {
      if (!Array.isArray(raw)) { errors[key] = "Tem de ser uma lista"; return; }
      if (raw.length > spec.max) { errors[key] = "No máximo " + spec.max + " itens"; return; }
      const items = [];
      for (const item of raw) {
        if (typeof item !== "string" || !item.trim() || item.trim().length > spec.items) {
          errors[key] = "Cada item tem de ser texto com 1 a " + spec.items + " caracteres";
          return;
        }
        items.push(item.trim());
      }
      values[key] = items;
    }

  });

  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, "Dados inválidos", errors);
  }

  return values;

}

module.exports = {
  HttpError,
  isUuid,
  intParam,
  numberParam,
  parsePagination,
  cleanText,
  searchTokens,
  reasonField,
  editableFields,
  validateListingEdit
};
