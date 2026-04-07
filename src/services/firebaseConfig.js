// ============================================
// FIREBASE CONFIGURATION - StudySync
// ============================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuración extraída de google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyBQY9pq40o37Uzi07_OMB1nXLLfxSBmdyM",
  authDomain: "studysync-e43e3.firebaseapp.com",
  projectId: "studysync-e43e3",
  storageBucket: "studysync-e43e3.firebasestorage.app",
  messagingSenderId: "596028728819",
  appId: "1:596028728819:android:7b5ab440fed794fe665e86"
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
