require("dotenv").config();

console.log("INICIANDO TESTE...");

const supabase = require("./src/config/supabase");

async function testar() {
  console.log("CONECTANDO AO SUPABASE...");

  const { data, error } =
    await supabase.storage.listBuckets();

  console.log("ERRO:");
  console.log(error);

  console.log("BUCKETS:");
  console.log(data);
}

testar()
  .then(() => {
    console.log("TESTE TERMINADO");
  })
  .catch((erro) => {
    console.error("ERRO GERAL:");
    console.error(erro);
  });
