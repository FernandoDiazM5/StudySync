// ============================================
// FIRESTORE SERVICE - StudySync
// CRUD para Groups, Tasks, Messages, Files, Users
// ============================================

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
  documentId,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// Logger central de errores Firestore
const logFirestoreError = (context) => (error) => {
  console.error(`[Firestore:${context}]`, error?.code || '', error?.message || error);
};

// ── Caché en memoria para perfiles de usuario ──────────────────────────────
// Evita múltiples getDoc al mismo UID dentro de la misma sesión.
// Se invalida automáticamente cuando el perfil se actualiza (updateUserProfile).
const _userCache = new Map();

/** Invalida la caché en memoria de un usuario (tras crear/actualizar perfil). */
export const invalidateUserCache = (uid) => {
  if (uid) _userCache.delete(uid);
};

// ==========================================
// USERS
// ==========================================

/**
 * Obtener perfil de usuario por UID
 */
export const getUser = async (uid) => {
  if (_userCache.has(uid)) return _userCache.get(uid);
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = { id: docSnap.id, ...docSnap.data() };
    _userCache.set(uid, data);
    return data;
  }
  return null;
};

/**
 * Buscar usuario por email (para invitaciones)
 */
export const getUserByEmail = async (email) => {
  if (!email) return null;
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.trim().toLowerCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

/**
 * Obtener múltiples usuarios por sus IDs.
 * Usa consultas `documentId in (...)` por lotes (hasta 30) para menos viajes
 * a red que N getDoc en paralelo; sigue usando caché en memoria vía getUser.
 */
export const getUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  const ordered = [...new Set(userIds.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < ordered.length; i += 30) {
    chunks.push(ordered.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      if (!chunk.length) return;
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where(documentId(), 'in', chunk)),
        );
        snap.docs.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          _userCache.set(d.id, data);
        });
      } catch (e) {
        logFirestoreError('getUsersByIds')(e);
        await Promise.all(
          chunk.map((uid) => getUser(uid).catch(() => null)),
        );
      }
    }),
  );

  return ordered
    .map((id) => _userCache.get(id))
    .filter(Boolean)
    .map((u) => ({
      ...u,
      // `name` en Profile es la fuente de verdad para mostrar autor en chat.
      name: (u?.name || '').trim(),
    }));
};

/**
 * Marcar usuario como online en la app (nivel global, no por chat)
 */
export const setUserOnline = async (uid) => {
  await updateDoc(doc(db, 'users', uid), {
    isOnline: true,
    lastSeen: new Date().toISOString(),
  });
};

/**
 * Marcar usuario como offline
 */
export const setUserOffline = async (uid) => {
  await updateDoc(doc(db, 'users', uid), {
    isOnline: false,
    lastSeen: new Date().toISOString(),
  });
};

/**
 * Escuchar miembros online de un grupo.
 * Un listener por `users/{uid}` (solo miembros del grupo) para no escanear
 * toda la colección de usuarios con isOnline==true.
 * `isOnline` refleja si la app está en primer plano (ver AppNavigator + AppState).
 */
export const getOnlineMembers = (_groupId, memberIds, callback) => {
  if (!memberIds?.length) {
    callback([]);
    return () => {};
  }
  const ids = [...new Set(memberIds)];
  const onlineById = new Map();
  let flushTimer = null;
  const emit = () => {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const list = ids
        .map((id) => onlineById.get(id))
        .filter(Boolean);
      callback(list);
    }, 0);
  };

  const unsubs = ids.map((id) =>
    onSnapshot(
      doc(db, 'users', id),
      (snap) => {
        if (!snap.exists()) {
          onlineById.delete(id);
        } else {
          const d = snap.data();
          if (d?.isOnline === true) {
            onlineById.set(id, {
              id,
              name: d.name || d.displayName || '',
              ...d,
            });
          } else {
            onlineById.delete(id);
          }
        }
        emit();
      },
      () => {
        onlineById.delete(id);
        emit();
      },
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
    if (flushTimer != null) clearTimeout(flushTimer);
  };
};

// ── Aliases para compatibilidad con ChatScreen (se eliminan gradualmente) ──
/** @deprecated Usar setUserOnline */
export const setUserPresence = (uid, _groupId) => setUserOnline(uid);
/** @deprecated Usar setUserOffline */
export const clearUserPresence = (uid) => setUserOffline(uid);

/**
 * Actualizar perfil de usuario
 */
export const updateUserProfile = async (uid, data) => {
  invalidateUserCache(uid);
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

// ==========================================
// GROUPS
// ==========================================

/** Normaliza fechas Firestore / ISO / número a ms (0 si inválido). */
const firestoreValueToMs = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v > 1e12 ? v : v * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') {
    try {
      return v.toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof v?.seconds === 'number') {
    return (
      v.seconds * 1000 +
      (typeof v.nanoseconds === 'number' ? v.nanoseconds / 1e6 : 0)
    );
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
};

/**
 * Tiempo usado para ordenar la lista de grupos del usuario (unión al grupo o creación).
 */
export const groupSortTimeMs = (group, userId) => {
  if (!group || !userId) return 0;
  const joinedMs = firestoreValueToMs(group.membersJoinedAt?.[userId]);
  if (joinedMs > 0) return joinedMs;
  return firestoreValueToMs(group.createdAt);
};

/**
 * Orden estable: más reciente primero; mismo tiempo → por id (evita saltos al reconectar / caché).
 */
export const sortGroupsForUser = (groups, userId) => {
  if (!userId || !groups?.length) return groups ? [...groups] : [];
  return [...groups].sort((a, b) => {
    const tb = groupSortTimeMs(b, userId);
    const ta = groupSortTimeMs(a, userId);
    if (tb !== ta) return tb - ta;
    return String(a.id).localeCompare(String(b.id));
  });
};

/**
 * Obtener grupos del usuario actual (donde es miembro)
 * CASCADA: usuario → grupos donde members array-contains user.uid
 */
export const getMyGroups = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'groups'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(sortGroupsForUser(groups, userId));
    },
    logFirestoreError('getMyGroups')
  );
};

/**
 * Actualizar datos de un grupo
 */
export const updateGroup = async (groupId, data) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
};

/**
 * Obtener un grupo por ID
 */
export const getGroup = async (groupId) => {
  const docRef = doc(db, 'groups', groupId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

/**
 * Escuchar un grupo en tiempo real (para detectar cambios en members, nombre, etc.)
 */
export const listenGroup = (groupId, callback) => {
  if (!groupId) { callback(null); return () => {}; }
  const docRef = doc(db, 'groups', groupId);
  return onSnapshot(docRef, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, (e) => {
    console.error('[listenGroup]', e?.code, e?.message);
    callback(null);
  });
};

/**
 * Crear un nuevo grupo
 */
export const createGroup = async (groupData) => {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, 'groups'), {
    ...groupData,
    createdAt: now,
    status: 'En progreso',
    // timestamp de unión por usuario (para ordenar la lista del creador)
    membersJoinedAt: groupData.leaderId ? { [groupData.leaderId]: now } : {},
  });
  return docRef.id;
};

/**
 * Agregar miembro a un grupo
 */
export const addMemberToGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    members: arrayUnion(userId),
    [`membersJoinedAt.${userId}`]: now,
  });
};

/**
 * Remover miembro de un grupo
 */
export const removeMemberFromGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, {
    members: arrayRemove(userId),
    moderators: arrayRemove(userId), // si era moderador, también se le quita
  });
};

/**
 * Agregar moderador a un grupo
 */
export const addModeratorToGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, { moderators: arrayUnion(userId) });
};

/**
 * Quitar rol de moderador a un miembro
 */
export const removeModeratorFromGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, { moderators: arrayRemove(userId) });
};

// ==========================================
// INVITATIONS
// ==========================================

/**
 * Crear una invitación a un grupo.
 * Evita duplicados: si ya existe una invitación pendiente para ese usuario+grupo, no crea otra.
 */
export const inviteUserToGroup = async ({ groupId, groupName, invitedUserId, invitedBy, invitedByName }) => {
  if (!groupId || !invitedUserId || !invitedBy) {
    throw new Error('Faltan datos para crear la invitación');
  }
  // ¿Ya es miembro?
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error('El grupo no existe');
  const members = groupSnap.data().members || [];
  if (members.includes(invitedUserId)) {
    throw new Error('Este usuario ya es miembro del grupo');
  }
  // ¿Ya hay invitación pendiente?
  const existingQ = query(
    collection(db, 'invitations'),
    where('groupId', '==', groupId),
    where('invitedUserId', '==', invitedUserId),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    throw new Error('Ya hay una invitación pendiente para este usuario');
  }
  // Guardar snapshot de los campos del grupo necesarios para mostrar la
  // tarjeta inmediatamente al aceptar, sin requerir una lectura adicional.
  const gd = groupSnap.data();
  const docRef = await addDoc(collection(db, 'invitations'), {
    groupId,
    groupName:      groupName || gd.name || '',
    groupDesc:      gd.desc       || '',
    groupLeaderId:  gd.leaderId   || '',
    groupPhotoURL:  gd.photoURL   || null,
    groupStatus:    gd.status     || 'En progreso',
    groupCreatedAt: gd.createdAt  || new Date().toISOString(),
    invitedUserId,
    invitedBy,
    invitedByName: invitedByName || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  // Notificación in-app (fire-and-forget)
  createNotification(invitedUserId, {
    type: 'invitation',
    title: '¡Invitación a grupo!',
    body: `${invitedByName || 'Alguien'} te invitó a unirte a "${groupName}"`,
    titleKey: 'notifInvitationTitle',
    bodyKey: 'notifInvitationBody',
    notifParams: { who: invitedByName || '', group: groupName },
    data: { groupId, invitationId: docRef.id },
  }).catch((e) => console.error('[notif:invitation]', e?.message));
  return docRef.id;
};

/**
 * Escuchar invitaciones pendientes del usuario actual en tiempo real
 */
export const getMyInvitations = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'invitations'),
    where('invitedUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const invitations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(invitations);
    },
    logFirestoreError('getMyInvitations')
  );
};

/**
 * Aceptar invitación: agrega al usuario a members del grupo y marca la invitación como aceptada.
 * Operación atómica con writeBatch.
 * Retorna un objeto de grupo construido desde los datos almacenados en la invitación,
 * evitando una lectura adicional al documento de grupo (que podría ser bloqueada por
 * reglas de seguridad antes de que el listener de onSnapshot se re-evalúe).
 */
export const acceptInvitation = async (invitationId, groupId, userId) => {
  if (!invitationId || !groupId || !userId) {
    throw new Error('Faltan datos para aceptar la invitación');
  }

  // Leer la invitación ANTES del batch para obtener el snapshot del grupo
  // (el invitador tenía acceso de lectura al grupo, por eso los campos se guardaron aquí)
  const invitationRef = doc(db, 'invitations', invitationId);
  const invSnap = await getDoc(invitationRef);
  const invData = invSnap.exists() ? invSnap.data() : {};

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);

  batch.update(groupRef, {
    members: arrayUnion(userId),
    // registrar cuándo se unió este usuario (para ordenar su lista de grupos)
    [`membersJoinedAt.${userId}`]: now,
  });
  batch.update(invitationRef, {
    status: 'accepted',
    respondedAt: now,
  });
  await batch.commit();

  // Construir y retornar el objeto del grupo desde los datos de la invitación.
  // Esto permite mostrarlo inmediatamente en la UI sin depender de una lectura
  // adicional que podría fallar si las reglas de Firestore aún no reflejaron
  // el nuevo miembro (el listener onSnapshot lo actualizará en breve).
  return {
    id: groupId,
    name:            invData.groupName      || '',
    desc:            invData.groupDesc      || '',
    leaderId:        invData.groupLeaderId  || '',
    photoURL:        invData.groupPhotoURL  || null,
    status:          invData.groupStatus    || 'En progreso',
    createdAt:       invData.groupCreatedAt || now,
    members:         [userId],
    membersJoinedAt: { [userId]: now },
  };
};

/**
 * Rechazar invitación
 */
export const declineInvitation = async (invitationId) => {
  if (!invitationId) return;
  const ref = doc(db, 'invitations', invitationId);
  await updateDoc(ref, {
    status: 'declined',
    respondedAt: new Date().toISOString()
  });
};

// ==========================================
// TASKS
// ==========================================

/**
 * Notifica al asignado como si fuera una tarea nueva (creación o reasignación).
 * Se ejecuta en microtarea; `createNotification` debe estar ya definido en el módulo.
 */
function enqueueNewTaskAssignedNotification(assigneeId, taskId, title, groupId) {
  if (!assigneeId || !taskId) return;
  (async () => {
    try {
      const group = groupId ? await getGroup(groupId) : null;
      const groupName = group?.name || "";
      const taskTitle = title || "";
      await createNotification(assigneeId, {
        type: "task",
        title: "Nueva tarea asignada",
        body: groupName ? `${taskTitle} · ${groupName}` : taskTitle,
        titleKey: "notifNewTaskTitle",
        bodyKey: groupName ? "notifNewTaskBodyWithGroup" : "notifNewTaskBodyTaskOnly",
        notifParams: { task: taskTitle, group: groupName || "" },
        data: {
          taskId,
          groupId,
          taskName: taskTitle,
          groupName,
        },
      });
    } catch (e) {
      console.error("[notif:task:assign]", e?.message);
    }
  })();
}

/**
 * Escuchar tareas de un grupo en tiempo real
 * CASCADA: grupo → tareas donde groupId == grupo.id
 */
export const getGroupTasks = (groupId, callback) => {
  if (!groupId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'tasks'),
    where('groupId', '==', groupId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(tasks);
    },
    logFirestoreError('getGroupTasks')
  );
};

/**
 * Crear una nueva tarea
 */
export const createTask = async (taskData) => {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    createdAt: new Date().toISOString()
  });
  if (taskData.assigneeId) {
    enqueueNewTaskAssignedNotification(
      taskData.assigneeId,
      docRef.id,
      taskData.title,
      taskData.groupId,
    );
  }
  return docRef.id;
};

/**
 * Editar una tarea.
 * Si cambian los valores de dueDate, dueTime o assigneeId respecto al doc anterior,
 * resetea las flags de notificación para que los recordatorios vuelvan a evaluarse.
 * Editar solo título, descripción, prioridad, etc. no resetea flags.
 */
export const updateTask = async (taskId, data) => {
  const docRef = doc(db, 'tasks', taskId);
  let previous = null;
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) previous = snap.data();
  } catch {
    /* noop */
  }
  const previousAssigneeId = previous?.assigneeId || null;
  const normalizeDueDate = (v) =>
    !v || v === "Sin fecha" ? "Sin fecha" : String(v);
  const normalizeDueTime = (v) => {
    if (v == null || v === "") return null;
    return String(v).trim();
  };

  // Solo si cambian valores reales (no basta con que el payload traiga la clave, p. ej. CreateTask envía siempre dueDate/dueTime).
  const dueDateChanged =
    "dueDate" in data &&
    normalizeDueDate(data.dueDate) !== normalizeDueDate(previous?.dueDate);
  const dueTimeChanged =
    "dueTime" in data &&
    normalizeDueTime(data.dueTime) !== normalizeDueTime(previous?.dueTime);
  const assigneeChanged =
    "assigneeId" in data &&
    (data.assigneeId || null) !== previousAssigneeId;

  const updateData = { ...data, updatedAt: new Date().toISOString() };
  if (dueDateChanged || dueTimeChanged || assigneeChanged) {
    // Resetear flags de recordatorios al cambiar fecha/hora o asignado (vuelven a aplicar ventanas 1d/2d/3d / hoy / vencida)
    updateData.notif3daysBefore       = false;
    updateData.notif2daysBefore       = false;
    updateData.notif1dayBefore        = false;
    updateData.notifDueToday          = false;
    updateData.notifExpired           = false;
    updateData.notifLeaderAtRisk      = false;
    updateData.notifLeaderMemberStuck = false;
  }
  // Si el miembro mueve el estado, resetear el flag de "sin avance"
  // para que el líder no reciba notificaciones obsoletas si la fecha se extiende
  if ('status' in data) {
    updateData.notifLeaderMemberStuck = false;
  }
  await updateDoc(docRef, updateData);

  const nextAssigneeId =
    data.assigneeId !== undefined ? data.assigneeId || null : previousAssigneeId;
  if (
    nextAssigneeId &&
    nextAssigneeId !== previousAssigneeId
  ) {
    const title =
      data.title !== undefined ? data.title : previous?.title || "";
    const groupId =
      data.groupId !== undefined ? data.groupId : previous?.groupId;
    enqueueNewTaskAssignedNotification(
      nextAssigneeId,
      taskId,
      title,
      groupId,
    );
  }
};

/**
 * Actualizar estado de una tarea
 */
export const updateTaskStatus = async (taskId, newStatus, taskMeta = {}) => {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });
  // Cuando se completa, notificar a los miembros del grupo (fire-and-forget)
  if (newStatus === 'Completada' && taskMeta.groupId && taskMeta.title) {
    (async () => {
      try {
        const group = await getGroup(taskMeta.groupId);
        if (!group?.members) return;
        const assigneeName = taskMeta.assigneeName || 'Un miembro';
        await Promise.all(
          group.members
            .filter((uid) => uid !== taskMeta.assigneeId)
            .map((uid) =>
              createNotification(uid, {
                type: 'group',
                title: `Tarea completada en ${group.name}`,
                body: `${assigneeName} completó: ${taskMeta.title}`,
                titleKey: 'notifTaskCompletedTitle',
                bodyKey: 'notifTaskCompletedBody',
                notifParams: {
                  group: group.name,
                  who: assigneeName,
                  task: taskMeta.title,
                },
                data: { groupId: taskMeta.groupId, taskId },
              })
            )
        );
      } catch (e) {
        console.error('[notif:taskComplete]', e?.message);
      }
    })();
  }
};

/**
 * Escuchar en tiempo real las tareas asignadas a un usuario (bandeja personal)
 */
export const getMyAssignedTasks = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'tasks'),
    where('assigneeId', '==', userId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(tasks);
    },
    logFirestoreError('getMyAssignedTasks')
  );
};

/**
 * Obtener tareas de múltiples grupos (para la pantalla de mensajes)
 */
export const getTasksByGroups = async (groupIds) => {
  if (!groupIds || groupIds.length === 0) return [];
  const batchResults = await Promise.all(
    groupIds.map(async (groupId) => {
      const q = query(
        collection(db, 'tasks'),
        where('groupId', '==', groupId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    })
  );
  return batchResults.flat();
};

// ==========================================
// MESSAGES
// ==========================================

/**
 * Escuchar mensajes de un grupo en tiempo real
 * CASCADA: grupo → mensajes ordenados por fecha
 * NOTA: Usamos orden client-side para evitar índice compuesto en Firestore.
 */
export const getGroupMessages = (groupId, callback) => {
  if (!groupId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'messages'),
    where('groupId', '==', groupId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      callback(messages);
    },
    logFirestoreError('getGroupMessages')
  );
};

/**
 * Enviar un mensaje
 * Además de guardar en /messages, actualiza el campo `lastMessage`
 * del documento del grupo para que el badge del tab pueda resolverse
 * con una sola query (getMyGroups) sin necesidad de N listeners extra.
 */
export const sendMessage = async (messageData) => {
  const createdAt = new Date().toISOString();
  const docRef = await addDoc(collection(db, 'messages'), {
    ...messageData,
    createdAt,
    readBy: [messageData.authorId],
  });

  // Texto resumido para la preview (según tipo de mensaje)
  const previewText =
    messageData.text ||
    (messageData.type === 'poll' ? '📊 Encuesta' :
     messageData.fileName  ? `📎 ${messageData.fileName}` : '📎 Archivo');

  // Denormalizar en el grupo → permite badge instantáneo
  await updateDoc(doc(db, 'groups', messageData.groupId), {
    lastMessage: {
      id: docRef.id,
      text: previewText,
      senderId: messageData.authorId,
      createdAt,
      readBy: [messageData.authorId],
    },
  });

  return docRef.id;
};

/**
 * Marcar mensajes como leídos
 */
export const markMessagesAsRead = async (groupId, userId) => {
  const q = query(
    collection(db, 'messages'),
    where('groupId', '==', groupId)
  );
  const snapshot = await getDocs(q);
  
  // Filtrar solo los mensajes que realmente necesitan ser marcados
  const unreadDocs = snapshot.docs.filter(docSnap => {
    const data = docSnap.data();
    return !data.readBy || !data.readBy.includes(userId);
  });
  
  // Si no hay mensajes sin leer, evitar batch vacío
  if (unreadDocs.length === 0) return;
  
  // Firestore soporta máx. 500 operaciones por batch
  const BATCH_SIZE = 500;
  for (let i = 0; i < unreadDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = unreadDocs.slice(i, i + BATCH_SIZE);
    chunk.forEach(docSnap => {
      batch.update(docSnap.ref, { readBy: arrayUnion(userId) });
    });
    await batch.commit();
  }

  // Marcar también el lastMessage del grupo como leído por este usuario
  // para que el badge desaparezca inmediatamente al abrir el chat
  await updateDoc(doc(db, 'groups', groupId), {
    'lastMessage.readBy': arrayUnion(userId),
  });
};

/**
 * Toggle mensaje importante
 */
export const toggleMessageImportant = async (messageId, currentValue) => {
  const docRef = doc(db, 'messages', messageId);
  await updateDoc(docRef, {
    important: !currentValue
  });
};

/**
 * Editar texto de un mensaje
 */
export const editMessage = async (messageId, newText) => {
  const docRef = doc(db, 'messages', messageId);
  await updateDoc(docRef, {
    text: newText.trim(),
    edited: true,
    editedAt: new Date().toISOString(),
  });
};

/**
 * Votar en una encuesta (reemplaza voto anterior del usuario)
 */
export const votePoll = async (messageId, optionIndex, userId) => {
  const docRef = doc(db, 'messages', messageId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const currentVotes = snap.data().votes || {};
  const newVotes = {};
  for (const key of Object.keys(currentVotes)) {
    newVotes[key] = (currentVotes[key] || []).filter((id) => id !== userId);
  }
  const k = String(optionIndex);
  newVotes[k] = [...(newVotes[k] || []), userId];
  await updateDoc(docRef, { votes: newVotes });
};

/** Un mensaje por id (p. ej. revertir UI tras error al votar). */
export const getMessageById = async (messageId) => {
  if (!messageId) return null;
  try {
    const snap = await getDoc(doc(db, 'messages', messageId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    logFirestoreError('getMessageById')(e);
    return null;
  }
};

/**
 * Eliminar un mensaje
 */
export const deleteMessage = async (messageId) => {
  const docRef = doc(db, 'messages', messageId);
  await deleteDoc(docRef);
};

/**
 * Obtener último mensaje de un grupo
 * NOTA: Sin orderBy en la query para evitar índice compuesto. Ordenamos en cliente.
 */

export const getLastMessage = async (groupId) => {
  try {
    // Intentar con orderBy + limit (requiere índice compuesto)
    // Si falla, cae al método de fallback
    try {
      const q = query(
        collection(db, 'messages'),
        where('groupId', '==', groupId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length === 0) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (indexError) {
      // Fallback: sin orderBy (hasta que el índice compuesto sea creado)
      console.warn('[getLastMessage] Índice compuesto no encontrado, usando fallback. Crea el índice en Firebase Console.');
      const q = query(
        collection(db, 'messages'),
        where('groupId', '==', groupId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length === 0) return null;
      const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      messages.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return messages[0];
    }
  } catch (error) {
    logFirestoreError('getLastMessage')(error);
    return null;
  }
};

/**
 * Obtener el último mensaje de cada grupo en UNA sola ronda de red (Promise.all).
 * Usado para migrar grupos sin el campo `lastMessage` denormalizado.
 * @param {string[]} groupIds
 * @returns {Promise<Array<{groupId, msg}>>}
 */
export const fetchLastMessagesForGroups = async (groupIds) => {
  if (!groupIds.length) return [];
  const results = await Promise.all(
    groupIds.map(async (groupId) => {
      try {
        const q = query(
          collection(db, 'messages'),
          where('groupId', '==', groupId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.docs.length === 0) return { groupId, msg: null };
        return { groupId, msg: { id: snap.docs[0].id, ...snap.docs[0].data() } };
      } catch {
        // Índice no disponible: fallback sin orderBy
        try {
          const q2 = query(collection(db, 'messages'), where('groupId', '==', groupId));
          const snap2 = await getDocs(q2);
          if (snap2.docs.length === 0) return { groupId, msg: null };
          const msgs = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
          msgs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          return { groupId, msg: msgs[0] };
        } catch {
          return { groupId, msg: null };
        }
      }
    })
  );
  return results;
};

/**
 * Escribe el campo `lastMessage` en el documento del grupo (migración).
 * Fire-and-forget: el caller ignora el resultado.
 */
export const migrateGroupLastMessage = (groupId, msg) =>
  updateDoc(doc(db, 'groups', groupId), {
    lastMessage: {
      id:       msg.id,
      text:     msg.text || (msg.type === 'poll' ? '📊 Encuesta' : msg.fileName ? `📎 ${msg.fileName}` : '📎 Archivo'),
      senderId: msg.authorId,
      createdAt: msg.createdAt,
      readBy:   msg.readBy || [],
    },
  });

export const onLastMessage = (groupId, callback) => {
  // Try with index (orderBy + limit), fall back to full collection if index missing
  try {
    const q = query(
      collection(db, 'messages'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (snapshot.docs.length === 0) { callback(null); return; }
      callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    }, () => {
      // Index missing — fallback: listen to all messages for this group and pick latest
      const qFallback = query(collection(db, 'messages'), where('groupId', '==', groupId));
      return onSnapshot(qFallback, (snapshot) => {
        if (snapshot.docs.length === 0) { callback(null); return; }
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        msgs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(msgs[0]);
      }, () => callback(null));
    });
  } catch {
    callback(null);
    return () => {};
  }
};

// ==========================================
// FILES
// ==========================================

/**
 * Escuchar archivos de un grupo en tiempo real
 * CASCADA: grupo → archivos donde groupId == grupo.id
 */
export const getGroupFiles = (groupId, callback) => {
  if (!groupId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'files'),
    where('groupId', '==', groupId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const files = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(files);
    },
    logFirestoreError('getGroupFiles')
  );
};

/**
 * Registrar un archivo subido
 */
export const addFileRecord = async (fileData) => {
  const docRef = await addDoc(collection(db, 'files'), {
    ...fileData,
    uploadedAt: new Date().toISOString()
  });
  return docRef.id;
};

/**
 * Agregar archivo a un grupo
 * Guarda metadatos en Firestore, la URL pública viene de Supabase Storage
 */
export const addGroupFile = async (fileData) => {
  try {
    const docRef = await addDoc(
      collection(db, 'files'),
      {
        ...fileData,
        uploadedAt: fileData.uploadedAt instanceof Date
          ? fileData.uploadedAt.toISOString()
          : (fileData.uploadedAt || new Date().toISOString()),
      }
    );
    // Notificar a miembros del grupo (fire-and-forget)
    if (fileData.groupId && fileData.uploadedBy) {
      (async () => {
        try {
          const group = await getGroup(fileData.groupId);
          if (!group?.members) return;
          const uploaderName = fileData.uploadedByName || 'Alguien';
          await Promise.all(
            group.members.map((uid) =>
              createNotification(uid, {
                type: 'group',
                title: `Nuevo archivo en ${group.name}`,
                body: uid === fileData.uploadedBy
                  ? `Subiste: ${fileData.fileName}`
                  : `${uploaderName} subió: ${fileData.fileName}`,
                titleKey: 'notifNewFileTitle',
                bodyKey: uid === fileData.uploadedBy
                  ? 'notifNewFileBodySelf'
                  : 'notifNewFileBodyOther',
                notifParams: {
                  group: group.name,
                  who: uploaderName,
                  file: fileData.fileName,
                },
                data: { groupId: fileData.groupId, tab: 'archivos', fileId: docRef.id },
              })
            )
          );
        } catch (e) {
          console.error('[notif:fileUpload]', e?.message);
        }
      })();
    }
    return { id: docRef.id, ...fileData };
  } catch (error) {
    console.error('Error adding group file:', error);
    throw error;
  }
};

/**
 * Eliminar archivo de un grupo
 * Solo elimina el registro en Firestore, Supabase Storage se elimina por separado
 */
export const deleteGroupFile = async (groupId, fileId) => {
  try {
    await deleteDoc(doc(db, 'files', fileId));
    return true;
  } catch (error) {
    console.error('Error deleting group file:', error);
    throw error;
  }
};

// ==========================================
// ELIMINACIÓN DE GRUPOS Y TAREAS
// ==========================================

/**
 * Eliminar una tarea por su ID
 * Solo el líder del grupo debería invocar esta función
 */
export const deleteTask = async (taskId) => {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

/**
 * Eliminar un grupo completo y todos sus datos asociados
 * Elimina: mensajes, tareas, archivos y el documento del grupo
 * Solo el líder del grupo debería invocar esta función
 */
export const deleteGroup = async (groupId) => {
  try {
    // 1. Obtener todos los mensajes del grupo
    const messagesQ = query(collection(db, 'messages'), where('groupId', '==', groupId));
    const messagesSnap = await getDocs(messagesQ);

    // 2. Obtener todas las tareas del grupo
    const tasksQ = query(collection(db, 'tasks'), where('groupId', '==', groupId));
    const tasksSnap = await getDocs(tasksQ);

    // 3. Obtener todos los archivos del grupo
    const filesQ = query(collection(db, 'files'), where('groupId', '==', groupId));
    const filesSnap = await getDocs(filesQ);

    // 4. Eliminar todo en batches (máx 500 por batch)
    const allDocs = [
      ...messagesSnap.docs,
      ...tasksSnap.docs,
      ...filesSnap.docs,
    ];

    const BATCH_SIZE = 500;
    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = allDocs.slice(i, i + BATCH_SIZE);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 5. Eliminar invitaciones pendientes del grupo
    const invitesQ = query(collection(db, 'invitations'), where('groupId', '==', groupId));
    const invitesSnap = await getDocs(invitesQ);
    if (invitesSnap.docs.length > 0) {
      const batch = writeBatch(db);
      invitesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 6. Eliminar el documento del grupo
    await deleteDoc(doc(db, 'groups', groupId));

    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

/**
 * Salir de un grupo (para miembros que no son el líder)
 * Remueve al usuario del array de miembros
 */
export const leaveGroup = async (groupId, userId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      members: arrayRemove(userId),
    });
    return true;
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error;
  }
};

// ==========================================
// TYPING INDICATOR
// ==========================================

/**
 * Marca al usuario como escribiendo (isTyping=true) o no (false).
 * Usa la subcolección groups/{groupId}/typing/{userId}
 */
export const setTypingStatus = async (groupId, userId, isTyping) => {
  try {
    const ref = doc(db, 'groups', groupId, 'typing', userId);
    if (isTyping) {
      await setDoc(ref, { updatedAt: new Date().toISOString() });
    } else {
      await deleteDoc(ref);
    }
  } catch (_) {}
};

/**
 * Escucha quién está escribiendo en el grupo (excluye al usuario actual).
 * Devuelve un array de userIds.
 */
export const onTypingStatus = (groupId, currentUserId, callback) => {
  const ref = collection(db, 'groups', groupId, 'typing');
  return onSnapshot(ref, (snap) => {
    const ids = snap.docs.map((d) => d.id).filter((id) => id !== currentUserId);
    callback(ids);
  }, () => callback([]));
};

// ==========================================
// NOTIFICATIONS
// ==========================================

/**
 * Crear una notificación in-app para un usuario.
 * type: 'invitation' | 'task' | 'group'
 * data: objeto con info para navegar al tocar (groupId, taskId, etc.)
 */
export const createNotification = async (userId, payload) => {
  if (!userId) return;
  const { type, title, body, data = {}, titleKey, bodyKey, notifParams } = payload;
  try {
    // Usamos doc() + setDoc en lugar de addDoc.
    // addDoc internamente usa una precondición "create-only" (exists: false).
    // Si el SDK reintenta la escritura (error de red transitorio) y el documento
    // ya llegó al servidor, lanza "already-exists".
    // setDoc hace un write incondicional → idempotente ante reintentos.
    const ref = doc(collection(db, 'notifications'));
    const docData = {
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (titleKey) docData.titleKey = titleKey;
    if (bodyKey) docData.bodyKey = bodyKey;
    if (notifParams && typeof notifParams === 'object' && Object.keys(notifParams).length) {
      docData.notifParams = notifParams;
    }
    await setDoc(ref, docData);
    console.log(`[createNotification] OK → ${type} para ${userId}`);
  } catch (e) {
    console.error(`[createNotification] FAILED → ${type} para ${userId}:`, e?.code, e?.message);
  }
};

/**
 * Escuchar notificaciones del usuario en tiempo real (ordenadas por fecha desc).
 */
export const getMyNotifications = (userId, callback) => {
  if (!userId) { callback([]); return () => {}; }
  // Sin orderBy para evitar requerir índice compuesto — ordenamos en cliente
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    limit(100),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(items);
  }, (e) => {
    console.error('[getMyNotifications] Error:', e?.code, e?.message);
    callback([]);
  });
};

/**
 * Marcar una notificación como leída.
 */
export const markNotificationRead = async (notifId) => {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
};

/**
 * Marcar todas las notificaciones del usuario como leídas.
 */
export const markAllNotificationsRead = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};

/**
 * Revisa las tareas asignadas al usuario (`assigneeId`) y crea notificaciones in-app:
 *   · "3 días antes" / "2 días antes" si:
 *       – el asignado tiene plan personal (suscripción propia) → en todas sus tareas y grupos; o
 *       – el líder de ese grupo tiene plan personal → solo tareas de ese grupo (beneficio al grupo).
 *   · "1 día antes" / "Vencida" → cualquier usuario, solo sus tareas asignadas.
 *   · Si la tarea tiene `dueTime` (HH:MM local), 1d/2d/3d y vencida usan el instante
 *     fecha+hora (no solo el día), para no avisar “mañana” cuando aún faltan >24 h.
 *
 * Flags: `notif3daysBefore`, `notif2daysBefore`, `notif1dayBefore`, `notifDueToday`
 * (solo día, vence hoy), `notifExpired`.
 * Se resetean en updateTask al editar fecha/hora o asignado.
 */
export const checkTaskNotifications = async (userId) => {
  if (!userId) return;
  try {
    let assigneeHasPersonalPlan = false;
    try {
      const profile = await getUser(userId);
      if (profile) {
        assigneeHasPersonalPlan = (profile.plan || 'free') === 'personal';
      }
    } catch {
      /* sin perfil → solo reglas por líder de grupo */
    }

    const now              = new Date();
    const today            = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow         = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 2);
    const inThreeDays      = new Date(today); inThreeDays.setDate(today.getDate() + 3);

    // YYYY-MM-DD para comparar con el campo dueDate de Firestore
    const pad2 = (n) => String(n).padStart(2, '0');
    const toISODate = (d) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const todayISO            = toISODate(today);
    const tomorrowISO         = toISODate(tomorrow);
    const dayAfterTomorrowISO = toISODate(dayAfterTomorrow);
    const inThreeDaysISO      = toISODate(inThreeDays);

    // "HH:MM" (24 h) → "H:MM a.m./p.m."
    const fmt12h = (t24) => {
      if (!t24) return '';
      const [h, m] = t24.split(':').map(Number);
      const period = h >= 12 ? 'p.m.' : 'a.m.';
      const h12    = h % 12 || 12;
      return `${h12}:${pad2(m)} ${period}`;
    };

    // "YYYY-MM-DD" → "DD/MM/YYYY"
    const fmtDate = (iso) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };

    const hasValidDueTime = (t) => {
      if (t == null || typeof t !== 'string') return false;
      const s = t.trim();
      if (!/^\d{1,2}:\d{2}$/.test(s)) return false;
      const [h, mi] = s.split(':').map(Number);
      return (
        !Number.isNaN(h) &&
        !Number.isNaN(mi) &&
        h >= 0 &&
        h <= 23 &&
        mi >= 0 &&
        mi <= 59
      );
    };

    /** Fecha+hora local de vencimiento; solo usar si hasValidDueTime(dueTime). */
    const getDueAtLocal = (dueISO, dueTimeStr) => {
      const parts = String(dueISO || '')
        .split('-')
        .map(Number);
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
      const [y, mo, d] = parts;
      if (!hasValidDueTime(dueTimeStr)) return null;
      const [h, mi] = dueTimeStr.split(':').map(Number);
      return new Date(y, mo - 1, d, h, mi, 0, 0);
    };

    // Obtener todas las tareas del usuario (filtrar en cliente
    // para evitar índices compuestos en Firestore)
    const q    = query(collection(db, 'tasks'), where('assigneeId', '==', userId));
    const snap = await getDocs(q);

    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Plan del líder por grupo: beneficio 2d/3d para miembros no suscritos solo en ese grupo.
    const uniqueGroupIds = [...new Set(tasks.map((t) => t.groupId).filter(Boolean))];
    const leaderSubscribedByGroup = {};
    if (uniqueGroupIds.length > 0) {
      await Promise.all(
        uniqueGroupIds.map(async (gid) => {
          try {
            const gSnap = await getDoc(doc(db, 'groups', gid));
            if (gSnap.exists()) {
              leaderSubscribedByGroup[gid] =
                (gSnap.data().leaderPlan || 'free') === 'personal';
            }
          } catch {
            leaderSubscribedByGroup[gid] = false;
          }
        }),
      );
    }

    const ops = [];

    tasks.forEach((task) => {
      // Ignorar tareas completadas o sin fecha
      if (task.status === 'Completada') return;
      if (!task.dueDate || task.dueDate === 'Sin fecha') return;

      const dueISO       = task.dueDate; // YYYY-MM-DD
      const timeStr      = task.dueTime ? ` a las ${fmt12h(task.dueTime)}` : '';
      const leaderOfGroupHasPersonal =
        Boolean(task.groupId) && leaderSubscribedByGroup[task.groupId] === true;
      const earlyReminders2d3d =
        assigneeHasPersonalPlan || leaderOfGroupHasPersonal;

      const dueAt = getDueAtLocal(dueISO, task.dueTime);
      const useTimedReminders =
        dueAt != null && !Number.isNaN(dueAt.getTime());

      if (useTimedReminders) {
        const t = now.getTime();
        const d = dueAt.getTime();
        const ms24 = 24 * 60 * 60 * 1000;
        const ms48 = 48 * 60 * 60 * 1000;
        const ms72 = 72 * 60 * 60 * 1000;

        // ── 3d / 2d / 1d: ventanas de 24 h respecto al vencimiento con hora ──
        if (
          earlyReminders2d3d &&
          !task.notif3daysBefore &&
          t >= d - ms72 &&
          t < d - ms48
        ) {
          ops.push(
            createNotification(userId, {
              type: 'task',
              title: '📅 Tarea — en 3 días',
              body: `"${task.title}" vence en 3 días${timeStr}.`,
              titleKey: 'notifTaskReminder3dTitle',
              bodyKey: 'notifTaskReminder3dBody',
              notifParams: { task: task.title, dueTime: task.dueTime || '' },
              data: {
                taskId: task.id,
                groupId: task.groupId,
                dueTime: task.dueTime || '',
              },
            }).then(() =>
              updateDoc(doc(db, 'tasks', task.id), { notif3daysBefore: true }),
            ),
          );
        }
        if (
          earlyReminders2d3d &&
          !task.notif2daysBefore &&
          t >= d - ms48 &&
          t < d - ms24
        ) {
          ops.push(
            createNotification(userId, {
              type: 'task',
              title: '📅 Recordatorio de tarea',
              body: `"${task.title}" vence en 2 días${timeStr}.`,
              titleKey: 'notifTaskReminder2dTitle',
              bodyKey: 'notifTaskReminder2dBody',
              notifParams: { task: task.title, dueTime: task.dueTime || '' },
              data: {
                taskId: task.id,
                groupId: task.groupId,
                dueTime: task.dueTime || '',
              },
            }).then(() =>
              updateDoc(doc(db, 'tasks', task.id), { notif2daysBefore: true }),
            ),
          );
        }
        if (!task.notif1dayBefore && t >= d - ms24 && t < d) {
          const calendarDueIsTomorrow = tomorrowISO === dueISO;
          const useTomorrowCopy = calendarDueIsTomorrow;
          ops.push(
            createNotification(userId, {
              type: 'task',
              title: useTomorrowCopy ? '⏰ Tarea por vencer' : '⏰ Vence hoy',
              body: useTomorrowCopy
                ? `"${task.title}" vence mañana${timeStr}.`
                : `La tarea "${task.title}" vence hoy${timeStr}.`,
              titleKey: useTomorrowCopy
                ? 'notifTaskReminder1dTitle'
                : 'notifAssignDueTodayTitle',
              bodyKey: useTomorrowCopy
                ? 'notifTaskReminder1dBody'
                : 'notifAssignDueTodayBody',
              notifParams: { task: task.title, dueTime: task.dueTime || '' },
              data: {
                taskId: task.id,
                groupId: task.groupId,
                dueTime: task.dueTime || '',
              },
            }).then(() =>
              updateDoc(doc(db, 'tasks', task.id), { notif1dayBefore: true }),
            ),
          );
        }
        if (!task.notifExpired && t >= d) {
          ops.push(
            createNotification(userId, {
              type: 'task',
              title: '🔴 Tarea vencida',
              body: `Oh no, "${task.title}" venció el ${fmtDate(dueISO)} y no se completó.`,
              titleKey: 'notifTaskExpiredTitle',
              bodyKey: 'notifTaskExpiredBody',
              notifParams: { task: task.title, dueDateISO: dueISO },
              data: { taskId: task.id, groupId: task.groupId },
            }).then(() =>
              updateDoc(doc(db, 'tasks', task.id), { notifExpired: true }),
            ),
          );
        }
        return;
      }

      // ── Sin hora: solo día calendario (comportamiento anterior) ──────────

      // ── 3 días antes (asignado suscrito en cualquier grupo, o líder suscrito en este grupo) ──
      if (
        earlyReminders2d3d &&
        dueISO === inThreeDaysISO &&
        !task.notif3daysBefore
      ) {
        ops.push(
          createNotification(userId, {
            type: 'task',
            title: '📅 Tarea — en 3 días',
            body: `"${task.title}" vence en 3 días${timeStr}.`,
            titleKey: 'notifTaskReminder3dTitle',
            bodyKey: 'notifTaskReminder3dBody',
            notifParams: { task: task.title, dueTime: task.dueTime || '' },
            data: {
              taskId: task.id,
              groupId: task.groupId,
              dueTime: task.dueTime || '',
            },
          }).then(() =>
            updateDoc(doc(db, 'tasks', task.id), { notif3daysBefore: true }),
          ),
        );
      }

      // ── 2 días antes (misma regla que 3 días) ────────────────────────────
      if (
        earlyReminders2d3d &&
        dueISO === dayAfterTomorrowISO &&
        !task.notif2daysBefore
      ) {
        ops.push(
          createNotification(userId, {
            type:  'task',
            title: '📅 Recordatorio de tarea',
            body:  `"${task.title}" vence en 2 días${timeStr}.`,
            titleKey: 'notifTaskReminder2dTitle',
            bodyKey: 'notifTaskReminder2dBody',
            notifParams: { task: task.title, dueTime: task.dueTime || '' },
            data:  { taskId: task.id, groupId: task.groupId, dueTime: task.dueTime || '' },
          }).then(() =>
            updateDoc(doc(db, 'tasks', task.id), { notif2daysBefore: true })
          )
        );
      }

      // ── 1 día antes (cualquier usuario, su tarea asignada) ──────────────
      if (dueISO === tomorrowISO && !task.notif1dayBefore) {
        ops.push(
          createNotification(userId, {
            type:  'task',
            title: '⏰ Tarea por vencer',
            body:  `"${task.title}" vence mañana${timeStr}.`,
            titleKey: 'notifTaskReminder1dTitle',
            bodyKey: 'notifTaskReminder1dBody',
            notifParams: { task: task.title, dueTime: task.dueTime || '' },
            data:  { taskId: task.id, groupId: task.groupId, dueTime: task.dueTime || '' },
          }).then(() =>
            updateDoc(doc(db, 'tasks', task.id), { notif1dayBefore: true })
          )
        );
      }

      // ── Vence hoy (solo día calendario, sin hora válida): una vez por alineación de fechas ──
      if (dueISO === todayISO && !task.notifDueToday) {
        ops.push(
          createNotification(userId, {
            type: "task",
            title: "⏰ Vence hoy",
            body: `La tarea "${task.title}" vence hoy${timeStr}.`,
            titleKey: "notifAssignDueTodayTitle",
            bodyKey: "notifAssignDueTodayBody",
            notifParams: { task: task.title, dueTime: task.dueTime || "" },
            data: {
              taskId: task.id,
              groupId: task.groupId,
              dueTime: task.dueTime || "",
            },
          }).then(() =>
            updateDoc(doc(db, "tasks", task.id), { notifDueToday: true }),
          ),
        );
      }

      // ── Vencida (cualquier usuario, su tarea asignada) ─────────────────
      if (dueISO < todayISO && !task.notifExpired) {
        ops.push(
          createNotification(userId, {
            type:  'task',
            title: '🔴 Tarea vencida',
            body:  `Oh no, "${task.title}" venció el ${fmtDate(dueISO)} y no se completó.`,
            titleKey: 'notifTaskExpiredTitle',
            bodyKey: 'notifTaskExpiredBody',
            notifParams: { task: task.title, dueDateISO: dueISO },
            data:  { taskId: task.id, groupId: task.groupId },
          }).then(() =>
            updateDoc(doc(db, 'tasks', task.id), { notifExpired: true })
          )
        );
      }
    });

    if (ops.length > 0) await Promise.all(ops);
  } catch (e) {
    console.error('[checkTaskNotifications]', e?.message);
  }
};

/**
 * Revisa los grupos que lidera el usuario y crea notificaciones in-app
 * exclusivas para el líder:
 *
 *   · "Miembro sin avance"  → tarea de un miembro vence mañana y sigue
 *                             en estado "Pendiente" (nunca fue movida).
 *   · "Tareas en riesgo"    → resumen por grupo: N tareas vencen mañana.
 *
 * Flags por tarea: `notifLeaderMemberStuck` y `notifLeaderAtRisk`.
 * Se resetean automáticamente en updateTask al cambiar fecha/hora o estado.
 */
export const checkLeaderNotifications = async (userId) => {
  if (!userId) return;
  try {
    const pad2      = (n) => String(n).padStart(2, '0');
    const now       = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow  = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowISO = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;

    // Grupos donde este usuario es líder
    const groupsSnap = await getDocs(
      query(collection(db, 'groups'), where('leaderId', '==', userId))
    );
    if (groupsSnap.empty) return;

    const ops = [];

    for (const groupDoc of groupsSnap.docs) {
      const group = { id: groupDoc.id, ...groupDoc.data() };

      // Notificaciones de líder son exclusivas del plan premium
      if ((group.leaderPlan || 'free') !== 'personal') continue;

      // Tareas del grupo (filtro client-side → sin índice compuesto)
      const tasksSnap = await getDocs(
        query(collection(db, 'tasks'), where('groupId', '==', group.id))
      );

      // IDs de tareas que necesitan la notificación grupal "en riesgo"
      const atRiskIds = [];

      tasksSnap.forEach((taskDoc) => {
        const task = { id: taskDoc.id, ...taskDoc.data() };

        // Solo tareas pendientes/en progreso que vencen mañana
        if (task.status === 'Completada') return;
        if (!task.dueDate || task.dueDate === 'Sin fecha') return;
        if (task.dueDate !== tomorrowISO) return;

        // ── "Tareas en riesgo" (una notif por grupo) ─────────────────────
        if (!task.notifLeaderAtRisk) {
          atRiskIds.push(task.id);
        }

        // ── "Miembro sin avance" (por tarea, solo si sigue en Pendiente) ─
        if (task.status === 'Pendiente' && !task.notifLeaderMemberStuck) {
          const memberName = task.assigneeName || 'Un miembro';
          ops.push(
            createNotification(userId, {
              type:  'task',
              title: '⚠️ Miembro sin avance',
              body:  `${memberName} no ha avanzado en "${task.title}" y vence mañana.`,
              titleKey: 'notifLeaderMemberStuckTitle',
              bodyKey: 'notifLeaderMemberStuckBody',
              notifParams: { who: memberName, task: task.title },
              data:  { taskId: task.id, groupId: group.id },
            }).then(() =>
              updateDoc(doc(db, 'tasks', task.id), { notifLeaderMemberStuck: true })
            )
          );
        }
      });

      // Una sola notificación de riesgo por grupo (no por tarea)
      if (atRiskIds.length > 0) {
        const n = atRiskIds.length;
        ops.push(
          createNotification(userId, {
            type:  'task',
            title: '🚨 Tareas en riesgo',
            body:  `Hay ${n} tarea${n !== 1 ? 's' : ''} por vencer mañana en "${group.name}".`,
            titleKey: 'notifLeaderAtRiskTitle',
            bodyKey: n === 1 ? 'notifLeaderAtRiskBodyOne' : 'notifLeaderAtRiskBodyMany',
            notifParams: { n: String(n), group: group.name },
            data:  { groupId: group.id },
          }).then(() =>
            Promise.all(
              atRiskIds.map((taskId) =>
                updateDoc(doc(db, 'tasks', taskId), { notifLeaderAtRisk: true })
              )
            )
          )
        );
      }
    }

    if (ops.length > 0) await Promise.all(ops);
  } catch (e) {
    console.error('[checkLeaderNotifications]', e?.message);
  }
};

/**
 * Sincroniza el nombre del líder en todos los grupos que lidera.
 * Se llama al actualizar el perfil del usuario.
 */
export const syncLeaderNameToGroups = async (leaderId, name) => {
  if (!leaderId || !name) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'groups'), where('leaderId', '==', leaderId))
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { leaderName: name }));
    await batch.commit();
  } catch (e) {
    console.error('[syncLeaderNameToGroups]', e?.message);
  }
};

/**
 * Sincroniza el plan del líder en todos los grupos que lidera.
 * Se llama al actualizar el plan del usuario (upgrade/downgrade).
 * Plan gratuito: como máximo 1 moderador → se conserva solo el primero asignado (orden del array).
 */
export const syncLeaderPlanToGroups = async (leaderId, plan) => {
  if (!leaderId) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'groups'), where('leaderId', '==', leaderId))
    );
    if (snap.empty) return;
    const isPersonal = (plan || "free") === "personal";
    const docs = [...snap.docs];
    const BATCH_MAX = 450;
    for (let i = 0; i < docs.length; i += BATCH_MAX) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_MAX).forEach((d) => {
        const data = d.data();
        const updates = { leaderPlan: plan || "free" };
        if (!isPersonal) {
          const mods = Array.isArray(data.moderators) ? data.moderators : [];
          if (mods.length > 1) {
            updates.moderators = [mods[0]];
          }
        }
        batch.update(d.ref, updates);
      });
      await batch.commit();
    }
  } catch (e) {
    console.error('[syncLeaderPlanToGroups]', e?.message);
  }
};
