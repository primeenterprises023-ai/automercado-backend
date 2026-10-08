const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendPasswordResetEmail } = require("./mailer");

const TOKEN_TTL_MS = 60 * 60 * 1000;

module.exports = function (supabaseAdmin) {
  const router = express.Router();

  router.post("/forgot-password", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          error: "Email é obrigatório."
        });
      }

      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, email, name")
        .eq("email", email)
        .maybeSingle();

      if (userError || !user) {
        return res.json({
          message:
            "Se esse email tiver conta, vais receber um link para definires uma nova palavra-passe."
        });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      const expiresAt = new Date(
        Date.now() + TOKEN_TTL_MS
      ).toISOString();

      await supabaseAdmin
        .from("password_reset_tokens")
        .update({
          used_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .is("used_at", null);

      const { error: insertError } = await supabaseAdmin
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt
        });

      if (insertError) {
        console.error("Erro ao criar token:", insertError);

        return res.status(500).json({
          error: "Não foi possível criar o link."
        });
      }

      const frontendUrl =
        process.env.FRONTEND_URL ||
        "https://automercado-site-2.vercel.app";

      const resetLink =
        `${frontendUrl}/redefinir-password.html?token=${encodeURIComponent(rawToken)}`;

      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink
      });

      return res.json({
        message:
          "Se esse email tiver conta, vais receber um link para definires uma nova palavra-passe."
      });
    } catch (error) {
      console.error("Erro forgot-password:", error);

      return res.status(500).json({
        error: "Erro interno."
      });
    }
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const token = String(req.body.token || "").trim();
      const newPassword = String(req.body.newPassword || "");

      if (!token || !newPassword) {
        return res.status(400).json({
          error: "Pedido inválido."
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: "A palavra-passe deve ter pelo menos 6 caracteres."
        });
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const { data: tokenRow, error: tokenError } =
        await supabaseAdmin
          .from("password_reset_tokens")
          .select("id, user_id, expires_at, used_at")
          .eq("token_hash", tokenHash)
          .maybeSingle();

      if (tokenError) {
        console.error("Erro ao procurar token:", tokenError);

        return res.status(500).json({
          error: "Erro ao validar o link."
        });
      }

      if (!tokenRow) {
        return res.status(400).json({
          error: "Link inválido ou expirado. Pede um novo."
        });
      }

      if (tokenRow.used_at) {
        return res.status(400).json({
          error: "Este link já foi utilizado. Pede um novo."
        });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return res.status(400).json({
          error: "Link expirado. Pede um novo."
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          password: passwordHash
        })
        .eq("id", tokenRow.user_id);

      if (updateError) {
        console.error("Erro ao atualizar password:", updateError);

        return res.status(500).json({
          error: "Não foi possível atualizar a palavra-passe."
        });
      }

      await supabaseAdmin
        .from("password_reset_tokens")
        .update({
          used_at: new Date().toISOString()
        })
        .eq("id", tokenRow.id);

      return res.json({
        message: "Palavra-passe atualizada com sucesso."
      });
    } catch (error) {
      console.error("Erro reset-password:", error);

      return res.status(500).json({
        error: "Erro interno."
      });
    }
  });

  return router;
};
