import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import * as Speech from 'expo-speech';
import { useAccessibility } from '../contexts/AccessibilityContext';

// Extractor recursivo de strings para JSX elements
export const extractString = (node) => {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractString).join(' ');
  if (node.props && node.props.children) return extractString(node.props.children);
  return '';
};

export default function AppButton({ children, overrideText, accessibilityLabel, ...props }) {
  const accessibility = useAccessibility();

  // No detenemos el speech al desmontar: múltiples AppButton
  // llamando a Speech.stop() al desmontarse cancelan la narración activa.

  const handleLongPress = (event) => {
    if (accessibility && accessibility.speechEnabled) {
      try {
        const textToRead = overrideText || extractString(children);
        if (textToRead.trim().length > 0) {
          accessibility.speakText(textToRead);
        }
      } catch (error) {
        console.warn('Error in button speech handler:', error);
      }
    }
    if (props.onLongPress) {
      props.onLongPress(event);
    }
  };

  return (
    <TouchableOpacity
      {...props}
      onLongPress={handleLongPress}
      delayLongPress={500}
      accessible={true}
      accessibilityLabel={accessibilityLabel || extractString(children)}
      accessibilityRole="button"
    >
      {children}
    </TouchableOpacity>
  );
}
