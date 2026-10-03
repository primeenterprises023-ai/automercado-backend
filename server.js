const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./src/routes/authRoutes");
const carRoutes = require("./src/routes/carRoutes");
const productRoutes = require("./src/routes/productRoutes");

const app = express();


// ================================
// MIDDLEWARES
// ================================

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use(helmet());


// ================================
// RATE LIMIT
// ================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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


// ================================
// TESTE DO SERVIDOR
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "online"
  });
});


// ================================
// INICIAR SERVIDOR
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
