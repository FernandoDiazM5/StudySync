import React, { useMemo } from "react";
import { Platform } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Una sola fuente de verdad: expo-status-bar (sin imperativos duplicados ni StatusBar de RN).
 * Tema claro y oscuro: fondo `headerBg` (misma franja que cabeceras moradas) + iconos claros.
 * Evita la franja gris‑clara bajo el reloj que parecía “margen” respecto al morado.
 */
export default function AppStatusBar() {
  const { theme } = useTheme();

  const { statusBarBg, expoStyle } = useMemo(
    () => ({ statusBarBg: theme.headerBg, expoStyle: "light" }),
    [theme.headerBg],
  );

  return (
    <ExpoStatusBar
      key={`${theme.dark}-${statusBarBg}`}
      style={expoStyle}
      translucent={Platform.OS === "android"}
      backgroundColor={Platform.OS === "android" ? statusBarBg : undefined}
      hidden={false}
    />
  );
}
