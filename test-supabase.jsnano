require("dotenv").config();

const supabase = require("./src/config/supabase");

async function testar() {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  if (error) {
    console.log("❌ Erro:", error.message);
  } else {
    console.log("✅ Ligação ao Supabase funcionando!");
    console.log(data);
  }
}

testar();
