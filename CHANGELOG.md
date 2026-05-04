# StudySync — Update Final

**Autor:** Bryan Huaman
**Plataforma:** React Native (Expo)
**Fecha:** 27 de abril de 2026

---

## Correcciones de bugs

### Grupos
- **Invitación aceptada no aparecía en la lista** — `acceptInvitation` leía los datos del grupo tras el batch write, pero las reglas de seguridad de Firestore bloqueaban la lectura porque el listener aún no re-evaluaba la membresía. Solución: leer el snapshot de la invitación *antes* del batch y retornar el objeto del grupo construido desde esos datos, sin necesitar una lectura adicional al documento de grupo.

### Chat — Menciones
- **`@todos` no notificaba** — El estado `members` estaba vacío al momento del envío porque `getUsersByIds` es asíncrono. Solución: usar `group.members` (array de UIDs cargado con el grupo) como fuente de verdad.
- **`@nombre` lanzaba TypeError** — `m.name.toLowerCase()` fallaba si algún perfil no tenía campo `name`. Solución: `(m.name || m.displayName || '').toLowerCase()`.
- **Segunda mención no aparecía en el input** — `setNativeProps({ text })` en Android no dispara `onChangeText`, dejando `inputValueRef` y el valor nativo desfasados tras la primera inserción. Solución: convertir el `TextInput` a controlado con estado `inputText`; `handleSelectMention` usa `setInputText` en lugar de `setNativeProps`.
- **Mensaje `@todos` decía "te mencionó"** — Al usar `@todos`, el cuerpo de la notificación ahora dice `"X mencionó a todos los integrantes"` en lugar de `"X te mencionó"`.

### Chat — TypeError al abrir
- **`Cannot read property 'length' of undefined`** — `messageList.length` en el array de dependencias de `useEffect` se evaluaba como `undefined` porque `messageList` (declarado con `useMemo` más abajo) es hoistado por Babel como `var = undefined`. Solución: cambiar la dependencia a `messages.length` (estado `useState`, definido al inicio).

### Chat — Bottom sheets (filtro de grupos / menú 3 puntos)
- **Contenido tapado por la barra de navegación del móvil** — Los action sheets tenían `paddingBottom` fijo. Solución: `paddingBottom: Math.max(16, insets.bottom)` usando `useSafeAreaInsets`, que refleja exactamente la altura de la barra de navegación del sistema en cada dispositivo.
- **Demasiado espaciado en un dispositivo** — La fórmula anterior sumaba `+16` ó `+8` a `insets.bottom`, generando padding excesivo en dispositivos con gesture navigation grande (~44–50 px). Solución: usar `insets.bottom` directamente sin extra.

### Notificaciones
- **Outline gris al tocar una notificación de mención** — `Pressable` en Android activa el `StateListAnimator` nativo (que dibuja un overlay gris rectangular que ignora `borderRadius`) cuando la View tiene `elevation > 0`. Solución: eliminar `elevation` de `s.item` y reemplazar `Pressable` por `TouchableOpacity` con `onPressIn`/`onPressOut`.
- **Borde izquierdo cortado en ítems no leídos** — Mezclar `borderWidth: 1` y `borderLeftWidth: 3` con `borderRadius: 12` rompe el renderizado de esquinas en React Native. Solución: pill de acento posicionado como hijo flex dentro de un `View` externo con `overflow: hidden`, eliminando cualquier mezcla de anchos de borde.
- **Espacio fantasma en texto de notificación** — El texto del tiempo ("Ahora" → "1m") cambiaba el ancho de `itemRight`, provocando que `itemBody` se re-midiera pero dejara el espacio de la línea anterior. Solución: `width: 40` fijo en `itemRight` y `textAlign: 'right'` en el tiempo.

### Archivos — Botón eliminar no visible en algunos dispositivos
- **Botón de eliminar documento no se veía** — El motor Yoga en algunas versiones de Android ignora `flexShrink: 0` en contenedores anidados, colapsando los botones. Solución: `position: 'absolute'` en `fileActions` con `right: 12`, `top: 0`, `bottom: 0`, sacando los botones del flujo flex y garantizando visibilidad sin importar el motor de layout.
- **Sin separación entre nombre del archivo y botones** — El `paddingRight` del card no sumaba margen de respiración entre el último botón y el texto. Solución: recalcular con gap de 8 px extra: `98 px` (líder) y `56 px` (miembro).

### Barra de progreso de carga de documento
- **Mostraba 125% y no llegaba al 100%** — En algunos Android, `XMLHttpRequest.upload.onprogress` emite `e.loaded > e.total` (quirk conocido), haciendo que `10 + round((loaded/total) * 80)` supere 90. Solución: clampear a `[10, 90]` en el callback XHR y a `[0, 100]` en el render del modal.

---

## Nuevas funcionalidades

### Notificaciones — Tab de Menciones
- Agregado el tipo `mention` como quinta pestaña en el header de notificaciones.
- El tab bar usa `ScrollView` horizontal para acomodar las 5 pestañas sin apretarse.
- Color de acento dinámico por tipo: índigo (menciones), violeta (invitaciones), ámbar (tareas), esmeralda (grupos).

### Notificaciones — Indicador visual por tipo
- Ítems no leídos: borde completo del color del tipo (`borderWidth: 2`) + pill de acento izquierdo de 4×36 px con `borderRadius: 4`, centrado verticalmente.
- Ítems leídos: borde tenue `rgba` del color del tipo (22 % de opacidad) — nunca gris.
- Al presionar: fondo tenue del tipo + borde de 2 px del color.
- Navegación push (`mention`, `group`): el marcado como leído se retrasa 350 ms para que la transición arranque con el borde coloreado aún visible.

### Foto de perfil de usuario
- Botón de cámara sobre el avatar en `ProfileScreen`. Al tocarlo, abre el picker de imágenes del sistema.
- La imagen se sube a Supabase Storage en `avatars/users/{uid}/photo.{ext}` con `upsert: true` (reemplaza la anterior).
- La URL pública con cache-buster (`?t=timestamp`) se guarda en el perfil de Firestore y se refresca con `refreshProfile()`.
- Mientras sube muestra `ActivityIndicator` en el círculo del avatar.

### Avatar de miembros en Detalle de Grupo
- La lista de miembros ahora muestra la foto de perfil si el usuario tiene `photoURL` en Firestore.
- Si no tiene foto, se muestran las iniciales (máximo 2 letras) como antes.
- El avatar creció de 32 → 40 px para mejor visibilidad. `overflow: 'hidden'` garantiza el recorte circular en Android.

---

## Archivos modificados

| Archivo | Cambios principales |
|---|---|
| `src/screens/group/ChatScreen.js` | Fix @todos / @nombre, fix TypeError, input controlado para menciones, bottom sheet padding, `@todos` mensaje notificación |
| `src/screens/group/GroupDetailsScreen.js` | Botón eliminar con `position: absolute`, paddingRight con gap, avatar miembros con foto/iniciales |
| `src/screens/main/GroupsScreen.js` | Fix `acceptInvitation`, bottom sheet padding |
| `src/screens/main/NotificationsScreen.js` | Tab menciones, ScrollView horizontal en tabs, pill de acento, `TouchableOpacity` en lugar de `Pressable`, eliminación de `elevation`, borde tenue para leídos, ancho fijo en tiempo |
| `src/screens/main/ProfileScreen.js` | Foto de perfil: picker, upload, display con `Image` |
| `src/contexts/FileStorageContext.js` | Añadido `uploadUserAvatar` |
| `src/services/firestoreService.js` | `acceptInvitation` lee snapshot antes del batch y retorna objeto de grupo construido |

---

*StudySync — Colaboración académica, sin distracciones.*

---

# StudySync — Update 3.0

**Autor:** Bryan Huaman Roque
**Plataforma:** React Native (Expo)
**Versión:** 3.0.0

---

## Correcciones de bugs

### Chat
- **Delay en el ícono de enviar** — El ícono cambiaba de color con retraso porque dependía de `setHasInput`, que requiere un ciclo de re-render. Solución: se eliminó el estado `hasInput` y se reemplazó por `Animated.Value` con `setValue()`. Dos íconos superpuestos (gris/morado) con opacidad cruzada actualizan el color directamente en el hilo nativo, sin pasar por React.
- **Delay al subir el input con el teclado (Android)** — La animación de 120ms sobre `keyboardDidShow` sumaba delay visible al delay natural del evento. Solución: `keyboardAnim.setValue()` en lugar de `Animated.timing`, actualización instantánea.

### Encuestas y Ruleta en el chat
- **Opciones de ruleta colapsadas** — `alignSelf: "flex-start"` en el wrapper colapsaba el ancho del contenedor, rompiendo el layout flex interno de la lista. Corregido con `alignSelf: "stretch"`.
- **Texto de opción tapado por la barra de votación** — La barra era de altura completa con `position: absolute`, ocultando el texto. Rediseñada como barra delgada de 3px debajo del texto.

---

## Nuevas funcionalidades

### Autenticación
- **Ver/ocultar contraseña** — Botón de ojo en todos los campos de contraseña:
  - Login: campo contraseña.
  - Registro: campo contraseña y confirmar contraseña. El ojo coexiste con el ícono de coincidencia (check/X).
  - Perfil → Cambiar contraseña: los tres campos (actual, nueva, confirmar).

### Chat — Menú de acciones (3 puntos verticales)
- **Reemplaza el ícono de adjuntar** — El botón `MoreVertical` abre un action sheet con dos opciones: Crear encuesta y Ruleta de sorteo.

### Chat — Encuestas
- **Crear encuesta** — Modal con campo de pregunta y lista dinámica de opciones (mín. 2, máx. 6). Botón "Agregar opción" y eliminación individual.
- **Publicar encuesta** — Se envía como mensaje especial con tipo `poll`. Visible para todos los miembros en tiempo real.
- **Votar** — Cualquier miembro puede votar tocando una opción. Solo un voto por persona; el nuevo reemplaza al anterior. Se actualiza en Firestore con `votePoll`.
- **Visualización** — Barra de progreso delgada debajo de cada opción, porcentaje a la derecha, contador total de votos al pie.

### Chat — Ruleta de sorteo
- **Crear ruleta** — Modal con:
  - Campo de título del sorteo (ej. "¿Quién expone?").
  - Chips de miembros del grupo para agregar/quitar con un toque (toggle: rellena espacios vacíos primero).
  - Lista manual de elementos (mín. 2, máx. 10) con botón "Agregar elemento".
  - El modal se resetea limpio cada vez que se abre.
- **Animación de giro** — 26 ciclos con desaceleración exponencial (~3s) que termina en el ganador.
- **Banner de resultado** — Al terminar el giro, aparece un banner con el nombre del ganador dentro del modal.
- **Enviar al chat** — Publica un mensaje especial con tipo `roulette` que muestra:
  - Encabezado con emoji 🎡, título del sorteo y nombre de quien lo lanzó.
  - Lista numerada de todos los participantes; el ganador resaltado en morado con 👑.
  - Caja destacada "¡Le tocó!" con el nombre del ganador en grande.
- **Volver a girar** — Permite repetir el sorteo sin cerrar el modal.

---

## Archivos modificados

| Archivo | Cambios principales |
|---|---|
| `src/screens/auth/LoginScreen.js` | Toggle ver/ocultar contraseña |
| `src/screens/auth/RegisterScreen.js` | Toggle ver/ocultar en contraseña y confirmar contraseña (layout flex con ojo + check/X) |
| `src/screens/main/ProfileScreen.js` | Toggle ver/ocultar en los 3 campos de cambio de contraseña |
| `src/screens/group/ChatScreen.js` | Ícono 3 puntos verticales, encuestas, ruleta, fix delay ícono enviar, fix delay teclado |
| `src/services/firestoreService.js` | Añadido: `votePoll` |

---

*StudySync — Colaboración académica, sin distracciones.*

---

# StudySync — Update 2.0

**Autor:** Bryan Huaman Roque  
**Plataforma:** React Native (Expo)  
**Versión:** 2.0.0

---

## Correcciones de bugs

### Chat
- **Mensajes truncados al enviar** — Los mensajes solo mostraban el primer carácter. Causa: el prop `value` en el TextInput causaba que el buffer nativo de Android fuera sobreescrito en cada re-render por el listener de Firestore. Solución: TextInput no controlado (`inputValueRef` + `textInputRef`).

### Pantalla de Grupos
- **Título del grupo desbordaba el header** — Nombre largo rompía el layout. Corregido con `numberOfLines={1}`, `ellipsizeMode="tail"` y `flex: 1` en el contenedor del título.

### Pantalla de Perfil
- **Avatar tapado por el header púrpura** — El `marginTop: -56` estaba aplicado en `contentContainerStyle` del ScrollView en vez de en `style`, haciendo que el contenido quedara oculto bajo el encabezado.

### Pantalla de Mensajes (lista de chats)
- **Hora pegada al título del chat** — El texto de la hora aparecía sin separación visual del nombre del grupo. Corregido con `gap: 8` en la fila y `minWidth: 0` en la sección de texto.

### Creación de tareas
- **Fecha guardaba un día anterior** — El formato `DD-MM-YYYY` se almacenaba directamente en Firestore y `new Date("DD-MM-YYYY")` lo parseaba incorrectamente. Solución: conversión a `YYYY-MM-DD` con `toISO()` antes de guardar.

---

## Nuevas funcionalidades

### Autenticación
- **Animación de ola en "StudySync"** — Al entrar al login, cada letra del título ejecuta una animación de rebote escalonada (efecto wave) que se reproduce una sola vez.
- **Banner de error inline** — Los errores de login ya no muestran un Alert modal; aparecen como un banner rojo sobre el formulario.
- **Campo de repetir contraseña en registro** — Incluye ícono en tiempo real (`CheckCircle` / `XCircle`) que indica si las contraseñas coinciden.
- **Validación en tiempo real en registro** — Errores por campo visibles al perder el foco. El botón de registro se habilita solo cuando todos los campos son válidos.
  - Nombre: mínimo 2 palabras
  - Correo: formato válido con regex
  - Teléfono: entre 7 y 15 dígitos
  - Contraseña: mínimo 8 caracteres, una mayúscula, un número y un carácter especial
  - Confirmar contraseña: debe coincidir exactamente

### Grupos
- **Avatar de grupo con icono `UsersRound`** — Reemplaza las iniciales en la lista de grupos y lista de mensajes para reflejar visualmente que es un grupo.
- **Iniciales nombre+apellido en sección de miembros** — El avatar de cada miembro dentro del detalle de grupo muestra las iniciales de su nombre y apellido.
- **Editar grupo (solo líderes)** — Botón de lápiz en el header del detalle de grupo. Abre un modal para modificar nombre y descripción del grupo.
- **Estado inicial del grupo cambiado** — Al crear un grupo nuevo, el estado por defecto pasa de "Todo al día" a "Por iniciar", que es semánticamente correcto para un grupo sin tareas aún.
- **Editar tarea (solo líderes)** — Ícono de lápiz en cada tarea del listado. Reutiliza la pantalla `CreateTaskScreen` en modo edición con los campos pre-cargados.

### Chat
- **Panel de miembros del grupo en el header** — Botón `UsersRound` en el header del chat. Al presionarlo muestra un panel desplegable con todos los miembros separados en "Conectados" y "Desconectados", con indicadores de presencia en tiempo real.
- **Sistema de presencia en tiempo real** — Se registra cuándo un usuario está activo en el chat (`activeInChat`, `lastActive`). Se limpia automáticamente al salir de la pantalla.
- **Editar mensajes** — Long press sobre un mensaje propio abre un action sheet. La opción "Editar" abre un modal con el texto pre-cargado. Los mensajes editados muestran la etiqueta *editado* al lado de la hora.
- **Eliminar mensajes** — Desde el mismo action sheet, opción "Eliminar" con confirmación. El mensaje desaparece en tiempo real para todos los miembros.
- **Vibración al long press** — Al mantener presionado un mensaje propio, el dispositivo vibra brevemente (40ms) como retroalimentación háptica.
- **Separadores de fecha entre mensajes** — Los mensajes se agrupan visualmente por día. El separador muestra: "Hoy", "Ayer", o la fecha formateada ("12 de enero", "12 de enero de 2024").

### Selector de fecha en tareas
- **DateTimePicker integrado** — Botón de calendario junto al campo de fecha en la creación/edición de tareas. Compatible con iOS (modo inline) y Android (modo default).
- **Formato de visualización DD-MM-YYYY** — La fecha se muestra en formato local y se convierte a `YYYY-MM-DD` solo al guardar en Firestore.

### Perfil
- **Botón de editar avatar funcional** — El ícono de lápiz sobre el avatar navega directamente a la subvista de edición de perfil (nombre y teléfono).

### Tema oscuro / claro
- **Toggle de tema en ajustes de perfil** — Nueva fila en "Ajustes de cuenta" con ícono de Sol/Luna. Alterna entre modo claro y modo oscuro instantáneamente en toda la aplicación.
- **Modo oscuro en todas las pantallas:**
  - Login y Registro
  - Grupos (lista, detalle, crear grupo)
  - Mensajes (lista de chats, chat interno)
  - Perfil y sub-vistas (editar perfil, cambiar contraseña)
  - Crear / Editar Tarea
  - Modales (invitar miembro, editar grupo, action sheet de mensajes, panel de miembros)
  - Componentes compartidos: `TaskItem`, `EmptyState`
  - Tab bar inferior

---

## Archivos creados

| Archivo | Descripción |
|---|---|
| `src/contexts/ThemeContext.js` | Context de tema con tokens `light` y `dark`, hook `useTheme()` y `ThemeProvider` |
| `src/utils/dateUtils.js` | Utilidades de fecha: `isOverdue`, `formatDate`, `formatShortDate`, `getDaysUntilDue`, `formatTime`, `getTodayString` |

## Archivos modificados

| Archivo | Cambios principales |
|---|---|
| `App.js` | Envuelto con `ThemeProvider` |
| `src/navigation/BottomTabNavigator.js` | Tab bar usa colores del tema |
| `src/services/firestoreService.js` | Añadido: `editMessage`, `deleteMessage`, `updateGroup`, `updateTask`, `setUserPresence`, `clearUserPresence`, `getOnlineMembers` |
| `src/screens/auth/LoginScreen.js` | Animación wave, banner de error inline |
| `src/screens/auth/RegisterScreen.js` | Validación en tiempo real, confirmar contraseña, botón condicional |
| `src/screens/main/GroupsScreen.js` | Avatar de grupo, estado inicial, dark mode |
| `src/screens/main/MessagesListScreen.js` | Avatar de grupo, fix de hora, dark mode |
| `src/screens/main/ProfileScreen.js` | Fix avatar, editar perfil funcional, toggle dark mode |
| `src/screens/group/GroupDetailsScreen.js` | Editar grupo, editar tarea, iniciales de miembros, dark mode |
| `src/screens/group/ChatScreen.js` | Panel de presencia, editar/eliminar mensajes, vibración, separadores de fecha, dark mode |
| `src/screens/group/CreateTaskScreen.js` | DateTimePicker, modo edición, dark mode |
| `src/components/TaskItem.js` | Botón editar para líderes, dark mode |
| `src/components/EmptyState.js` | Dark mode |

---

*StudySync — Colaboración académica, sin distracciones.*
