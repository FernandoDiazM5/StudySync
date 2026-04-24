import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

// Extractor recursivo de texto plano desde JSX
export const extractString = (node) => {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractString).join(' ');
  if (node.props && node.props.children) return extractString(node.props.children);
  return '';
};

/**
 * AppButton — Botón con soporte completo de TalkBack / VoiceOver.
 *
 * DISEÑO SEMÁNTICO:
 * - El botón ES el único elemento accesible del árbol (accessible={true}).
 * - Los hijos (AppText) son accessible={false} por defecto, así no
 *   compiten por el foco ni "roban" el doble-toque.
 * - TalkBack anuncia: "<label>, Botón" y el usuario hace doble toque
 *   en cualquier parte de la pantalla para activar onPress.
 * - Cuando el narrador está activo, long-press lee el label en voz alta
 *   y accessibilityHint da una pista de la acción.
 *
 * Props especiales:
 *   overrideText       — texto alternativo para el narrador (si el label
 *                        derivado de los hijos no es suficiente)
 *   accessibilityLabel — etiqueta explícita para TalkBack
 *   accessibilityHint  — pista de acción (solo visible con narrador ON)
 */
export default function AppButton({
  children,
  overrideText,
  accessibilityLabel,
  accessibilityHint,
  ...props
}) {
  const accessibility = useAccessibility();
  const speechEnabled = accessibility?.speechEnabled ?? false;

  // Etiqueta que leerá TalkBack: prioridad → prop explícita → texto de hijos
  const computedLabel = accessibilityLabel || extractString(children);

  // Long-press: solo activo cuando el narrador está habilitado
  const handleLongPress = speechEnabled
    ? (event) => {
        try {
          const text = overrideText || computedLabel;
          if (text.trim().length > 0) accessibility.speakText(text);
        } catch (e) {
          console.warn('[AppButton] Speech error:', e);
        }
        props.onLongPress?.(event);
      }
    : props.onLongPress;

  return (
    <TouchableOpacity
      {...props}
      // ─── ACCESIBILIDAD ───────────────────────────────────────────────
      // accessible={true} siempre: TalkBack puede enfocar este botón.
      // Sus hijos (AppText) son accessible={false}, así forman una unidad
      // monolítica: 1 elemento de foco → 1 doble-toque → 1 onPress.
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={computedLabel}
      // Hint solo cuando el narrador está activo (no contamina la UI normal)
      accessibilityHint={speechEnabled ? accessibilityHint : undefined}
      accessibilityState={{
        disabled: !!props.disabled,
        // Si el consumer pasa selected/checked, lo propagamos
        ...(props.accessibilityState || {}),
      }}
      // ────────────────────────────────────────────────────────────────
      onLongPress={handleLongPress}
      delayLongPress={speechEnabled ? 600 : props.delayLongPress}
    >
      {children}
    </TouchableOpacity>
  );
}
