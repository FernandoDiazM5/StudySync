const path = require("path");

// Carga .env en el proceso de Node que evalúa la config (expo start / EAS build).
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

/** Expo inyecta aquí el contenido fusionado de app.json (y otros). */
module.exports = ({ config }) => ({
  ...config,
  // Brevo: solo EXPO_PUBLIC_* en .env o EAS (no en app.json — secret scanning de GitHub).
  extra: {
    ...config.extra,
    brevoApiKey: process.env.EXPO_PUBLIC_BREVO_API_KEY || "",
    brevoSenderEmail: process.env.EXPO_PUBLIC_BREVO_SENDER_EMAIL || "",
    brevoSenderName:
      process.env.EXPO_PUBLIC_BREVO_SENDER_NAME || "StudySync",
  },
});
