const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ========================
// REGISTO
// ========================

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Preencha todos os campos"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password: hashedPassword
        }
      ])
      .select();

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(201).json({
      message: "Utilizador criado com sucesso!",
      user: {
        id: data[0].id,
        name: data[0].name,
        email: data[0].email,
        plan: data[0].plan || "free"
      }
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ========================
// LOGIN
// ========================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email e password são obrigatórios"
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: "Email ou password incorretos"
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Email ou password incorretos"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      message: "Login realizado com sucesso!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan || "free"
      }
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ========================
// UTILIZADOR AUTENTICADO
// ========================

router.get("/me", authMiddleware, async (req, res) => {
  try {

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, plan, created_at")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: "Utilizador não encontrado"
      });
    }

    res.json({
      user
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ========================
// ATUALIZAR PERFIL
// ========================

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "O nome é obrigatório"
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ name })
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Perfil atualizado com sucesso!",
      user: data
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});

module.exports = router;
