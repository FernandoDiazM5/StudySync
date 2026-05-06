// PROFILE SCREEN - StudySync (Migración L432-611)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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
  Camera,
  Settings,
  Phone,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Accessibility as AccessibilityIcon,
  Crown,
} from "lucide-react-native";
import PlanMenu from "../../components/PlanMenu";
import AccessibilityMenu from "../../components/AccessibilityMenu";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  useAccessibility,
  useMenuOpen,
} from "../../contexts/AccessibilityContext";
import { useFileStorage } from "../../contexts/FileStorageContext";
import { signOut, updatePassword } from "../../services/authService";
import {
  updateUserProfile,
  getUsersByIds,
  syncLeaderPlanToGroups,
  syncLeaderNameToGroups,
} from "../../services/firestoreService";

// Formatea el número al estilo "XXX XXX XXX" (máx. 9 dígitos)
const fmtPhone = (v) => {
  const d = (v || "").replace(/\D/g, "").substring(0, 9);
  if (d.length > 6) return `${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}`;
  if (d.length > 3) return `${d.substring(0, 3)} ${d.substring(3)}`;
  return d;
};

export default function ProfileScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { uploadUserAvatar } = useFileStorage();
  const insets = useSafeAreaInsets();
  const [subView, setSubView] = useState("main");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileNameFromDb, setProfileNameFromDb] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isPlanMenuOpen, setIsPlanMenuOpen] = useState(false);

  // Plan
  const currentPlan = userProfile?.plan || "free";
  const currentBilling = userProfile?.planBilling || "monthly";
  const isPro = currentPlan === "personal";

  const { t } = useAccessibility();

  // Al volver a la pestaña Perfil, refrescar Firestore (p. ej. cambios desde otro dispositivo)
  useFocusEffect(
    useCallback(() => {
      refreshProfile?.();
    }, [refreshProfile]),
  );

  // Nombre fuente de verdad: users/{uid}.name (mismo campo que se guarda en registro)
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUsersByIds([user.uid])
      .then((users) => {
        if (cancelled) return;
        const dbUser = users?.[0];
        setProfileNameFromDb((dbUser?.name || "").trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid, userProfile?.name]);

  const displayRole = useMemo(() => {
    const r = (userProfile?.role || "").trim();
    if (!r) return t("member");
    const lower = r.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower === "miembro" || lower === "member") return t("member");
    if (lower === "lider" || lower === "leader") return t("leader");
    return r;
  }, [userProfile?.role, t]);

  const handleSelectPlan = useCallback(
    async (plan, billing) => {
      try {
        await updateUserProfile(user.uid, { plan, planBilling: billing });
        // Propagar el nuevo plan a todos los grupos que lidera este usuario
        syncLeaderPlanToGroups(user.uid, plan).catch(() => {});
        await refreshProfile();
      } catch (e) {
        Alert.alert(t("error"), t("cannotUpdate"));
      }
    },
    [user?.uid, refreshProfile, t],
  );

  const closePlanMenu = useCallback(() => setIsPlanMenuOpen(false), []);

  const { setIsMenuOpen } = useMenuOpen();

  // Sincronizar estado local cuando cambia userProfile,
  // pero sin pisar lo que el usuario escribe en el formulario de edición.
  useEffect(() => {
    if (subView === "editProfile") return;
    setEditName(userProfile?.name || "");
    setEditPhone(userProfile?.phone || "");
  }, [userProfile, subView]);

  const handleLogout = async () => {
    Alert.alert(t("logout"), t("logoutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logout"),
        style: "destructive",
        onPress: async () => {
          const result = await signOut();
          if (!result.success)
            Alert.alert(t("error"), result.error || t("cannotLogout"));
        },
      },
    ]);
  };

  const handleProfileSubmit = async () => {
    const trimmedName = editName.trim();
    const phoneDigits = (editPhone || "").replace(/\D/g, "");

    if (!trimmedName) {
      Alert.alert(t("error"), t("nameRequired"));
      return;
    }
    if (trimmedName.split(/\s+/).length < 2) {
      Alert.alert(t("error"), t("nameAndLastname"));
      return;
    }
    if (trimmedName.length < 3) {
      Alert.alert(t("error"), t("nameTooShort"));
      return;
    }
    if (!phoneDigits || phoneDigits.length < 9) {
      Alert.alert(t("error"), t("phoneInvalid"));
      return;
    }
    try {
      await updateUserProfile(user.uid, {
        name: trimmedName,
        phone: fmtPhone(editPhone),
      });
      // Propagar el nombre actualizado a los grupos donde este usuario es líder
      syncLeaderNameToGroups(user.uid, trimmedName).catch(() => {});
      await refreshProfile();
      Alert.alert(t("success"), t("infoUpdated"));
      setSubView("main");
    } catch (e) {
      Alert.alert(t("error"), t("cannotUpdate"));
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPwd || !newPwd) {
      Alert.alert(t("error"), t("completeAllFields"));
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert(t("error"), t("passwordsDontMatch2"));
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert(t("error"), t("passwordTooShort"));
      return;
    }
    const result = await updatePassword(currentPwd, newPwd);
    if (result.success) {
      Alert.alert(t("success"), t("passwordUpdated"));
      setSubView("main");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      Alert.alert(t("error"), result.error);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setUploadingAvatar(true);
      const url = await uploadUserAvatar(
        user.uid,
        file.uri,
        file.mimeType || "image/jpeg",
      );
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshProfile();
    } catch (e) {
      Alert.alert(t("error"), t("cannotUpdate"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // === EDIT PROFILE SUB-VIEW ===
  if (subView === "editProfile") {
    return (
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
        <View style={[s.subHeader, { backgroundColor: theme.headerBg }]}>
          <AppButton
            onPress={() => setSubView("main")}
            accessibilityLabel="Volver"
            accessibilityHint="Doble toque para regresar al perfil"
          >
            <ChevronLeft color="#C7D2FE" size={24} />
          </AppButton>
          <Text style={s.subHeaderTitle}>{t("editProfile")}</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View
            style={[
              s.formCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[s.formDesc, { color: theme.textSecondary }]}>
              Actualiza tu nombre y número de celular.
            </Text>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                NOMBRE COMPLETO
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                editable={true}
                selectTextOnFocus
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Nombre completo"
                accessibilityHint="Ingresa tu nombre completo"
              />
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("phoneNumber")}
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={editPhone}
                onChangeText={(v) => setEditPhone(fmtPhone(v))}
                editable={true}
                selectTextOnFocus
                keyboardType="phone-pad"
                maxLength={11}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Número de celular"
                accessibilityHint="Ingresa tu número de teléfono"
              />
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("emailLabel")}
              </Text>
              <TextInput
                style={[
                  s.input,
                  s.inputDisabled,
                  {
                    backgroundColor: isDark ? "#374151" : "#F3F4F6",
                    borderColor: theme.inputBorder,
                    color: theme.textMuted,
                  },
                ]}
                value={userProfile?.email || ""}
                editable={false}
                accessibilityLabel="Correo electrónico"
                accessibilityHint="El correo no se puede modificar"
              />
              <Text style={[s.hint, { color: theme.textMuted }]}>
                {t("emailCannotChange")}
              </Text>
            </View>
            <AppButton
              style={s.saveBtn}
              onPress={handleProfileSubmit}
              accessibilityLabel={t("saveChanges")}
              accessibilityHint={t("saveChangesHint")}
            >
              <User color="#FFF" size={16} />
              <Text style={s.saveBtnText}>{t("saveChanges")}</Text>
            </AppButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
          <Text style={s.subHeaderTitle}>{t("changePassword")}</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View
            style={[
              s.formCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[s.formDesc, { color: theme.textSecondary }]}>
              Ingresa tu contraseña actual y la nueva.
            </Text>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("currentPassword")}
              </Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[
                    s.input,
                    s.pwdInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  secureTextEntry={!showCurrentPwd}
                  value={currentPwd}
                  onChangeText={setCurrentPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("currentPassword")}
                  accessibilityHint={t("enterCurrentPassword")}
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowCurrentPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={
                    showCurrentPwd ? t("hidePassword") : t("showPassword")
                  }
                  accessibilityHint={
                    showCurrentPwd
                      ? t("hidePasswordHint")
                      : t("showPasswordHint")
                  }
                >
                  {showCurrentPwd ? (
                    <EyeOff color={theme.textMuted} size={18} />
                  ) : (
                    <Eye color={theme.textMuted} size={18} />
                  )}
                </AppButton>
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("newPassword")}
              </Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[
                    s.input,
                    s.pwdInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  secureTextEntry={!showNewPwd}
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("newPassword")}
                  accessibilityHint={t("enterNewPassword")}
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowNewPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={
                    showNewPwd ? t("hidePassword") : t("showPassword")
                  }
                  accessibilityHint={
                    showNewPwd ? t("hidePasswordHint") : t("showPasswordHint")
                  }
                >
                  {showNewPwd ? (
                    <EyeOff color={theme.textMuted} size={18} />
                  ) : (
                    <Eye color={theme.textMuted} size={18} />
                  )}
                </AppButton>
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("confirmNewPassword")}
              </Text>
              <View style={s.pwdRow}>
                <TextInput
                  style={[
                    s.input,
                    s.pwdInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  secureTextEntry={!showConfirmPwd}
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("confirmNewPassword")}
                  accessibilityHint={t("confirmNewPasswordHint")}
                />
                <AppButton
                  style={s.eyeBtn}
                  onPress={() => setShowConfirmPwd((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  overrideText={
                    showConfirmPwd ? t("hidePassword") : t("showPassword")
                  }
                  accessibilityHint={
                    showConfirmPwd
                      ? t("hidePasswordHint")
                      : t("showPasswordHint")
                  }
                >
                  {showConfirmPwd ? (
                    <EyeOff color={theme.textMuted} size={18} />
                  ) : (
                    <Eye color={theme.textMuted} size={18} />
                  )}
                </AppButton>
              </View>
            </View>
            <AppButton
              style={s.saveBtn}
              onPress={handlePasswordSubmit}
              accessibilityLabel={t("savePassword")}
              accessibilityHint={t("savePasswordHint")}
            >
              <Lock color="#FFF" size={16} />
              <Text style={s.saveBtnText}>{t("savePassword")}</Text>
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
      <ScrollView
        style={s.profileScroll}
        contentContainerStyle={{
          paddingBottom: Math.max(32, insets.bottom + 32),
        }}
      >
        {/* Header morado — dentro del scroll, se desplaza con el contenido */}
        <View style={[s.profileHeader, { backgroundColor: theme.headerBg }]} />

        <View style={[s.profileContent]}>
          {/* Avatar */}
          <View style={s.avatarContainer}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("changeProfilePhoto")}
              accessibilityHint={t("changeProfilePhotoHint")}
            >
              <View
                style={[
                  s.avatarCircle,
                  {
                    borderColor: theme.bg,
                    backgroundColor: isDark ? "#312E81" : "#EEF2FF",
                  },
                ]}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator color="#4F46E5" size="large" />
                ) : userProfile?.photoURL ? (
                  <Image
                    source={{ uri: userProfile.photoURL }}
                    style={s.avatarImage}
                  />
                ) : (
                  <User color="#4F46E5" size={48} />
                )}
              </View>
            </TouchableOpacity>
            {/* Botón cámara sobre el avatar */}
            <TouchableOpacity
              style={s.editAvatarBtn}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              accessibilityRole="button"
              accessibilityLabel={t("changeProfilePhoto")}
              accessibilityHint={t("changeProfilePhotoHint")}
            >
              <Camera color="#FFF" size={14} />
            </TouchableOpacity>
          </View>
          <Text style={[s.userName, { color: theme.text }]}>
            {profileNameFromDb || userProfile?.name || t("userFallback")}
          </Text>
          <Text style={[s.userEmail, { color: theme.textSecondary }]}>
            {userProfile?.email || ""}
          </Text>
          {userProfile?.phone ? (
            <View style={s.phoneRow}>
              <Phone color={theme.textSecondary} size={14} />
              <Text style={[s.userPhone, { color: theme.textSecondary }]}>
                {userProfile.phone}
              </Text>
            </View>
          ) : null}
          <View style={s.badgesRow}>
            <View
              style={[
                s.roleBadge,
                {
                  backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF",
                  borderColor: isDark ? "#4338CA" : "#C7D2FE",
                },
              ]}
            >
              <View style={s.roleDot} />
              <Text style={s.roleText}>{displayRole}</Text>
            </View>
            <View
              style={[
                s.planBadge,
                isPro
                  ? {
                      backgroundColor: isDark ? "#312E81" : "#EDE9FE",
                      borderColor: isDark ? "#7C3AED" : "#C4B5FD",
                    }
                  : {
                      backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
                      borderColor: isDark ? "#374151" : "#D1D5DB",
                    },
              ]}
            >
              <Crown
                color={isPro ? "#7C3AED" : isDark ? "#6B7280" : "#9CA3AF"}
                size={11}
              />
              <Text
                style={[
                  s.planBadgeText,
                  isPro
                    ? { color: "#7C3AED" }
                    : { color: isDark ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                {isPro
                  ? currentBilling === "annual"
                    ? t("planPersonalAnnual")
                    : t("planPersonalMonthly")
                  : t("planFree")}
              </Text>
            </View>
          </View>

          {/* Settings */}
          <View
            style={[
              s.settingsCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                s.settingsHeader,
                {
                  backgroundColor: isDark ? "#1F2937" : "#FAFAFA",
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              <Settings color={theme.textSecondary} size={16} />
              <Text style={[s.settingsTitle, { color: theme.textSecondary }]}>
                {t("accountSettings")}
              </Text>
            </View>
            <AppButton
              style={s.settingsRow}
              onPress={() => {
                setEditName(userProfile?.name || "");
                setEditPhone(userProfile?.phone || "");
                setSubView("editProfile");
              }}
              accessibilityLabel={t("personalInfo")}
              accessibilityHint={t("updatePersonalInfo")}
            >
              <View style={s.settingsLeft}>
                <View style={[s.settingsIcon, { backgroundColor: "#EFF6FF" }]}>
                  <User color="#2563EB" size={16} />
                </View>
                <Text style={[s.settingsLabel, { color: theme.text }]}>
                  {t("personalInfo")}
                </Text>
              </View>
              <ChevronRight color={theme.textMuted} size={16} />
            </AppButton>
            <View style={[s.divider, { backgroundColor: theme.divider }]} />
            <AppButton
              style={s.settingsRow}
              onPress={() => setSubView("password")}
              accessibilityLabel={t("changePassword")}
              accessibilityHint={t("enterNewPassword")}
            >
              <View style={s.settingsLeft}>
                <View style={[s.settingsIcon, { backgroundColor: "#FFF7ED" }]}>
                  <Lock color="#EA580C" size={16} />
                </View>
                <Text style={[s.settingsLabel, { color: theme.text }]}>
                  {t("changePassword")}
                </Text>
              </View>
              <ChevronRight color={theme.textMuted} size={16} />
            </AppButton>
            <View style={[s.divider, { backgroundColor: theme.divider }]} />
            <AppButton
              style={s.settingsRow}
              onPress={() => setNotificationsEnabled((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityLabel={
                notificationsEnabled
                  ? t("notificationsEnabled")
                  : t("notificationsDisabled")
              }
              accessibilityHint={t("toggleThemeHint")}
              accessibilityState={{ checked: notificationsEnabled }}
            >
              <View style={s.settingsLeft}>
                <View style={[s.settingsIcon, { backgroundColor: "#FAF5FF" }]}>
                  <Bell color="#9333EA" size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.settingsLabel, { color: theme.text }]}>
                    {t("pushNotifications")}
                  </Text>
                  <Text style={s.settingsHint}>{t("taskAlerts")}</Text>
                </View>
              </View>
              <View style={[s.toggle, !notificationsEnabled && s.toggleOff]}>
                <View
                  style={[
                    s.toggleKnob,
                    !notificationsEnabled && s.toggleKnobOff,
                  ]}
                />
              </View>
            </AppButton>
            <View style={[s.divider, { backgroundColor: theme.divider }]} />
            <AppButton
              style={s.settingsRow}
              onPress={toggleTheme}
              activeOpacity={0.7}
              accessibilityLabel={isDark ? t("darkMode") : t("lightMode")}
              accessibilityHint={t("toggleThemeHint")}
              accessibilityState={{ checked: isDark }}
            >
              <View style={s.settingsLeft}>
                <View
                  style={[
                    s.settingsIcon,
                    { backgroundColor: isDark ? "#1E3A5F" : "#F0F9FF" },
                  ]}
                >
                  {isDark ? (
                    <Moon color="#60A5FA" size={16} />
                  ) : (
                    <Sun color="#F59E0B" size={16} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.settingsLabel, { color: theme.text }]}>
                    {t("themeApp")}
                  </Text>
                  <Text style={s.settingsHint}>
                    {isDark ? t("darkMode") : t("lightMode")}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.toggle,
                  !isDark && s.toggleOff,
                  isDark && { backgroundColor: "#60A5FA" },
                ]}
              >
                <View style={[s.toggleKnob, !isDark && s.toggleKnobOff]} />
              </View>
            </AppButton>
            <View style={[s.divider, { backgroundColor: theme.divider }]} />
            <AppButton
              style={s.settingsRow}
              onPress={() => setIsPlanMenuOpen(true)}
              activeOpacity={0.7}
              accessibilityLabel={t("managePlan")}
              accessibilityHint={t("managePlanHint")}
            >
              <View style={s.settingsLeft}>
                <View
                  style={[
                    s.settingsIcon,
                    { backgroundColor: isDark ? "#2E1065" : "#EDE9FE" },
                  ]}
                >
                  <Crown color="#7C3AED" size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.settingsLabel, { color: theme.text }]}>
                    {t("managePlan")}
                  </Text>
                  <Text style={s.settingsHint}>
                    {isPro
                      ? `${t("planPersonal")} · ${currentBilling === "annual" ? t("annual") : t("monthly")}`
                      : t("upgradeSubscription")}
                  </Text>
                </View>
              </View>
              <ChevronRight color={theme.textMuted} size={16} />
            </AppButton>
            <View style={[s.divider, { backgroundColor: theme.divider }]} />
            <AppButton
              style={s.settingsRow}
              onPress={() => setIsMenuOpen(true)}
              activeOpacity={0.7}
              accessibilityLabel={t("accessibilityMenu")}
              accessibilityHint={t("accessibilityMenuHint")}
            >
              <View style={s.settingsLeft}>
                <View
                  style={[
                    s.settingsIcon,
                    { backgroundColor: isDark ? "#14532D" : "#F0FDF4" },
                  ]}
                >
                  <AccessibilityIcon color="#16A34A" size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.settingsLabel, { color: theme.text }]}>
                    {t("accessibilityMenu")}
                  </Text>
                  <Text style={s.settingsHint}>
                    {t("accessibilityMenuDescription")}
                  </Text>
                </View>
              </View>
              <ChevronRight color={theme.textMuted} size={16} />
            </AppButton>
          </View>

          {/* Logout */}
          <AppButton
            style={s.logoutBtn}
            onPress={handleLogout}
            accessibilityLabel={t("logoutSecure")}
            accessibilityHint={t("logoutHint")}
          >
            <LogOut color="#DC2626" size={20} />
            <Text style={s.logoutText}>{t("logoutSecure")}</Text>
          </AppButton>
        </View>
      </ScrollView>

      {/* Sidebars — fuera del ScrollView, acotados entre status bar y tab bar */}
      <PlanMenu
        visible={isPlanMenuOpen}
        onClose={closePlanMenu}
        currentPlan={currentPlan}
        currentBilling={currentBilling}
        onSelectPlan={handleSelectPlan}
      />
      <AccessibilityMenu />
    </View>
  );
}

const s = StyleSheet.create({
  // overflow: hidden evita que sidebars absolutos se dibujen sobre la tab bar
  container: { flex: 1, backgroundColor: "#F9FAFB", overflow: "hidden" },
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
    height: 128,
  },
  profileScroll: {
    flex: 1,
  },
  profileContent: {
    marginTop: -56,
    alignItems: "center",
    paddingHorizontal: 16,
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
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
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
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 24,
    flexWrap: "wrap",
    justifyContent: "center",
  },
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
  },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366F1" },
  roleText: { fontSize: 12, fontWeight: "700", color: "#4338CA" },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
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
  settingsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
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
