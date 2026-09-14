// ============================================
// LOGIN 2FA GATE - StudySync
// Coordina el reto OTP post-password sin
// dejar entrar a MainStack prematuramente.
// ============================================

/** @type {string | null} */
let pending2faUid = null;
/** @type {Promise<void> | null} */
let signInGate = null;
/** @type {(() => void) | null} */
let resolveSignInGate = null;

export const beginSignInGate = () => {
  if (!signInGate) {
    signInGate = new Promise((resolve) => {
      resolveSignInGate = resolve;
    });
  }
};

export const endSignInGate = () => {
  if (resolveSignInGate) resolveSignInGate();
  resolveSignInGate = null;
  signInGate = null;
};

export const waitForSignInGate = async () => {
  if (signInGate) {
    try {
      await signInGate;
    } catch {
      /* noop */
    }
  }
};

export const markPending2fa = (uid) => {
  pending2faUid = uid || null;
};

export const clearPending2faMark = () => {
  pending2faUid = null;
};

export const getPending2faUid = () => pending2faUid;

export const isPending2faFor = (uid) =>
  !!(uid && pending2faUid && pending2faUid === uid);
