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

    // Número de contacto do vendedor: vem da conta dele (tabela users,
    // preenchida no registo) — não é um campo do carro.
    const sellerIds = [...new Set(cars.map(car => car.user_id))];

    const { data: sellers, error: sellersError } = await supabase
      .from("users")
      .select("id, phone")
      .in("id", sellerIds);

    if (sellersError) {
      console.error("Erro ao buscar contacto dos vendedores:", sellersError);

      return res.status(400).json({
        error: sellersError.message
      });
    }

    const phoneBySeller = {};

    for (const seller of sellers || []) {
      phoneBySeller[seller.id] = seller.phone;
    }

    const carsWithImages = cars.map(car => ({
      ...car,
      images: imagesByCar[car.id] || [],
      seller_phone: phoneBySeller[car.user_id] || ""
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

    // Mesmo número usado nos anúncios públicos: vem da conta do próprio
    // vendedor autenticado.
    const { data: sellerData } = await supabase
      .from("users")
      .select("phone")
      .eq("id", req.user.id)
      .single();

    const cars = (data || []).map(car => ({
      ...car,
      seller_phone: (sellerData && sellerData.phone) || ""
    }));

    res.json({
      cars
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

    // Número de contacto do vendedor, vindo da conta dele (tabela users).
    const { data: sellerData, error: sellerError } = await supabase
      .from("users")
      .select("phone")
      .eq("id", car.user_id)
      .single();

    if (sellerError) {
      console.log("ERRO AO BUSCAR CONTACTO DO VENDEDOR:", sellerError);
    }

    res.json({
      car: { ...car, seller_phone: (sellerData && sellerData.phone) || "" },
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

      console.log("========== UPLOAD ==========");
      console.log("CAR ID:", req.params.id);
      console.log("USER ID:", req.user.id);
      console.log("FILES:", req.files?.length);

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "Nenhuma imagem enviada"
        });
      }

      // Procurar carro
      const { data: car, error: carError } = await supabase
        .from("cars")
        .select("*")
        .eq("id", req.params.id)
        .single();

      if (carError || !car) {
        console.log("CAR ERROR:", carError);

        return res.status(404).json({
          error: "Carro não encontrado"
        });
      }

      // Verificar proprietário
      if (car.user_id !== req.user.id) {
        return res.status(403).json({
          error: "Não tens permissão"
        });
      }

      const uploadedImages = [];

      // Enviar cada imagem
      for (const file of req.files) {

        console.log("ENVIANDO:", file.originalname);

        const safeName = file.originalname
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const fileName =
          `${req.user.id}/${req.params.id}/${Date.now()}-${safeName}`;

        // Upload para Storage
        const { data: uploadData, error: uploadError } =
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

          console.log(
            "ERRO STORAGE:",
            uploadError
          );

          continue;
        }

        console.log(
          "UPLOAD OK:",
          uploadData
        );

        // URL pública
        const { data: publicUrlData } =
          supabase
            .storage
            .from("Car-images")
            .getPublicUrl(fileName);

        const imageUrl =
          publicUrlData.publicUrl;

        console.log(
          "IMAGE URL:",
          imageUrl
        );

        // Guardar imagem no banco
        const { data: imageData, error: imageError } =
          await supabase
            .from("car_images")
            .insert({
              car_id: req.params.id,
              image_url: imageUrl
            })
            .select()
            .single();

        if (imageError) {

          console.log(
            "ERRO CAR_IMAGES:",
            imageError
          );

          continue;
        }

        console.log(
          "BANCO OK:",
          imageData
        );

        uploadedImages.push(imageData);
      }

      console.log(
        "TOTAL UPLOAD:",
        uploadedImages.length
      );

      res.json({
        message: "Fotos enviadas com sucesso",
        images: uploadedImages
      });

    } catch (error) {

      console.log(
        "ERRO GERAL UPLOAD:",
        error
      );

      res.status(500).json({
        error: "Erro ao enviar imagens"
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
