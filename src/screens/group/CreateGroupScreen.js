// CREATE GROUP SCREEN - StudySync (Migración L1081-1143)
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { headerPaddingTop } from "../../utils/headerInsets";
import { ChevronLeft, Users } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { createGroup } from "../../services/firestoreService";
import GroupColorPicker from "../../components/GroupColorPicker";
import { GROUP_COLOR_PALETTE } from "../../utils/groupColors";

export default function CreateGroupScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { t } = useAccessibility();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(GROUP_COLOR_PALETTE[0]);
  const [loading, setLoading] = useState(false);

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert(t("error"), t("groupNameRequired"));
      return;
    }
    setLoading(true);
    try {
      await createGroup({
        name: name.trim(),
        desc: desc.trim() || t("defaultGroupDesc"),
        leaderId: user.uid,
        leaderName: userProfile?.name || user.displayName || "Líder",
        members: [user.uid],
        leaderPlan: userProfile?.plan || "free",
        color,
      });
      Alert.alert(t("success"), t("groupCreatedSuccess"), [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error("Error al crear grupo:", e);
      Alert.alert(t("error"), e?.message || t("operationError"));
    }
    setLoading(false);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          s.header,
          {
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
            paddingTop: headerPaddingTop(insets, 16),
          },
        ]}
      >
        <AppButton
          onPress={() => navigation.goBack()}
          accessibilityLabel={t("back")}
          accessibilityHint={t("doubleTapBack")}
        >
          <ChevronLeft color={theme.textSecondary} size={24} />
        </AppButton>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {t("createNewGroup")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.form}>
        <View
          style={[
            s.iconWrap,
            { backgroundColor: color },
          ]}
        >
          <Users color="#FFFFFF" size={32} />
        </View>

        <Text style={[s.subtitle, { color: theme.textSecondary }]}>
          {t("createGroupSubtitle")}
        </Text>

        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("groupName").toUpperCase()}
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
            placeholder={t("exampleGroupName")}
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            accessibilityLabel={t("groupName")}
            accessibilityHint={t("a11yWriteGroupNameHint")}
          />
        </View>

        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("groupDescription").toUpperCase()} {t("optionalParen")}
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
            placeholder={t("exampleGroupDesc")}
            placeholderTextColor={theme.textMuted}
            value={desc}
            onChangeText={setDesc}
            accessibilityLabel={t("groupDescription")}
            accessibilityHint={t("a11yWriteGroupDescHint")}
          />
        </View>

        <GroupColorPicker
          label={t("groupColorLabel")}
          value={color}
          onChange={setColor}
          disabled={loading}
        />

        <AppButton
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleCreateGroup}
          disabled={loading}
          accessibilityLabel={t("createGroup")}
          accessibilityHint={t("a11yCreateGroupHint")}
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={s.btnText}>{t("createGroup")}</Text>
          )}
        </AppButton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  form: { flex: 1, padding: 24, gap: 20 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 14,
  },
  btn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 32,
    elevation: 6,
  },
  btnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
