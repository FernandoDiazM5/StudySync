// CREATE GROUP SCREEN - StudySync (Migración L1081-1143)
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import Text from "../../components/AppText";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { ChevronLeft, Users } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { createGroup } from "../../services/firestoreService";

export default function CreateGroupScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useAccessibility();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('groupNameRequired'));
      return;
    }
    setLoading(true);
    try {
      await createGroup({
        name: name.trim(),
        desc: desc.trim() || t('defaultGroupDesc'),
        leaderId: user.uid,
        members: [user.uid],
      });
      Alert.alert(t('success'), t('groupCreatedSuccess'), [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error("Error al crear grupo:", e);
      Alert.alert(t('error'), e?.message || t('operationError'));
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#6B7280" size={24} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('createNewGroup')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.form}>
        <View style={s.iconWrap}>
          <Users color="#4F46E5" size={32} />
        </View>
        <Text style={s.subtitle}>
          {t('groupDescription') || 'Crea un nuevo espacio de trabajo para tu materia o proyecto.'}
        </Text>
        <View>
          <Text style={s.label}>{t('groupName').toUpperCase()}</Text>
          <TextInput
            style={s.input}
            placeholder={t('exampleGroupName')}
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View>
          <Text style={s.label}>{t('groupDescription').toUpperCase()} (OPCIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder={t('exampleGroupDesc')}
            placeholderTextColor="#9CA3AF"
            value={desc}
            onChangeText={setDesc}
          />
        </View>
        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleCreateGroup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={s.btnText}>{t('createGroup')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#1F2937" },
  form: { flex: 1, padding: 24, gap: 20 },
  iconWrap: {
    width: 64,
    height: 64,
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    fontSize: 14,
    color: "#1F2937",
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
