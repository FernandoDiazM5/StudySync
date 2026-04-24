// ============================================
// LOGIN SCREEN - StudySync
// Migración de líneas 110-137 del frontend React
// ============================================

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Animated,
} from "react-native";

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
import { BookOpen, Eye, EyeOff } from "lucide-react-native";
import { signIn } from "../../services/authService";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
import { useAccessibility } from "../../contexts/AccessibilityContext";

const LETTERS = "StudySync".split("");
const AnimatedAppText = Animated.createAnimatedComponent(Text);

function WaveText() {
  const anims = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = LETTERS.map((_, i) =>
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.timing(anims[i], {
          toValue: -10,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(anims[i], {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 8,
      }}
    >
      {LETTERS.map((letter, i) => (
        <AnimatedAppText
          key={i}
          style={[styles.title, { transform: [{ translateY: anims[i] }] }]}
        >
          {letter}
        </AnimatedAppText>
      ))}
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { t } = useAccessibility();

  const handleLogin = async () => {
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <BookOpen color="#FFFFFF" size={32} />
        </View>

        <WaveText />
        <Text style={styles.subtitle}>
          Colaboración académica, sin distracciones.
        </Text>

        {/* Banner de error */}
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Formulario */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('email').toUpperCase()}</Text>
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
              accessibilityHint="Ingresa tu correo universitario"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('password').toUpperCase()}</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput]}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Contraseña"
                accessibilityHint="Ingresa tu contraseña"
              />
              <AppButton
                style={styles.eyeBtn}
                overrideText={showPwd ? 'Ocultar Contraseña' : 'Mostrar Contraseña'}
                onPress={() => setShowPwd((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityHint={showPwd ? 'Doble toque para ocultar la contraseña' : 'Doble toque para mostrar la contraseña'}
              >
                {showPwd
                  ? <EyeOff color="#9CA3AF" size={18} />
                  : <Eye color="#9CA3AF" size={18} />}
              </AppButton>
            </View>
          </View>

          <AppButton
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityLabel="Iniciar sesión"
            accessibilityHint="Doble toque para ingresar a tu cuenta"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t('login')}</Text>
            )}
          </AppButton>
        </View>

        <AppButton
          onPress={() => navigation.navigate("Register")}
          style={styles.registerLink}
          accessibilityLabel="Ir a registro"
          accessibilityHint="Doble toque para crear una cuenta nueva"
        >
          <Text style={styles.registerText}>{t('register')}</Text>
        </AppButton>
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
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...shadow("rgba(79,70,229,0.3)", 0.3, 8, 4, 6),
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 32,
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
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  pwdRow: {
    position: "relative",
  },
  pwdInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
  registerLink: {
    marginTop: 24,
    paddingVertical: 8,
  },
  registerText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
});
