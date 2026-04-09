// CREATE TASK SCREEN - StudySync
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, Calendar } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import * as firestoreService from "../../services/firestoreService";

export default function CreateTaskScreen({ route, navigation }) {
  const { groupId, task } = route.params; // task presente = modo edición
  const isEditing = !!task;
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "");
  // dueDate en pantalla: DD-MM-YYYY — se convierte a YYYY-MM-DD al guardar
  const toDisplay = (iso) => {
    if (!iso || iso === "Sin fecha") return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };
  const toISO = (display) => {
    if (!display || !/^\d{2}-\d{2}-\d{4}$/.test(display)) return null;
    const [d, m, y] = display.split("-");
    return `${y}-${m}-${d}`;
  };

  const [dueDate, setDueDate] = useState(toDisplay(task?.dueDate));
  const [showPicker, setShowPicker] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      const group = await firestoreService.getGroup(groupId);
      if (group?.members) {
        const memberData = await firestoreService.getUsersByIds(group.members);
        setMembers(memberData);
        if (!isEditing && memberData.length > 0)
          setAssigneeId(memberData[0].id);
      }
    };
    loadMembers();
  }, [groupId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "El título es obligatorio.");
      return;
    }
    if (!assigneeId) {
      Alert.alert("Error", "Debes asignar la tarea a un miembro.");
      return;
    }
    if (dueDate && !/^\d{2}-\d{2}-\d{4}$/.test(dueDate)) {
      Alert.alert("Error", "La fecha debe tener el formato DD-MM-YYYY.");
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await firestoreService.updateTask(task.id, {
          title: title.trim(),
          description: desc.trim(),
          assigneeId,
          dueDate: toISO(dueDate) || "Sin fecha",
        });
        Alert.alert("Éxito", "Tarea actualizada", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        await firestoreService.createTask({
          groupId,
          title: title.trim(),
          description: desc.trim(),
          assigneeId,
          dueDate: toISO(dueDate) || "Sin fecha",
          status: "Pendiente",
          createdBy: user.uid,
        });
        Alert.alert("Éxito", "Tarea creada", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo guardar la tarea.");
    }
    setLoading(false);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.card} />
      <View style={[s.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {isEditing ? "Editar Tarea" : "Nueva Tarea"}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        style={s.form}
        contentContainerStyle={[
          s.formContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>TÍTULO DE LA TAREA</Text>
          <TextInput
            style={[s.input, { backgroundColor: theme.card, borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="Ej: Marco teórico"
            placeholderTextColor={theme.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>DESCRIPCIÓN (OPCIONAL)</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: "top", backgroundColor: theme.card, borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="Describe la tarea..."
            placeholderTextColor={theme.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
          />
        </View>
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>ASIGNAR A</Text>
          {members.length === 0 ? (
            <Text style={[s.hint, { color: theme.textMuted }]}>No hay miembros en este grupo.</Text>
          ) : (
            <View style={s.memberList}>
              {members.map((m) => {
                const selected = assigneeId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.memberOption, { backgroundColor: theme.card, borderColor: theme.inputBorder }, selected && s.memberOptionSelected]}
                    onPress={() => setAssigneeId(m.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        s.memberOptionText,
                        { color: theme.text },
                        selected && s.memberOptionTextSelected,
                      ]}
                    >
                      {m.name}
                    </Text>
                    {selected && <Check color="#4F46E5" size={18} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>FECHA LÍMITE</Text>
          <View style={s.dateRow}>
            <TextInput
              style={[s.input, { flex: 1, backgroundColor: theme.card, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="DD-MM-YYYY"
              placeholderTextColor={theme.textMuted}
              value={dueDate}
              onChangeText={(text) => {
                setDueDate(text);
              }}
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity
              style={[s.calendarBtn, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: isDark ? "#4F46E5" : "#A5B4FC" }]}
              onPress={() => setShowPicker(true)}
            >
              <Calendar color="#4F46E5" size={20} />
            </TouchableOpacity>
          </View>
          {showPicker && (
            <DateTimePicker
              value={
                toISO(dueDate)
                  ? new Date(toISO(dueDate) + "T00:00:00")
                  : new Date()
              }
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(event, selectedDate) => {
                setShowPicker(Platform.OS === "ios");
                if (selectedDate) {
                  const y = selectedDate.getFullYear();
                  const m = String(selectedDate.getMonth() + 1).padStart(
                    2,
                    "0",
                  );
                  const d = String(selectedDate.getDate()).padStart(2, "0");
                  setDueDate(`${d}-${m}-${y}`);
                }
              }}
            />
          )}
        </View>
        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={s.btnText}>
              {isEditing ? "Guardar Cambios" : "Crear Tarea"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  form: { flex: 1 },
  formContent: { padding: 24, gap: 20 },
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
  hint: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calendarBtn: {
    padding: 14,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#A5B4FC",
    borderRadius: 10,
  },
  memberList: { gap: 8 },
  memberOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
  },
  memberOptionSelected: { backgroundColor: "#EEF2FF", borderColor: "#4F46E5" },
  memberOptionText: { fontSize: 14, color: "#374151" },
  memberOptionTextSelected: { fontWeight: "700", color: "#4F46E5" },
  btn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    elevation: 6,
  },
  btnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
