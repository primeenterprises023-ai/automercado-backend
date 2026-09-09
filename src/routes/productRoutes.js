const express = require("express");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ========================
// CRIAR PRODUTO
// ========================

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        error: "Nome e preço são obrigatórios"
      });
    }

    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          name,
          description,
          price,
          user_id: req.user.id
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(201).json({
      message: "Produto criado com sucesso!",
      product: data
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ========================
// LISTAR PRODUTOS
// ========================

router.get("/", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      products: data
    });

  } catch (error) {

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// ========================
// VER UM PRODUTO
// ========================

router.get("/:id", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: "Produto não encontrado"
      });
    }

    res.json({
      product: data
    });

  } catch (error) {

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// ========================
// ATUALIZAR PRODUTO
// ========================

router.put("/:id", authMiddleware, async (req, res) => {
  try {

    const { name, description, price } = req.body;

    const { data: product, error: findError } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (findError || !product) {
      return res.status(404).json({
        error: "Produto não encontrado"
      });
    }

    if (product.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para editar este produto"
      });
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        name,
        description,
        price
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
      message: "Produto atualizado com sucesso!",
      product: data
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});


// ========================
// APAGAR PRODUTO
// ========================

router.delete("/:id", authMiddleware, async (req, res) => {
  try {

    const { data: product, error: findError } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (findError || !product) {
      return res.status(404).json({
        error: "Produto não encontrado"
      });
    }

    if (product.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para apagar este produto"
      });
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Produto apagado com sucesso!"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });

  }
});

module.exports = router;
