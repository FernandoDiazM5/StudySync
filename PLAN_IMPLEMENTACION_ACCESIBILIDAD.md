# Plan de Implementación - Accesibilidad Global en StudySync

**Objetivo:** Llevar accesibilidad del 22% al 100%  
**Prioridad:** CRÍTICA  
**Tiempo Estimado:** 3-4 días de desarrollo

---

## FASE 1: PREPARACIÓN (30 minutos)

### Paso 1.1: Instalar OpenDyslexic y expo-font

```bash
cd /ruta/a/StudySync

# Instalar dependencias
expo install expo-font expo-splash-screen

# Descargar OpenDyslexic
# Opción A: Descargar manualmente desde https://opendyslexic.org/
# Opción B: Usar npm
npm install @fonts/opendyslexic

# Crear carpeta de assets
mkdir -p src/assets/fonts

# Copiar archivo OpenDyslexic.ttf a src/assets/fonts/
```

### Paso 1.2: Expandir Diccionario de Traducciones

**Crear archivo:** `src/locales/translations.js`

```javascript
// src/locales/translations.js

export const TRANSLATIONS = {
  es: {
    // Accesibilidad (existentes)
    language: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    quechua: 'Quechua',
    profile: 'Perfil',
    textSize: 'Tamaño de texto',
    contrasts: 'Contrastes',
    dyslexiaFriendly: 'Dislexia amigable',
    lineSpacing: 'Interlineado',
    narrator: 'Narrador',
    reset: 'Restablecer',
    accessibilityMenu: 'Menú de accesibilidad',

    // NUEVOS - Pantalla Login
    login: 'Iniciar Sesión',
    register: 'Registrarse',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    noAccount: '¿No tienes cuenta?',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    loginError: 'Error al iniciar sesión',
    emailRequired: 'El correo es obligatorio',
    passwordRequired: 'La contraseña es obligatoria',

    // NUEVOS - Pantalla Grupos
    groups: 'Grupos',
    searchGroup: 'Buscar grupo...',
    pendingInvitations: 'Invitaciones pendientes',
    noGroupsYet: 'No perteneces a ningún grupo aún',
    workProgress: 'Progreso del trabajo',
    createGroup: 'Crear grupo',
    joinGroup: 'Unirse al grupo',
    viewGroup: 'Ver grupo',
    groupMembers: 'Miembros del grupo',
    groupTasks: 'Tareas del grupo',

    // NUEVOS - Pantalla Mensajes
    messages: 'Mensajes',
    noMessages: 'No tienes mensajes',
    typing: 'Escribiendo...',
    writeMessage: 'Escribir mensaje...',
    sendMessage: 'Enviar',
    messageTime: 'Hora del mensaje',
    deletedMessage: 'Mensaje eliminado',

    // NUEVOS - Pantalla Chat
    chat: 'Chat',
    participant: 'Participante',
    participants: 'Participantes',
    attachFile: 'Adjuntar archivo',
    sendImage: 'Enviar imagen',
    selectEmoji: 'Seleccionar emoji',
    chatEmpty: 'No hay mensajes aún',

    // NUEVOS - Pantalla Detalles Grupo
    groupDetails: 'Detalles del grupo',
    groupName: 'Nombre del grupo',
    groupDescription: 'Descripción',
    members: 'Miembros',
    tasks: 'Tareas',
    leave: 'Abandonar grupo',
    delete: 'Eliminar',
    leaveGroupConfirm: '¿Estás seguro de que deseas abandonar este grupo?',
    deleteGroupConfirm: '¿Estás seguro de que deseas eliminar este grupo?',

    // NUEVOS - Crear Grupo
    createNewGroup: 'Crear nuevo grupo',
    groupNamePlaceholder: 'Nombre del grupo',
    descriptionPlaceholder: 'Descripción (opcional)',
    selectMembers: 'Seleccionar miembros',
    create: 'Crear',
    cancel: 'Cancelar',

    // NUEVOS - Crear Tarea
    createTask: 'Crear tarea',
    taskTitle: 'Título de la tarea',
    taskDescription: 'Descripción',
    dueDate: 'Fecha de vencimiento',
    assignTo: 'Asignar a',
    priority: 'Prioridad',
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',

    // NUEVOS - Estados de Tareas
    unassigned: 'Sin asignar',
    overdue: 'Vencida',
    dueBy: 'Vence',
    completed: 'Completada',
    pending: 'Pendiente',
    inProgress: 'En progreso',

    // Profile (existentes pero asegurarse)
    editProfile: 'Editar Perfil',
    changePassword: 'Cambiar contraseña',
    pushNotifications: 'Notificaciones push',
    themeApp: 'Tema de la aplicación',
    accountSettings: 'AJUSTES DE CUENTA',
    logoutSecure: 'Cerrar Sesión Segura',

    // Errores comunes
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    loading: 'Cargando...',
    retry: 'Reintentar',
    back: 'Atrás',
    next: 'Siguiente',
  },

  en: {
    // Accesibilidad
    language: 'Language',
    spanish: 'Spanish',
    english: 'English',
    quechua: 'Quechuan',
    profile: 'Profile',
    textSize: 'Text Size',
    contrasts: 'Contrasts',
    dyslexiaFriendly: 'Dyslexia Friendly',
    lineSpacing: 'Line Spacing',
    narrator: 'Narrator',
    reset: 'Reset',
    accessibilityMenu: 'Accessibility Menu',

    // Login
    login: 'Sign In',
    register: 'Sign Up',
    email: 'Email Address',
    password: 'Password',
    forgotPassword: 'Forgot your password?',
    noAccount: 'Don\'t have an account?',
    alreadyHaveAccount: 'Already have an account?',
    loginError: 'Login failed',
    emailRequired: 'Email is required',
    passwordRequired: 'Password is required',

    // Grupos
    groups: 'Groups',
    searchGroup: 'Search group...',
    pendingInvitations: 'Pending invitations',
    noGroupsYet: 'You don\'t belong to any group yet',
    workProgress: 'Work Progress',
    createGroup: 'Create Group',
    joinGroup: 'Join Group',
    viewGroup: 'View Group',
    groupMembers: 'Group Members',
    groupTasks: 'Group Tasks',

    // Mensajes
    messages: 'Messages',
    noMessages: 'You have no messages',
    typing: 'Typing...',
    writeMessage: 'Write a message...',
    sendMessage: 'Send',
    messageTime: 'Message time',
    deletedMessage: 'Deleted message',

    // Chat
    chat: 'Chat',
    participant: 'Participant',
    participants: 'Participants',
    attachFile: 'Attach file',
    sendImage: 'Send image',
    selectEmoji: 'Select emoji',
    chatEmpty: 'No messages yet',

    // Detalles Grupo
    groupDetails: 'Group Details',
    groupName: 'Group Name',
    groupDescription: 'Description',
    members: 'Members',
    tasks: 'Tasks',
    leave: 'Leave',
    delete: 'Delete',
    leaveGroupConfirm: 'Are you sure you want to leave this group?',
    deleteGroupConfirm: 'Are you sure you want to delete this group?',

    // Crear Grupo
    createNewGroup: 'Create New Group',
    groupNamePlaceholder: 'Group name',
    descriptionPlaceholder: 'Description (optional)',
    selectMembers: 'Select members',
    create: 'Create',
    cancel: 'Cancel',

    // Crear Tarea
    createTask: 'Create Task',
    taskTitle: 'Task Title',
    taskDescription: 'Description',
    dueDate: 'Due Date',
    assignTo: 'Assign to',
    priority: 'Priority',
    high: 'High',
    medium: 'Medium',
    low: 'Low',

    // Task States
    unassigned: 'Unassigned',
    overdue: 'Overdue',
    dueBy: 'Due by',
    completed: 'Completed',
    pending: 'Pending',
    inProgress: 'In Progress',

    // Profile
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    pushNotifications: 'Push Notifications',
    themeApp: 'App Theme',
    accountSettings: 'ACCOUNT SETTINGS',
    logoutSecure: 'Secure Logout',

    // Errores
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    loading: 'Loading...',
    retry: 'Retry',
    back: 'Back',
    next: 'Next',
  },

  qu: {
    language: 'Simi',
    spanish: 'Kastilla simi',
    english: 'Inles simi',
    quechua: 'Qhichwa simi',
    profile: 'Kawsay qillqa',
    textSize: 'Qillqa hatun',
    contrasts: 'Llimphi',
    dyslexiaFriendly: 'Dislexia alli',
    lineSpacing: 'Sutha',
    narrator: 'Rimariq',
    reset: 'Kutichiy',
    accessibilityMenu: 'Yaykuy llikamanta',
    login: 'Yaykuy',
    register: 'Qillqakuy',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    groups: 'Ayllu',
    messages: 'Willakuykuna',
    chat: 'Rimay',
    create: 'Churay',
    cancel: 'Huchuy ama',
    delete: 'Qichuy',
    error: 'Pantalla',
    success: 'Allinchu',
    loading: 'Chayachimuni...',
  }
};
```

---

## FASE 2: REFACTORIZACIÓN ChatScreen (CRÍTICO - 68 elementos)

**Archivo:** `src/screens/group/ChatScreen.js`

### Paso 2.1: Cambiar Imports

```diff
- import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ... } from 'react-native';
+ import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, ... } from 'react-native';
+ import Text from "../../components/AppText";
+ import { useAccessibility } from "../../contexts/AccessibilityContext";
```

### Paso 2.2: Agregar Hook de Accesibilidad

Dentro del componente ChatScreen:
```javascript
export default function ChatScreen() {
  // ... otros hooks
  const { t } = useAccessibility();
  
  // ... resto del código
}
```

### Paso 2.3: Reemplazar Strings Hardcoded

**ANTES:**
```javascript
<Text>Escribir mensaje...</Text>
<Text>Sin mensajes aún</Text>
<Text>Escribiendo...</Text>
```

**DESPUÉS:**
```javascript
<Text>{t('writeMessage')}</Text>
<Text>{t('chatEmpty')}</Text>
<Text>{t('typing')}</Text>
```

### Paso 2.4: Todos los `<Text>` ya Funcionan

Automáticamente heredarán:
- ✅ Escalado de tamaño (textScaleMultiplier)
- ✅ Fuente de dislexia (OpenDyslexic)
- ✅ Spacing (lineHeightMultiplier)
- ✅ Narrador (onLongPress + speakText)

---

## FASE 3: REFACTORIZACIÓN OTRAS PANTALLAS

### Paso 3.1: GroupsScreen.js

**Archivo:** `src/screens/main/GroupsScreen.js`

1. Cambiar imports (igual a ChatScreen):
```diff
- import { ... Text, ... } from 'react-native';
+ import Text from "../../components/AppText";
+ import { useAccessibility } from "../../contexts/AccessibilityContext";
```

2. Agregar hook:
```javascript
const { t } = useAccessibility();
```

3. Reemplazar strings:
```diff
- placeholder="Buscar grupo..."
+ placeholder={t('searchGroup')}

- "Invitaciones pendientes ({invitations.length})"
+ {t('pendingInvitations')} + ` (${invitations.length})`

- "No perteneces a ningún grupo aún"
+ t('noGroupsYet')

- "Progreso del trabajo"
+ t('workProgress')
```

### Paso 3.2: MessagesListScreen.js

Aplicar mismo patrón:
1. Import Text desde AppText
2. useAccessibility()
3. Reemplazar strings con t()

### Paso 3.3: GroupDetailsScreen.js

Mismo patrón (28 `<Text>` elementos)

### Paso 3.4: CreateGroupScreen.js, CreateTaskScreen.js

Mismo patrón

### Paso 3.5: RegisterScreen.js

Copiar estructura de LoginScreen (que YA tiene accesibilidad)

---

## FASE 4: REFACTORIZACIÓN COMPONENTES

### Paso 4.1: TaskItem.js

```diff
- import { ... Text, ... } from 'react-native';
+ import Text from "../AppText";
+ import { useAccessibility } from "../../contexts/AccessibilityContext";

export default function TaskItem() {
+ const { t } = useAccessibility();
  
  return (
    // ...
-   <Text>Sin asignar</Text>
+   <Text>{t('unassigned')}</Text>
    
-   <Text>{overdue ? 'Vencida: ' : 'Vence: '}</Text>
+   <Text>{overdue ? t('overdue') + ': ' : t('dueBy') + ': '}</Text>
  );
}
```

### Paso 4.2: EmptyState.js

```diff
- import { ... Text, ... } from 'react-native';
+ import Text from "../AppText";

export default function EmptyState({ title, message, actionText, onActionPress }) {
  return (
    // ...
-   <Text style={[styles.title]}>{title}</Text>
-   <Text style={[styles.message]}>{message}</Text>
-   <Text style={styles.actionText}>{actionText}</Text>
+   <Text style={[styles.title]}>{title}</Text>  {/* Ya incluye accesibilidad */}
+   <Text style={[styles.message]}>{message}</Text>
+   <Text style={styles.actionText}>{actionText}</Text>
  );
}
```

---

## FASE 5: ACTUALIZAR AccessibilityContext.js

**Archivo:** `src/contexts/AccessibilityContext.js`

### Paso 5.1: Importar diccionario expandido

```diff
import React, { createContext, useState, useContext, useMemo } from 'react';
import * as Speech from 'expo-speech';
+ import { TRANSLATIONS } from '../locales/translations';

- const translations = { es: { ... }, en: { ... }, qu: { ... } };
+ const translations = TRANSLATIONS;
```

### Paso 5.2: Registrar OpenDyslexic

En App.js, antes de renderizar:

```javascript
import * as Font from 'expo-font';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Cargar fuente OpenDyslexic
        await Font.loadAsync({
          'OpenDyslexic': require('./src/assets/fonts/OpenDyslexic.ttf'),
        });
      } catch (e) {
        console.warn('Failed to load OpenDyslexic font:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;  // O splash screen
  }

  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        {/* ... resto de la app */}
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
```

---

## FASE 6: PRUEBAS

### Test Checklist

- [ ] **Tamaño de Texto**
  - [ ] Activar "Tamaño Grande" en menú
  - [ ] Verificar que TODOS los elementos se agrandan en todas las pantallas
  - [ ] ProfileScreen ✅
  - [ ] LoginScreen ✅
  - [ ] ChatScreen ✅
  - [ ] GroupsScreen ✅
  - [ ] MessagesListScreen ✅
  - [ ] GroupDetailsScreen ✅

- [ ] **Narrador**
  - [ ] Activar Narrador en menú
  - [ ] Long-press en cada pantalla
  - [ ] Verificar que el texto se lee en todas partes
  - [ ] ChatScreen ✅
  - [ ] GroupsScreen ✅
  - [ ] Etc.

- [ ] **Dislexia**
  - [ ] Activar Dislexia en menú
  - [ ] Verificar que fuente cambia a OpenDyslexic
  - [ ] Verificar que spacing aumenta
  - [ ] Todas las pantallas ✅

- [ ] **Idiomas**
  - [ ] Cambiar a Inglés en ProfileScreen
  - [ ] Navegar a ChatScreen → debe estar en INGLÉS
  - [ ] Navegar a GroupsScreen → debe estar en INGLÉS
  - [ ] Cambiar a Quechua → verificar fallback a español para speech
  - [ ] Todas las pantallas ✅

- [ ] **Accesibilidad General**
  - [ ] Screen reader (TalkBack/VoiceOver) funciona
  - [ ] Accessibility labels están presentes
  - [ ] Contraste de colores es correcto (WCAG AA)

---

## MÉTRICAS DE ÉXITO

### Antes de Fixes
```
Cobertura Global:        22%
Pantallas con A11y:      2/9
Elementos de Texto:      170+ sin accesibilidad
Features Funcionales:    2/5
```

### Después de Fixes (Target)
```
Cobertura Global:        100% ✅
Pantallas con A11y:      9/9 ✅
Elementos de Texto:      0 sin accesibilidad ✅
Features Funcionales:    5/5 ✅
- Tamaño de texto:       ✅
- Narrador:              ✅
- Dislexia:              ✅
- Idiomas:               ✅
- Contraste:             ✅
```

---

## TIMELINE

| Fase | Tarea | Tiempo | Responsable |
|------|-------|--------|-------------|
| 1 | Preparación (fonts, diccionario) | 30 min | Dev |
| 2 | ChatScreen (68 elementos) | 1.5 horas | Dev |
| 3 | Otras pantallas (5 más) | 2 horas | Dev |
| 4 | Componentes reutilizables | 30 min | Dev |
| 5 | Actualizar Context | 15 min | Dev |
| 6 | Pruebas exhaustivas | 1 hora | QA |
| **TOTAL** | | **~5.5 horas** | |

---

## PRÓXIMOS PASOS

1. ✅ Ejecutar Fase 1-5 según plan
2. ✅ Realizar pruebas Fase 6
3. ✅ Hacer commit a rama dev
4. ✅ Pull request a main
5. ✅ Deploy a producción

