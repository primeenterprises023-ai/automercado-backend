const express = require("express");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();


// ==========================================
// PUBLICAR ALUGUER
// POST /api/rentals
// ==========================================

router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      brand,
      model,
      year,
      price_per_day,
      location,
      province,
      transmission,
      fuel,
      seats,
      description,
      image_url
    } = req.body;

    if (!brand || !model || !year || !price_per_day) {
      return res.status(400).json({
        error: "Marca, modelo, ano e preço por dia são obrigatórios"
      });
    }

    const { data, error } = await supabase
      .from("rentals")
      .insert([
        {
          user_id: req.user.id,
          brand,
          model,
          year,
          price_per_day,
          location,
          province,
          transmission,
          fuel,
          seats,
          description,
          image_url,
          status: "approved"
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
      message: "Aluguer publicado com sucesso!",
      rental: data
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// LISTAR ALUGUERES APROVADOS
// GET /api/rentals
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { data: rentals, error: rentalsError } = await supabase
      .from("rentals")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (rentalsError) {
      console.error("Erro ao buscar alugueres:", rentalsError);
      return res.status(400).json({
        error: rentalsError.message
      });
    }

    if (!rentals || rentals.length === 0) {
      return res.json({
        rentals: []
      });
    }

    const rentalIds = rentals.map(rental => rental.id);

    const { data: images, error: imagesError } = await supabase
      .from("rental_images")
      .select("*")
      .in("rental_id", rentalIds)
      .order("created_at", { ascending: true });

    if (imagesError) {
      console.error("Erro ao buscar imagens:", imagesError);

      return res.status(400).json({
        error: imagesError.message
      });
    }

    const imagesByRental = {};

    for (const image of images || []) {
      if (!imagesByRental[image.rental_id]) {
        imagesByRental[image.rental_id] = [];
      }

      imagesByRental[image.rental_id].push(image);
    }

    const ownerIds = [...new Set(rentals.map(rental => rental.user_id))];

    const { data: owners, error: ownersError } = await supabase
      .from("users")
      .select("id, name, phone, province")
      .in("id", ownerIds);

    if (ownersError) {
      console.error("Erro ao buscar proprietários:", ownersError);
    }

    const ownerById = {};

    for (const owner of owners || []) {
      ownerById[owner.id] = owner;
    }

    const rentalsWithImages = rentals.map(rental => {
      const owner = ownerById[rental.user_id];

      return {
        ...rental,
        images: imagesByRental[rental.id] || [],
        owner_name: owner ? owner.name : null,
        owner_phone: owner ? owner.phone : null,
        owner_province: owner ? owner.province : null
      };
    });

    res.json({
      rentals: rentalsWithImages
    });

  } catch (error) {
    console.error("Erro interno:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// MEUS ALUGUERES
// GET /api/rentals/my/rentals
// ==========================================

router.get("/my/rentals", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rentals")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      rentals: data
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// BUSCAR UM ALUGUER
// GET /api/rentals/:id
// ==========================================

router.get("/:id", async (req, res) => {
  try {
    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        error: "Aluguer não encontrado"
      });
    }

    const { data: images, error: imagesError } = await supabase
      .from("rental_images")
      .select("*")
      .eq("rental_id", req.params.id)
      .order("created_at", { ascending: true });

    if (imagesError) {
      console.log("ERRO AO BUSCAR IMAGENS:", imagesError);
    }

    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("name, phone, province")
      .eq("id", rental.user_id)
      .single();

    if (ownerError) {
      console.log("ERRO AO BUSCAR PROPRIETÁRIO:", ownerError);
    }

    res.json({
      rental: {
        ...rental,
        owner_name: owner ? owner.name : null,
        owner_phone: owner ? owner.phone : null,
        owner_province: owner ? owner.province : null
      },
      images: images || []
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// EDITAR ALUGUER
// PUT /api/rentals/:id
// ==========================================

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        error: "Aluguer não encontrado"
      });
    }

    if (rental.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para editar este aluguer"
      });
    }

    const {
      brand,
      model,
      year,
      price_per_day,
      location,
      province,
      transmission,
      fuel,
      seats,
      description
    } = req.body;

    const { data, error } = await supabase
      .from("rentals")
      .update({
        brand,
        model,
        year,
        price_per_day,
        location,
        province,
        transmission,
        fuel,
        seats,
        description,
        status: "pending"
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Aluguer atualizado com sucesso",
      rental: data
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// MUDAR ESTADO (pausar / reativar / alugado)
// PATCH /api/rentals/:id/status
// ==========================================

router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["paused", "approved", "rented"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "Estado inválido"
      });
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        error: "Aluguer não encontrado"
      });
    }

    if (rental.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para alterar este aluguer"
      });
    }

    const { data, error } = await supabase
      .from("rentals")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Estado atualizado com sucesso",
      rental: data
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// APAGAR ALUGUER
// DELETE /api/rentals/:id
// ==========================================

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        error: "Aluguer não encontrado"
      });
    }

    if (rental.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Não tens permissão para apagar este aluguer"
      });
    }

    const { error } = await supabase
      .from("rentals")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Aluguer apagado com sucesso"
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// UPLOAD DE FOTOS
// POST /api/rentals/:id/images
// ==========================================
router.post(
  "/:id/images",
  authMiddleware,
  upload.array("images", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "Nenhuma imagem enviada"
        });
      }

      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .select("*")
        .eq("id", req.params.id)
        .single();

      if (rentalError || !rental) {
        return res.status(404).json({
          error: "Aluguer não encontrado"
        });
      }

      if (rental.user_id !== req.user.id) {
        return res.status(403).json({
          error: "Não tens permissão"
        });
      }

      const uploadedImages = [];

      for (const file of req.files) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${req.user.id}/${req.params.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase
          .storage
          .from("Car-images")
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.log("ERRO STORAGE:", uploadError);
          continue;
        }

        const { data: publicUrlData } = supabase
          .storage
          .from("Car-images")
          .getPublicUrl(fileName);

        const imageUrl = publicUrlData.publicUrl;

        const { data: imageData, error: imageError } = await supabase
          .from("rental_images")
          .insert({
            rental_id: req.params.id,
            image_url: imageUrl
          })
          .select()
          .single();

        if (imageError) {
          console.log("ERRO RENTAL_IMAGES:", imageError);
          continue;
        }

        uploadedImages.push(imageData);
      }

      res.json({
        message: "Fotos enviadas com sucesso",
        images: uploadedImages
      });

    } catch (error) {
      console.log("ERRO GERAL UPLOAD:", error);

      res.status(500).json({
        error: "Erro ao enviar imagens"
      });
    }
  }
);

module.exports = router;
