import React, { useRef } from 'react';
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
 * - El padre (AppButton / View) es quien se declara como elemento accesible.
 *
 * COEXISTENCIA NARRADOR + BOTONES PADRE:
 * - accessible={false} (dentro de botón): usa onTouchStart/onTouchEnd con timer
 *   de 700 ms. Estos eventos son "pasivos" — no reclaman el responder, así que
 *   el padre sigue recibiendo el tap normalmente. Mantener pulsado ≥700 ms activa
 *   la lectura en voz alta.
 * - accessible={true} (texto autónomo): usa onLongPress convencional. Es seguro
 *   porque no hay botón padre que pueda perder el responder.
 *
 * Props especiales:
 *   isHeading   — marca el texto como cabecera (accessibilityRole="header")
 */
export default function AppText({ style, children, isHeading, ...props }) {
  const accessibility = useAccessibility();

  // speechTimerRef DEBE estar antes del early-return para respetar las reglas de Hooks
  const speechTimerRef = useRef(null);

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

  const isExplicitlyAccessible = props.accessible === true;

  // ─── Texto AUTÓNOMO (accessible={true}) ────────────────────────────────────
  // onLongPress es seguro: no hay botón padre compitiendo por el responder.
  const handleLongPress = (speechEnabled && isExplicitlyAccessible)
    ? (event) => {
        clearTimeout(speechTimerRef.current);
        try {
          const text = extractString(children);
          if (text.trim().length > 0) speakText(text);
        } catch (e) {
          console.warn('[AppText] Speech error:', e);
        }
        props.onLongPress?.(event);
      }
    : props.onLongPress;

  // ─── Texto DENTRO DE BOTÓN (accessible={false}, default) ───────────────────
  // onTouchStart/onTouchEnd son "pasivos": no reclaman el responder, por lo que
  // el TouchableOpacity/Pressable padre sigue recibiendo el tap normalmente.
  // Un timer de 700 ms distingue "mantener pulsado" (→ narrador) de "tap rápido".
  const handleTouchStart = (speechEnabled && !isExplicitlyAccessible)
    ? () => {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = setTimeout(() => {
          try {
            const text = extractString(children);
            if (text.trim().length > 0) speakText(text);
          } catch (e) {
            console.warn('[AppText] Speech (touch) error:', e);
          }
        }, 700);
        props.onTouchStart?.();
      }
    : props.onTouchStart;

  const handleTouchEnd = (speechEnabled && !isExplicitlyAccessible)
    ? () => {
        clearTimeout(speechTimerRef.current);
        props.onTouchEnd?.();
      }
    : props.onTouchEnd;

  return (
    <Text
      // Spread primero para que nuestros handlers sobreescriban cualquier valor
      // que el consumer haya pasado para onLongPress/onTouchStart/onTouchEnd.
      {...props}
      style={[style, customStyle]}
      // ─── NARRADOR ─────────────────────────────────────────────────────────
      onLongPress={handleLongPress}
      delayLongPress={(speechEnabled && isExplicitlyAccessible) ? 600 : props.delayLongPress}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      // ─── ACCESIBILIDAD ────────────────────────────────────────────────────
      // Por defecto accessible=false: el texto no es un nodo independiente
      // en el árbol de accesibilidad, así no interfiere con los botones padre.
      // El consumer puede pasar accessible={true} explícitamente para textos
      // autónomos (párrafos, títulos de pantalla, etc.).
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
