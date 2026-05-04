// ============================================
// AUTH SERVICE - StudySync
// Manejo de autenticación con Firebase Auth
// ============================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { invalidateUserCache } from './firestoreService';

/**
 * Combina el documento Firestore `users` con Auth (displayName, email, photo)
 * para que nunca falte nombre/email en UI si el doc está vacío o no existe.
 */
export const mergeUserProfileFromAuth = (firebaseUser, firestoreData) => {
  const d =
    firestoreData && typeof firestoreData === 'object' ? { ...firestoreData } : {};
  const authEmail = firebaseUser?.email || '';
  const authName =
    (firebaseUser?.displayName && String(firebaseUser.displayName).trim()) || '';
  const fromEmail =
    authEmail && authEmail.includes('@')
      ? authEmail.split('@')[0].trim()
      : '';
  const firestoreName =
    typeof d.name === 'string' && d.name.trim() ? d.name.trim() : '';
  return {
    ...d,
    id: firebaseUser.uid,
    email: (typeof d.email === 'string' && d.email.trim()) || authEmail,
    name: firestoreName || authName || fromEmail || 'Usuario',
    phone: d.phone ?? '',
    role: d.role ?? 'Miembro',
    plan: d.plan || 'free',
    planBilling: d.planBilling || 'monthly',
    photoURL: d.photoURL || firebaseUser.photoURL || null,
  };
};

async function ensureUserProfileDocument(uid, merged) {
  try {
    invalidateUserCache(uid);
    await setDoc(
      doc(db, 'users', uid),
      {
        id: uid,
        email: merged.email || '',
        name: merged.name || '',
        phone: merged.phone ?? '',
        role: merged.role || 'Miembro',
        plan: merged.plan || 'free',
        planBilling: merged.planBilling || 'monthly',
        ...(merged.photoURL ? { photoURL: merged.photoURL } : {}),
        createdAt: merged.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[ensureUserProfileDocument]', e?.message);
  }
}

/**
 * Registrar un nuevo usuario
 * Crea cuenta en Auth + documento en colección 'users'
 */
export const registerUser = async (email, password, name, phone) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Guardar datos extra en Firestore
    await setDoc(doc(db, 'users', user.uid), {
      id: user.uid,
      name: name,
      email: email,
      phone: phone || '',
      role: 'Miembro',
      fcmToken: '',
      createdAt: new Date().toISOString()
    });

    return { success: true, user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

/**
 * Iniciar sesión
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

/**
 * Cerrar sesión
 */
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Cambiar contraseña
 */
export const updatePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: 'No hay sesión activa.' };
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, newPassword);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

/**
 * Enviar correo de recuperación de contraseña
 */
export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

/**
 * Obtener datos del perfil desde Firestore y unirlos con Auth.
 * @param {string} uid
 * @param {object | null} authUser — usuario de Firebase Auth; si se pasa, siempre hay `data` usable y se crea el doc si no existía.
 */
export const getUserProfile = async (uid, authUser = null) => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    const exists = docSnap.exists();
    const raw = exists ? docSnap.data() : null;

    if (authUser && authUser.uid === uid) {
      const merged = mergeUserProfileFromAuth(authUser, raw);
      if (!exists) {
        ensureUserProfileDocument(uid, merged).catch(() => {});
      }
      return { success: true, data: merged };
    }

    if (raw) return { success: true, data: raw };
    return { success: false, error: 'Usuario no encontrado' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Escuchar cambios de autenticación
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Traducir códigos de error de Firebase a español
 */
const getErrorMessage = (code) => {
  const messages = {
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/invalid-credential': 'Credenciales inválidas. Verifica tu correo y contraseña.',
  };
  return messages[code] || 'Ha ocurrido un error. Intenta de nuevo.';
};
