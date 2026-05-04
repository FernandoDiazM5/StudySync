// CREATE TASK SCREEN - StudySync
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, Calendar, Clock, X } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import * as firestoreService from "../../services/firestoreService";

export default function CreateTaskScreen({ route, navigation }) {
  const { groupId, task } = route.params; // task presente = modo edición
  const isEditing = !!task;
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();

  const [title, setTitle]       = useState(task?.title || "");
  const [desc, setDesc]         = useState(task?.description || "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "");

  // ── Fecha ────────────────────────────────────────────────────────────────
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

  const [dueDate, setDueDate]         = useState(toDisplay(task?.dueDate));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Hora (opcional, por defecto 09:00) ───────────────────────────────────
  const DEFAULT_TIME = "09:00";
  const [useTime, setUseTime]         = useState(!!task?.dueTime);
  const [dueTime, setDueTime]         = useState(task?.dueTime || DEFAULT_TIME);
  const [showTimePicker, setShowTimePicker] = useState(false);

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

  // Convierte "HH:MM" (24 h) → "H:MM a.m./p.m."
  const formatTime12h = (t24) => {
    if (!t24) return "";
    const [h, m] = t24.split(":").map(Number);
    const period = h >= 12 ? "p.m." : "a.m.";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };

  // Construye el Date para el picker de hora
  const timePickerValue = () => {
    const [h, m] = dueTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t("error"), t("taskTitleRequired"));
      return;
    }
    if (!assigneeId) {
      Alert.alert(t("error"), t("taskAssignRequired"));
      return;
    }
    if (dueDate && !/^\d{2}-\d{2}-\d{4}$/.test(dueDate)) {
      Alert.alert(t("error"), t("taskDateFormat"));
      return;
    }
    setLoading(true);
    try {
      // Resolver nombre del asignado para mostrarlo inmediatamente en el badge
      // sin necesidad de esperar la carga de miembros en GroupDetailsScreen.
      const assigneeMember = members.find((m) => m.id === assigneeId);
      const payload = {
        title:        title.trim(),
        description:  desc.trim(),
        assigneeId,
        assigneeName: assigneeMember?.name || '',
        dueDate:  toISO(dueDate) || "Sin fecha",
        dueTime:  useTime ? dueTime : null,
      };
      if (isEditing) {
        await firestoreService.updateTask(task.id, payload);
        Alert.alert(t("success"), t("taskUpdated"), [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        await firestoreService.createTask({
          ...payload,
          groupId,
          status:    "Pendiente",
          createdBy: user.uid,
        });
        Alert.alert(t("success"), t("taskCreatedMsg"), [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert(t("error"), e?.message || t("operationError"));
    }
    setLoading(false);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor={theme.card}
      />
      <View
        style={[
          s.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <AppButton
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver"
          accessibilityHint="Doble toque para regresar sin guardar"
        >
          <ChevronLeft color={theme.textSecondary} size={24} />
        </AppButton>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {isEditing ? t("edit") + " " + t("tasks") : t("newTask")}
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
        {/* Título */}
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("taskTitle").toUpperCase()}
          </Text>
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: theme.card,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder={t("exampleTaskTitle")}
            placeholderTextColor={theme.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Descripción */}
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("taskDescription").toUpperCase()} (OPCIONAL)
          </Text>
          <TextInput
            style={[
              s.input,
              {
                minHeight: 80,
                textAlignVertical: "top",
                backgroundColor: theme.card,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder={t("exampleTaskDesc")}
            placeholderTextColor={theme.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
          />
        </View>

        {/* Asignar a */}
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("assignTo").toUpperCase()}
          </Text>
          {members.length === 0 ? (
            <Text style={[s.hint, { color: theme.textMuted }]}>
              {t("noMembersYet")}
            </Text>
          ) : (
            <View style={s.memberList}>
              {members.map((m) => {
                const selected = assigneeId === m.id;
                return (
                  <AppButton
                    key={m.id}
                    style={[
                      s.memberOption,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.inputBorder,
                      },
                      selected && s.memberOptionSelected,
                    ]}
                    onPress={() => setAssigneeId(m.id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Asignar a ${m.name}`}
                    accessibilityHint="Doble toque para asignar esta tarea a este miembro"
                    accessibilityState={{ selected }}
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
                  </AppButton>
                );
              })}
            </View>
          )}
        </View>

        {/* Fecha de vencimiento */}
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("dueDate").toUpperCase()}
          </Text>
          <View style={s.dateRow}>
            <TextInput
              style={[
                s.input,
                {
                  flex: 1,
                  backgroundColor: theme.card,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder="DD-MM-YYYY"
              placeholderTextColor={theme.textMuted}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numeric"
              maxLength={10}
              accessibilityLabel="Fecha de vencimiento"
              accessibilityHint="Ingresa la fecha en formato día guión mes guión año"
            />
            <AppButton
              style={[
                s.calendarBtn,
                {
                  backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF",
                  borderColor: isDark ? "#4F46E5" : "#A5B4FC",
                },
              ]}
              onPress={() => setShowDatePicker(true)}
              accessibilityLabel="Abrir calendario"
              accessibilityHint="Doble toque para seleccionar la fecha con el calendario"
            >
              <Calendar color="#4F46E5" size={20} />
            </AppButton>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={
                toISO(dueDate)
                  ? new Date(toISO(dueDate) + "T00:00:00")
                  : new Date()
              }
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selectedDate) {
                  const y = selectedDate.getFullYear();
                  const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                  const d = String(selectedDate.getDate()).padStart(2, "0");
                  setDueDate(`${d}-${m}-${y}`);
                }
              }}
            />
          )}
        </View>

        {/* ── Hora (opcional) ─────────────────────────────────────────────── */}
        <View>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            HORA (OPCIONAL)
          </Text>

          <View style={s.timeRow}>
            {/* Botón principal: muestra la hora o el placeholder */}
            <TouchableOpacity
              style={[
                s.timeDisplayBtn,
                {
                  backgroundColor: theme.card,
                  borderColor: useTime
                    ? "#4F46E5"
                    : theme.inputBorder,
                },
              ]}
              onPress={() => useTime && setShowTimePicker(true)}
              activeOpacity={useTime ? 0.7 : 1}
              accessibilityLabel={
                useTime
                  ? `Hora establecida: ${formatTime12h(dueTime)}`
                  : "Sin hora específica"
              }
              accessibilityHint={useTime ? "Doble toque para cambiar la hora" : ""}
            >
              <Clock
                color={useTime ? "#4F46E5" : theme.textMuted}
                size={18}
              />
              <Text
                style={[
                  s.timeDisplayText,
                  { color: useTime ? theme.text : theme.textMuted },
                ]}
              >
                {useTime ? formatTime12h(dueTime) : "Sin hora específica"}
              </Text>
            </TouchableOpacity>

            {/* Toggle activar / desactivar hora */}
            {useTime ? (
              /* Quitar hora */
              <TouchableOpacity
                style={[
                  s.timeToggleBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.15)"
                      : "#FEF2F2",
                    borderColor: isDark
                      ? "rgba(239,68,68,0.4)"
                      : "#FECACA",
                  },
                ]}
                onPress={() => {
                  setUseTime(false);
                  setDueTime(DEFAULT_TIME); // resetea el valor
                }}
                accessibilityLabel="Quitar hora"
                accessibilityHint="Doble toque para eliminar la hora específica"
              >
                <X color="#EF4444" size={16} />
              </TouchableOpacity>
            ) : (
              /* Agregar hora */
              <TouchableOpacity
                style={[
                  s.timeToggleBtn,
                  {
                    backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF",
                    borderColor: isDark ? "#4F46E5" : "#A5B4FC",
                  },
                ]}
                onPress={() => setUseTime(true)}
                accessibilityLabel="Agregar hora"
                accessibilityHint="Doble toque para establecer una hora específica"
              >
                <Clock color="#4F46E5" size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* Hint informativo cuando la hora está activa */}
          {useTime && (
            <Text style={[s.timeHint, { color: theme.textMuted }]}>
              Recibirás una notificación el día anterior a esta hora.
            </Text>
          )}

          {showTimePicker && useTime && (
            <DateTimePicker
              value={timePickerValue()}
              mode="time"
              is24Hour={true}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowTimePicker(Platform.OS === "ios");
                if (selectedDate) {
                  const h = String(selectedDate.getHours()).padStart(2, "0");
                  const m = String(selectedDate.getMinutes()).padStart(2, "0");
                  setDueTime(`${h}:${m}`);
                }
              }}
            />
          )}
        </View>

        {/* Botón guardar */}
        <AppButton
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel={isEditing ? "Guardar cambios" : "Crear tarea"}
          accessibilityHint={
            isEditing
              ? "Doble toque para guardar los cambios de la tarea"
              : "Doble toque para crear la nueva tarea"
          }
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={s.btnText}>
              {isEditing ? t("saveChanges") : t("createTask")}
            </Text>
          )}
        </AppButton>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    backgroundColor:    "#FFF",
    paddingHorizontal:  16,
    paddingVertical:    16,
    paddingTop:         48,
    borderBottomWidth:  1,
    borderBottomColor:  "#E5E7EB",
    flexDirection:      "row",
    alignItems:         "center",
    gap:                12,
    elevation:          2,
  },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: "700", color: "#1F2937" },
  form:         { flex: 1 },
  formContent:  { padding: 24, gap: 20 },
  label: {
    fontSize:      11,
    fontWeight:    "700",
    color:         "#4B5563",
    letterSpacing: 0.5,
    marginBottom:  8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   "#FFF",
    borderWidth:       1,
    borderColor:       "#D1D5DB",
    borderRadius:      10,
    fontSize:          14,
    color:             "#1F2937",
  },
  hint: {
    fontSize:    12,
    color:       "#9CA3AF",
    fontStyle:   "italic",
    paddingVertical: 8,
  },
  // ── Fecha ──────────────────────────────────────────────────────────────
  dateRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  calendarBtn: {
    padding:         14,
    backgroundColor: "#EEF2FF",
    borderWidth:     1,
    borderColor:     "#A5B4FC",
    borderRadius:    10,
  },
  // ── Hora ───────────────────────────────────────────────────────────────
  timeRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  timeDisplayBtn: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderWidth:    1,
    borderRadius:   10,
  },
  timeDisplayText: {
    fontSize:   14,
    fontWeight: "500",
  },
  timeToggleBtn: {
    padding:      14,
    borderWidth:  1,
    borderRadius: 10,
    alignItems:   "center",
    justifyContent: "center",
  },
  timeHint: {
    fontSize:   11,
    marginTop:  6,
    fontStyle:  "italic",
    lineHeight: 16,
  },
  // ── Miembros ───────────────────────────────────────────────────────────
  memberList: { gap: 8 },
  memberOption: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor:   "#FFF",
    borderWidth:       1,
    borderColor:       "#D1D5DB",
    borderRadius:      10,
  },
  memberOptionSelected:     { backgroundColor: "#EEF2FF", borderColor: "#4F46E5" },
  memberOptionText:         { fontSize: 14, color: "#374151" },
  memberOptionTextSelected: { fontWeight: "700", color: "#4F46E5" },
  // ── Botón submit ───────────────────────────────────────────────────────
  btn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 18,
    borderRadius:    16,
    alignItems:      "center",
    marginTop:       24,
    elevation:       6,
  },
  btnText: {
    color:         "#FFF",
    fontSize:      15,
    fontWeight:    "700",
    letterSpacing: 0.5,
  },
});
