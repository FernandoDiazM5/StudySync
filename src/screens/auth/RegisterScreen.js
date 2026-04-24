// ============================================
// REGISTER SCREEN - StudySync
// Migración de líneas 139-176 del frontend React
// ============================================

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import Text from '../../components/AppText';
import AppButton from '../../components/AppButton';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { Users, ChevronLeft, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react-native';
import { registerUser } from '../../services/authService';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;

export default function RegisterScreen({ navigation }) {
  const { t } = useAccessibility();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);

  const errors = {
    name: !name.trim()
      ? t('nameRequired')
      : name.trim().split(/\s+/).length < 2
      ? t('nameAndLastname')
      : name.trim().length < 3
      ? t('nameTooShort')
      : null,
    email: !email.trim()
      ? t('emailRequired2')
      : !EMAIL_REGEX.test(email.trim())
      ? t('emailInvalid')
      : null,
    phone: !phone.trim()
      ? t('phoneTooShort')
      : !PHONE_REGEX.test(phone.trim())
      ? t('phoneInvalid')
      : null,
    password: !password
      ? t('passwordTooShort')
      : password.length < 8
      ? t('passwordTooShort')
      : !/[A-Z]/.test(password)
      ? t('passwordWeak')
      : !/[0-9]/.test(password)
      ? t('passwordWeak')
      : !/[^A-Za-z0-9]/.test(password)
      ? t('passwordWeak')
      : null,
    confirmPassword: !confirmPassword
      ? t('passwordNoSpace')
      : password !== confirmPassword
      ? t('passwordsDontMatch2')
      : null,
  };

  const isValid = Object.values(errors).every((e) => e === null);

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleRegister = async () => {
    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true });
    if (!isValid) return;

    setLoading(true);
    const result = await registerUser(email.trim(), password, name.trim(), phone.trim());
    setLoading(false);

    if (!result.success) {
      Alert.alert(t('error'), result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Botón Volver */}
          <AppButton
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Volver"
            accessibilityHint="Doble toque para regresar al inicio de sesión"
          >
            <ChevronLeft color="#9CA3AF" size={24} />
          </AppButton>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Users color="#FFFFFF" size={32} />
          </View>

          <Text style={styles.title}>{t('registerTitle')}</Text>
          <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>

          {/* Formulario */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('fullName').toUpperCase()}</Text>
              <TextInput
                style={[styles.input, touched.name && errors.name && styles.inputError]}
                placeholder={t('exampleName')}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                onBlur={() => touch('name')}
                accessibilityLabel="Campo nombre completo"
                accessibilityHint="Ingresa tu nombre y apellido"
              />
              {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('email').toUpperCase()}</Text>
              <TextInput
                style={[styles.input, touched.email && errors.email && styles.inputError]}
                placeholder={t('exampleEmail')}
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onBlur={() => touch('email')}
                accessibilityLabel="Campo correo electrónico"
                accessibilityHint="Ingresa tu dirección de correo electrónico"
              />
              {touched.email && errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('phoneNumber').toUpperCase()}</Text>
              <TextInput
                style={[styles.input, touched.phone && errors.phone && styles.inputError]}
                placeholder={t('examplePhone')}
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onBlur={() => touch('phone')}
                accessibilityLabel="Campo número de teléfono"
                accessibilityHint="Ingresa tu número de teléfono"
              />
              {touched.phone && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('password').toUpperCase()}</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  style={[styles.input, styles.pwdInput, touched.password && errors.password && styles.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => touch('password')}
                  accessibilityLabel="Campo contraseña"
                  accessibilityHint="Ingresa una contraseña segura de al menos 8 caracteres"
                />
                <AppButton
                  style={styles.eyeBtn}
                  onPress={() => setShowPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  overrideText={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff color="#9CA3AF" size={18} /> : <Eye color="#9CA3AF" size={18} />}
                </AppButton>
              </View>
              {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('confirmPassword').toUpperCase()}</Text>
              <View style={[
                styles.confirmRow,
                confirmPassword.length > 0 && (
                  password === confirmPassword ? styles.inputMatch : styles.inputNoMatch
                ),
                touched.confirmPassword && errors.confirmPassword && !confirmPassword.length && styles.inputError,
              ]}>
                <TextInput
                  style={styles.confirmInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPwd}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={() => touch('confirmPassword')}
                  accessibilityLabel="Campo confirmar contraseña"
                  accessibilityHint="Repite la contraseña para confirmarla"
                />
                <View style={styles.confirmIcons}>
                  <AppButton
                    onPress={() => setShowConfirmPwd((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={showConfirmPwd ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                    overrideText={showConfirmPwd ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                  >
                    {showConfirmPwd ? <EyeOff color="#9CA3AF" size={18} /> : <Eye color="#9CA3AF" size={18} />}
                  </AppButton>
                  {confirmPassword.length > 0 && (
                    password === confirmPassword
                      ? <CheckCircle color="#10B981" size={22} />
                      : <XCircle color="#EF4444" size={22} />
                  )}
                </View>
              </View>
              {touched.confirmPassword && errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <AppButton
              style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!isValid || loading}
              activeOpacity={0.8}
              accessibilityLabel="Registrarse"
              accessibilityHint="Doble toque para crear tu cuenta"
              accessibilityState={{ disabled: !isValid || loading }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{t('register').toUpperCase()}</Text>
              )}
            </AppButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 40,
    borderRadius: 20,
    alignItems: 'center',
    ...shadow('rgba(0,0,0,0.1)', 0.1, 12, 4, 8),
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    padding: 4,
  },
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...shadow('rgba(79,70,229,0.3)', 0.3, 8, 4, 6),
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    gap: 16,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  pwdRow: {
    position: 'relative',
  },
  pwdInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
  },
  confirmInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  confirmIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  inputMatch: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputNoMatch: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  button: {
    width: '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    ...shadow('rgba(79,70,229,0.3)', 0.3, 8, 4, 6),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
