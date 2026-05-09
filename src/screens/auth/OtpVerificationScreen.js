// ============================================
// OTP VERIFICATION SCREEN - StudySync
// El usuario ingresa el código de 6 dígitos
// enviado a su correo. Si es válido se crea la cuenta.
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import Text from '../../components/AppText';
import AppButton from '../../components/AppButton';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { ChevronLeft, Mail, RefreshCw, CheckCircle } from 'lucide-react-native';
import { verifyOtp, sendOtp, clearOtp } from '../../services/otpService';
import { registerUser } from '../../services/authService';

const CODE_LENGTH  = 6;
const RESEND_DELAY = 60; // segundos antes de poder reenviar

const shadow = (color, opacity, radius, offsetY, elevation) =>
  Platform.select({
    web    : { boxShadow: `0px ${offsetY}px ${radius}px ${color}` },
    default: {
      shadowColor  : color,
      shadowOffset : { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius : radius,
      elevation,
    },
  });

export default function OtpVerificationScreen({ navigation, route }) {
  const { email, password, name, phone } = route.params;
  const { t } = useAccessibility();

  // ── Estado ────────────────────────────────────────────────
  const [digits, setDigits]         = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]       = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_DELAY);
  const [canResend, setCanResend]   = useState(false);

  // ── Refs para las cajas ───────────────────────────────────
  const inputRefs = useRef(Array.from({ length: CODE_LENGTH }, () => React.createRef()));

  // ── Animaciones ───────────────────────────────────────────
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  // ── Countdown para reenvío ───────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  // ── Efecto shake en error ─────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Efecto pop en éxito ───────────────────────────────────
  const triggerSuccess = useCallback(() => {
    Animated.spring(successAnim, {
      toValue         : 1,
      tension         : 60,
      friction        : 6,
      useNativeDriver : true,
    }).start();
  }, [successAnim]);

  // ── Manejar entrada en cada caja ─────────────────────────
  const handleChangeText = (text, index) => {
    // Solo dígitos
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Avanzar al siguiente
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.current?.focus();
    }

    // Auto-verificar cuando se completan los 6 dígitos
    const code = newDigits.join('');
    if (code.length === CODE_LENGTH && !newDigits.includes('')) {
      handleVerify(code);
    }
  };

  // ── Manejar paste (se pega en la primera caja) ────────────
  const handlePaste = (e, index) => {
    // Solo disponible en web; en RN se maneja via onChangeText
    const pasted = e?.nativeEvent?.text || '';
    const clean  = pasted.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    if (clean.length > 1) {
      const filled = Array(CODE_LENGTH).fill('');
      clean.split('').forEach((c, i) => { filled[i] = c; });
      setDigits(filled);
      inputRefs.current[Math.min(clean.length, CODE_LENGTH - 1)]?.current?.focus();
      if (clean.length === CODE_LENGTH) handleVerify(clean);
    }
  };

  // ── Manejar backspace ────────────────────────────────────
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.current?.focus();
    }
  };

  // ── Verificar código ────────────────────────────────────
  const handleVerify = async (code) => {
    const finalCode = code || digits.join('');
    if (finalCode.length < CODE_LENGTH) {
      setError('Ingresa los 6 dígitos del código.');
      return;
    }

    setVerifying(true);
    setError('');

    const result = await verifyOtp(email, finalCode);

    if (!result.success) {
      setVerifying(false);
      setError(result.error);
      triggerShake();

      if (result.expired) {
        // Limpiar cajas para que el usuario pida un nuevo código
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.current?.focus();
      }
      return;
    }

    // OTP válido → crear cuenta
    setSuccess(true);
    triggerSuccess();

    const regResult = await registerUser(email, password, name, phone);
    setVerifying(false);

    if (!regResult.success) {
      setSuccess(false);
      setError(regResult.error || 'No se pudo crear la cuenta. Intenta de nuevo.');
      triggerShake();
    }
    // Si fue exitoso, AuthContext detectará el nuevo usuario y navegará automáticamente.
  };

  // ── Reenviar código ──────────────────────────────────────
  const handleResend = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    setError('');
    setDigits(Array(CODE_LENGTH).fill(''));

    const result = await sendOtp(email, name);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCanResend(false);
    setResendTimer(RESEND_DELAY);
    inputRefs.current[0]?.current?.focus();
  };

  // ── Formato mm:ss del timer ───────────────────────────────
  const timerLabel = `${String(Math.floor(resendTimer / 60)).padStart(2, '0')}:${String(resendTimer % 60).padStart(2, '0')}`;

  const codeComplete = digits.every((d) => d !== '');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Botón Volver */}
          <AppButton
            onPress={() => {
              clearOtp(email);
              navigation.goBack();
            }}
            style={styles.backButton}
            accessibilityLabel="Volver al registro"
          >
            <ChevronLeft color="#9CA3AF" size={24} />
          </AppButton>

          {/* Ícono */}
          <View style={[styles.iconWrap, success && styles.iconWrapSuccess]}>
            {success
              ? <CheckCircle color="#16A34A" size={36} />
              : <Mail color="#4F46E5" size={36} />
            }
          </View>

          <Text style={styles.title}>
            {success ? '¡Cuenta creada!' : 'Verifica tu correo'}
          </Text>
          <Text style={styles.subtitle}>
            {success
              ? 'Tu cuenta ha sido creada exitosamente.'
              : `Ingresa el código de 6 dígitos que enviamos a`}
          </Text>
          {!success && (
            <Text style={styles.emailLabel} numberOfLines={1}>{email}</Text>
          )}

          {/* Cajas de dígitos */}
          {!success && (
            <>
              <Animated.View
                style={[styles.codeRow, { transform: [{ translateX: shakeAnim }] }]}
              >
                {digits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={inputRefs.current[i]}
                    style={[
                      styles.digitBox,
                      digit        && styles.digitBoxFilled,
                      error        && styles.digitBoxError,
                      success      && styles.digitBoxSuccess,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleChangeText(text, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    onChange={(e) => handlePaste(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                    editable={!verifying && !success}
                    accessibilityLabel={`Dígito ${i + 1} del código`}
                  />
                ))}
              </Animated.View>

              {/* Error */}
              {!!error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* Botón verificar manual */}
              <AppButton
                style={[
                  styles.verifyBtn,
                  (!codeComplete || verifying) && styles.verifyBtnDisabled,
                ]}
                onPress={() => handleVerify()}
                disabled={!codeComplete || verifying}
                activeOpacity={0.8}
                accessibilityLabel="Verificar código"
              >
                {verifying
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.verifyBtnText}>Verificar código</Text>
                }
              </AppButton>

              {/* Reenviar */}
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>¿No recibiste el código? </Text>
                {canResend ? (
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color="#4F46E5" />
                      : (
                        <View style={styles.resendBtn}>
                          <RefreshCw color="#4F46E5" size={13} />
                          <Text style={styles.resendBtnText}>Reenviar</Text>
                        </View>
                      )
                    }
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>Reenviar en {timerLabel}</Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex           : 1,
    backgroundColor: '#EEF2FF',
  },
  scrollContent: {
    flexGrow       : 1,
    justifyContent : 'center',
    alignItems     : 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    width          : '100%',
    maxWidth       : 400,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 40,
    borderRadius   : 20,
    alignItems     : 'center',
    ...shadow('rgba(0,0,0,0.1)', 0.1, 12, 4, 8),
  },
  backButton: {
    position: 'absolute',
    top     : 24,
    left    : 24,
    padding : 4,
  },
  iconWrap: {
    width          : 72,
    height         : 72,
    borderRadius   : 36,
    backgroundColor: '#EEF2FF',
    justifyContent : 'center',
    alignItems     : 'center',
    marginBottom   : 20,
  },
  iconWrapSuccess: {
    backgroundColor: '#F0FDF4',
  },
  title: {
    fontSize  : 22,
    fontWeight: '800',
    color     : '#1F2937',
    marginBottom: 6,
    textAlign : 'center',
  },
  subtitle: {
    fontSize  : 13,
    color     : '#6B7280',
    textAlign : 'center',
    lineHeight: 20,
  },
  emailLabel: {
    fontSize    : 13,
    fontWeight  : '700',
    color       : '#4F46E5',
    marginTop   : 2,
    marginBottom: 28,
    textAlign   : 'center',
    maxWidth    : '90%',
  },
  codeRow: {
    flexDirection: 'row',
    gap          : 10,
    marginBottom : 16,
  },
  digitBox: {
    width          : 44,
    height         : 54,
    borderWidth    : 1.5,
    borderColor    : '#D1D5DB',
    borderRadius   : 12,
    backgroundColor: '#F9FAFB',
    fontSize       : 22,
    fontWeight     : '700',
    color          : '#1F2937',
    textAlign      : 'center',
  },
  digitBoxFilled: {
    borderColor    : '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  digitBoxError: {
    borderColor    : '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  digitBoxSuccess: {
    borderColor    : '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  errorText: {
    fontSize   : 12,
    color      : '#EF4444',
    textAlign  : 'center',
    marginBottom: 12,
    fontWeight : '500',
  },
  verifyBtn: {
    width          : '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius   : 12,
    alignItems     : 'center',
    marginBottom   : 16,
    ...shadow('rgba(79,70,229,0.3)', 0.3, 8, 4, 6),
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color     : '#FFFFFF',
    fontSize  : 14,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems   : 'center',
    flexWrap     : 'wrap',
    justifyContent: 'center',
  },
  resendLabel: {
    fontSize: 13,
    color   : '#6B7280',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems   : 'center',
    gap          : 4,
  },
  resendBtnText: {
    fontSize  : 13,
    fontWeight: '700',
    color     : '#4F46E5',
  },
  timerText: {
    fontSize  : 13,
    fontWeight: '600',
    color     : '#6B7280',
  },
});
