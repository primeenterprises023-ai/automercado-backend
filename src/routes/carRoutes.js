const express = require("express");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// PUBLICAR CARRO
router.post("/", authMiddleware, async (req, res) => {
  try {

    const {
      brand,
      model,
      year,
      price,
      mileage,
      location,
      description,
      image_url
    } = req.body;

    if (!brand || !model || !year || !price) {
      return res.status(400).json({
        error: "Marca, modelo, ano e preço são obrigatórios"
      });
    }

    const { data, error } = await supabase
      .from("cars")
      .insert([
        {
          user_id: req.user.id,
          brand,
          model,
          year,
          price,
          mileage,
          location,
          description,
          image_url
        }
      ])
      .select()
      .single();

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.status(201).json({
      message: "Carro publicado com sucesso!",
      car: data
    });

  } catch (error) {

    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// LISTAR TODOS OS CARROS
router.get("/", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("cars")
      .select("*");

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      cars: data
    });

  } catch (error) {

    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// BUSCAR UM CARRO
router.get("/:id", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: "Carro não encontrado"
      });
    }

    res.json({
      car: data
    });

  } catch (error) {

    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// MEUS CARROS
router.get("/my/cars", authMiddleware, async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("user_id", req.user.id);

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      cars: data
    });

  } catch (error) {

    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


module.exports = router;
