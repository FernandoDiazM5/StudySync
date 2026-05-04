import React, { createContext, useState, useContext, useMemo, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from '../locales/translations';

// Mapeo de idiomas soportados por expo-speech
// Nota: Quechua no es soportado, usa español como fallback
const SPEECH_LANGUAGE_MAP = {
  'es': 'es',
  'en': 'en',
  'qu': 'es', // Quechua fallback a español
};

const STORAGE_KEY = '@studysync_accessibility';

const translations = TRANSLATIONS;

const AccessibilityContext = createContext(null);

// Contexto separado y liviano SOLO para el estado open/close del sidebar.
// Al mantenerlo aparte, abrir el menú NO re-renderiza AppText / AppButton
// ni ningún otro consumidor del contexto principal, eliminando el lag de 300-500 ms
// en dispositivos lentos.
const MenuOpenContext = createContext({ isMenuOpen: false, setIsMenuOpen: () => {} });

export const AccessibilityProvider = ({ children }) => {
  // Estados de Configuración
  const [language, setLanguage] = useState('es');
  const [textLevel, setTextLevel] = useState(0);
  const [contrastActive, setContrastActive] = useState(false);
  const [dyslexiaFontActive, setDyslexiaFontActive] = useState(false);
  const [spacingLevel, setSpacingLevel] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar configuración guardada al inicializar
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const config = JSON.parse(saved);
          if (config.language) setLanguage(config.language);
          if (typeof config.textLevel === 'number') setTextLevel(config.textLevel);
          if (typeof config.contrastActive === 'boolean') setContrastActive(config.contrastActive);
          if (typeof config.dyslexiaFontActive === 'boolean') setDyslexiaFontActive(config.dyslexiaFontActive);
          if (typeof config.spacingLevel === 'number') setSpacingLevel(config.spacingLevel);
          if (typeof config.speechEnabled === 'boolean') setSpeechEnabled(config.speechEnabled);
        }
      } catch (error) {
        console.warn('Error loading accessibility config:', error);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persistir configuración cuando cambie
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const config = {
          language,
          textLevel,
          contrastActive,
          dyslexiaFontActive,
          spacingLevel,
          speechEnabled,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (error) {
        console.warn('Error saving accessibility config:', error);
      }
    })();
  }, [language, textLevel, contrastActive, dyslexiaFontActive, spacingLevel, speechEnabled, isLoaded]);

  // Intérprete multiidioma con fallback a español.
  // Opcional: segundo argumento { n: 3 } reemplaza {{n}} en la cadena.
  const t = useCallback((key, vars) => {
    const raw =
      translations[language]?.[key] ??
      translations.es?.[key] ??
      key;
    if (vars != null && typeof vars === 'object') {
      return Object.keys(vars).reduce(
        (acc, k) => acc.split(`{{${k}}}`).join(String(vars[k])),
        String(raw),
      );
    }
    return raw;
  }, [language]);

  // Calculados a inyectar globalmente
  const textScaleMultiplier = useMemo(() => {
    if (textLevel === 1) return 1.15;
    if (textLevel === 2) return 1.3;
    return 1.0;
  }, [textLevel]);

  const lineHeightMultiplier = useMemo(() => {
    if (spacingLevel === 1) return 1.4;
    if (spacingLevel === 2) return 1.8;
    return 1.2;
  }, [spacingLevel]);

  // Fuente amigable para dislexia por plataforma (sin dependencias externas)
  // iOS: Verdana - ampliamente legible
  // Android: sans-serif (default más legible que monospace)
  // Web: 'Comic Sans MS, Verdana, sans-serif' - conocidas por mejor legibilidad
  const globalFontFamily = dyslexiaFontActive
    ? Platform.select({
        ios: 'Verdana',
        android: 'sans-serif',
        web: 'Comic Sans MS, Verdana, sans-serif',
        default: 'sans-serif',
      })
    : undefined;
  const globalLetterSpacing = dyslexiaFontActive ? 1.5 : 0;

  // Speech Helper with error handling
  const speakText = useCallback((text) => {
    if (!speechEnabled || !text) return;
    try {
      Speech.stop().catch(() => {});
      const lang = SPEECH_LANGUAGE_MAP[language] || 'es';
      const speakOptions = { language: lang };
      const result = Speech.speak(text.toString(), speakOptions);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => console.warn('Speech error:', err));
      }
    } catch (error) {
      console.error('Speech initialization failed:', error);
    }
  }, [speechEnabled, language]);

  // Reset all accessibility settings
  const resetAccessibility = useCallback(() => {
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
  }, []);

  const contextValue = useMemo(() => ({
    language, setLanguage, t,
    textLevel, setTextLevel,
    contrastActive, setContrastActive,
    dyslexiaFontActive, setDyslexiaFontActive,
    spacingLevel, setSpacingLevel,
    speechEnabled, setSpeechEnabled,
    resetAccessibility,
    speakText,

    // Propiedades calculadas
    textScaleMultiplier,
    lineHeightMultiplier,
    globalFontFamily,
    globalLetterSpacing,
  }), [
    language, t,
    textLevel, contrastActive, dyslexiaFontActive, spacingLevel, speechEnabled,
    resetAccessibility, speakText,
    textScaleMultiplier, lineHeightMultiplier, globalFontFamily, globalLetterSpacing,
  ]);

  // isMenuOpen vive en su propio useMemo para que el cambio SOLO
  // dispare re-renders en AccessibilityMenu (useMenuOpen), no en AppText/AppButton.
  const menuValue = useMemo(
    () => ({ isMenuOpen, setIsMenuOpen }),
    [isMenuOpen],
  );

  return (
    <MenuOpenContext.Provider value={menuValue}>
      <AccessibilityContext.Provider value={contextValue}>
        {children}
      </AccessibilityContext.Provider>
    </MenuOpenContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
// Hook liviano: solo re-renderiza cuando cambia el estado open/close del sidebar.
export const useMenuOpen = () => useContext(MenuOpenContext);
