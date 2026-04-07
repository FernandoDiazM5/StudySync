// CREATE TASK SCREEN - StudySync
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as firestoreService from '../../services/firestoreService';

export default function CreateTaskScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      const group = await firestoreService.getGroup(groupId);
      if (group?.members) {
        const memberData = await firestoreService.getUsersByIds(group.members);
        setMembers(memberData);
        if (memberData.length > 0) setAssigneeId(memberData[0].id);
      }
    };
    loadMembers();
  }, [groupId]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Error', 'El título es obligatorio.'); return; }
    if (!assigneeId) { Alert.alert('Error', 'Debes asignar la tarea a un miembro.'); return; }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert('Error', 'La fecha debe tener el formato YYYY-MM-DD.');
      return;
    }
    setLoading(true);
    try {
      await firestoreService.createTask({ groupId, title: title.trim(), description: desc.trim(), assigneeId, dueDate: dueDate || 'Sin fecha', status: 'Pendiente', createdBy: user.uid });
      Alert.alert('Éxito', 'Tarea creada', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      console.error('Error al crear tarea:', e);
      Alert.alert('Error', e?.message || 'No se pudo crear la tarea.');
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ChevronLeft color="#6B7280" size={24} /></TouchableOpacity>
        <Text style={s.headerTitle}>Nueva Tarea</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={s.form} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
        <View><Text style={s.label}>TÍTULO DE LA TAREA</Text><TextInput style={s.input} placeholder="Ej: Marco teórico" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} /></View>
        <View><Text style={s.label}>DESCRIPCIÓN (OPCIONAL)</Text><TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Describe la tarea..." placeholderTextColor="#9CA3AF" value={desc} onChangeText={setDesc} multiline /></View>
        <View>
          <Text style={s.label}>ASIGNAR A</Text>
          {members.length === 0 ? (
            <Text style={s.hint}>No hay miembros en este grupo.</Text>
          ) : (
            <View style={s.memberList}>
              {members.map(m => {
                const selected = assigneeId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.memberOption, selected && s.memberOptionSelected]}
                    onPress={() => setAssigneeId(m.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.memberOptionText, selected && s.memberOptionTextSelected]}>
                      {m.name}
                    </Text>
                    {selected && <Check color="#4F46E5" size={18} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <View><Text style={s.label}>FECHA LÍMITE (YYYY-MM-DD)</Text><TextInput style={s.input} placeholder="2025-12-31" placeholderTextColor="#9CA3AF" value={dueDate} onChangeText={setDueDate} /></View>
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleCreate} disabled={loading}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>CREAR TAREA</Text>}</TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F2937' },
  form: { flex: 1 },
  formContent: { padding: 24, gap: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#4B5563', letterSpacing: 0.5, marginBottom: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, fontSize: 14, color: '#1F2937' },
  hint: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 8 },
  memberList: { gap: 8 },
  memberOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10 },
  memberOptionSelected: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  memberOptionText: { fontSize: 14, color: '#374151' },
  memberOptionTextSelected: { fontWeight: '700', color: '#4F46E5' },
  btn: { backgroundColor: '#4F46E5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 24, elevation: 6 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
