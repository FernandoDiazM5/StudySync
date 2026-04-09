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
