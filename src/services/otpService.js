// ============================================
// OTP SERVICE - StudySync
// Genera, almacena y verifica códigos OTP.
// Usos: registro de cuenta + 2FA al iniciar sesión.
// Proveedor de email: Brevo (ex-Sendinblue)
// ============================================

import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { getBrevoCredentials } from "../config/brevo";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS = 3;
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const PURPOSE_COPY = {
  register: {
    subtitle: "Verificación de cuenta",
    body: "Usa el siguiente código para completar tu registro en StudySync. Es válido por <strong>5 minutos</strong>.",
    subject: "Tu código de verificación - StudySync",
    codeLabel: "Tu código",
  },
  login: {
    subtitle: "Inicio de sesión seguro",
    body: "Detectamos un inicio de sesión en tu cuenta. Usa el siguiente código para confirmar que eres tú. Es válido por <strong>5 minutos</strong>.",
    subject: "Tu código de acceso - StudySync",
    codeLabel: "Código de acceso",
  },
};

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const isBrevoConfigured = () => {
  const { apiKey, email } = getBrevoCredentials();
  return !!(apiKey && email);
};

const otpDocId = (email, purpose = "register") =>
  `${String(email).toLowerCase()}__${purpose}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildEmailHtml = (otp, userName, purpose = "register") => {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.register;
  const safeName = escapeHtml(userName);
  const logoUrl = process.env.EXPO_PUBLIC_APP_LOGO_URL || "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5 0%,#312E81 100%);padding:32px;text-align:center;">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" alt="StudySync" width="72" height="72"
                   style="border-radius:16px;margin:0 auto 12px;display:block;" />`
                  : ""
              }
              <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;
                        letter-spacing:-0.5px;">StudySync</p>
              <p style="margin:6px 0 0;font-size:13px;color:#C7D2FE;">
                ${copy.subtitle}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1F2937;">
                Hola, <strong>${safeName}</strong>
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#6B7280;line-height:1.6;">
                ${copy.body}
              </p>
              <!-- OTP box -->
              <div style="background:#EEF2FF;border:2px dashed #A5B4FC;
                          border-radius:12px;padding:24px;text-align:center;
                          margin-bottom:28px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;
                           color:#4F46E5;letter-spacing:2px;text-transform:uppercase;">
                  ${copy.codeLabel}
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;
                           color:#312E81;letter-spacing:10px;">
                  ${otp}
                </p>
              </div>
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                Si no solicitaste este código, ignora este correo y considera cambiar tu contraseña.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 32px;text-align:center;
                       border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                © ${new Date().getFullYear()} StudySync · Este es un correo automático
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * @param {string} email
 * @param {string} [userName]
 * @param {{ purpose?: 'register'|'login' }} [options]
 */
export const sendOtp = async (email, userName = "", options = {}) => {
  try {
    const purpose = options.purpose === "login" ? "login" : "register";
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    const name = userName || email.split("@")[0];
    const copy = PURPOSE_COPY[purpose];

    await setDoc(doc(db, "otpVerifications", otpDocId(email, purpose)), {
      otp,
      expiresAt,
      attempts: 0,
      purpose,
      createdAt: new Date().toISOString(),
    });

    if (!isBrevoConfigured()) {
      if (__DEV__) {
        console.warn(
          `\n[OTP DEV MODE] Brevo no configurado.\nCódigo ${purpose} para ${email}: ${otp}\n`,
        );
        return { success: true, devMode: true };
      }
      return {
        success: false,
        error:
          "El servicio de correo no está configurado. Contacta al administrador.",
      };
    }

    const { apiKey, email: brevoSenderEmail, name: brevoSenderName } =
      getBrevoCredentials();
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: brevoSenderName,
          email: brevoSenderEmail,
        },
        to: [{ email, name }],
        subject: copy.subject,
        htmlContent: buildEmailHtml(otp, name, purpose),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo error ${res.status}: ${body}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[OTP] sendOtp error:", error);
    return {
      success: false,
      error: "No se pudo enviar el correo. Intenta de nuevo.",
    };
  }
};

/**
 * @param {string} email
 * @param {string} code
 * @param {{ purpose?: 'register'|'login' }} [options]
 */
export const verifyOtp = async (email, code, options = {}) => {
  try {
    const purpose = options.purpose === "login" ? "login" : "register";
    const docRef = doc(db, "otpVerifications", otpDocId(email, purpose));
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        success: false,
        expired: true,
        error: "Código no encontrado. Solicita uno nuevo.",
      };
    }

    const data = snap.data();

    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(docRef);
      return {
        success: false,
        expired: true,
        error: "El código ha expirado. Solicita uno nuevo.",
      };
    }

    if (data.attempts >= MAX_ATTEMPTS) {
      await deleteDoc(docRef);
      return {
        success: false,
        expired: true,
        error: "Demasiados intentos fallidos. Solicita un nuevo código.",
      };
    }

    if (data.otp !== String(code).trim()) {
      const newAttempts = data.attempts + 1;
      await setDoc(docRef, { ...data, attempts: newAttempts });
      const remaining = MAX_ATTEMPTS - newAttempts;
      return {
        success: false,
        expired: remaining <= 0,
        error:
          remaining > 0
            ? `Código incorrecto. ${remaining} intento${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}.`
            : "Código incorrecto. No quedan más intentos.",
      };
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error("[OTP] verifyOtp error:", error);
    return {
      success: false,
      expired: false,
      error: "Error al verificar el código.",
    };
  }
};

export const clearOtp = async (email, options = {}) => {
  try {
    const purpose = options.purpose === "login" ? "login" : "register";
    await deleteDoc(doc(db, "otpVerifications", otpDocId(email, purpose)));
  } catch {
    /* noop */
  }
};
