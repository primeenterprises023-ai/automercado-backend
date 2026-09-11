const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


app.use(express.json());
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const carRoutes = require("./src/routes/carRoutes");

const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Muitas requisições. Tenta novamente mais tarde."
  }
});

app.use(limiter);
app.use(cors());
app.use(express.json());

// Abrir os ficheiros HTML da pasta public
app.use(express.static("public"));

// Rotas da API
app.use("/api/auth", authRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/products", productRoutes);

// Teste do servidor
app.get("/health", (req, res) => {
  res.json({
    status: "online"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
