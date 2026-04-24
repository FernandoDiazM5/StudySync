import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

// Extractor recursivo de texto plano desde JSX
const extractString = (node) => {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractString).join('');
  if (node.props && node.props.children) return extractString(node.props.children);
  return '';
};

/**
 * AppText — Texto con soporte de accesibilidad.
 *
 * DISEÑO SEMÁNTICO:
 * - accessible={false} por defecto: el texto NO es un elemento independiente
 *   de TalkBack/VoiceOver. Esto evita que "robe" el doble-toque al AppButton padre.
 * - Cuando el narrador está activo, onLongPress lee el texto en voz alta.
 * - El padre (AppButton / View) es quien se declara como elemento accesible.
 *
 * Props especiales:
 *   isHeading   — marca el texto como cabecera (accessibilityRole="header")
 *   speakOnFocus — el texto se lee solo cuando es foco de TalkBack (requiere accessible={true} explícito)
 */
export default function AppText({ style, children, isHeading, ...props }) {
  const accessibility = useAccessibility();

  // Fallback seguro si se usa fuera del provider
  if (!accessibility) {
    return <Text style={style} {...props}>{children}</Text>;
  }

  const {
    textScaleMultiplier,
    globalFontFamily,
    globalLetterSpacing,
    lineHeightMultiplier,
    speechEnabled,
    speakText,
  } = accessibility;

  // Escalar estilos de tipografía
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const baseFontSize = flattenedStyle.fontSize || 14;
  const baseLineHeight = flattenedStyle.lineHeight || baseFontSize * 1.2;

  const customStyle = {
    fontSize: baseFontSize * textScaleMultiplier,
    fontFamily: globalFontFamily || flattenedStyle.fontFamily,
    letterSpacing:
      globalLetterSpacing > 0
        ? (flattenedStyle.letterSpacing || 0) + globalLetterSpacing
        : flattenedStyle.letterSpacing,
    lineHeight: baseLineHeight * lineHeightMultiplier,
  };

  // Long-press: solo activo cuando el narrador está habilitado
  const handleLongPress = speechEnabled
    ? (event) => {
        try {
          const text = extractString(children);
          if (text.trim().length > 0) speakText(text);
        } catch (e) {
          console.warn('[AppText] Speech error:', e);
        }
        props.onLongPress?.(event);
      }
    : props.onLongPress; // sin narrador → comportamiento original (o undefined)

  return (
    <Text
      style={[style, customStyle]}
      // ─── ACCESIBILIDAD ───────────────────────────────────────────────
      // Por defecto accessible=false: el texto no es un nodo independiente
      // en el árbol de accesibilidad, así no interfiere con los botones padre.
      // El consumer puede pasar accessible={true} explícitamente si necesita
      // que el texto sea un elemento de foco (p.ej. párrafos autónomos).
      onLongPress={handleLongPress}
      delayLongPress={speechEnabled ? 600 : props.delayLongPress}
      {...props}
      // Re-aplicar DESPUÉS del spread para que no sean sobreescritos:
      accessible={props.accessible ?? false}
      accessibilityRole={
        props.accessible
          ? (isHeading ? 'header' : (props.accessibilityRole || 'text'))
          : undefined
      }
      accessibilityLabel={
        props.accessible
          ? (props.accessibilityLabel || extractString(children))
          : undefined
      }
    >
      {children}
    </Text>
  );
}
