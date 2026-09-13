const express = require("express");
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// Status possíveis para um carro. "pending" não é usado automaticamente —
// os carros são aprovados imediatamente ao publicar (ver POST abaixo).
const ALLOWED_STATUSES = ["approved", "paused", "sold"];

// Validação partilhada entre POST (criar) e PUT (editar), para não duplicar
// as mesmas regras nas duas rotas.
function validateCarPayload({ brand, model, year, price, mileage }) {
  if (!brand || !model || !year || !price) {
    return "Marca, modelo, ano e preço são obrigatórios";
  }

  const numericYear = Number(year);
  const numericPrice = Number(price);
  const numericMileage =
    mileage === undefined || mileage === null || mileage === ""
      ? 0
      : Number(mileage);

  const currentYear = new Date().getFullYear();

  if (!Number.isFinite(numericYear) || numericYear < 1900 || numericYear > currentYear + 1) {
    return "Ano inválido";
  }

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "Preço tem de ser um valor positivo";
  }

  if (!Number.isFinite(numericMileage) || numericMileage < 0) {
    return "Quilometragem inválida";
  }

  return null;
}


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

    const validationError = validateCarPayload({ brand, model, year, price, mileage });

    if (validationError) {
      return res.status(400).json({
        error: validationError
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

    const validationError = validateCarPayload({ brand, model, year, price, mileage });

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    // IMPORTANTE: não incluir "status" aqui. O AutoMercado tem aprovação
    // imediata — um carro aprovado deve continuar aprovado depois de
    // editado, e não voltar a "pending" automaticamente.
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

    // Apagar primeiro as imagens (Storage + tabela car_images), para não
    // deixar ficheiros nem registos órfãos depois de apagar o carro.
    const { data: images, error: imagesError } = await supabase
      .from("car_images")
      .select("*")
      .eq("car_id", req.params.id);

    if (imagesError) {
      console.log("ERRO AO BUSCAR IMAGENS PARA APAGAR:", imagesError);
    }

    if (images && images.length > 0) {
      const bucketMarker = "/Car-images/";

      const storagePaths = images
        .map((image) => {
          const url = image.image_url || "";
          const index = url.indexOf(bucketMarker);
          return index === -1 ? null : url.slice(index + bucketMarker.length);
        })
        .filter(Boolean);

      if (storagePaths.length > 0) {
        const { error: removeError } = await supabase
          .storage
          .from("Car-images")
          .remove(storagePaths);

        if (removeError) {
          // Não bloqueia o apagar do carro — evita sobretudo deixar
          // registos car_images órfãos, que é o pior dos dois casos.
          console.log("ERRO AO APAGAR FICHEIROS DO STORAGE:", removeError);
        }
      }

      const { error: deleteImagesError } = await supabase
        .from("car_images")
        .delete()
        .eq("car_id", req.params.id);

      if (deleteImagesError) {
        console.log("ERRO AO APAGAR REGISTOS car_images:", deleteImagesError);
      }
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
// ALTERAR STATUS (pausar / reativar / marcar vendido)
// PATCH /api/cars/:id/status
// ==========================================

router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {

    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Usa um destes: ${ALLOWED_STATUSES.join(", ")}`
      });
    }

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
        error: "Não tens permissão para alterar este carro"
      });
    }

    const { data, error } = await supabase
      .from("cars")
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
      message: "Status atualizado com sucesso",
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
