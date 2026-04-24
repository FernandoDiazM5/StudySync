// PROFILE SCREEN - StudySync (Migración L432-611)
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
} from "react-native";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  User,
  ChevronLeft,
  ChevronRight,
  Lock,
  Bell,
  LogOut,
  Edit3,
  Settings,
  Phone,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Accessibility as AccessibilityIcon,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { signOut, updatePassword } from "../../services/authService";
import { updateUserProfile } from "../../services/firestoreService";

export default function ProfileScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [subView, setSubView] = useState("main");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Accesibilidad
  const { setIsMenuOpen, t } = useAccessibility();

  // Sincronizar estado local cuando cambia userProfile
  useEffect(() => {
    setEditName(userProfile?.name || "");
    setEditPhone(userProfile?.phone || "");
  }, [userProfile]);

  const handleLogout = async () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar Sesión",
        style: "destructive",
        onPress: async () => {
          const result = await signOut();
          if (!result.success)
            Alert.alert("Error", result.error || "No se pudo cerrar sesión.");
        },
      },
    ]);
  };

  const handleProfileSubmit = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "El nombre es obligatorio.");
      return;
    }
    try {
      await updateUserProfile(user.uid, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      await refreshProfile();
      Alert.alert("Éxito", "¡Información actualizada!");
      setSubView("main");
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar.");
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPwd || !newPwd) {
      Alert.alert("Error", "Completa todos los campos.");
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert("Error", "Mínimo 6 caracteres.");
      return;
    }
    const result = await updatePassword(currentPwd, newPwd);
    if (result.success) {
      Alert.alert("Éxito", "¡Contraseña actualizada!");
      setSubView("main");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      Alert.alert("Error", result.error);
    }
  };

  // === EDIT PROFILE SUB-VIEW ===
  if (subView === "editProfile") {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
        <View style={[s.subHeader, { backgroundColor: theme.headerBg }]}>
          <AppButton
            onPress={() => setSubView("main")}
            accessibilityLabel="Volver"
            accessibilityHint="Doble toque para regresar al perfil"
          >
            <ChevronLeft color="#C7D2FE" size={24} />
          </AppButton>
          <Text style={s.subHeaderTitle}>{t('editProfile')}</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View style={[s.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.formDesc, { color: theme.textSecondary }]}>
              Actualiza tu nombre y número de celular.
            </Text>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>NOMBRE COMPLETO</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Nombre completo"
                accessibilityHint="Ingresa tu nombre completo"
              />
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>NÚMERO DE CELULAR</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Número de celular"
                accessibilityHint="Ingresa tu número de teléfono"
              />
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>CORREO ELECTRÓNICO</Text>
              <TextInput
                style={[s.input, s.inputDisabled, { backgroundColor: isDark ? "#374151" : "#F3F4F6", borderColor: theme.inputBorder, color: theme.textMuted }]}
                value={userProfile?.email || ""}
                editable={false}
                accessibilityLabel="Correo electrónico"
                accessibilityHint="El correo no se puede modificar"
              />
              <Text style={[s.hint, { color: theme.textMuted }]}>El correo no se puede modificar.</Text>
            </View>
            <AppButton
              style={s.saveBtn}
              onPress={handleProfileSubmit}
              accessibilityLabel="Guardar cambios"
              accessibilityHint="Doble toque para guardar tu información"
            >
              <User color="#FFF" size={16} />
              <Text style={s.saveBtnText}>Guardar Cambios</Text>
            </AppButton>
          </View>
        </ScrollView>
      </View>
    );
  }

  // === PASSWORD SUB-VIEW ===
  if (subView === "password") {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
        <View style={[s.subHeader, { backgroundColor: theme.headerBg }]}>
          <AppButton
            onPress={() => setSubView("main")}
            accessibilityLabel="Volver"
            accessibilityHint="Doble toque para regresar al perfil"
          >
            <ChevronLeft color="#C7D2FE" size={24} />
          </AppButton>
          <Text style={s.subHeaderTitle}>{t('changePassword')}</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View style={[s.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.formDesc, { color: theme.textSecondary }]}>
              Ingresa tu contraseña actual y la nueva.
            </Text>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>CONTRASEÑA ACTUAL</Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[s.input, s.pwdInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                  secureTextEntry={!showCurrentPwd}
                  value={currentPwd}
                  onChangeText={setCurrentPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Contraseña actual"
                  accessibilityHint="Ingresa tu contraseña actual"
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowCurrentPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={showCurrentPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  accessibilityHint={showCurrentPwd ? 'Doble toque para ocultar la contraseña' : 'Doble toque para mostrar la contraseña'}
                >
                  {showCurrentPwd ? <EyeOff color={theme.textMuted} size={18} /> : <Eye color={theme.textMuted} size={18} />}
                </AppButton>
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>NUEVA CONTRASEÑA</Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[s.input, s.pwdInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                  secureTextEntry={!showNewPwd}
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Nueva contraseña"
                  accessibilityHint="Ingresa tu nueva contraseña"
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowNewPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={showNewPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  accessibilityHint={showNewPwd ? 'Doble toque para ocultar la contraseña' : 'Doble toque para mostrar la contraseña'}
                >
                  {showNewPwd ? <EyeOff color={theme.textMuted} size={18} /> : <Eye color={theme.textMuted} size={18} />}
                </AppButton>
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>CONFIRMAR NUEVA CONTRASEÑA</Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[s.input, s.pwdInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                  secureTextEntry={!showConfirmPwd}
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Confirmar nueva contraseña"
                  accessibilityHint="Repite tu nueva contraseña para confirmar"
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowConfirmPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={showConfirmPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  accessibilityHint={showConfirmPwd ? 'Doble toque para ocultar la contraseña' : 'Doble toque para mostrar la contraseña'}
                >
                  {showConfirmPwd ? <EyeOff color={theme.textMuted} size={18} /> : <Eye color={theme.textMuted} size={18} />}
                </AppButton>
              </View>
            </View>
            <AppButton
              style={s.saveBtn}
              onPress={handlePasswordSubmit}
              accessibilityLabel="Guardar contraseña"
              accessibilityHint="Doble toque para actualizar tu contraseña"
            >
              <Lock color="#FFF" size={16} />
              <Text style={s.saveBtnText}>Guardar Contraseña</Text>
            </AppButton>
          </View>
        </ScrollView>
      </View>
    );
  }

  // === MAIN PROFILE VIEW ===
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
      <View style={[s.profileHeader, { backgroundColor: theme.headerBg }]} />
      <ScrollView
        style={s.profileScroll}
        contentContainerStyle={[
          s.profileContent,
          { paddingBottom: Math.max(32, insets.bottom + 32) },
        ]}
      >
        {/* Avatar */}
        <View style={s.avatarContainer}>
          <View style={[s.avatarCircle, { borderColor: theme.bg, backgroundColor: isDark ? "#312E81" : "#EEF2FF" }]}>
            <User color="#4F46E5" size={48} />
          </View>
          <AppButton
            style={s.editAvatarBtn}
            onPress={() => {
              setEditName(userProfile?.name || "");
              setEditPhone(userProfile?.phone || "");
              setSubView("editProfile");
            }}
            accessibilityLabel="Editar perfil"
            accessibilityHint="Doble toque para editar tu información personal"
          >
            <Edit3 color="#FFF" size={14} />
          </AppButton>
        </View>
        <Text style={[s.userName, { color: theme.text }]}>{userProfile?.name || "Usuario"}</Text>
        <Text style={[s.userEmail, { color: theme.textSecondary }]}>{userProfile?.email || ""}</Text>
        {userProfile?.phone ? (
          <View style={s.phoneRow}>
            <Phone color={theme.textSecondary} size={14} />
            <Text style={[s.userPhone, { color: theme.textSecondary }]}>{userProfile.phone}</Text>
          </View>
        ) : null}
        <View style={[s.roleBadge, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: isDark ? "#4338CA" : "#C7D2FE" }]}>
          <View style={s.roleDot} />
          <Text style={s.roleText}>{userProfile?.role || "Miembro"}</Text>
        </View>

        {/* Settings */}
        <View style={[s.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[s.settingsHeader, { backgroundColor: isDark ? "#1F2937" : "#FAFAFA", borderBottomColor: theme.divider }]}>
            <Settings color={theme.textSecondary} size={16} />
            <Text style={[s.settingsTitle, { color: theme.textSecondary }]}>{t('accountSettings')}</Text>
          </View>
          <AppButton
            style={s.settingsRow}
            onPress={() => {
              setEditName(userProfile?.name || "");
              setEditPhone(userProfile?.phone || "");
              setSubView("editProfile");
            }}
            accessibilityLabel="Información personal"
            accessibilityHint="Doble toque para editar tu nombre y teléfono"
          >
            <View style={s.settingsLeft}>
              <View style={[s.settingsIcon, { backgroundColor: "#EFF6FF" }]}>
                <User color="#2563EB" size={16} />
              </View>
              <Text style={[s.settingsLabel, { color: theme.text }]}>{t('personalInfo')}</Text>
            </View>
            <ChevronRight color={theme.textMuted} size={16} />
          </AppButton>
          <View style={[s.divider, { backgroundColor: theme.divider }]} />
          <AppButton
            style={s.settingsRow}
            onPress={() => setSubView("password")}
            accessibilityLabel="Cambiar contraseña"
            accessibilityHint="Doble toque para actualizar tu contraseña"
          >
            <View style={s.settingsLeft}>
              <View style={[s.settingsIcon, { backgroundColor: "#FFF7ED" }]}>
                <Lock color="#EA580C" size={16} />
              </View>
              <Text style={[s.settingsLabel, { color: theme.text }]}>{t('changePassword')}</Text>
            </View>
            <ChevronRight color={theme.textMuted} size={16} />
          </AppButton>
          <View style={[s.divider, { backgroundColor: theme.divider }]} />
          <AppButton
            style={s.settingsRow}
            onPress={() => setNotificationsEnabled((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityLabel={notificationsEnabled ? "Notificaciones activadas" : "Notificaciones desactivadas"}
            accessibilityHint="Doble toque para cambiar"
            accessibilityState={{ checked: notificationsEnabled }}
          >
            <View style={s.settingsLeft}>
              <View style={[s.settingsIcon, { backgroundColor: "#FAF5FF" }]}>
                <Bell color="#9333EA" size={16} />
              </View>
              <View>
                <Text style={[s.settingsLabel, { color: theme.text }]}>{t('pushNotifications')}</Text>
                <Text style={s.settingsHint}>Alertas de tareas pendientes</Text>
              </View>
            </View>
            <View style={[s.toggle, !notificationsEnabled && s.toggleOff]}>
              <View
                style={[s.toggleKnob, !notificationsEnabled && s.toggleKnobOff]}
              />
            </View>
          </AppButton>
          <View style={[s.divider, { backgroundColor: theme.divider }]} />
          <AppButton
            style={s.settingsRow}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel={isDark ? "Modo oscuro activado" : "Modo claro activado"}
            accessibilityHint="Doble toque para cambiar el tema"
            accessibilityState={{ checked: isDark }}
          >
            <View style={s.settingsLeft}>
              <View style={[s.settingsIcon, { backgroundColor: isDark ? "#1E3A5F" : "#F0F9FF" }]}>
                {isDark ? <Moon color="#60A5FA" size={16} /> : <Sun color="#F59E0B" size={16} />}
              </View>
              <View>
                <Text style={[s.settingsLabel, { color: theme.text }]}>{t('themeApp')}</Text>
                <Text style={s.settingsHint}>{isDark ? "Modo oscuro activo" : "Modo claro activo"}</Text>
              </View>
            </View>
            <View style={[s.toggle, !isDark && s.toggleOff, isDark && { backgroundColor: "#60A5FA" }]}>
              <View style={[s.toggleKnob, !isDark && s.toggleKnobOff]} />
            </View>
          </AppButton>
          <View style={[s.divider, { backgroundColor: theme.divider }]} />
          <AppButton
            style={s.settingsRow}
            onPress={() => setIsMenuOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Menú de accesibilidad"
            accessibilityHint="Doble toque para abrir opciones de accesibilidad"
          >
            <View style={s.settingsLeft}>
              <View style={[s.settingsIcon, { backgroundColor: isDark ? "#14532D" : "#F0FDF4" }]}>
                <AccessibilityIcon color="#16A34A" size={16} />
              </View>
              <View>
                <Text style={[s.settingsLabel, { color: theme.text }]}>Menú de Accesibilidad</Text>
                <Text style={s.settingsHint}>Tamaño de texto, contrastes y dislexia</Text>
              </View>
            </View>
            <ChevronRight color={theme.textMuted} size={16} />
          </AppButton>
        </View>

        {/* Logout */}
        <AppButton
          style={s.logoutBtn}
          onPress={handleLogout}
          accessibilityLabel="Cerrar sesión"
          accessibilityHint="Doble toque para salir de tu cuenta"
        >
          <LogOut color="#DC2626" size={20} />
          <Text style={s.logoutText}>{t('logoutSecure')}</Text>
        </AppButton>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  // Sub-view headers
  subHeader: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  formContent: { padding: 24 },
  formCard: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 16,
  },
  formDesc: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
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
  inputDisabled: { backgroundColor: "#F3F4F6", color: "#9CA3AF" },
  hint: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  saveBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    elevation: 4,
  },
  saveBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  // Main profile
  profileHeader: {
    backgroundColor: "#4F46E5",
    minHeight: 128,
    paddingTop: 48,
    alignItems: "center",
  },
  profileScroll: {
    marginTop: -56,
  },
  profileContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 0,
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#F9FAFB",
    elevation: 4,
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#4F46E5",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  userName: { fontSize: 24, fontWeight: "800", color: "#1F2937" },
  userEmail: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  userPhone: { fontSize: 14, color: "#6B7280" },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginTop: 12,
    marginBottom: 24,
  },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366F1" },
  roleText: { fontSize: 12, fontWeight: "700", color: "#4338CA" },
  // Settings card
  settingsCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 24,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingsTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  settingsHint: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 64 },
  toggle: {
    width: 40,
    height: 20,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 2,
  },
  toggleOff: { backgroundColor: "#D1D5DB", alignItems: "flex-start" },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    elevation: 2,
  },
  toggleKnobOff: {},
  // Logout
  logoutBtn: {
    width: "100%",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
});
