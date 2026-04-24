// ============================================
// GROUP AVATAR - StudySync
// Muestra la foto del grupo o un ícono de fallback
// con color generado por el nombre del grupo
// ============================================

import React, { useState } from 'react';
import { View, Image } from 'react-native';
import { UsersRound } from 'lucide-react-native';
import Text from './AppText';

// Genera un color consistente para cada grupo basado en su nombre
const PALETTE = ['#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777'];
const colorFromName = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

/**
 * GroupAvatar
 * Props:
 *   photoURL    — URL de la foto del grupo (opcional)
 *   name        — nombre del grupo (para color de fallback e iniciales)
 *   size        — tamaño en px (default 44)
 *   borderRadius— radio de borde (default: circular)
 *   style       — estilos adicionales
 *   showInitials— muestra iniciales en lugar del ícono (default false)
 */
export default function GroupAvatar({
  photoURL,
  name = '',
  size = 44,
  borderRadius,
  style,
  showInitials = false,
}) {
  const [imgError, setImgError] = useState(false);
  const radius = borderRadius !== undefined ? borderRadius : size / 2;
  const iconSize = Math.round(size * 0.48);
  const accentColor = colorFromName(name);
  const bgColor = accentColor + '22'; // 13% opacity

  // Calcular iniciales (máximo 2 letras)
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
    style,
  ];

  // Foto disponible y sin error
  if (photoURL && !imgError) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
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
            color: accentColor,
          }}
        >
          {initials}
        </Text>
      ) : (
        <UsersRound size={iconSize} color={accentColor} />
      )}
    </View>
  );
}
