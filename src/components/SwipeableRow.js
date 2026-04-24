// ============================================
// SWIPEABLE ROW - StudySync
// Componente reutilizable de swipe con PanResponder
// Revela botones de acción al deslizar a la izquierda
// ============================================

import React, { useRef, useCallback } from 'react';
import {
  View,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Text from './AppText';
import { useTheme } from '../contexts/ThemeContext';

/**
 * SwipeableRow — Envuelve cualquier contenido y revela botones al deslizar.
 *
 * Props:
 *   actions: Array<{ icon: ReactNode, label: string, bgColor: string, onPress: () => void }>
 *   enabled: boolean (default true) — habilita/deshabilita el swipe
 *   actionWidth: number (default 72) — ancho de cada botón de acción
 *   children: ReactNode — contenido visible de la fila
 */
export default function SwipeableRow({
  children,
  actions = [],
  enabled = true,
  actionWidth = 72,
}) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const totalActionsWidth = actions.length * actionWidth;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Solo activar si el movimiento es horizontal y significativo
        if (!enabled || actions.length === 0) return false;
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 1.5)
        );
      },
      onPanResponderGrant: () => {
        // Detener cualquier animación en curso
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const currentOffset = isOpen.current ? -totalActionsWidth : 0;
        let newX = currentOffset + gestureState.dx;

        // No permitir deslizar a la derecha más allá de 0
        if (newX > 0) newX = 0;
        // Limitar el deslizamiento máximo a la izquierda
        if (newX < -totalActionsWidth - 40) newX = -totalActionsWidth - 40;

        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentOffset = isOpen.current ? -totalActionsWidth : 0;
        const finalX = currentOffset + gestureState.dx;
        const threshold = totalActionsWidth * 0.3;

        if (!isOpen.current) {
          // Estaba cerrado: ¿abrir?
          if (finalX < -threshold || gestureState.vx < -0.5) {
            openRow();
          } else {
            closeRow();
          }
        } else {
          // Estaba abierto: ¿cerrar?
          if (finalX > -totalActionsWidth + threshold || gestureState.vx > 0.5) {
            closeRow();
          } else {
            openRow();
          }
        }
      },
      onPanResponderTerminate: () => {
        closeRow();
      },
    })
  ).current;

  const openRow = useCallback(() => {
    isOpen.current = true;
    Animated.spring(translateX, {
      toValue: -totalActionsWidth,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [totalActionsWidth]);

  const closeRow = useCallback(() => {
    isOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, []);

  const handleActionPress = useCallback((action) => {
    closeRow();
    // Ejecutar acción después de que la animación de cierre empiece
    setTimeout(() => {
      action.onPress?.();
    }, 150);
  }, [closeRow]);

  if (!enabled || actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Botones de acción (detrás del contenido) */}
      <View style={[styles.actionsContainer, { width: totalActionsWidth }]}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.actionButton,
              { width: actionWidth, backgroundColor: action.bgColor || '#DC2626' },
            ]}
            onPress={() => handleActionPress(action)}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={`Doble toque para ${action.label.toLowerCase()}`}
          >
            {action.icon}
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido deslizable — fondo opaco para ocultar los botones */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme.bg,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  contentContainer: {
    // backgroundColor se aplica dinámicamente desde theme.bg
  },
});
