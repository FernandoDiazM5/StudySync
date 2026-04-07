// PROFILE SCREEN - StudySync (Migración L432-611)
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, StatusBar } from 'react-native';
import { User, ChevronLeft, ChevronRight, Lock, Bell, LogOut, Edit3, Settings, Phone } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { signOut, updatePassword } from '../../services/authService';
import { updateUserProfile } from '../../services/firestoreService';

export default function ProfileScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [subView, setSubView] = useState('main');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Sincronizar estado local cuando cambia userProfile
  useEffect(() => {
    setEditName(userProfile?.name || '');
    setEditPhone(userProfile?.phone || '');
  }, [userProfile]);

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          const result = await signOut();
          if (!result.success) Alert.alert('Error', result.error || 'No se pudo cerrar sesión.');
        }
      }
    ]);
  };

  const handleProfileSubmit = async () => {
    if (!editName.trim()) { Alert.alert('Error', 'El nombre es obligatorio.'); return; }
    try {
      await updateUserProfile(user.uid, { name: editName.trim(), phone: editPhone.trim() });
      await refreshProfile();
      Alert.alert('Éxito', '¡Información actualizada!');
      setSubView('main');
    } catch (e) { Alert.alert('Error', 'No se pudo actualizar.'); }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPwd || !newPwd) { Alert.alert('Error', 'Completa todos los campos.'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('Error', 'Las contraseñas no coinciden.'); return; }
    if (newPwd.length < 6) { Alert.alert('Error', 'Mínimo 6 caracteres.'); return; }
    const result = await updatePassword(currentPwd, newPwd);
    if (result.success) { Alert.alert('Éxito', '¡Contraseña actualizada!'); setSubView('main'); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }
    else { Alert.alert('Error', result.error); }
  };

  // === EDIT PROFILE SUB-VIEW ===
  if (subView === 'editProfile') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => setSubView('main')}><ChevronLeft color="#C7D2FE" size={24} /></TouchableOpacity>
          <Text style={s.subHeaderTitle}>Editar Perfil</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View style={s.formCard}>
            <Text style={s.formDesc}>Actualiza tu nombre y número de celular.</Text>
            <View><Text style={s.label}>NOMBRE COMPLETO</Text><TextInput style={s.input} value={editName} onChangeText={setEditName} /></View>
            <View><Text style={s.label}>NÚMERO DE CELULAR</Text><TextInput style={s.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" /></View>
            <View><Text style={s.label}>CORREO ELECTRÓNICO</Text><TextInput style={[s.input, s.inputDisabled]} value={userProfile?.email || ''} editable={false} /><Text style={s.hint}>El correo no se puede modificar.</Text></View>
            <TouchableOpacity style={s.saveBtn} onPress={handleProfileSubmit}><User color="#FFF" size={16} /><Text style={s.saveBtnText}>Guardar Cambios</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // === PASSWORD SUB-VIEW ===
  if (subView === 'password') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => setSubView('main')}><ChevronLeft color="#C7D2FE" size={24} /></TouchableOpacity>
          <Text style={s.subHeaderTitle}>Cambiar Contraseña</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View style={s.formCard}>
            <Text style={s.formDesc}>Ingresa tu contraseña actual y la nueva.</Text>
            <View><Text style={s.label}>CONTRASEÑA ACTUAL</Text><TextInput style={s.input} secureTextEntry value={currentPwd} onChangeText={setCurrentPwd} placeholder="••••••••" placeholderTextColor="#9CA3AF" /></View>
            <View><Text style={s.label}>NUEVA CONTRASEÑA</Text><TextInput style={s.input} secureTextEntry value={newPwd} onChangeText={setNewPwd} placeholder="••••••••" placeholderTextColor="#9CA3AF" /></View>
            <View><Text style={s.label}>CONFIRMAR NUEVA CONTRASEÑA</Text><TextInput style={s.input} secureTextEntry value={confirmPwd} onChangeText={setConfirmPwd} placeholder="••••••••" placeholderTextColor="#9CA3AF" /></View>
            <TouchableOpacity style={s.saveBtn} onPress={handlePasswordSubmit}><Lock color="#FFF" size={16} /><Text style={s.saveBtnText}>Guardar Contraseña</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // === MAIN PROFILE VIEW ===
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      <View style={s.profileHeader} />
      <ScrollView contentContainerStyle={s.profileContent}>
        {/* Avatar */}
        <View style={s.avatarContainer}>
          <View style={s.avatarCircle}><User color="#4F46E5" size={48} /></View>
          <TouchableOpacity style={s.editAvatarBtn}><Edit3 color="#FFF" size={14} /></TouchableOpacity>
        </View>
        <Text style={s.userName}>{userProfile?.name || 'Usuario'}</Text>
        <Text style={s.userEmail}>{userProfile?.email || ''}</Text>
        {userProfile?.phone ? <View style={s.phoneRow}><Phone color="#6B7280" size={14} /><Text style={s.userPhone}>{userProfile.phone}</Text></View> : null}
        <View style={s.roleBadge}><View style={s.roleDot} /><Text style={s.roleText}>{userProfile?.role || 'Miembro'}</Text></View>

        {/* Settings */}
        <View style={s.settingsCard}>
          <View style={s.settingsHeader}><Settings color="#6B7280" size={16} /><Text style={s.settingsTitle}>AJUSTES DE CUENTA</Text></View>
          <TouchableOpacity style={s.settingsRow} onPress={() => { setEditName(userProfile?.name || ''); setEditPhone(userProfile?.phone || ''); setSubView('editProfile'); }}>
            <View style={s.settingsLeft}><View style={[s.settingsIcon, { backgroundColor: '#EFF6FF' }]}><User color="#2563EB" size={16} /></View><Text style={s.settingsLabel}>Editar información personal</Text></View>
            <ChevronRight color="#9CA3AF" size={16} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.settingsRow} onPress={() => setSubView('password')}>
            <View style={s.settingsLeft}><View style={[s.settingsIcon, { backgroundColor: '#FFF7ED' }]}><Lock color="#EA580C" size={16} /></View><Text style={s.settingsLabel}>Cambiar contraseña</Text></View>
            <ChevronRight color="#9CA3AF" size={16} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.settingsRow} onPress={() => setNotificationsEnabled(prev => !prev)} activeOpacity={0.7}>
            <View style={s.settingsLeft}><View style={[s.settingsIcon, { backgroundColor: '#FAF5FF' }]}><Bell color="#9333EA" size={16} /></View><View><Text style={s.settingsLabel}>Notificaciones push</Text><Text style={s.settingsHint}>Alertas de tareas pendientes</Text></View></View>
            <View style={[s.toggle, !notificationsEnabled && s.toggleOff]}>
              <View style={[s.toggleKnob, !notificationsEnabled && s.toggleKnobOff]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <LogOut color="#DC2626" size={20} /><Text style={s.logoutText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  // Sub-view headers
  subHeader: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  subHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  formContent: { padding: 24 },
  formCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', gap: 16 },
  formDesc: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 6 },
  input: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, fontSize: 14, color: '#1F2937' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  hint: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  saveBtn: { backgroundColor: '#4F46E5', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, elevation: 4 },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  // Main profile
  profileHeader: { backgroundColor: '#4F46E5', height: 128, paddingTop: 48, alignItems: 'center' },
  profileContent: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32, marginTop: -56 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#F9FAFB', elevation: 4 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4F46E5', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  userName: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  userEmail: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  userPhone: { fontSize: 14, color: '#6B7280' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#C7D2FE', marginTop: 12, marginBottom: 24 },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
  roleText: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
  // Settings card
  settingsCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 24 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingsTitle: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 1 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  settingsLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  settingsHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 64 },
  toggle: { width: 40, height: 20, backgroundColor: '#6366F1', borderRadius: 10, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 2 },
  toggleOff: { backgroundColor: '#D1D5DB', alignItems: 'flex-start' },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', elevation: 2 },
  toggleKnobOff: {},
  // Logout
  logoutBtn: { width: '100%', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
