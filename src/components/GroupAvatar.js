// ============================================
// GROUP AVATAR - StudySync
// Muestra la foto del grupo o un ícono de fallback
// con color generado por el nombre del grupo
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import { View, Image } from 'react-native';
import { GraduationCap } from 'lucide-react-native';
import Text from './AppText';

// Genera un color consistente para cada grupo basado en su nombre
const PALETTE = ['#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777'];
const colorFromName = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return { r: 79, g: 70, b: 229 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Icono más oscuro que el acento: evita mismo tono que el fondo tenue (sombrero invisible). */
function iconTintFromAccent(hex) {
  const { r, g, b } = hexToRgb(hex);
  const k = 0.38;
  return `rgb(${Math.max(32, Math.round(r * k))},${Math.max(32, Math.round(g * k))},${Math.max(32, Math.round(b * k))})`;
}

/**
 * GroupAvatar
 * Props:
 *   photoURL    — URL de la foto del grupo (opcional)
 *   name        — nombre del grupo (para color de fallback e iniciales)
 *   size        — tamaño en px (default 44)
 *   borderRadius— radio de borde (default: circular)
 *   style       — estilos adicionales
 *   showInitials— muestra iniciales en lugar del ícono (default false)
 *   onColoredHeader — cabecera oscura (p. ej. morado): más contraste en foto y en fallback
 */
export default function GroupAvatar({
  photoURL,
  name = '',
  size = 44,
  borderRadius,
  style,
  showInitials = false,
  onColoredHeader = false,
}) {
  const [imgError, setImgError] = useState(false);

  const photoUri = useMemo(() => {
    if (photoURL == null) return "";
    const s = String(photoURL).trim();
    return s || "";
  }, [photoURL]);

  // Reciclaje de FlatList + updates de lastMessage: resetear al cambiar identidad de imagen o nombre.
  useEffect(() => {
    setImgError(false);
  }, [photoUri, name]);

  const radius = borderRadius !== undefined ? borderRadius : size / 2;
  // Birrete sobresale del bbox; ~43% del lado del avatar (antes 36%), sin pasarse del overflow:hidden.
  const iconSize = Math.max(18, Math.round(size * 0.43));
  const accentColor = colorFromName(name);
  const { r, g, b } = hexToRgb(accentColor);
  const bgColor = onColoredHeader
    ? "rgba(255,255,255,0.34)"
    : `rgba(${r},${g},${b},0.38)`;
  const iconColor = onColoredHeader ? "#FFFFFF" : iconTintFromAccent(accentColor);
  const headerRing = onColoredHeader
    ? { borderWidth: 2.5, borderColor: "rgba(255,255,255,0.92)" }
    : {};

  // Iniciales para grupos: hasta 2 letras de las dos primeras palabras (no confundir con personas).
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const containerStyle = [
    {
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: bgColor,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    onColoredHeader ? headerRing : null,
    style,
  ];

  // Foto disponible y sin error (URL vacía / espacios → fallback birrete)
  if (photoUri && !imgError) {
    return (
      <Image
        key={photoUri}
        source={{ uri: photoUri }}
        style={[
          { width: size, height: size, borderRadius: radius },
          onColoredHeader ? headerRing : null,
          style,
        ]}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: iniciales o ícono
  return (
    <View style={containerStyle}>
      {showInitials && initials ? (
        <Text
          style={{
            fontSize: Math.round(size * 0.34),
            fontWeight: '800',
            color: iconColor,
          }}
        >
          {initials}
        </Text>
      ) : (
        // Contenedor explícito necesario para que react-native-svg
        // mida su espacio al montarse dinámicamente en un FlatList.
        <View
          style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}
          collapsable={false}
        >
          <GraduationCap
            key={`${name}-${iconSize}-${iconColor}`}
            size={iconSize}
            color={iconColor}
            strokeWidth={onColoredHeader ? 2.85 : 2.45}
          />
        </View>
      )}
    </View>
  );
}
