import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import { useAccessibility } from '../contexts/AccessibilityContext';

// Este componente envuelve al Text nativo e intercepta los estilos para aplicar 
// las escalas de accesibilidad y fuentes amigables con dislexia globalmente.
export default function AppText({ style, children, ...props }) {
  const accessibility = useAccessibility();

  // No detenemos el speech al desmontar: múltiples AppText
  // llamando a Speech.stop() al desmontarse cancelan la narración activa.

  // Safety check if used without AccessibilityProvider
  if (!accessibility) {
    return <Text style={style} {...props}>{children}</Text>;
  }

  const { textScaleMultiplier, globalFontFamily, globalLetterSpacing, lineHeightMultiplier, speechEnabled, speakText } = accessibility;

  // Extraer propiedades para escalarlas
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const baseFontSize = flattenedStyle.fontSize || 14; 
  const baseLineHeight = flattenedStyle.lineHeight || (baseFontSize * 1.2);

  const customStyle = {
    fontSize: baseFontSize * textScaleMultiplier,
    fontFamily: globalFontFamily || flattenedStyle.fontFamily,
    letterSpacing: globalLetterSpacing > 0 ? (flattenedStyle.letterSpacing || 0) + globalLetterSpacing : flattenedStyle.letterSpacing,
    lineHeight: baseLineHeight * lineHeightMultiplier,
  };

  // Extractor recursivo mágico para aplanar componentes React en Strings puros
  const extractString = (node) => {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractString).join('');
    if (node.props && node.props.children) return extractString(node.props.children);
    return '';
  };

  // Auto-Speech handler
  const handleLongPress = (event) => {
    if (speechEnabled && children) {
      try {
        const pureString = extractString(children);
        if (pureString.trim().length > 0) {
          speakText(pureString);
        }
      } catch (error) {
        console.warn('Error in speech handler:', error);
      }
    }
    if (props.onLongPress) {
      props.onLongPress(event);
    }
  };

  return (
    <Text
      style={[style, customStyle]}
      onLongPress={handleLongPress}
      accessible={true}
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {children}
    </Text>
  );
}
