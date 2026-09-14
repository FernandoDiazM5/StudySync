// ============================================
// GROUP AVATAR - StudySync
// Color + iniciales blancas
// Misma paleta en claro/oscuro (evita bug al
// togglear tema donde las iniciales desaparecen)
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Image, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { resolveGroupColor } from "../utils/groupColors";

function groupInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

/**
 * GroupAvatar
 * circular — chat / mensajes
 * color — color personalizado del grupo (hex); si falta, hash del nombre
 */
export default function GroupAvatar({
  photoURL,
  name = "",
  color,
  size = 44,
  borderRadius,
  circular = false,
  style,
  showInitials: _showInitials,
  onColoredHeader = false,
}) {
  const { theme, isDark } = useTheme() ?? {};
  const uiDark = !!(theme?.dark ?? isDark);
  const [imgError, setImgError] = useState(false);

  const photoUri = useMemo(() => {
    if (photoURL == null) return "";
    return String(photoURL).trim();
  }, [photoURL]);

  useEffect(() => {
    setImgError(false);
  }, [photoUri, name, color]);

  // Al cambiar tema, resetear error de imagen por si el native view quedó a medias
  useEffect(() => {
    setImgError(false);
  }, [uiDark]);

  const radius = circular
    ? size / 2
    : borderRadius !== undefined
      ? borderRadius
      : Math.round(size * 0.28);
  const accent = resolveGroupColor(color, name);
  const initials = groupInitials(name);
  const fontSize =
    initials.length > 1 ? Math.round(size * 0.36) : Math.round(size * 0.42);

  const edge = onColoredHeader
    ? {
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.9)",
      }
    : uiDark
      ? {
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
        }
      : {
          borderWidth: 0,
          borderColor: "transparent",
        };

  if (photoUri && !imgError) {
    return (
      <Image
        key={`img-${photoUri}-${uiDark ? "d" : "l"}`}
        source={{ uri: photoUri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            ...edge,
          },
          style,
        ]}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      // key fuerza remount nativo al cambiar tema (fix redraw de Text en Android)
      key={`av-${uiDark ? "d" : "l"}-${accent}`}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: onColoredHeader
            ? "rgba(255,255,255,0.28)"
            : accent,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          ...edge,
        },
        style,
      ]}
    >
      <Text
        key={`ini-${uiDark ? "d" : "l"}-${initials}`}
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontSize,
          lineHeight: fontSize + 2,
          fontWeight: "700",
          color: "#FFFFFF",
          letterSpacing: initials.length > 1 ? 0.5 : 0,
          textAlign: "center",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
