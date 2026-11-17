const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("./src/middleware/authMiddleware");
const adminMiddleware = require("./src/middleware/adminMiddleware");
const { adminApiLimiter } = require("./src/middleware/adminRateLimiters");
const { buildAdminCorsOptions } = require("./src/config/adminCors");

const authRoutes = require("./src/routes/authRoutes");
const carRoutes = require("./src/routes/carRoutes");
const productRoutes = require("./src/routes/productRoutes");
const rentalRoutes = require("./src/routes/rentalRoutes");
const adminAuthRoutes = require("./src/routes/adminAuthRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const app = express();


// ================================
// PROXY DA RENDER
// ================================

// Atrás da Render há 1 proxy. Sem isto, o limite de pedidos e o histórico
// de atividades veem o IP do proxy (igual para toda a gente) em vez do IP
// real de cada utilizador.
app.set("trust proxy", 1);

function isAdminPath(req) {
  return req.path === "/api/admin" || req.path.startsWith("/api/admin/");
}


// ================================
// MIDDLEWARES
// ================================

// CORS do site público: igual ao que já tinhas.
const publicCors = cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

// CORS do painel administrativo: só as origens de ADMIN_ORIGINS.
const adminCors = cors(buildAdminCorsOptions(process.env.ADMIN_ORIGINS));

app.use((req, res, next) => {
  if (isAdminPath(req)) {
    return adminCors(req, res, next);
  }

  return publicCors(req, res, next);
});

app.use(express.json());

app.use(helmet());


// ================================
// RATE LIMIT
// ================================

// Limite geral do site. As rotas /api/admin têm limites próprios
// (ver src/middleware/adminRateLimiters.js).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: isAdminPath,
  message: {
    error: "Muitas requisições. Tenta novamente mais tarde."
  }
});

app.use(limiter);


// ================================
// FICHEIROS PÚBLICOS
// ================================

app.use(express.static("public"));


// ================================
// ROTAS DA API
// ================================

app.use("/api/auth", authRoutes);

app.use("/api/cars", carRoutes);

app.use("/api/products", productRoutes);

app.use("/api/rentals", rentalRoutes);


// ================================
// PAINEL ADMINISTRATIVO
// ================================

// Login (público, com limite próprio de tentativas falhadas)
app.use("/api/admin/auth", adminApiLimiter, adminAuthRoutes);

// Tudo o resto exige token de administrador válido e uma função ativa
// confirmada na base de dados (ver adminMiddleware).
app.use("/api/admin", adminApiLimiter, authMiddleware, adminMiddleware, adminRoutes);


// ================================
// TESTE DO SERVIDOR
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "online"
  });
});


// ================================
// ERROS NÃO TRATADOS
// ================================

// Respondem sempre em JSON (por exemplo, quando o corpo do pedido não é
// JSON válido), em vez de uma página HTML de erro.
app.use((err, req, res, next) => {

  if (res.headersSent) {
    return next(err);
  }

  const status = err && (err.status || err.statusCode);

  if (status === 413) {
    return res.status(413).json({ error: "Pedido demasiado grande" });
  }

  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: "Pedido inválido" });
  }

  console.error("ERRO NÃO TRATADO:", err && err.message);

  res.status(500).json({ error: "Erro interno do servidor" });

});


// ================================
// INICIAR SERVIDOR
// ================================

if (!process.env.ADMIN_ORIGINS) {
  console.warn(
    "AVISO: ADMIN_ORIGINS não está definido — o painel administrativo " +
    "não conseguirá chamar a API a partir do browser."
  );
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
