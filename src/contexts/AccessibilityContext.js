import React, { createContext, useState, useContext, useMemo } from 'react';
import * as Speech from 'expo-speech';

// Mapeo de idiomas soportados por expo-speech
// Nota: Quechua no es soportado, usa español como fallback
const SPEECH_LANGUAGE_MAP = {
  'es': 'es',
  'en': 'en',
  'qu': 'es', // Quechua fallback a español
};

// DICCIONARIO BÁSICO INCORPORADO
const translations = {
  es: {
    language: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    quechua: 'Quechua',
    profile: 'Perfil',
    textSize: 'Tamaño de texto',
    contrasts: 'Contrastes',
    dyslexiaFriendly: 'Dislexia amigable',
    lineSpacing: 'Interlineado',
    narrator: 'Narrador',
    reset: 'Restablecer',
    accessibilityMenu: 'Menú de accesibilidad',
    // Global App Strings
    logoutSecure: 'Cerrar Sesión Segura',
    personalInfo: 'Editar información personal',
    changePassword: 'Cambiar contraseña',
    pushNotifications: 'Notificaciones push',
    themeApp: 'Tema de la aplicación',
    accountSettings: 'AJUSTES DE CUENTA',
    editProfile: 'Editar Perfil',
    login: 'Iniciar Sesión',
    register: 'Registrarse',
    email: 'Correo Electrónico',
    password: 'Contraseña'
  },
  en: {
    language: 'Language',
    spanish: 'Spanish',
    english: 'English',
    quechua: 'Quechuan',
    profile: 'Profile',
    textSize: 'Text Size',
    contrasts: 'Contrasts',
    dyslexiaFriendly: 'Dyslexia Friendly',
    lineSpacing: 'Line Spacing',
    narrator: 'Narrator',
    reset: 'Reset',
    accessibilityMenu: 'Accessibility Menu',
    // Global App Strings
    logoutSecure: 'Secure Logout',
    personalInfo: 'Edit personal information',
    changePassword: 'Change password',
    pushNotifications: 'Push notifications',
    themeApp: 'App Theme',
    accountSettings: 'ACCOUNT SETTINGS',
    editProfile: 'Edit Profile',
    login: 'Login',
    register: 'Register',
    email: 'Email Address',
    password: 'Password'
  },
  qu: {
    language: 'Simi',
    spanish: 'Kastilla simi',
    english: 'Inles simi',
    quechua: 'Qhichwa simi',
    profile: 'Kawsay qillqa',
    textSize: 'Qillqa hatun',
    contrasts: 'Llimphi',
    dyslexiaFriendly: 'Dislexia alli',
    lineSpacing: 'Sutha',
    narrator: 'Rimariq',
    reset: 'Kutichiy',
    accessibilityMenu: 'Yaykuy llikamanta',
    // Global App Strings
    logoutSecure: 'Lluqsiy Segura',
    personalInfo: 'Sutiykita allichay',
    changePassword: 'Contraseña musuqyachiy',
    pushNotifications: 'Willakuykuna',
    themeApp: 'Llimphi churasqa',
    accountSettings: 'KAWSAY QILLQA ALLICHAY',
    editProfile: 'Kawsay qillqa allichay',
    login: 'Yaykuy',
    register: 'Qillqakuy',
    email: 'Correo Electrónico',
    password: 'Contraseña'
  }
};

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
  // Estados de Configuración
  const [language, setLanguage] = useState('es'); // 'es', 'en', 'qu'
  const [textLevel, setTextLevel] = useState(0); // 0: Normal, 1: Grande, 2: Muy Grande
  const [contrastActive, setContrastActive] = useState(false);
  const [dyslexiaFontActive, setDyslexiaFontActive] = useState(false);
  const [spacingLevel, setSpacingLevel] = useState(0); // 0: Normal, 1: Medio, 2: Amplio
  const [speechEnabled, setSpeechEnabled] = useState(false);
  
  // Modal de accesibilidad visibilidad
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Intérprete multiidioma con fallback a español
  const t = (key) => {
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }
    if (translations['es'] && translations['es'][key]) {
      return translations['es'][key];
    }
    return key;
  };

  // Calculados a inyectar globalmente
  const textScaleMultiplier = useMemo(() => {
    if (textLevel === 1) return 1.15;
    if (textLevel === 2) return 1.3;
    return 1.0;
  }, [textLevel]);

  const lineHeightMultiplier = useMemo(() => {
    if (spacingLevel === 1) return 1.4;
    if (spacingLevel === 2) return 1.8;
    return 1.2; // Base
  }, [spacingLevel]);

  // OpenDyslexic or fallback to system default
  const globalFontFamily = dyslexiaFontActive ? 'OpenDyslexic' : undefined;
  const globalLetterSpacing = dyslexiaFontActive ? 1.5 : 0;

  // Speech Helper with error handling
  const speakText = (text) => {
    if (!speechEnabled || !text) return;
    try {
      Speech.stop().catch(() => {});
      const lang = SPEECH_LANGUAGE_MAP[language] || 'es';
      Speech.speak(text.toString(), { language: lang }).catch((err) => {
        console.warn('Speech error:', err);
      });
    } catch (error) {
      console.error('Speech initialization failed:', error);
    }
  };

  // Reset all accessibility settings
  const resetAccessibility = () => {
    setLanguage('es');
    setTextLevel(0);
    setContrastActive(false);
    setDyslexiaFontActive(false);
    setSpacingLevel(0);
    setSpeechEnabled(false);
    try {
      Speech.stop().catch(() => {});
    } catch (error) {
      console.warn('Error stopping speech during reset:', error);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        language, setLanguage, t,
        textLevel, setTextLevel,
        contrastActive, setContrastActive,
        dyslexiaFontActive, setDyslexiaFontActive,
        spacingLevel, setSpacingLevel,
        speechEnabled, setSpeechEnabled,
        isMenuOpen, setIsMenuOpen,
        resetAccessibility,
        speakText,
        
        // Propiedades calculadas
        textScaleMultiplier,
        lineHeightMultiplier,
        globalFontFamily,
        globalLetterSpacing,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
