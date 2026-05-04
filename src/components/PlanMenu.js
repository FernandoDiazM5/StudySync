// ============================================
// PLAN MENU - StudySync
// Sidebar sin Modal — acotado entre status bar y tab bar
// Vistas: 'plan' → 'payment' → 'success'
// Métodos de pago: Tarjeta · PayPal · Yape
// ============================================

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  BackHandler,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import AppText from "./AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Crown,
  Check,
  Zap,
  ArrowLeft,
  CreditCard,
  User,
  Calendar,
  Lock,
  Globe,
  Smartphone,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAccessibility } from "../contexts/AccessibilityContext";

/** Símbolo de sol peruano (formato oficial informal) */
const PEN = "S/";

/** Claves i18n — orden de beneficios plan Personal */
const PLAN_FEATURE_KEYS = [
  "planFeatureStudyGroupsUnlimited",
  "planFeatureMembersUnlimitedPerGroup",
  "planFeatureMultipleModeratorsPerGroup",
  "planFeatureSubscriberToolkit",
  "planFeatureInactiveMemberNotifications",
  "planFeatureLeaderPanelPerGroup",
  "planFeatureSubtaskIntelligence",
  "planFeatureTaskPriorityOrganization",
  "planFeatureChatToolkit",
];

// ── Métodos de pago ─────────────────────────────────────────────────────────
const METHODS = [
  { id: "card", label: "Tarjeta", Icon: CreditCard },
  { id: "paypal", label: "PayPal", Icon: Globe },
  { id: "yape", label: "Yape", Icon: Smartphone },
];

/** Claves i18n: paymentMethodCard | paymentMethodPayPal | paymentMethodYape (no usar label en español). */
const paymentMethodTranslationKey = (methodId) => {
  if (methodId === "paypal") return "paymentMethodPayPal";
  if (methodId === "yape") return "paymentMethodYape";
  return "paymentMethodCard";
};

// ── Lógica mock de pago ──────────────────────────────────────────────────────
const CARD_OUTCOMES = {
  4242424242424242: null, // éxito
  4000000000000002: "Tarjeta rechazada por el banco.",
  4000000000009995: "Fondos insuficientes en la cuenta.",
  4000000000000101: "CVV incorrecto. Verifica el código de seguridad.",
  4000000000000069: "La tarjeta está vencida.",
};

function resolveCard(rawNumber, cvv) {
  const digits = rawNumber.replace(/\s/g, "");
  if (digits.length < 16) return "Ingresa un número de tarjeta de 16 dígitos.";
  const known = CARD_OUTCOMES[digits];
  if (known === undefined)
    return "Tarjeta no reconocida. Usa los números de prueba.";
  // special case: 0101 needs CVV 999
  if (digits === "4000000000000101" && cvv !== "999")
    return "CVV incorrecto. Verifica el código de seguridad.";
  return known; // null = success, string = error
}

function resolvePayPal(email, pwd) {
  if (!email.includes("@")) return "Ingresa un correo electrónico válido.";
  if (!pwd) return "La contraseña no puede estar vacía.";
  if (email === "rechazado@test.com")
    return "Tu cuenta PayPal fue rechazada. Contacta a soporte.";
  if (email === "comprador@test.com" && pwd !== "test1234")
    return "Contraseña incorrecta.";
  if (email !== "comprador@test.com") return "Cuenta PayPal no encontrada.";
  return null; // éxito
}

function resolveYape(phone, code) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return "Ingresa un número de celular de 9 dígitos.";
  if (!code) return "Ingresa el código Yape.";
  if (digits !== "999999999") return "El número no está registrado en Yape.";
  if (code !== "123456") return "Código Yape incorrecto. Inténtalo de nuevo.";
  return null; // éxito
}

// ── Formateadores ────────────────────────────────────────────────────────────
const fmtCard = (v) =>
  v
    .replace(/\D/g, "")
    .substring(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
const fmtExpiry = (v) => {
  const d = v.replace(/\D/g, "").substring(0, 4);
  return d.length >= 3 ? `${d.substring(0, 2)}/${d.substring(2)}` : d;
};
const fmtCvv = (v) => v.replace(/\D/g, "").substring(0, 4);
const fmtPhone = (v) => {
  const d = v.replace(/\D/g, "").substring(0, 9);
  if (d.length > 6)
    return `${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}`;
  if (d.length > 3) return `${d.substring(0, 3)} ${d.substring(3)}`;
  return d;
};

// ── Componente principal ─────────────────────────────────────────────────────
function PlanMenu({
  visible,
  onClose,
  currentPlan,
  currentBilling,
  onSelectPlan,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.min(Math.round(windowWidth * 0.9), 400);

  const { theme, isDark } = useTheme();
  const {
    t,
    textScaleMultiplier,
    globalFontFamily,
    globalLetterSpacing,
    lineHeightMultiplier,
  } = useAccessibility();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").width),
  ).current;
  const [mounted, setMounted] = useState(false);

  // Vista activa
  const [view, setView] = useState("plan");
  const [selected, setSelected] = useState(currentBilling || "monthly");

  // Método de pago
  const [payMethod, setPayMethod] = useState("card");

  // Campos tarjeta
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // Campos PayPal
  const [ppEmail, setPpEmail] = useState("");
  const [ppPwd, setPpPwd] = useState("");
  const [ppShowPwd, setPpShowPwd] = useState(false);

  // Campos Yape
  const [yapePhone, setYapePhone] = useState("");
  const [yapeCode, setYapeCode] = useState("");

  // UX
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  const isPro = currentPlan === "personal";
  const amountStr = selected === "monthly" ? "7.90" : "79.90";
  const price = `${PEN} ${amountStr}`;
  const period =
    selected === "monthly"
      ? t("planPriceSuffixMonth")
      : t("planPriceSuffixYear");

  const accent = "#4F46E5";
  const accentOnCard = theme.dark ? "#A5B4FC" : accent;
  const accentSoft = theme.dark ? "#818CF8" : "#6366F1";
  const priceCardBg = theme.dark ? theme.card : "#EEF2FF";
  const summaryBg = theme.dark ? theme.card : "#EEF2FF";

  const inputTypography = useMemo(
    () => ({
      fontSize: 14 * textScaleMultiplier,
      lineHeight: Math.round(14 * textScaleMultiplier * lineHeightMultiplier),
      ...(globalFontFamily ? { fontFamily: globalFontFamily } : {}),
      ...(globalLetterSpacing > 0 ? { letterSpacing: globalLetterSpacing } : {}),
    }),
    [
      textScaleMultiplier,
      lineHeightMultiplier,
      globalFontFamily,
      globalLetterSpacing,
    ],
  );

  const featureTypography = useMemo(() => {
    const fs = Math.round(14 * textScaleMultiplier);
    return {
      fontSize: fs,
      lineHeight: Math.round(fs * lineHeightMultiplier),
      ...(globalFontFamily ? { fontFamily: globalFontFamily } : {}),
      ...(globalLetterSpacing > 0 ? { letterSpacing: globalLetterSpacing } : {}),
    };
  }, [
    textScaleMultiplier,
    lineHeightMultiplier,
    globalFontFamily,
    globalLetterSpacing,
  ]);

  const featureRowPadV = Math.round(14 * textScaleMultiplier);
  const featureRowPadH = Math.round(16 * textScaleMultiplier);
  const featureRowGap = Math.round(14 * textScaleMultiplier);
  const featureCheckSize = Math.round(24 * Math.max(textScaleMultiplier, 1));

  const resetPayment = useCallback(() => {
    setCardNumber("");
    setCardName("");
    setExpiry("");
    setCvv("");
    setPpEmail("");
    setPpPwd("");
    setPpShowPwd(false);
    setYapePhone("");
    setYapeCode("");
    setPayError(null);
    setPaying(false);
    setPayMethod("card");
  }, []);

  const resetAndClose = useCallback(() => onClose(), [onClose]);

  const changeMethod = useCallback((m) => {
    setPayMethod(m);
    setPayError(null);
  }, []);

  /** Iconos de pestañas de pago: escala con accesibilidad, tope para no desbordar. */
  const methodTabIconSize = useMemo(
    () =>
      Math.round(20 * Math.min(Math.max(textScaleMultiplier, 1), 1.35)),
    [textScaleMultiplier],
  );

  // ── Animación entrada / salida ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: windowWidth,
        duration: 170,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
        resetPayment();
        setView("plan");
      });
    }
  }, [visible, windowWidth, resetPayment]);

  useEffect(() => {
    if (currentBilling === "monthly" || currentBilling === "annual") {
      setSelected(currentBilling);
    }
  }, [currentBilling]);

  // ── Botón hardware back ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (view === "payment") {
        setView("plan");
        return true;
      }
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [mounted, visible, view]);

  // ── Procesar pago ────────────────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    setPayError(null);

    // Validación por método
    let fieldError = null;
    if (payMethod === "card") {
      if (!cardName.trim()) fieldError = "Ingresa el nombre del titular.";
      else if (expiry.length < 5)
        fieldError = "Ingresa la fecha de vencimiento (MM/AA).";
      else if (cvv.length < 3)
        fieldError = "Ingresa el CVV (mínimo 3 dígitos).";
    } else if (payMethod === "paypal") {
      if (!ppEmail.trim()) fieldError = "Ingresa tu correo PayPal.";
      else if (!ppPwd) fieldError = "Ingresa tu contraseña PayPal.";
    } else if (payMethod === "yape") {
      if (!yapePhone.replace(/\D/g, ""))
        fieldError = "Ingresa tu número de celular.";
      else if (!yapeCode) fieldError = "Ingresa el código Yape.";
    }

    if (fieldError) {
      setPayError(fieldError);
      return;
    }

    setPaying(true);
    await new Promise((r) => setTimeout(r, 1800));
    setPaying(false);

    // Resolver resultado mock
    let outcome = null;
    if (payMethod === "card") outcome = resolveCard(cardNumber, cvv);
    if (payMethod === "paypal") outcome = resolvePayPal(ppEmail, ppPwd);
    if (payMethod === "yape") outcome = resolveYape(yapePhone, yapeCode);

    if (outcome) {
      setPayError(outcome);
    } else {
      onSelectPlan("personal", selected);
      setView("success");
    }
  }, [
    payMethod,
    cardName,
    expiry,
    cvv,
    ppEmail,
    ppPwd,
    yapePhone,
    yapeCode,
    cardNumber,
    onSelectPlan,
    selected,
  ]);

  // ── Cancelar suscripción ─────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    Alert.alert(t("cancelSubscription"), t("cancelSubscriptionConfirm"), [
      { text: t("noKeep"), style: "cancel" },
      {
        text: t("yesCancel"),
        style: "destructive",
        onPress: () => {
          onSelectPlan("free", null);
          resetAndClose();
        },
      },
    ]);
  }, [onSelectPlan, resetAndClose, t]);

  // Renderiza en cuanto visible=true para que el Animated.View esté
  // montado cuando la animación useNativeDriver:true empiece.
  if (!mounted && !visible) return null;

  /** Cabecera del panel bajo notch/status; el contenedor va de borde a borde vertical. */
  const headerSafePadding = {
    paddingTop: insets.top + 12,
    paddingBottom: 14,
  };
  /** Padding del contenido del ScrollView (últimas líneas / botones). */
  const scrollBottomPaddingPlan = insets.bottom + 24;
  const scrollBottomPaddingPayment = insets.bottom + 28;
  /** Margen inferior del bloque scrollable respecto al borde del sidebar. */
  const scrollHostMarginBottom = Math.max(insets.bottom, 8) + 16;

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, Math.max(windowWidth, 1)],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // ── Render método de pago activo ─────────────────────────────────────────────
  const renderPayForm = () => {
    if (payMethod === "card")
      return (
        <>
          {/* Vista previa decorativa (no entra en el orden de foco del narrador) */}
          <View
            style={styles.cardPreview}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.cardChip} />
            <AppText
              style={styles.cardPreviewNumber}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
              maxFontSizeMultiplier={2}
            >
              {cardNumber ? cardNumber.padEnd(19, " ") : "•••• •••• •••• ••••"}
            </AppText>
            <View style={styles.cardPreviewBottom}>
              <View style={styles.cardPreviewColumn}>
                <AppText style={styles.cardPreviewLabel}>{t("cardHolder")}</AppText>
                <AppText style={styles.cardPreviewValue} numberOfLines={1}>
                  {cardName.toUpperCase() || "••••••••"}
                </AppText>
              </View>
              <View style={styles.cardPreviewColumn}>
                <AppText style={styles.cardPreviewLabel}>{t("expiryLabel")}</AppText>
                <AppText style={styles.cardPreviewValue}>{expiry || "••/••"}</AppText>
              </View>
            </View>
          </View>

          <View style={styles.payForm}>
            <View style={styles.payField}>
              <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
                {t("cardNumberLabel")}
              </AppText>
              <View
                style={[
                  styles.payInputRow,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.inputBorder,
                  },
                ]}
              >
                <CreditCard color={theme.textMuted} size={16} />
                <TextInput
                  style={[styles.payInput, inputTypography, { color: theme.text }]}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={theme.textMuted}
                  value={cardNumber}
                  onChangeText={(t) => {
                    setCardNumber(fmtCard(t));
                    setPayError(null);
                  }}
                  keyboardType="numeric"
                  maxLength={19}
                  accessibilityLabel={t("cardNumberLabel")}
                />
              </View>
            </View>
            <View style={styles.payField}>
              <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
                {t("cardHolderLabel")}
              </AppText>
              <View
                style={[
                  styles.payInputRow,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.inputBorder,
                  },
                ]}
              >
                <User color={theme.textMuted} size={16} />
                <TextInput
                  style={[styles.payInput, inputTypography, { color: theme.text }]}
                  placeholder="Como aparece en la tarjeta"
                  placeholderTextColor={theme.textMuted}
                  value={cardName}
                  onChangeText={(t) => {
                    setCardName(t);
                    setPayError(null);
                  }}
                  autoCapitalize="characters"
                  accessibilityLabel={t("cardHolderLabel")}
                />
              </View>
            </View>
            <View style={styles.payRow}>
              <View style={[styles.payField, { flex: 1 }]}>
                <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
                  {t("expiryLabel")}
                </AppText>
                <View
                  style={[
                    styles.payInputRow,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                >
                  <Calendar color={theme.textMuted} size={16} />
                  <TextInput
                    style={[styles.payInput, inputTypography, { color: theme.text }]}
                    placeholder={t("expiryPlaceholder")}
                    placeholderTextColor={theme.textMuted}
                    value={expiry}
                    onChangeText={(t) => {
                      setExpiry(fmtExpiry(t));
                      setPayError(null);
                    }}
                    keyboardType="numeric"
                    maxLength={5}
                    accessibilityLabel={t("expiryLabel")}
                  />
                </View>
              </View>
              <View style={[styles.payField, { flex: 1 }]}>
                <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
                  CVV
                </AppText>
                <View
                  style={[
                    styles.payInputRow,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                >
                  <Lock color={theme.textMuted} size={16} />
                  <TextInput
                    style={[styles.payInput, inputTypography, { color: theme.text }]}
                    placeholder={t("cvvPlaceholder")}
                    placeholderTextColor={theme.textMuted}
                    value={cvv}
                    onChangeText={(t) => {
                      setCvv(fmtCvv(t));
                      setPayError(null);
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    accessibilityLabel={t("cvvLabel")}
                  />
                </View>
              </View>
            </View>
          </View>
        </>
      );

    if (payMethod === "paypal")
      return (
        <View style={styles.payForm}>
          <View
            style={[
              styles.ppHeader,
              {
                backgroundColor: theme.dark ? "#1E3A5F" : "#EFF6FF",
                borderColor: "#2563EB",
              },
            ]}
          >
            <Globe color="#2563EB" size={20} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.ppTitle, { color: "#2563EB" }]}>
                {t("paypalLogin")}
              </AppText>
              <AppText
                style={[
                  styles.ppSub,
                  { color: theme.dark ? "#93C5FD" : "#3B82F6" },
                ]}
                accessible
              >
                {t("paypalSecureAuth")}
              </AppText>
            </View>
          </View>
          <View style={styles.payField}>
            <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
              {t("emailLabel")}
            </AppText>
            <View
              style={[
                styles.payInputRow,
                { backgroundColor: theme.card, borderColor: theme.inputBorder },
              ]}
            >
              <User color={theme.textMuted} size={16} />
              <TextInput
                style={[styles.payInput, inputTypography, { color: theme.text }]}
                placeholder={t("paypalEmailPlaceholder")}
                placeholderTextColor={theme.textMuted}
                value={ppEmail}
                onChangeText={(t) => {
                  setPpEmail(t);
                  setPayError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel={t("emailLabel")}
              />
            </View>
          </View>
          <View style={styles.payField}>
            <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
              {t("passwordLabel")}
            </AppText>
            <View
              style={[
                styles.payInputRow,
                { backgroundColor: theme.card, borderColor: theme.inputBorder },
              ]}
            >
              <Lock color={theme.textMuted} size={16} />
              <TextInput
                style={[styles.payInput, inputTypography, { color: theme.text }]}
                placeholder={t("paypalPasswordPlaceholder")}
                placeholderTextColor={theme.textMuted}
                value={ppPwd}
                onChangeText={(t) => {
                  setPpPwd(t);
                  setPayError(null);
                }}
                secureTextEntry={!ppShowPwd}
                accessibilityLabel={t("passwordLabel")}
              />
              <TouchableOpacity
                onPress={() => setPpShowPwd((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={
                  ppShowPwd ? t("hidePassword") : t("showPassword")
                }
                accessibilityHint={
                  ppShowPwd ? t("hidePasswordHint") : t("showPasswordHint")
                }
              >
                {ppShowPwd ? (
                  <EyeOff color={theme.textMuted} size={16} />
                ) : (
                  <Eye color={theme.textMuted} size={16} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );

    if (payMethod === "yape")
      return (
        <View style={styles.payForm}>
          <View
            style={[
              styles.ppHeader,
              {
                backgroundColor: theme.dark ? "#2E1065" : "#F5F3FF",
                borderColor: "#7C3AED",
              },
            ]}
          >
            <Smartphone color="#7C3AED" size={20} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.ppTitle, { color: "#7C3AED" }]}>
                {t("yapePayment")}
              </AppText>
              <AppText
                style={[
                  styles.ppSub,
                  { color: theme.dark ? "#C4B5FD" : "#8B5CF6" },
                ]}
                accessible
              >
                {t("yapeInstructions")}
              </AppText>
            </View>
          </View>
          <View style={styles.payField}>
            <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
              {t("phoneNumberLabel")}
            </AppText>
            <View
              style={[
                styles.payInputRow,
                { backgroundColor: theme.card, borderColor: theme.inputBorder },
              ]}
            >
              <Smartphone color={theme.textMuted} size={16} />
              <TextInput
                style={[styles.payInput, inputTypography, { color: theme.text }]}
                placeholder={t("yapePhonePlaceholder")}
                placeholderTextColor={theme.textMuted}
                value={yapePhone}
                onChangeText={(t) => {
                  setYapePhone(fmtPhone(t));
                  setPayError(null);
                }}
                keyboardType="numeric"
                maxLength={11}
                accessibilityLabel={t("phoneNumberLabel")}
              />
            </View>
          </View>
          <View style={styles.payField}>
            <AppText style={[styles.payLabel, { color: theme.textSecondary }]}>
              {t("approvalCodeLabel")}
            </AppText>
            <View
              style={[
                styles.payInputRow,
                { backgroundColor: theme.card, borderColor: theme.inputBorder },
              ]}
            >
              <Lock color={theme.textMuted} size={16} />
              <TextInput
                style={[styles.payInput, inputTypography, { color: theme.text }]}
                placeholder={t("yapeCodePlaceholder")}
                placeholderTextColor={theme.textMuted}
                value={yapeCode}
                onChangeText={(t) => {
                  setYapeCode(t.replace(/\D/g, "").substring(0, 6));
                  setPayError(null);
                }}
                keyboardType="numeric"
                maxLength={6}
                accessibilityLabel={t("approvalCodeLabel")}
              />
            </View>
            <AppText style={[styles.yapeHint, { color: theme.textMuted }]}>
              {t("yapeApprovalHint")}
            </AppText>
          </View>
        </View>
      );
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrapper]}
      pointerEvents="box-none"
    >
      {/* Overlay oscuro */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { opacity: overlayOpacity },
        ]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={resetAndClose}
          accessibilityLabel={t("close")}
          accessibilityHint={t("planMenuOverlayHint")}
          accessibilityRole="button"
        />
      </Animated.View>

      {/* Panel lateral — pointerEvents="none" cuando cerrado para no bloquear
          toques en la pantalla mientras el panel sale del árbol (170ms). */}
      <Animated.View
        style={[
          styles.container,
          {
            width: panelWidth,
            maxWidth: panelWidth,
            backgroundColor: theme.bg,
            transform: [{ translateX: slideAnim }],
          },
        ]}
        pointerEvents={visible ? "auto" : "none"}
        accessibilityViewIsModal={visible}
        importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
      >
        <View style={styles.panelInner}>
        {/* ── ÉXITO ── */}
        {view === "success" && (
          <View style={styles.tabRoot}>
            <View
              style={[
                styles.header,
                { backgroundColor: theme.headerBg },
                headerSafePadding,
              ]}
            >
              <View style={styles.headerLeft}>
                <Crown color="#FFF" size={22} />
                <AppText style={styles.headerTitle} accessible isHeading>
                  {t("myPlan")}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={resetAndClose}
                style={styles.closeBtn}
                accessibilityLabel={t("close")}
                accessibilityRole="button"
              >
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.successBody,
                { paddingBottom: scrollBottomPaddingPlan },
              ]}
            >
              <View
                style={[
                  styles.successCircle,
                  { backgroundColor: theme.headerBg },
                ]}
              >
                <Check color="#FFF" size={40} strokeWidth={3} />
              </View>
              <AppText
                style={[styles.successTitle, { color: theme.text }]}
                accessible
              >
                {t("paymentSuccess")}
              </AppText>
              <AppText
                style={[styles.successSub, { color: theme.textMuted }]}
                accessible
              >
                {t("planPersonal")}{" "}
                {selected === "annual" ? t("annual") : t("monthly")}{" "}
                {t("paymentActiveMessage")}
              </AppText>
              <TouchableOpacity
                style={[styles.successBtn, { backgroundColor: theme.headerBg }]}
                onPress={resetAndClose}
                accessibilityLabel={t("close")}
                accessibilityRole="button"
              >
                <AppText style={styles.successBtnText}>{t("close")}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PAGO ── */}
        {view === "payment" && (
          <View style={styles.tabRoot}>
            <View
              style={[
                styles.header,
                { backgroundColor: theme.headerBg },
                headerSafePadding,
              ]}
            >
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setView("plan");
                    resetPayment();
                  }}
                  style={styles.backBtn}
                  accessibilityLabel={t("back")}
                  accessibilityRole="button"
                >
                  <ArrowLeft color="#FFF" size={20} />
                </TouchableOpacity>
                <AppText style={styles.headerTitle} accessible isHeading>
                  {t("paymentDetails")}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={resetAndClose}
                style={styles.closeBtn}
                accessibilityLabel={t("close")}
                accessibilityRole="button"
              >
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.sideContentShell}>
              <KeyboardAvoidingView
                style={{ flex: 1, minHeight: 0, width: "100%", minWidth: 0 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <ScrollView
                  style={styles.scrollArea}
                  contentContainerStyle={[
                    styles.scrollContent,
                    {
                      paddingBottom: scrollBottomPaddingPayment,
                      width: "100%",
                    },
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  accessibilityLabel={t("paymentDetails")}
                >
                {/* Resumen del pedido */}
                <View
                  style={[
                    styles.orderSummary,
                    {
                      backgroundColor: summaryBg,
                      borderColor: accent,
                    },
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${t("orderSummary")}. ${price}`}
                >
                  <Crown color={accentOnCard} size={16} importantForAccessibility="no" />
                  <AppText style={[styles.orderText, { color: accentOnCard }]} accessible={false}>
                    {t("orderSummary")}
                  </AppText>
                  <AppText style={[styles.orderPrice, { color: accentOnCard }]} accessible={false}>
                    {price}
                  </AppText>
                </View>

                {/* Selector de método (pestañas centradas, texto legible) */}
                <View
                  style={[
                    styles.methodBar,
                    { backgroundColor: theme.input },
                  ]}
                  accessibilityRole="tablist"
                  accessibilityLabel={t("paymentMethodTabListA11y")}
                >
                  {METHODS.map(({ id, Icon }) => {
                    const active = payMethod === id;
                    const methodName = t(paymentMethodTranslationKey(id));
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.methodBtn,
                          active && styles.methodBtnActive,
                        ]}
                        onPress={() => changeMethod(id)}
                        activeOpacity={0.8}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={methodName}
                        accessibilityHint={t("paymentMethodTabHint")}
                      >
                        <Icon
                          color={active ? "#FFF" : theme.textMuted}
                          size={methodTabIconSize}
                          importantForAccessibility="no"
                        />
                        <AppText
                          style={[
                            styles.methodLabel,
                            { color: active ? "#FFF" : theme.textMuted },
                          ]}
                          numberOfLines={2}
                          accessible={false}
                        >
                          {methodName}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Formulario activo */}
                {renderPayForm()}

                {/* Banner de error inline */}
                {payError && (
                  <View
                    style={styles.errorBanner}
                    accessible
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={payError}
                  >
                    <AlertCircle color="#FFF" size={16} />
                    <AppText style={styles.errorText} accessible={false}>
                      {payError}
                    </AppText>
                  </View>
                )}

                {/* Botón de pago */}
                <TouchableOpacity
                  style={[
                    styles.payBtn,
                    { backgroundColor: theme.headerBg },
                    paying && { opacity: 0.7 },
                  ]}
                  onPress={handlePay}
                  disabled={paying}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("pay")} ${price}`}
                  accessibilityHint={t("paymentPayButtonHint")}
                  accessibilityState={{ busy: paying }}
                >
                  {paying ? (
                    <>
                      <ActivityIndicator color="#FFF" size="small" />
                      <AppText style={styles.payBtnText}>{t("processing")}</AppText>
                    </>
                  ) : (
                    <>
                      <Zap color="#FFF" size={18} fill="#FFF" />
                      <AppText
                        style={styles.payBtnText}
                      >{`${t("pay")} ${price}`}</AppText>
                    </>
                  )}
                </TouchableOpacity>

                <AppText
                  style={[styles.payLegal, { color: theme.textMuted }]}
                  accessible
                >
                  {t("paymentTestNotice")}
                </AppText>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
            <View
              style={[
                styles.bottomSeparator,
                {
                  borderTopColor: theme.border,
                  paddingBottom: scrollHostMarginBottom,
                },
              ]}
            />
          </View>
        )}

        {/* ── PLAN PRINCIPAL ── */}
        {view === "plan" && (
          <View style={styles.tabRoot}>
            <View
              style={[
                styles.header,
                { backgroundColor: theme.headerBg },
                headerSafePadding,
              ]}
            >
              <View style={styles.headerLeft}>
                <Crown color="#FFF" size={22} />
                <AppText style={styles.headerTitle} accessible isHeading>
                  {t("myPlan")}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={resetAndClose}
                style={styles.closeBtn}
                accessibilityLabel={t("close")}
                accessibilityRole="button"
              >
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.sideContentShell}>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={[
                  styles.scrollContent,
                  {
                    paddingBottom: scrollBottomPaddingPlan,
                    width: "100%",
                  },
                ]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
              <View
                style={[
                  styles.currentCard,
                  {
                    backgroundColor: isPro
                      ? theme.dark
                        ? "#1E1B4B"
                        : "#EEF2FF"
                      : theme.dark
                        ? "#1F2937"
                        : "#F9FAFB",
                    borderColor: isPro ? "#4F46E5" : theme.border,
                  },
                ]}
              >
                <View style={styles.currentCardTop}>
                  <View style={styles.currentLeft}>
                    <View
                      style={[
                        styles.currentIconWrap,
                        {
                          backgroundColor: isPro
                            ? "#4F46E5"
                            : theme.dark
                              ? "#374151"
                              : "#E5E7EB",
                        },
                      ]}
                    >
                      <Crown color={isPro ? "#FFF" : theme.textMuted} size={16} />
                    </View>
                    <View style={styles.currentTitles}>
                      <AppText
                        style={[
                          styles.currentLabel,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {isPro ? t("planPersonal") : t("planFree")}
                      </AppText>
                      <AppText
                        style={[styles.currentName, { color: theme.text }]}
                        numberOfLines={2}
                      >
                        {isPro
                          ? selected === "annual"
                            ? t("planPersonalAnnual")
                            : t("planPersonalMonthly")
                          : t("planFree")}
                      </AppText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.activeChip,
                      {
                        backgroundColor: theme.dark
                          ? isPro
                            ? "#312E81"
                            : "#374151"
                          : isPro
                            ? "#EEF2FF"
                            : "#F3F4F6",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.activeDot,
                        {
                          backgroundColor: theme.dark
                            ? "#A5B4FC"
                            : "#4F46E5",
                        },
                      ]}
                    />
                    <AppText
                      style={[
                        styles.activeChipText,
                        {
                          color: theme.dark
                            ? isPro
                              ? "#C7D2FE"
                              : "#D1D5DB"
                            : isPro
                              ? "#4F46E5"
                              : "#6B7280",
                        },
                      ]}
                    >
                      {t("planActive")}
                    </AppText>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.pricingCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pricingSegmentTrack,
                    { backgroundColor: theme.input },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.pricingSegment,
                      selected === "monthly" && styles.pricingSegmentActive,
                    ]}
                    onPress={() => setSelected("monthly")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === "monthly" }}
                    accessibilityLabel={t("monthly")}
                  >
                    <AppText
                      style={[
                        styles.pricingSegmentLabel,
                        {
                          color:
                            selected === "monthly" ? "#FFF" : theme.textMuted,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("monthly")}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pricingSegment,
                      selected === "annual" && styles.pricingSegmentActive,
                    ]}
                    onPress={() => setSelected("annual")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === "annual" }}
                    accessibilityLabel={t("annual")}
                  >
                    <View style={styles.pricingSegmentCol}>
                      <AppText
                        style={[
                          styles.pricingSegmentLabel,
                          {
                            color:
                              selected === "annual" ? "#FFF" : theme.textMuted,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {t("annual")}
                      </AppText>
                      <View
                        style={[
                          styles.pricingDiscountPill,
                          theme.dark &&
                            selected !== "annual" &&
                            styles.pricingDiscountPillDark,
                          selected === "annual" && styles.pricingDiscountPillOn,
                        ]}
                      >
                        <AppText
                          style={[
                            styles.pricingDiscountPillText,
                            selected === "annual" &&
                              styles.pricingDiscountPillTextOn,
                            theme.dark &&
                              selected !== "annual" &&
                              styles.pricingDiscountPillTextDark,
                          ]}
                        >
                          -16%
                        </AppText>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.pricingCardDivider,
                    { backgroundColor: theme.divider },
                  ]}
                />

                <View
                  style={[
                    styles.pricingPriceBlock,
                    { backgroundColor: priceCardBg },
                  ]}
                >
                  <View style={styles.priceOneLineRow}>
                    <AppText
                      style={[styles.priceSolesLine, { color: accentOnCard }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.35}
                      maxFontSizeMultiplier={2}
                    >
                      {price}
                    </AppText>
                    <AppText
                      style={[
                        styles.pricePeriodInline,
                        { color: accentSoft },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      maxFontSizeMultiplier={2}
                    >
                      {period}
                    </AppText>
                  </View>
                  {selected === "annual" && (
                    <AppText style={[styles.priceEquiv, { color: accentSoft }]}>
                      {t("priceEquivalent")}
                    </AppText>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.featuresCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {PLAN_FEATURE_KEYS.map((featKey, i) => (
                  <View
                    key={featKey}
                    style={[
                      styles.featureRow,
                      {
                        paddingVertical: featureRowPadV,
                        paddingHorizontal: featureRowPadH,
                        gap: featureRowGap,
                      },
                      i < PLAN_FEATURE_KEYS.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.divider,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureCheckWrap,
                        {
                          width: featureCheckSize,
                          height: featureCheckSize,
                          borderRadius: featureCheckSize / 2,
                          backgroundColor: theme.dark
                            ? "rgba(79, 70, 229, 0.28)"
                            : "#EEF2FF",
                        },
                      ]}
                    >
                      <Check
                        color={accentOnCard}
                        size={Math.max(12, Math.round(15 * textScaleMultiplier))}
                        strokeWidth={2.5}
                      />
                    </View>
                    <AppText
                      style={[
                        styles.featureText,
                        featureTypography,
                        { color: theme.text },
                      ]}
                      accessible
                    >
                      {t(featKey)}
                    </AppText>
                  </View>
                ))}
              </View>

              {isPro && currentBilling === selected ? (
                <View
                  style={[
                    styles.currentBtn,
                    {
                      backgroundColor: theme.dark ? "#14532D" : "#F0FDF4",
                      borderColor: theme.dark ? "#16A34A" : "#BBF7D0",
                    },
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={t("planSubscribed")}
                >
                  <Check
                    color={theme.dark ? "#86EFAC" : "#16A34A"}
                    size={18}
                    strokeWidth={2.5}
                  />
                  <AppText
                    style={[
                      styles.currentBtnText,
                      {
                        color: theme.dark ? "#BBF7D0" : "#16A34A",
                      },
                    ]}
                    accessible={false}
                  >
                    {t("planSubscribed")}
                  </AppText>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.subscribeBtn,
                    { backgroundColor: theme.headerBg },
                  ]}
                  onPress={() => setView("payment")}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPro ? t("changePlan") : t("subscribeNow")
                  }
                >
                  <Zap color="#FFF" size={18} fill="#FFF" />
                  <AppText style={styles.subscribeBtnText}>
                    {isPro ? t("changePlan") : t("subscribeNow")}
                  </AppText>
                </TouchableOpacity>
              )}

              {isPro && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t("cancelSubscription")}
                >
                  <AppText style={styles.cancelBtnText}>
                    {t("cancelSubscription")}
                  </AppText>
                </TouchableOpacity>
              )}

              <AppText
                style={[styles.legalText, { color: theme.textMuted }]}
                accessible
              >
                {t("subscriptionTerms")}
              </AppText>
              </ScrollView>
            </View>
            <View
              style={[
                styles.bottomSeparator,
                {
                  borderTopColor: theme.border,
                  paddingBottom: scrollHostMarginBottom,
                },
              ]}
            />
          </View>
        )}
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(PlanMenu);

const styles = StyleSheet.create({
  wrapper: { zIndex: 999 },
  overlay: { backgroundColor: "rgba(0,0,0,0.5)" },
  container: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    minWidth: 0,
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
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  },
  tabRoot: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    flexDirection: "column",
  },
  /** Contenido lateral: scroll + franja inferior con línea (mismo criterio que AccessibilityMenu). */
  sideContentShell: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    marginTop: 12,
    marginHorizontal: 12,
  },
  bottomSeparator: {
    alignSelf: "stretch",
    width: "100%",
    borderTopWidth: 1,
    flexShrink: 0,
    paddingTop: 12,
  },

  // Header (padding vertical vía headerSafePadding + insets en el componente)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerTitle: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  closeBtn: { padding: 4 },
  backBtn: { padding: 4 },

  scrollArea: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    alignSelf: "stretch",
    maxWidth: "100%",
  },

  // Plan view — resumen de plan actual
  currentCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  currentCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  currentLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  currentTitles: { flex: 1, minWidth: 0 },
  currentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  currentName: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeChipText: { fontSize: 11, fontWeight: "700" },

  sectionHeader: { gap: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 13 },

  /** Una sola tarjeta: segmento mensual/anual + precio */
  pricingCard: {
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    padding: 12,
    gap: 0,
  },
  pricingSegmentTrack: {
    flexDirection: "row",
    borderRadius: 11,
    padding: 4,
    gap: 4,
    width: "100%",
  },
  pricingSegment: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  pricingSegmentActive: {
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
  },
  pricingSegmentLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  pricingSegmentCol: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "100%",
  },
  pricingDiscountPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
  },
  pricingDiscountPillOn: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  pricingDiscountPillDark: {
    backgroundColor: "#78350F",
  },
  pricingDiscountPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },
  pricingDiscountPillTextOn: {
    color: "#FFF",
  },
  pricingDiscountPillTextDark: {
    color: "#FDE68A",
  },
  pricingCardDivider: {
    height: 1,
    width: "100%",
    marginVertical: 14,
  },
  pricingPriceBlock: {
    alignItems: "center",
    width: "100%",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  /** Precio + /mes|/año en una sola línea (baseline). */
  priceOneLineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flexWrap: "nowrap",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
  },
  priceSolesLine: {
    fontSize: 40,
    fontWeight: "900",
    color: "#4F46E5",
    letterSpacing: -0.5,
    lineHeight: 46,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  pricePeriodInline: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6366F1",
    marginLeft: 6,
    flexShrink: 0,
  },
  priceEquiv: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 10,
    width: "100%",
    textAlign: "center",
    paddingHorizontal: 6,
    lineHeight: 17,
  },

  featuresCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    flexShrink: 1,
    minWidth: 0,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  featureCheckWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontWeight: "500",
  },

  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  subscribeBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  currentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  currentBtnText: { fontSize: 15, fontWeight: "700" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EF4444",
    textDecorationLine: "underline",
  },
  legalText: { fontSize: 11, textAlign: "center", lineHeight: 16 },

  // Payment view
  orderSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    width: "100%",
    maxWidth: "100%",
  },
  orderText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" },
  orderPrice: { fontSize: 15, fontWeight: "900" },

  methodBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 5,
    gap: 5,
    width: "100%",
    maxWidth: "100%",
    alignItems: "stretch",
  },
  methodBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderRadius: 9,
    minHeight: 76,
  },
  methodBtnActive: {
    backgroundColor: "#4F46E5",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },

  // Card preview
  cardPreview: {
    backgroundColor: "#4F46E5",
    borderRadius: 18,
    padding: 22,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  cardChip: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
    opacity: 0.7,
    marginBottom: 20,
  },
  cardPreviewNumber: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 20,
    width: "100%",
    maxWidth: "100%",
  },
  cardPreviewBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  cardPreviewColumn: { flex: 1, minWidth: 0 },
  cardPreviewLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardPreviewValue: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },

  // PayPal / Yape header card
  ppHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  ppTitle: { fontSize: 15, fontWeight: "700" },
  ppSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },

  // Yape hint
  yapeHint: { fontSize: 12, marginTop: 5, lineHeight: 17 },

  // Generic form
  payForm: { gap: 14, width: "100%", maxWidth: "100%" },
  payField: { gap: 6 },
  payLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  payInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderRadius: 10,
    maxWidth: "100%",
    minWidth: 0,
  },
  payInput: { flex: 1, fontSize: 14, padding: 0 },
  payRow: { flexDirection: "row", gap: 12 },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Pay button
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  payBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  payLegal: { fontSize: 11, textAlign: "center", marginTop: 4 },

  // Success
  successBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  successSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  successBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  successBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
