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
      image_url,
      status: "pending"
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
  .select("*")
  .eq("status", "approved");
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

// EDITAR CARRO
router.put("/:id", authMiddleware, async (req, res) => {

  try {

    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (carError || !car) {
      return res.status(404).json({
        error: "Carro não encontrado"
      });
    }

    if (car.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para editar este carro"
      });
    }

    const {
      brand,
      model,
      year,
      price,
      mileage,
      location,
      description
    } = req.body;

    const { data, error } = await supabase
      .from("cars")
      .update({
        brand,
        model,
        year,
        price,
        mileage,
        location,
        description
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Carro atualizado com sucesso",
      car: data
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }

});
// APAGAR CARRO
router.delete("/:id", authMiddleware, async (req, res) => {

  try {

    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (carError || !car) {
      return res.status(404).json({
        error: "Carro não encontrado"
      });
    }

    if (car.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para apagar este carro"
      });
    }

    const { error } = await supabase
      .from("cars")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Carro apagado com sucesso"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }

});
module.exports = router;
