// ============================================
// OTP SERVICE - StudySync
// Genera, almacena y verifica códigos OTP para
// la verificación de correo en el registro.
//
// PROVEEDOR DE EMAIL: Brevo (ex-Sendinblue)
//   - Gratis: 300 emails / día
//   - Sin verificación de dominio
//   - Envía a cualquier correo
//
// SETUP (2 minutos):
//  1. Crea cuenta en https://brevo.com
//  2. Settings → API Keys → "Generate a new API key"
//  3. Agrega al .env del proyecto:
//       EXPO_PUBLIC_BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxx
//       EXPO_PUBLIC_BREVO_SENDER_EMAIL=tucorreo@gmail.com
//     (el sender debe ser el correo con que te registraste en Brevo)
//  4. Reinicia Metro: npx expo start --clear
// ============================================

import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } from '../config/brevo';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS  = 3;
const BREVO_URL     = 'https://api.brevo.com/v3/smtp/email';

// ── Genera un código numérico de 6 dígitos ──────────────────
const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// ── Detectar si Brevo está configurado ───────────────────────
const isBrevoConfigured = () =>
  !!(BREVO_API_KEY &&
     BREVO_SENDER_EMAIL &&
     BREVO_API_KEY    !== 'PEGA_TU_API_KEY_AQUI' &&
     BREVO_SENDER_EMAIL !== 'PEGA_TU_CORREO_AQUI');

// ── HTML del email ───────────────────────────────────────────
const buildEmailHtml = (otp, userName) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#4F46E5;padding:32px;text-align:center;">
              ${(process.env.EXPO_PUBLIC_APP_LOGO_URL || '') ? `
              <img src="${process.env.EXPO_PUBLIC_APP_LOGO_URL}"
                   alt="StudySync"
                   width="72" height="72"
                   style="border-radius:16px;margin-bottom:12px;
                          display:block;margin-left:auto;margin-right:auto;" />
              ` : ''}
              <p style="margin:0;font-size:28px;font-weight:800;color:#fff;
                        letter-spacing:-0.5px;">StudySync</p>
              <p style="margin:6px 0 0;font-size:13px;color:#C7D2FE;">
                Verificación de cuenta
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1F2937;">
                Hola, <strong>${userName}</strong> 👋
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#6B7280;line-height:1.6;">
                Usa el siguiente código para completar tu registro en StudySync.
                Es válido por <strong>5 minutos</strong>.
              </p>
              <!-- OTP box -->
              <div style="background:#EEF2FF;border:2px dashed #A5B4FC;
                          border-radius:12px;padding:24px;text-align:center;
                          margin-bottom:28px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;
                           color:#4F46E5;letter-spacing:2px;text-transform:uppercase;">
                  Tu código
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;
                           color:#312E81;letter-spacing:10px;">
                  ${otp}
                </p>
              </div>
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Si no solicitaste este código, ignora este correo.
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

// ── Enviar OTP al correo del usuario ────────────────────────
export const sendOtp = async (email, userName = '') => {
  try {
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    const name      = userName || email.split('@')[0];

    // Guardar en Firestore (doc ID = email normalizado)
    await setDoc(doc(db, 'otpVerifications', email.toLowerCase()), {
      otp,
      expiresAt,
      attempts : 0,
      createdAt: new Date().toISOString(),
    });

    // ── Modo desarrollo: sin Brevo configurado ────────────────
    if (!isBrevoConfigured()) {
      if (__DEV__) {
        console.warn(
          '\n[OTP DEV MODE] Brevo no está configurado.\n' +
          `Código para ${email}: ${otp}\n` +
          'Configura EXPO_PUBLIC_BREVO_API_KEY y EXPO_PUBLIC_BREVO_SENDER_EMAIL en .env\n'
        );
        return { success: true, devMode: true };
      }
      return {
        success: false,
        error  : 'El servicio de correo no está configurado. Contacta al administrador.',
      };
    }

    // ── Llamar a Brevo API ────────────────────────────────────
    const res = await fetch(BREVO_URL, {
      method : 'POST',
      headers: {
        'Accept'      : 'application/json',
        'Content-Type': 'application/json',
        'api-key'     : BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name : BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to     : [{ email, name }],
        subject: 'Tu código de verificación - StudySync',
        htmlContent: buildEmailHtml(otp, name),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo error ${res.status}: ${body}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[OTP] sendOtp error:', error);
    return { success: false, error: 'No se pudo enviar el correo. Intenta de nuevo.' };
  }
};

// ── Verificar el código ingresado ────────────────────────────
export const verifyOtp = async (email, code) => {
  try {
    const docRef = doc(db, 'otpVerifications', email.toLowerCase());
    const snap   = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        success: false,
        expired: true,
        error  : 'Código no encontrado. Solicita uno nuevo.',
      };
    }

    const data = snap.data();

    // Verificar expiración
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(docRef);
      return {
        success: false,
        expired: true,
        error  : 'El código ha expirado. Solicita uno nuevo.',
      };
    }

    // Verificar intentos
    if (data.attempts >= MAX_ATTEMPTS) {
      await deleteDoc(docRef);
      return {
        success: false,
        expired: true,
        error  : 'Demasiados intentos fallidos. Solicita un nuevo código.',
      };
    }

    // Verificar código
    if (data.otp !== code.trim()) {
      const newAttempts = data.attempts + 1;
      await setDoc(docRef, { ...data, attempts: newAttempts });
      const remaining = MAX_ATTEMPTS - newAttempts;
      return {
        success: false,
        expired: remaining <= 0,
        error  : remaining > 0
          ? `Código incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`
          : 'Código incorrecto. No quedan más intentos.',
      };
    }

    // ¡Válido! Eliminar el doc
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('[OTP] verifyOtp error:', error);
    return { success: false, expired: false, error: 'Error al verificar el código.' };
  }
};

// ── Eliminar OTP manualmente (p. ej. al cancelar) ────────────
export const clearOtp = async (email) => {
  try {
    await deleteDoc(doc(db, 'otpVerifications', email.toLowerCase()));
  } catch (_) {}
};
