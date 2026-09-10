const carRoutes = require("./src/routes/carRoutes");const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");

const app = express();

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
