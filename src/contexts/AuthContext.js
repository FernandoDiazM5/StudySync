// ============================================
// AUTH CONTEXT - StudySync
// Provee usuario actual y funciones de auth a toda la app
// Reemplaza el estado currentUser del componente principal
// ============================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthChange, getUserProfile } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);          // Firebase Auth user
  const [userProfile, setUserProfile] = useState(null); // Firestore user data
  const [loading, setLoading] = useState(true);     // Loading state inicial

  useEffect(() => {
    // Escuchar cambios de autenticación
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Obtener datos extra del perfil desde Firestore
        const result = await getUserProfile(firebaseUser.uid);
        if (result.success) {
          setUserProfile(result.data);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Actualizar el perfil local después de editar
   */
  const refreshProfile = async () => {
    if (user) {
      const result = await getUserProfile(user.uid);
      if (result.success) {
        setUserProfile(result.data);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,           // Firebase Auth user (uid, email, etc.)
      userProfile,    // Firestore profile data (name, phone, role, etc.)
      loading,        // true mientras se verifica la sesión
      refreshProfile  // función para refrescar datos del perfil
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de autenticación
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
