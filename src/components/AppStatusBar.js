import React, { useCallback, useEffect } from "react";
import {
  AppState,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import {
  StatusBar as ExpoStatusBar,
  setStatusBarBackgroundColor,
  setStatusBarStyle,
  setStatusBarTranslucent,
} from "expo-status-bar";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Barra de estado según tema. Android: expo-status-bar + API imperativa.
 * Con `android.edgeToEdgeEnabled: true`, el fondo opaco de la barra no aplica
 * (Expo/Android lo ignoran); por eso el proyecto usa edge-to-edge desactivado
 * salvo que en el futuro se migre a scrim + safe area.
 */
export default function AppStatusBar() {
  const { theme } = useTheme();
  const bg = theme.headerBg;
  /** 'light' = iconos/hora claros (cabecera oscura); no confundir con theme.dark (modo claro/oscuro UI). */
  const style = theme.statusBarStyle ?? (theme.dark ? "light" : "dark");
  const barStyleRN = style === "light" ? "light-content" : "dark-content";

  const applyAndroidStatusBar = useCallback(() => {
    if (Platform.OS !== "android") return;
    try {
      setStatusBarTranslucent(false);
      setStatusBarBackgroundColor(bg);
      setStatusBarStyle(style);
      RNStatusBar.setTranslucent(false);
      RNStatusBar.setBackgroundColor(bg, true);
      RNStatusBar.setBarStyle(barStyleRN, true);
    } catch {
      /* noop */
    }
  }, [bg, style, barStyleRN]);

  useEffect(() => {
    applyAndroidStatusBar();
    if (Platform.OS !== "android") return;
    const id = requestAnimationFrame(() => applyAndroidStatusBar());
    return () => cancelAnimationFrame(id);
  }, [applyAndroidStatusBar]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") applyAndroidStatusBar();
    });
    return () => sub.remove();
  }, [applyAndroidStatusBar]);

  return (
    <ExpoStatusBar
      style={style}
      backgroundColor={Platform.OS === "android" ? bg : undefined}
      translucent={false}
    />
  );
}
