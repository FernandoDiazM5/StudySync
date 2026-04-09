// ============================================
// REGISTER SCREEN - StudySync
// Migración de líneas 139-176 del frontend React
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
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
import { Users, ChevronLeft, CheckCircle, XCircle } from 'lucide-react-native';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);

  const errors = {
    name: !name.trim()
      ? 'El nombre es obligatorio.'
      : name.trim().split(/\s+/).length < 2
      ? 'Ingresa nombre y apellido.'
      : name.trim().length < 3
      ? 'El nombre es muy corto.'
      : null,
    email: !email.trim()
      ? 'El correo es obligatorio.'
      : !EMAIL_REGEX.test(email.trim())
      ? 'Ingresa un correo válido.'
      : null,
    phone: !phone.trim()
      ? 'El celular es obligatorio.'
      : !PHONE_REGEX.test(phone.trim())
      ? 'Ingresa un número válido (7-15 dígitos).'
      : null,
    password: !password
      ? 'La contraseña es obligatoria.'
      : password.length < 8
      ? 'Mínimo 8 caracteres.'
      : !/[A-Z]/.test(password)
      ? 'Debe tener al menos una mayúscula.'
      : !/[0-9]/.test(password)
      ? 'Debe tener al menos un número.'
      : !/[^A-Za-z0-9]/.test(password)
      ? 'Debe tener al menos un carácter especial.'
      : null,
    confirmPassword: !confirmPassword
      ? 'Repite la contraseña.'
      : password !== confirmPassword
      ? 'Las contraseñas no coinciden.'
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
      Alert.alert('Error', result.error);
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft color="#9CA3AF" size={24} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Users color="#FFFFFF" size={32} />
          </View>

          <Text style={styles.title}>Nueva Cuenta</Text>
          <Text style={styles.subtitle}>Únete a tu equipo de trabajo.</Text>

          {/* Formulario */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NOMBRE COMPLETO</Text>
              <TextInput
                style={[styles.input, touched.name && errors.name && styles.inputError]}
                placeholder="Ej. Carlos Mendoza"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                onBlur={() => touch('name')}
              />
              {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
              <TextInput
                style={[styles.input, touched.email && errors.email && styles.inputError]}
                placeholder="tu@uni.edu"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onBlur={() => touch('email')}
              />
              {touched.email && errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>NÚMERO DE CELULAR</Text>
              <TextInput
                style={[styles.input, touched.phone && errors.phone && styles.inputError]}
                placeholder="Ej. 999 999 999"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onBlur={() => touch('phone')}
              />
              {touched.phone && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <TextInput
                style={[styles.input, touched.password && errors.password && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onBlur={() => touch('password')}
              />
              {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>REPETIR CONTRASEÑA</Text>
              <View style={styles.confirmRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.confirmInput,
                    confirmPassword.length > 0 && (
                      password === confirmPassword
                        ? styles.inputMatch
                        : styles.inputNoMatch
                    ),
                    touched.confirmPassword && errors.confirmPassword && !confirmPassword.length && styles.inputError,
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={() => touch('confirmPassword')}
                />
                {confirmPassword.length > 0 && (
                  <View style={styles.matchIcon}>
                    {password === confirmPassword
                      ? <CheckCircle color="#10B981" size={22} />
                      : <XCircle color="#EF4444" size={22} />
                    }
                  </View>
                )}
              </View>
              {touched.confirmPassword && errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!isValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>REGISTRARSE</Text>
              )}
            </TouchableOpacity>
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
  confirmRow: {
    position: 'relative',
  },
  confirmInput: {
    paddingRight: 48,
  },
  inputMatch: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputNoMatch: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  matchIcon: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
