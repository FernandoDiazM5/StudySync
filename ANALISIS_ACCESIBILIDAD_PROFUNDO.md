# Análisis Profundo - Sistema de Accesibilidad No Funcional

**Realizado por:** Agente Especializado en React Native + Accesibilidad Móvil + SQLite  
**Fecha:** 23 de Abril, 2026  
**Versión:** Diagnóstico Crítico

---

## 🔴 HALLAZGO PRINCIPAL

**El sistema de accesibilidad está implementado SOLO al 22% de la aplicación.**

- ✅ **ProfileScreen y LoginScreen:** Accesibilidad completa (22% de la app)
- ❌ **7 pantallas principales:** SIN accesibilidad (78% de la app)
- ❌ **170+ elementos de texto:** Usando `<Text>` nativo en lugar de AppText

---

## 📊 ESTADÍSTICAS CRÍTICAS

### Cobertura por Pantalla

| Pantalla | Pantalla | useAccessibility | AppText | Traducción | Escalado | Speech | Dislexia |
|----------|----------|------------------|---------|-----------|----------|--------|----------|
| ProfileScreen | ✅ 100% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LoginScreen | ✅ 100% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GroupsScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ChatScreen | ❌ 0% | ❌ (68 <Text>) | ❌ | ❌ | ❌ | ❌ | ❌ |
| MessagesListScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| GroupDetailsScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CreateGroupScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CreateTaskScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| RegisterScreen | ❌ 0% | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **TOTAL COBERTURA** | **22%** |

### Elementos de Texto Sin Accesibilidad

```
ChatScreen:              68 <Text> nativos
GroupDetailsScreen:      28 <Text> nativos
GroupsScreen:            14 <Text> nativos
CreateTaskScreen:        11 <Text> nativos
RegisterScreen:          18 <Text> nativos
CreateGroupScreen:        7 <Text> nativos
MessagesListScreen:       6 <Text> nativos
TaskItem.js:             3 <Text> nativos
EmptyState.js:           3 <Text> nativos
─────────────────────────────────────
TOTAL:                 158 <Text> nativos sin accesibilidad
```

---

## 🔍 PROBLEMA #1: TAMAÑO DE TEXTO SOLO EN ALGUNAS VISTAS

### Causa Raíz
La función `textScaleMultiplier` se **calcula correctamente** en AccessibilityContext pero se **aplica SOLO en AppText.js línea 39**:

```javascript
// AppText.js línea 39
fontSize: baseFontSize * textScaleMultiplier
```

### Dónde Funciona ✅
- ProfileScreen - Usa AppText
- LoginScreen - Usa AppText

### Dónde NO Funciona ❌
- ChatScreen - 68 `<Text>` nativos con fontSize hardcoded
- GroupsScreen - 14 `<Text>` nativos con fontSize hardcoded
- GroupDetailsScreen - 28 `<Text>` nativos
- MessagesListScreen - 6 `<Text>` nativos
- Y 5 pantallas más...

### Impacto
Un usuario con baja visión activa "Tamaño Grande (30%)" en el menú:
- ✅ Texto en ProfileScreen se agranda 30%
- ❌ Texto en ChatScreen NO se agranda (texto sigue en 12px, 14px, etc.)
- ❌ Texto en GroupsScreen NO se agranda
- ❌ Texto en 7 pantallas más NO se agranda

**Resultado:** Usuario reporta "solo se agranda en algunas vistas"

---

## 🔍 PROBLEMA #2: NARRADOR NO FUNCIONA

### Causa Raíz
La función `speakText()` se **define correctamente** en AccessibilityContext pero se **llama SOLO en 2 lugares**:

```
1. AppText.js línea 56 (en onLongPress handler)
2. AppButton.js línea 34 (en onLongPress handler)
```

Estos componentes aparecen en: ProfileScreen y LoginScreen SOLAMENTE.

### Arquitectura del Speech

```
AccessibilityContext.js
├─ speakText() definida ✅
│   ├─ try-catch: ✅
│   ├─ Usa Speech.speak() ✅
│   └─ Manejo de errores ✅
│
└─ Usada en:
    ├─ AppText.js línea 56 (onLongPress) ✅
    ├─ AppButton.js línea 34 (onLongPress) ✅
    └─ NADA MÁS ❌
```

### Dónde Falta
ChatScreen tiene 68 elementos `<Text>` que son **clickeables y largos** (mensajes, títulos, etc.) pero:
- ❌ SIN onLongPress handler
- ❌ SIN extracción de texto
- ❌ SIN integración con speakText()

Cuando usuario presiona long-press: **NADA ocurre**

### Detalle Técnico
Para que Speech funcione, se necesita:
```javascript
// 1. Importar useAccessibility
const { speechEnabled, speakText } = useAccessibility();

// 2. Tener handler de onLongPress en CADA elemento de texto
<Text onLongPress={() => {
  if (speechEnabled) speakText(textContent);
}}>
  {textContent}
</Text>

// 3. O usar AppText (que lo hace automáticamente)
<AppText>{textContent}</AppText>
```

ChatScreen no hace NINGUNO de estos. Tiene `<Text>` nativos sin handlers.

---

## 🔍 PROBLEMA #3: DISLEXIA NO FUNCIONA

### Causa Raíz #1: OpenDyslexic NO Está Instalada

AccessibilityContext.js línea 133:
```javascript
const globalFontFamily = dyslexiaFontActive ? 'OpenDyslexic' : undefined;
```

**PROBLEMA:** 'OpenDyslexic' no es una fuente built-in en React Native. Sin instalar:
- `expo-font` 
- Descargar archivo OpenDyslexic.ttf
- Registrar la fuente

Cuando usuario activa Dislexia, la fuente NUNCA cambia. React Native simplemente ignora 'OpenDyslexic' como string desconocido.

### Causa Raíz #2: globalFontFamily NO se Aplica Globalmente

Incluso si OpenDyslexic estuviera instalada, se aplica SOLO en:

```javascript
// AppText.js línea 36
fontFamily: globalFontFamily || flattenedStyle.fontFamily
```

Los 158 `<Text>` nativos en otras pantallas:
```javascript
<Text style={styles.title}>Texto aquí</Text>
```

**NUNCA** hacen:
```javascript
fontFamily: globalFontFamily
```

### Causa Raíz #3: Line Height y Letter Spacing No Aplicados

AccessibilityContext.js calcula:
```javascript
const lineHeightMultiplier = spacingLevel === 2 ? 1.8 : ...
const globalLetterSpacing = dyslexiaFontActive ? 1.5 : 0;
```

AppText.js aplica ambos (línea 39-40). Los 158 `<Text>` nativos **NUNCA** lo hacen.

### Resultado
Cuando usuario activa:
- ✅ Dislexia en ProfileScreen: Fuente cambia (si estuviera instalada), spacing aumenta
- ❌ Dislexia en ChatScreen: NADA ocurre
- ❌ Dislexia en GroupsScreen: NADA ocurre
- ❌ Dislexia en 7 pantallas: NADA ocurre

---

## 🔍 PROBLEMA #4: IDIOMAS NO SE APLICAN GLOBALMENTE

### Causa Raíz
La función `t()` (traducción) está disponible SOLO cuando se llama:

```javascript
const { t } = useAccessibility();
```

### Dónde Se Usa useAccessibility() ✅
- ProfileScreen.js línea 52
- LoginScreen.js línea 34
- AccessibilityMenu.js línea 76

### Dónde NO Se Usa ❌
```
GroupsScreen.js          ❌
ChatScreen.js            ❌
MessagesListScreen.js    ❌
GroupDetailsScreen.js    ❌
CreateGroupScreen.js     ❌
CreateTaskScreen.js      ❌
RegisterScreen.js        ❌
```

### Strings Hardcoded (Deberían Usar t())

**GroupsScreen.js**
```javascript
// Línea 236
placeholder="Buscar grupo..."  // ❌ Hardcoded español

// Línea 265
Invitaciones pendientes ({invitations.length})  // ❌ Hardcoded

// Línea 305
"No perteneces a ningún grupo aún"  // ❌ Hardcoded

// Línea 199
"Progreso del trabajo"  // ❌ Hardcoded
```

**ChatScreen.js** (68 elementos - múltiples strings hardcoded)

**TaskItem.js**
```javascript
// Línea 73
'Sin asignar'  // ❌ Hardcoded

// Línea 87
'Vencida: ' : 'Vence: '  // ❌ Hardcoded
```

**EmptyState.js**
```javascript
// Línea 17-25
{title}  // ❌ Nunca traducido
{message}  // ❌ Nunca traducido
{actionText}  // ❌ Nunca traducido
```

### El Flujo Roto

```
1. Usuario cambia idioma a Inglés en ProfileScreen
2. setLanguage('en') se ejecuta ✅
3. AccessibilityContext.language = 'en' ✅
4. ProfileScreen se re-renderiza con t('key') → 'English values' ✅
5. Usuario navega a GroupsScreen
6. GroupsScreen NUNCA llamó useAccessibility() ❌
7. GroupsScreen NUNCA llamó t() ❌
8. Todos los strings permanecen en español original ❌
9. Usuario ve una pantalla en ESPAÑOL aunque eligió INGLÉS
```

### Por Qué Dice "Solo Cambia en Perfil"
Porque ProfileScreen es el ÚNICO lugar donde:
1. Se llama useAccessibility() para acceder a t()
2. Se usan strings con t('key')
3. Se re-renderiza cuando idioma cambia

Los otros 7 screens tienen strings hardcoded en español, así que never se actualizan.

---

## 🔍 PROBLEMA #5: ACCESIBILIDAD INCONSISTENTE ENTRE PANTALLAS

### Raíz del Problema
La arquitectura está **fragmentada**:

```
AccessibilityProvider ✅ (funciona bien)
    │
    ├─ ProfileScreen
    │   ├─ useAccessibility() ✅
    │   ├─ AppText ✅
    │   ├─ t() para traducción ✅
    │   └─ Accesibilidad completa ✅
    │
    ├─ LoginScreen
    │   ├─ useAccessibility() ✅
    │   ├─ AppText ✅
    │   ├─ t() para traducción ✅
    │   └─ Accesibilidad completa ✅
    │
    └─ ChatScreen, GroupsScreen, etc.
        ├─ useAccessibility() ❌ NO
        ├─ AppText ❌ NO
        ├─ t() ❌ NO
        └─ Accesibilidad CERO ❌
```

El Provider funciona perfectamente, pero solo 2 de 9 pantallas lo usan.

---

## 📋 CHECKLIST: ARCHIVOS CON PROBLEMAS

### CRÍTICOS (Refactorizar Ahora)

- [ ] **src/screens/group/ChatScreen.js**
  - 68 `<Text>` nativos
  - 0% accesibilidad
  - Importar: `import Text from "../../components/AppText";`
  - Reemplazar todos los `<Text>` con AppText

- [ ] **src/screens/group/GroupDetailsScreen.js**
  - 28 `<Text>` nativos
  - 0% accesibilidad
  - Añadir: `const { t } = useAccessibility();`
  - Reemplazar `<Text>` nativos con AppText

- [ ] **src/screens/main/GroupsScreen.js**
  - 14 `<Text>` nativos
  - Strings hardcoded en español
  - Añadir `useAccessibility()`
  - Usar `t()` para todos los strings

- [ ] **src/contexts/AccessibilityContext.js**
  - OpenDyslexic NO está instalada
  - Diccionario incompleto (~15 keys, necesita ~200+)
  - Instalar: `expo install expo-font`
  - Descargar OpenDyslexic.ttf

### ALTOS (Esta Semana)

- [ ] **src/screens/main/MessagesListScreen.js**
  - 6 `<Text>` nativos
  - Falta useAccessibility()

- [ ] **src/screens/auth/RegisterScreen.js**
  - 18 `<Text>` nativos
  - Inconsistente con LoginScreen

- [ ] **src/components/TaskItem.js**
  - 3 `<Text>` nativos
  - Strings sin traducción

- [ ] **src/components/EmptyState.js**
  - 3 `<Text>` nativos
  - Afecta múltiples pantallas

### MEDIOS (Próximo Sprint)

- [ ] **src/screens/group/CreateGroupScreen.js** (7 `<Text>`)
- [ ] **src/screens/group/CreateTaskScreen.js** (11 `<Text>`)
- [ ] **Persistencia** - Guardar preferencias en AsyncStorage
- [ ] **Diccionario de Traducciones** - Crear locales/es.json, en.json, qu.json

---

## 🚀 PLAN DE ACCIÓN INMEDIATO

### Fase 1: Refactorización ChatScreen (Crítico)

```bash
# 1. Importar AppText en lugar de Text
- import { Text } from 'react-native';
+ import Text from "../../components/AppText";

# 2. Importar useAccessibility para acceso a t()
+ import { useAccessibility } from "../../contexts/AccessibilityContext";

# 3. En el componente:
+ const { t } = useAccessibility();

# 4. Reemplazar TODOS los <Text> con strings hardcoded:
- <Text>Mensaje: {msg.text}</Text>
+ <Text>{msg.text}</Text>  {/* AppText maneja accesibilidad automáticamente */}

# 5. Traducir strings hardcoded:
- <Text>{"Escribir mensaje..."}</Text>
+ <Text>{t('writeMessage')}</Text>
  {/* Añadir 'writeMessage' al diccionario de AccessibilityContext */}
```

### Fase 2: Instalar OpenDyslexic

```bash
# 1. Instalar expo-font
expo install expo-font expo-splash-screen

# 2. Descargar OpenDyslexic.ttf desde:
# https://opendyslexic.org/get-started/

# 3. Copiar a: src/assets/fonts/OpenDyslexic.ttf

# 4. Registrar en App.js o fonts.js:
import * as Font from 'expo-font';

useEffect(() => {
  Font.loadAsync({
    'OpenDyslexic': require('./src/assets/fonts/OpenDyslexic.ttf'),
  });
}, []);
```

### Fase 3: Expandir Diccionario de Traducciones

Crear archivo `src/locales/translations.js`:
```javascript
export const translations = {
  es: {
    // Existentes
    language: 'Idioma',
    textSize: 'Tamaño de texto',
    // Nuevos
    searchGroup: 'Buscar grupo...',
    pendingInvitations: 'Invitaciones pendientes',
    noGroups: 'No perteneces a ningún grupo aún',
    workProgress: 'Progreso del trabajo',
    writeMessage: 'Escribir mensaje...',
    unassigned: 'Sin asignar',
    overdue: 'Vencida',
    dueBy: 'Vence',
    // ... más strings
  },
  en: {
    // Traducciones en inglés
  },
  qu: {
    // Traducciones en quechua
  }
};
```

### Fase 4: Propagación de Accesibilidad a Todas las Pantallas

Para CADA pantalla que falta:
1. `import { useAccessibility } from "../../contexts/AccessibilityContext";`
2. `const { t } = useAccessibility();`
3. Reemplazar todos los `<Text>` nativos con AppText
4. Reemplazar hardcoded strings con t('key')

---

## 📊 Impacto Esperado Después de Fixes

### Cobertura Actual vs. Target

```
AHORA:
├─ Accesibilidad global: 22%
├─ Tamaño de texto: 22%
├─ Narrador: 5% (solo buttons)
├─ Idiomas: 22%
└─ Dislexia: 0%

DESPUÉS DE FIXES:
├─ Accesibilidad global: 100% ✅
├─ Tamaño de texto: 100% ✅
├─ Narrador: 100% ✅
├─ Idiomas: 100% ✅
└─ Dislexia: 100% ✅
```

---

## 📚 Recursos

- [OpenDyslexic Font](https://opendyslexic.org/)
- [Expo Font Documentation](https://docs.expo.dev/versions/latest/sdk/font/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## ✅ Conclusión

**El sistema de accesibilidad en StudySync NO está roto - simplemente NO está implementado en el 78% de la aplicación.**

La solución no requiere reescribir el sistema, sino **aplicar lo que ya existe a las pantallas que le faltan** y **instalar una fuente especializada (OpenDyslexic)**.

Con los fixes propuestos, la accesibilidad será completa y consistente en 100% de la interfaz.

