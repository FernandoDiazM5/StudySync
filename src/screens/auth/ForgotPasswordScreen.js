// ============================================
// FORGOT PASSWORD SCREEN - StudySync
// ============================================

import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import LogoApp from "../../../assets/logo_app.svg";

const shadow = (color, opacity, radius, offsetY, elevation) =>
  Platform.select({
    web: { boxShadow: `0px ${offsetY}px ${radius}px ${color}` },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation,
    },
  });

import { Mail, CheckCircle, ArrowLeft } from "lucide-react-native";
import { sendPasswordReset } from "../../services/authService";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
import { useAccessibility } from "../../contexts/AccessibilityContext";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sent, setSent] = useState(false);
  const { t } = useAccessibility();

  const handleReset = async () => {
    setErrorMsg("");

    if (!email.trim()) {
      setErrorMsg(t("emailRequired"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg(t("emailInvalid"));
      return;
    }

    setLoading(true);
    const result = await sendPasswordReset(email.trim());
    setLoading(false);

    if (result.success) {
      setSent(true);
    } else {
      setErrorMsg(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        {/* Logo */}
        <LogoApp width={100} height={100} style={styles.logoImage} />

        {sent ? (
          /* ── Estado éxito ── */
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <CheckCircle color="#10B981" size={48} />
            </View>
            <Text style={styles.title}>{t("resetEmailSent")}</Text>
            <Text style={styles.successMsg}>{t("resetEmailSentMsg")}</Text>
            <AppButton
              style={styles.button}
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.8}
              accessibilityLabel={t("backToLogin")}
              accessibilityHint="Doble toque para volver al inicio de sesión"
            >
              <Text style={styles.buttonText}>{t("backToLogin")}</Text>
            </AppButton>
          </View>
        ) : (
          /* ── Formulario ── */
          <>
            <Text style={styles.title}>{t("resetPasswordTitle")}</Text>
            <Text style={styles.subtitle}>{t("resetPasswordSubtitle")}</Text>

            {/* Banner de error */}
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("email").toUpperCase()}</Text>
                <View style={styles.inputWrapper}>
                  <Mail
                    color="#9CA3AF"
                    size={16}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="tu@uni.edu"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    accessibilityLabel="Correo electrónico"
                    accessibilityHint="Ingresa el correo asociado a tu cuenta"
                  />
                </View>
              </View>

              <AppButton
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityLabel={t("send")}
                accessibilityHint="Doble toque para enviar el correo de recuperación"
                accessibilityState={{ disabled: loading }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t("send")}</Text>
                )}
              </AppButton>
            </View>

            <AppButton
              onPress={() => navigation.goBack()}
              style={styles.backLink}
              accessibilityLabel={t("back")}
              accessibilityHint="Doble toque para volver al inicio de sesión"
            >
              <ArrowLeft color="#6B7280" size={14} />
              <Text style={styles.backText}>{t("backToLogin")}</Text>
            </AppButton>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingVertical: 40,
    borderRadius: 20,
    alignItems: "center",
    ...shadow("rgba(0,0,0,0.1)", 0.1, 12, 4, 8),
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  errorBanner: {
    width: "100%",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: "600",
    textAlign: "center",
  },
  form: {
    width: "100%",
    gap: 16,
  },
  inputGroup: {
    width: "100%",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: "#1F2937",
  },
  button: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    ...shadow("rgba(79,70,229,0.3)", 0.3, 8, 4, 6),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  // ── Estado éxito ──
  successContainer: {
    width: "100%",
    alignItems: "center",
  },
  successIcon: {
    marginBottom: 16,
  },
  successMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
});
