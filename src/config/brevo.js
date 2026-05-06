// ============================================
// BREVO CONFIG - StudySync
//
// Orden: primero process.env.EXPO_PUBLIC_* (valor inlined / Metro en build y dev).
// Después Constants.expoConfig.extra (app.config.js). Si fuera al revés, un
// extra antiguo en el manifiesto nativo pisa la clave buena del .env → 401.
//
// Usa getBrevoCredentials() al enviar el correo, no constantes de módulo cacheadas.
// ============================================

import Constants from "expo-constants";

function normalizeEnvString(v) {
  if (v == null) return "";
  let s = String(v).replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith(";")) s = s.slice(0, -1).trim();
  return s;
}

function fromExtra(key) {
  const candidates = [
    Constants.expoConfig?.extra?.[key],
    Constants.manifest?.extra?.[key],
    Constants.manifest2?.extra?.[key],
  ];
  for (const ex of candidates) {
    const n = normalizeEnvString(ex);
    if (n) return n;
  }
  return "";
}

/**
 * Credenciales actuales (llamar al momento de usar, no cachear al importar).
 * Nombres literales EXPO_PUBLIC_* para que Babel/Expo los inyecten bien.
 */
export function getBrevoCredentials() {
  const apiKey =
    normalizeEnvString(process.env.EXPO_PUBLIC_BREVO_API_KEY) ||
    fromExtra("brevoApiKey");
  const email =
    normalizeEnvString(process.env.EXPO_PUBLIC_BREVO_SENDER_EMAIL) ||
    fromExtra("brevoSenderEmail");
  const name =
    normalizeEnvString(process.env.EXPO_PUBLIC_BREVO_SENDER_NAME) ||
    fromExtra("brevoSenderName") ||
    "StudySync";
  return { apiKey, email, name };
}
