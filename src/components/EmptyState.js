// ============================================
// EMPTY STATE COMPONENT - StudySync
// Migración de líneas 413-428 del frontend React
// ============================================

import React from "react";
import { View, StyleSheet } from "react-native";
import AppButton from "./AppButton";
import Text from "./AppText";
import { useTheme } from "../contexts/ThemeContext";

export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionText,
  onAction,
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.bg }]}>
        <Icon color={theme.textMuted} size={32} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>
        {message}
      </Text>
      {actionText && (
        <AppButton
          style={styles.actionButton}
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityLabel={actionText}
          accessibilityHint="Doble toque para realizar esta acción"
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </AppButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    borderRadius: 16,
    marginVertical: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#F9FAFB",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: "#EEF2FF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  actionText: {
    color: "#4338CA",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
