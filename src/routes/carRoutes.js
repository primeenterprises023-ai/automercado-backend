const express = require("express");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();


// ==========================================
// PUBLICAR CARRO
// POST /api/cars
// ==========================================

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


// ==========================================
// LISTAR CARROS APROVADOS
// GET /api/cars
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { data: cars, error: carsError } = await supabase
      .from("cars")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (carsError) {
      console.error("Erro ao buscar carros:", carsError);
      return res.status(400).json({
        error: carsError.message
      });
    }

    if (!cars || cars.length === 0) {
      return res.json({
        cars: []
      });
    }

    const carIds = cars.map(car => car.id);

    const { data: images, error: imagesError } = await supabase
      .from("car_images")
      .select("*")
      .in("car_id", carIds)
      .order("created_at", { ascending: true });

    if (imagesError) {
      console.error("Erro ao buscar imagens:", imagesError);

      return res.status(400).json({
        error: imagesError.message
      });
    }

    const imagesByCar = {};

    for (const image of images || []) {
      if (!imagesByCar[image.car_id]) {
        imagesByCar[image.car_id] = [];
      }

      imagesByCar[image.car_id].push(image);
    }

    const carsWithImages = cars.map(car => ({
      ...car,
      images: imagesByCar[car.id] || []
    }));

    res.json({
      cars: carsWithImages
    });

  } catch (error) {
    console.error("Erro interno:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// MEUS CARROS
// GET /api/cars/my/cars
// ==========================================

router.get("/my/cars", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", {
        ascending: false
      });

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


// ==========================================
// BUSCAR UM CARRO
// GET /api/cars/:id
// ==========================================

router.get("/:id", async (req, res) => {
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

    const { data: images, error: imagesError } = await supabase
      .from("car_images")
      .select("*")
      .eq("car_id", req.params.id)
      .order("created_at", {
        ascending: true
      });

    if (imagesError) {
      console.log("ERRO AO BUSCAR IMAGENS:", imagesError);
    }

    res.json({
      car,
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
// EDITAR CARRO
// PUT /api/cars/:id
// ==========================================

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
      message: "Carro atualizado com sucesso",
      car: data
    });

  } catch (error) {
    console.log("ERRO INTERNO:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});


// ==========================================
// APAGAR CARRO
// DELETE /api/cars/:id
// ==========================================

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
      console.log("ERRO SUPABASE:", error);

      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: "Carro apagado com sucesso"
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
// POST /api/cars/:id/images
// ==========================================

router.post(
  "/:id/images",
  authMiddleware,
  upload.array("images", 10),
  async (req, res) => {
    try {

      console.log("=== INÍCIO UPLOAD ===");
      console.log("CAR ID:", req.params.id);
      console.log("FILES:", req.files?.length);

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "Nenhuma imagem chegou ao servidor"
        });
      }

      const { data: car, error: carError } = await supabase
        .from("cars")
        .select("*")
        .eq("id", req.params.id)
        .single();

      if (carError || !car) {
        console.log("ERRO CARRO:", carError);

        return res.status(404).json({
          error: "Carro não encontrado"
        });
      }

      if (car.user_id !== req.user.id) {
        return res.status(403).json({
          error: "Sem permissão"
        });
      }

      const uploadedImages = [];

      for (const file of req.files) {

        console.log("ENVIANDO FOTO:", {
          nome: file.originalname,
          tipo: file.mimetype,
          tamanho: file.size
        });

        const fileName =
          `${req.user.id}/${req.params.id}/${Date.now()}-${file.originalname}`;

        const { data: storageData, error: uploadError } =
          await supabase
            .storage
            .from("Car-images")
            .upload(
              fileName,
              file.buffer,
              {
                contentType: file.mimetype,
                upsert: false
              }
            );

        if (uploadError) {

          console.error(
            "ERRO SUPABASE STORAGE COMPLETO:",
            uploadError
          );

          return res.status(400).json({
            error: uploadError.message,
            details: uploadError
          });
        }

        console.log(
          "STORAGE OK:",
          storageData
        );

        const { data: publicUrlData } =
          supabase
            .storage
            .from("Car-images")
            .getPublicUrl(fileName);

        const imageUrl =
          publicUrlData.publicUrl;

        console.log(
          "URL DA FOTO:",
          imageUrl
        );

        const { data: imageData, error: imageError } =
          await supabase
         .from("Car-images")
            .insert([
              {
                car_id: req.params.id,
                image_url: imageUrl
              }
            ])
            .select()
            .single();

        if (imageError) {

          console.error(
            "ERRO CAR_IMAGES:",
            imageError
          );

          return res.status(400).json({
            error: imageError.message,
            details: imageError
          });
        }

        uploadedImages.push(imageData);
      }

      console.log("=== UPLOAD CONCLUÍDO ===");

      return res.json({
        message: "Fotos enviadas com sucesso",
        images: uploadedImages
      });

    } catch (error) {

      console.error(
        "ERRO CRÍTICO UPLOAD:",
        error
      );

      return res.status(500).json({
        error: error.message || "Erro ao enviar imagens"
      });
    }
  }
);

// ==========================================
// EXPORTAR ROTAS
// ==========================================
router.get("/test/upload", (req, res) => {
  res.json({
    message: "Rota de upload está funcionando"
  });
});
module.exports = router;
