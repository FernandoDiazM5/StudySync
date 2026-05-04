// ============================================
// SWIPEABLE ROW - StudySync
// Componente reutilizable de swipe con PanResponder
// Revela botones de acción al deslizar a la izquierda
// ============================================

import React, { useRef, useCallback } from "react";
import {
  View,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Text from "./AppText";
import { useTheme } from "../contexts/ThemeContext";

/**
 * SwipeableRow — Envuelve cualquier contenido y revela botones al deslizar.
 *
 * Props:
 *   actions: Array<{ icon: ReactNode, label: string, bgColor: string, onPress: () => void }>
 *   enabled: boolean (default true) — habilita/deshabilita el swipe
 *   actionWidth: number (default 76) — ancho de cada botón de acción
 *   onOpen: (closeFn) => void — llamado cuando la fila se abre; recibe la fn para cerrarla
 *   children: ReactNode — contenido visible de la fila
 */
export default function SwipeableRow({
  children,
  actions = [],
  enabled = true,
  actionWidth = 76,
  onOpen,
}) {
  const { theme, isDark } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  // Ref que siempre apunta al array de actions más reciente.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const totalActionsWidth = actions.length * actionWidth;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!enabled || actions.length === 0) return false;
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 1.2)
        );
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled || actions.length === 0) return false;
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 1.2)
        );
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const currentOffset = isOpen.current ? -totalActionsWidth : 0;
        let newX = currentOffset + gestureState.dx;
        if (newX > 0) newX = 0;
        if (newX < -totalActionsWidth - 40) newX = -totalActionsWidth - 40;
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentOffset = isOpen.current ? -totalActionsWidth : 0;
        const finalX = currentOffset + gestureState.dx;
        const threshold = totalActionsWidth * 0.3;

        if (!isOpen.current) {
          if (finalX < -threshold || gestureState.vx < -0.5) openRow();
          else closeRow();
        } else {
          if (finalX > -totalActionsWidth + threshold || gestureState.vx > 0.5)
            closeRow();
          else openRow();
        }
      },
      onPanResponderTerminate: () => {
        closeRow();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const closeRow = useCallback(() => {
    isOpen.current = false;
    // useNativeDriver: false — en Android, useNativeDriver:true desincroniza
    // el hitbox de touch de la posición visual después de una animación,
    // haciendo que la parte superior del card no responda a toques.
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
  }, []);

  const closeRowRef = useRef(closeRow);
  closeRowRef.current = closeRow;

  const openRow = useCallback(() => {
    isOpen.current = true;
    Animated.spring(translateX, {
      toValue: -totalActionsWidth,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
    onOpen?.(closeRowRef.current);
  }, [totalActionsWidth, onOpen]);

  const handleActionPress = useCallback(
    (index) => {
      closeRow();
      setTimeout(() => {
        actionsRef.current[index]?.onPress?.();
      }, 150);
    },
    [closeRow],
  );

  if (!enabled || actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Panel de acciones — queda detrás del contenido */}
      <View style={[styles.actionsContainer, { width: totalActionsWidth }]}>
        {/* Wrapper con overflow:hidden para recortar las esquinas redondeadas */}
        <View style={styles.actionsWrapper}>
          {actions.map((action, index) => {
            const isFirst = index === 0;
            const isLast = index === actions.length - 1;
            const bgColor = action.bgColor || "#DC2626";

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  { width: actionWidth, backgroundColor: bgColor },
                  isFirst && styles.actionButtonFirst,
                  isLast && styles.actionButtonLast,
                  !isFirst && styles.actionButtonSep,
                ]}
                onPress={() => handleActionPress(index)}
                activeOpacity={0.78}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={`Doble toque para ${action.label.toLowerCase()}`}
              >
                {/* Reflejo superior sutil para dar profundidad */}
                <View style={styles.shineOverlay} />

                {/* Overlay oscuro en dark mode */}
                {isDark && <View style={StyleSheet.absoluteFill} />}

                {/* Ícono */}
                <View style={styles.iconWrap}>{action.icon}</View>

                {/* Etiqueta */}
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Contenido deslizable */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme.bg,
            transform: [{ translateX }],
          },
        ]}
        collapsable={false}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },

  // ── Panel de acciones ──────────────────────────────────────────
  actionsContainer: {
    position: "absolute",
    right: 0,
    // top: 0, bottom: 8 → alineado exacto con el card (que tiene marginBottom: 8)
    top: 0,
    bottom: 8,
    paddingRight: 4,
  },
  actionsWrapper: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
  },
  actionButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  actionButtonFirst: {
    // sin estilo extra; las esquinas las maneja actionsWrapper
  },
  actionButtonLast: {
    // sin estilo extra; las esquinas las maneja actionsWrapper
  },
  // Separador vertical muy sutil entre botones adyacentes
  actionButtonSep: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.25)",
  },

  // Reflejo superior para dar sensación de profundidad/glass
  shineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // Ícono dentro de un círculo con fondo semitransparente
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },

  actionLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ── Contenido ────────────────────────────────────────────────
  contentContainer: {},
});
