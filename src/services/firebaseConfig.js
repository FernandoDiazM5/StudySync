// ============================================
// FIREBASE CONFIGURATION - StudySync
// ============================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuración desde variables de entorno (.env) con fallback
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBQY9pq40o37Uzi07_OMB1nXLLfxSBmdyM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "studysync-e43e3.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "studysync-e43e3",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "studysync-e43e3.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "596028728819",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:596028728819:android:7b5ab440fed794fe665e86",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Auth - Simplificado para evitar crash de React Native Persistence en nuevas v de Firebase
const auth = getAuth(app);

// Firestore - Simplificado para evitar crash 
const db = getFirestore(app);

// Storage
const storage = getStorage(app);

export { app, auth, db, storage };
