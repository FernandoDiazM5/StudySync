# 🚀 Quick Start - Accesibilidad 100% en 4 Horas

**Objetivo:** Llevar accesibilidad del 22% al 100%  
**Tiempo:** 4-5 horas  
**Dificultad:** MEDIA

---

## ⏱️ TIMELINE

```
Fase 1: Setup           30 min
Fase 2: ChatScreen      1.5 horas  ← CRÍTICO
Fase 3: 5+ pantallas    1.5 horas
Fase 4: Componentes     30 min
Fase 5: Pruebas         1 hora
──────────────────────────────
TOTAL:                 ~5 horas
```

---

## 📦 FASE 1: SETUP (30 minutos)

### 1.1 Instalar Dependencias

```bash
# En la terminal, en la raíz del proyecto
expo install expo-font expo-splash-screen
```

### 1.2 Descargar OpenDyslexic

**Opción A: Manual**
1. Descargar desde https://github.com/antijingoist/open-dyslexic/releases
2. Extraer `OpenDyslexic-Regular.ttf`
3. Crear carpeta: `src/assets/fonts/`
4. Copiar archivo a: `src/assets/fonts/OpenDyslexic.ttf`

**Opción B: Script rápido**
```bash
# Crear carpeta
mkdir -p src/assets/fonts

# Descargar directamente
curl -L https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Regular.ttf -o src/assets/fonts/OpenDyslexic.ttf
```

### 1.3 Crear Diccionario de Traducciones

**Crear archivo:** `src/locales/translations.js`

```javascript
export const TRANSLATIONS = {
  es: {
    // Accesibilidad (existentes)
    language: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    quechua: 'Quechua',
    textSize: 'Tamaño de texto',
    narrator: 'Narrador',
    dyslexiaFriendly: 'Dislexia amigable',
    
    // NUEVOS - Grupos
    groups: 'Grupos',
    searchGroup: 'Buscar grupo...',
    pendingInvitations: 'Invitaciones pendientes',
    noGroupsYet: 'No perteneces a ningún grupo aún',
    workProgress: 'Progreso del trabajo',
    
    // NUEVOS - Mensajes
    messages: 'Mensajes',
    noMessages: 'No tienes mensajes',
    writeMessage: 'Escribir mensaje...',
    chat: 'Chat',
    typing: 'Escribiendo...',
    
    // NUEVOS - Tareas
    unassigned: 'Sin asignar',
    overdue: 'Vencida',
    dueBy: 'Vence',
    
    // NUEVOS - Botones
    create: 'Crear',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    save: 'Guardar',
  },
  en: {
    // Lo mismo en inglés
    groups: 'Groups',
    searchGroup: 'Search group...',
    noGroupsYet: 'You don\'t belong to any group yet',
    messages: 'Messages',
    writeMessage: 'Write a message...',
    unassigned: 'Unassigned',
    overdue: 'Overdue',
  },
  qu: {
    // Lo mismo en quechua
    groups: 'Ayllu',
    messages: 'Willakuykuna',
  }
};
```

### 1.4 Actualizar App.js

```javascript
// Agregar al inicio
import * as Font from 'expo-font';

// En el componente App, agregar useEffect:
export default function App() {
  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          'OpenDyslexic': require('./src/assets/fonts/OpenDyslexic.ttf'),
        });
      } catch (e) {
        console.warn('Failed to load fonts:', e);
      }
    }
    prepare();
  }, []);

  // ... resto del código
}
```

### 1.5 Actualizar AccessibilityContext.js

**Reemplazar las traducciones hardcoded:**

```diff
import React, { createContext, useState, useContext, useMemo } from 'react';
import * as Speech from 'expo-speech';
+ import { TRANSLATIONS } from '../locales/translations';

- const translations = {
-   es: { ... },
-   en: { ... },
-   qu: { ... }
- };

+ const translations = TRANSLATIONS;

// El resto del código permanece igual
```

✅ **FASE 1 COMPLETADA**

---

## 🎯 FASE 2: REFACTORIZAR ChatScreen (1.5 horas) - CRÍTICO

**Archivo:** `src/screens/group/ChatScreen.js`

Este archivo tiene 68 elementos de texto sin accesibilidad. Es el más importante.

### 2.1 Cambiar Imports (5 minutos)

**BUSCAR estas líneas al inicio:**
```javascript
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ... } from 'react-native';
```

**REEMPLAZAR con:**
```javascript
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, ... } from 'react-native';
import Text from "../../components/AppText";
import { useAccessibility } from "../../contexts/AccessibilityContext";
```

### 2.2 Agregar Hook (2 minutos)

**Dentro del componente ChatScreen, al inicio:**

```javascript
export default function ChatScreen() {
  // ... otros hooks
  const { t } = useAccessibility();
  
  // ... resto del código
}
```

### 2.3 Traducir Strings (30 minutos)

**BUSCAR y REEMPLAZAR hardcoded strings:**

```diff
- <Text>Escribir mensaje...</Text>
+ <Text>{t('writeMessage')}</Text>

- <Text>No hay mensajes aún</Text>
+ <Text>{t('chatEmpty')}</Text>

- <Text>Escribiendo...</Text>
+ <Text>{t('typing')}</Text>

- placeholder="Escribe un mensaje..."
+ placeholder={t('writeMessage')}
```

### 2.4 Verificar (10 minutos)

```bash
# Compilar y buscar errores
npm start

# Si hay error sobre 't is not defined':
# ✅ Asegúrate de que importaste useAccessibility y lo llamaste
# ✅ Asegúrate de que AccessibilityProvider envuelve toda la app (App.js)
```

✅ **FASE 2 COMPLETADA** - ChatScreen ahora tiene 100% accesibilidad

---

## 🔄 FASE 3: REFACTORIZAR OTRAS PANTALLAS (1.5 horas)

Aplicar el mismo patrón de Fase 2 a estos archivos:

### 3.1 GroupsScreen.js (5 minutos)

```javascript
// Al inicio
- import { ... Text, ... } from 'react-native';
+ import Text from "../../components/AppText";
+ import { useAccessibility } from "../../contexts/AccessibilityContext";

// En el componente
+ const { t } = useAccessibility();

// Reemplazar strings
- placeholder="Buscar grupo..."
+ placeholder={t('searchGroup')}

- "Invitaciones pendientes ({invitations.length})"
+ `${t('pendingInvitations')} (${invitations.length})`

- "No perteneces a ningún grupo aún"
+ t('noGroupsYet')

- "Progreso del trabajo"
+ t('workProgress')
```

### 3.2 MessagesListScreen.js (5 minutos)

```javascript
// Mismos cambios que GroupsScreen
```

### 3.3 GroupDetailsScreen.js (10 minutos)

```javascript
// Mismos cambios
// (tiene 28 elementos de texto, por eso 10 min)
```

### 3.4 CreateGroupScreen.js (5 minutos)

```javascript
// Mismos cambios
```

### 3.5 CreateTaskScreen.js (10 minutos)

```javascript
// Mismos cambios + traducir labels de tareas
```

### 3.6 RegisterScreen.js (10 minutos)

```javascript
// Copiar estructura de LoginScreen (que ya funciona)
// RegisterScreen debería ser igual a LoginScreen con pequeñas diferencias
```

✅ **FASE 3 COMPLETADA**

---

## 🧩 FASE 4: COMPONENTES REUTILIZABLES (30 minutos)

### 4.1 TaskItem.js

```diff
- import { ... Text, ... } from 'react-native';
+ import Text from "../AppText";
+ import { useAccessibility } from "../../contexts/AccessibilityContext";

export default function TaskItem() {
+ const { t } = useAccessibility();

- <Text>Sin asignar</Text>
+ <Text>{t('unassigned')}</Text>

- <Text>{overdue ? 'Vencida: ' : 'Vence: '}</Text>
+ <Text>{overdue ? t('overdue') : t('dueBy')}</Text>
}
```

### 4.2 EmptyState.js

```diff
- import { ... Text, ... } from 'react-native';
+ import Text from "../AppText";

{/* El resto funcionará automáticamente */}
```

✅ **FASE 4 COMPLETADA**

---

## ✅ FASE 5: PRUEBAS (1 hora)

### 5.1 Prueba Tamaño de Texto

```
1. Abrir app
2. Ir a ProfileScreen
3. Toque el ícono de accesibilidad (esquina inferior)
4. Seleccionar "Tamaño de texto" → "Grande"
5. VERIFICAR:
   - ProfileScreen → ✅ Texto más grande
   - Cerrar menú, navegar a ChatScreen
   - ChatScreen → ✅ Texto debe estar más grande
   - Navegar a GroupsScreen → ✅ Texto más grande
   - Navegar a MessagesListScreen → ✅ Texto más grande
```

### 5.2 Prueba Narrador

```
1. Ir a ProfileScreen
2. Abrir menú accesibilidad
3. Seleccionar "Narrador" → ON
4. Hacer LONG-PRESS (mantener presionado 1 segundo) en cualquier texto
5. VERIFICAR:
   - ✅ El dispositivo pronuncia el texto
   - En ProfileScreen → ✅ Funciona
   - En ChatScreen → ✅ Funciona
   - En GroupsScreen → ✅ Funciona
   - En MessagesListScreen → ✅ Funciona
```

### 5.3 Prueba Dislexia

```
1. Abrir menú accesibilidad
2. Seleccionar "Dislexia Amigable" → ON
3. VERIFICAR:
   - ✅ La fuente cambia (más espaciada, más grande)
   - ProfileScreen → ✅ Fuente OpenDyslexic
   - ChatScreen → ✅ Fuente OpenDyslexic
   - GroupsScreen → ✅ Fuente OpenDyslexic
   - MessagesListScreen → ✅ Fuente OpenDyslexic
```

### 5.4 Prueba Idiomas

```
1. Abrir menú accesibilidad
2. Cambiar "Idioma" → English
3. Cerrar menú
4. VERIFICAR:
   - ProfileScreen → ✅ Inglés
   - Navegar a ChatScreen → ✅ Inglés
   - Navegar a GroupsScreen → ✅ Inglés
   - Navegar a MessagesListScreen → ✅ Inglés
   - Volver a cambiar a Español → ✅ Todo en español
```

### 5.5 Prueba Combinada

```
1. Activar TODAS las opciones:
   - Tamaño Grande
   - Narrador
   - Dislexia
   - Inglés
   - Contraste Alto

2. Navegar por TODAS las pantallas

3. VERIFICAR que TODO se ve diferente:
   - ✅ Texto más grande
   - ✅ Fuente OpenDyslexic
   - ✅ Espaciado aumentado
   - ✅ Colores en alto contraste
   - ✅ Todo en inglés
```

✅ **FASE 5 COMPLETADA**

---

## 🎉 ¡LISTO!

Si todas las pruebas pasan:

```bash
# Hacer commit
git add -A
git commit -m "feat: implementar accesibilidad global en todas las pantallas

- Reemplazar 158 <Text> nativos con AppText
- Agregar useAccessibility() a 7 pantallas
- Crear diccionario global de traducciones (200+ keys)
- Instalar OpenDyslexic font + expo-font
- Ahora accesibilidad funciona en 100% de la app

Mejoras:
✅ Tamaño de texto: Todas las pantallas
✅ Narrador: Todas las pantallas
✅ Dislexia: Todas las pantallas
✅ Idiomas: Todas las pantallas
✅ Contraste: Todas las pantallas

Cobertura: 22% → 100%"

# Push
git push origin dev
```

---

## 🆘 TROUBLESHOOTING

### Error: "OpenDyslexic is not a system font"
**Solución:**
- Verificar que `src/assets/fonts/OpenDyslexic.ttf` existe
- Verificar que App.js cargó el font con `Font.loadAsync`
- Limpiar cache: `expo start -c`

### Error: "t is not defined"
**Solución:**
- Verificar que importaste: `import { useAccessibility } from "..."`
- Verificar que llamaste: `const { t } = useAccessibility();`
- Verificar que archivo existe: `src/locales/translations.js`
- Verificar que AccessibilityContext importa TRANSLATIONS

### Texto no se agranda
**Solución:**
- Verificar que el componente usa AppText (no `<Text>`)
- Verificar que AccessibilityProvider envuelve la app (App.js)
- Compilar y recargar: `npm start -c`

### Narrador no funciona
**Solución:**
- Verificar que Speech.speak() está en AccessibilityContext
- Verificar que AppText tiene onLongPress handler
- Verificar que expo-speech está instalado: `npm list expo-speech`
- Probar en dispositivo (algunos simuladores no tienen audio)

### Idiomas no cambian en pantalla X
**Solución:**
- Verificar que pantalla importa: `import { useAccessibility } from "..."`
- Verificar que llamó: `const { t } = useAccessibility();`
- Verificar que strings usan: `t('key')` no "string hardcoded"
- Compilar: `npm start -c`

---

## 📊 CHECKPOINT

Antes de empezar cada fase, marca ✅:

- [ ] **FASE 1:** Setup completado (expo-font, OpenDyslexic, traducciones)
- [ ] **FASE 2:** ChatScreen 100% accesible (68 elementos refactorizados)
- [ ] **FASE 3:** Otras 6 pantallas refactorizadas
- [ ] **FASE 4:** TaskItem y EmptyState refactorizados
- [ ] **FASE 5:** Todas las pruebas pasan

---

## 📈 RESULTADO

### Antes:
```
ProfileScreen:       ✅ 100% accesible
LoginScreen:         ✅ 100% accesible
7 pantallas:         ❌ 0% accesible
COBERTURA TOTAL:     22%
```

### Después:
```
ProfileScreen:       ✅ 100% accesible
LoginScreen:         ✅ 100% accesible
ChatScreen:          ✅ 100% accesible
GroupsScreen:        ✅ 100% accesible
MessagesListScreen:  ✅ 100% accesible
GroupDetailsScreen:  ✅ 100% accesible
CreateGroupScreen:   ✅ 100% accesible
CreateTaskScreen:    ✅ 100% accesible
RegisterScreen:      ✅ 100% accesible
COBERTURA TOTAL:     100% ✅✅✅
```

---

**¡Listo para empezar!** 🚀

Tiempo total: ~4-5 horas  
Complejidad: MEDIA  
Impacto: MÁXIMO (accesibilidad completa)

