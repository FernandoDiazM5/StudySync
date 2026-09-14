// ============================================
// GROUP COLOR PICKER - StudySync
// Fila de swatches para color de grupo.
// ============================================

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import Text from "./AppText";
import { GROUP_COLOR_PALETTE } from "../utils/groupColors";
import { useTheme } from "../contexts/ThemeContext";

export default function GroupColorPicker({
  value,
  onChange,
  label,
  disabled = false,
}) {
  const { theme } = useTheme();
  const selected = value || GROUP_COLOR_PALETTE[0];

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View style={styles.row}>
        {GROUP_COLOR_PALETTE.map((hex) => {
          const active = selected.toUpperCase() === hex.toUpperCase();
          return (
            <TouchableOpacity
              key={hex}
              onPress={() => !disabled && onChange?.(hex)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={hex}
              style={[
                styles.swatch,
                {
                  backgroundColor: hex,
                  borderColor: active
                    ? theme.dark
                      ? "#FFFFFF"
                      : "#111827"
                    : "transparent",
                  opacity: disabled ? 0.55 : 1,
                },
              ]}
            >
              {active ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
