import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import {
  X,
  Type,
  Droplet,
  CaseSensitive,
  AlignJustify,
  Volume2,
  RotateCcw,
  Accessibility as AccessibilityIcon,
  ChevronDown,
  Check,
} from "lucide-react-native";
import {
  useAccessibility,
  useMenuOpen,
} from "../contexts/AccessibilityContext";
import { useTheme } from "../contexts/ThemeContext";
import AppText from "./AppText";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const GridButton = memo(
  ({
    icon: Icon,
    label,
    levels,
    currentLevel,
    onPress,
    accessibilityLabel,
    iconSize,
  }) => {
    const { theme } = useTheme();
    const { contrastActive, language } = useAccessibility();

    const isActive = currentLevel > 0;
    const levelText =
      levels === 1
        ? isActive
          ? language === "en"
            ? "On"
            : "Activado"
          : language === "en"
            ? "Off"
            : "Desactivado"
        : language === "en"
          ? `Level ${currentLevel + 1} of ${levels}`
          : `Nivel ${currentLevel + 1} de ${levels}`;

    return (
      <TouchableOpacity
        style={[
          styles.gridBtn,
          {
            backgroundColor: theme.card,
            borderColor: isActive ? theme.text : theme.border,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`${label}: ${levelText}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
      >
        <Icon color={isActive ? theme.text : theme.textMuted} size={iconSize} />
        <View style={styles.labelGroup}>
          <AppText
            style={[styles.gridLabel, { color: theme.text, fontSize: 13 }]}
            accessible={false}
            maxFontSizeMultiplier={2.2}
          >
            {label}
          </AppText>
          <View style={styles.levelIndicators}>
            {Array.from({ length: levels }).map((_, idx) => {
              const filled = currentLevel >= idx;
              return (
                <View
                  key={idx}
                  style={[
                    styles.levelSegment,
                    {
                      backgroundColor: filled
                        ? contrastActive
                          ? theme.text
                          : "#4F46E5"
                        : contrastActive
                          ? "#92400e"
                          : theme.dark
                            ? "#4B5563"
                            : "#CBD5E1",
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

export default function AccessibilityMenu() {
  // Estado open/close en contexto separado → no re-renderiza AppText/AppButton
  const { isMenuOpen, setIsMenuOpen } = useMenuOpen();

  const {
    language,
    setLanguage,
    t,
    textLevel,
    setTextLevel,
    contrastActive,
    setContrastActive,
    dyslexiaFontActive,
    setDyslexiaFontActive,
    spacingLevel,
    setSpacingLevel,
    speechEnabled,
    setSpeechEnabled,
    resetAccessibility,
    textScaleMultiplier,
    speakText,
  } = useAccessibility();

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [mounted, setMounted] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const gridIconSize = Math.round(28 * Math.min(textScaleMultiplier, 1.25));

  const announce = useCallback(
    (message) => {
      if (!message) return;
      setTimeout(() => speakText(message), 90);
    },
    [speakText],
  );

  useEffect(() => {
    if (isMenuOpen) {
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 170,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [isMenuOpen]);

  // Botón hardware back
  useEffect(() => {
    if (!mounted) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [mounted, isMenuOpen]);

  // Cycle handlers — useCallback garantiza referencia estable → memo en GridButton funciona
  const handleTextSize = useCallback(() => {
    setTextLevel((p) => {
      const next = p + 1 > 2 ? 0 : p + 1;
      const part =
        language === "en" ? `${next + 1} of 3` : `${next + 1} de 3`;
      announce(`${t("textSize")}, ${part}`);
      return next;
    });
  }, [announce, language, t]);

  const handleSpacing = useCallback(() => {
    setSpacingLevel((p) => {
      const next = p + 1 > 2 ? 0 : p + 1;
      const part =
        language === "en" ? `${next + 1} of 3` : `${next + 1} de 3`;
      announce(`${t("lineSpacing")}, ${part}`);
      return next;
    });
  }, [announce, language, t]);

  const handleContrast = useCallback(() => {
    setContrastActive((p) => {
      const next = !p;
      announce(`${t("contrasts")}: ${next ? t("yes") : t("no")}`);
      return next;
    });
  }, [announce, t]);

  const handleDyslexia = useCallback(() => {
    setDyslexiaFontActive((p) => {
      const next = !p;
      announce(`${t("dyslexiaFriendly")}: ${next ? t("yes") : t("no")}`);
      return next;
    });
  }, [announce, t]);

  const handleNarrator = useCallback(() => {
    setSpeechEnabled((p) => {
      const next = !p;
      if (next) {
        try {
          const lang = language === "en" ? "en" : "es";
          Speech.speak(
            language === "en" ? "Narrator enabled." : "Narrador activado.",
            { language: lang },
          );
        } catch {
          /* noop */
        }
      } else {
        try {
          Speech.stop().catch(() => {});
        } catch {
          /* noop */
        }
        try {
          const lang = language === "en" ? "en" : "es";
          Speech.speak(
            language === "en" ? "Narrator disabled." : "Narrador desactivado.",
            { language: lang },
          );
        } catch {
          /* noop */
        }
      }
      return next;
    });
  }, [language]);

  // Renderiza el JSX en cuanto isMenuOpen=true (antes de que mounted se actualice),
  // para que el Animated.View nativo esté montado cuando la animación con
  // useNativeDriver:true empiece. Sin esto, la animación se ejecuta contra
  // un View inexistente y el panel nunca aparece.
  if (!mounted && !isMenuOpen) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrapper]}
      pointerEvents="box-none"
      importantForAccessibility={isMenuOpen ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!isMenuOpen}
    >
      {/* Overlay oscuro */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          {
            opacity: slideAnim.interpolate({
              inputRange: [0, SCREEN_WIDTH],
              outputRange: [1, 0],
            }),
          },
        ]}
        pointerEvents={isMenuOpen ? "auto" : "none"}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setIsMenuOpen(false)}
        />
      </Animated.View>

      {/* Panel lateral.
          pointerEvents="none" cuando está cerrado: evita que el panel
          (que con useNativeDriver:true tarda ~170ms en salir del árbol)
          bloquee toques sobre tabs, cards y cualquier elemento debajo. */}
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.bg,
            top: 0,
            bottom: 0,
            transform: [{ translateX: slideAnim }],
          },
        ]}
        pointerEvents={isMenuOpen ? "auto" : "none"}
      >
        <View style={styles.panelInner}>
        {/* Header — padding superior = área segura bajo notch */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.headerBg,
              paddingTop: insets.top + 12,
              paddingBottom: 14,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <AccessibilityIcon color="#FFF" size={24} />
            <AppText
              style={[styles.headerTitle, { fontSize: 16 }]}
              accessible
              isHeading
              maxFontSizeMultiplier={2.2}
            >
              {t("accessibilityMenu")}
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => setIsMenuOpen(false)}
            style={styles.closeBtn}
          >
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.round(16 * Math.min(textScaleMultiplier, 1.15)),
              paddingHorizontal: Math.round(
                16 * Math.min(textScaleMultiplier, 1.2),
              ),
              paddingBottom:
                insets.bottom + Math.round(16 * textScaleMultiplier),
            },
          ]}
        >
          {/* Language Selector */}
          <View style={styles.sectionRow}>
            <TouchableOpacity
              style={[
                styles.dropdownHeader,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => setLangDropdownOpen(!langDropdownOpen)}
            >
              <AppText
                style={{ color: theme.text, fontSize: 16, flex: 1, minWidth: 0 }}
                accessible={false}
                maxFontSizeMultiplier={2.2}
              >
                {t("language")}:{" "}
                {language === "es"
                  ? t("spanish")
                  : language === "en"
                    ? t("english")
                    : t("quechua")}
              </AppText>
              <ChevronDown color={theme.textMuted} size={20} />
            </TouchableOpacity>

            {langDropdownOpen && (
              <View
                style={[
                  styles.dropdownContent,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {["es", "en", "qu"].map((lng) => (
                  <TouchableOpacity
                    key={lng}
                    style={[
                      styles.langOption,
                      { borderBottomColor: theme.divider },
                    ]}
                    onPress={() => {
                      setLanguage(lng);
                      setLangDropdownOpen(false);
                    }}
                  >
                    <AppText
                      style={{ color: theme.text, fontSize: 15 }}
                      accessible={false}
                      maxFontSizeMultiplier={2.2}
                    >
                      {lng === "es"
                        ? t("spanish")
                        : lng === "en"
                          ? t("english")
                          : t("quechua")}
                    </AppText>
                    {language === lng && <Check color={theme.text} size={18} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Section label */}
          <View
            style={[styles.sectionLabel, { borderBottomColor: theme.border }]}
          >
            <AppText
              style={{
                color: theme.text,
                fontSize: 16,
                fontWeight: "600",
              }}
              accessible
              maxFontSizeMultiplier={2.2}
            >
              {t("profile")}
            </AppText>
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            <GridButton
              icon={Type}
              label={t("textSize")}
              levels={3}
              currentLevel={textLevel}
              onPress={handleTextSize}
              iconSize={gridIconSize}
            />
            <GridButton
              icon={Droplet}
              label={t("contrasts")}
              levels={1}
              currentLevel={contrastActive ? 1 : 0}
              onPress={handleContrast}
              iconSize={gridIconSize}
            />
            <GridButton
              icon={CaseSensitive}
              label={t("dyslexiaFriendly")}
              levels={1}
              currentLevel={dyslexiaFontActive ? 1 : 0}
              onPress={handleDyslexia}
              iconSize={gridIconSize}
            />
            <GridButton
              icon={AlignJustify}
              label={t("lineSpacing")}
              levels={3}
              currentLevel={spacingLevel}
              onPress={handleSpacing}
              iconSize={gridIconSize}
            />
            <GridButton
              icon={Volume2}
              label={t("narrator")}
              levels={1}
              currentLevel={speechEnabled ? 1 : 0}
              onPress={handleNarrator}
              iconSize={gridIconSize}
            />
          </View>
        </ScrollView>

        {/* Reset footer */}
        <View style={[styles.resetFooter, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={resetAccessibility}
          >
            <RotateCcw color={theme.textSecondary} size={20} />
            <AppText
              style={[
                styles.resetText,
                {
                  color: theme.textSecondary,
                  fontSize: 16,
                },
              ]}
              accessible={false}
              maxFontSizeMultiplier={2.2}
            >
              {t("reset")}
            </AppText>
          </TouchableOpacity>
        </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 999,
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  container: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "90%",
    maxWidth: 400,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  panelInner: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    color: "#FFF",
    fontWeight: "700",
  },
  closeBtn: { padding: 4 },
  scrollArea: { flex: 1, minHeight: 0 },
  scrollContent: {
    alignItems: "stretch",
  },
  sectionRow: { marginBottom: 20 },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownContent: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 32,
  },
  gridBtn: {
    width: "48%",
    aspectRatio: 1.1,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  labelGroup: { alignItems: "center", gap: 6 },
  gridLabel: { textAlign: "center", fontWeight: "600" },
  levelIndicators: { flexDirection: "row", gap: 4 },
  levelSegment: {
    height: 4,
    width: 16,
    borderRadius: 2,
    flexShrink: 0,
    flexGrow: 0,
  },
  resetFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  resetText: { fontWeight: "600" },
});
