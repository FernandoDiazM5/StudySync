// ============================================
// FIRESTORE SERVICE - StudySync
// CRUD para Groups, Tasks, Messages, Files, Users
// ============================================

import {
  collection,
  doc,
  addDoc,
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// Logger central de errores Firestore
const logFirestoreError = (context) => (error) => {
  console.error(`[Firestore:${context}]`, error?.code || '', error?.message || error);
};

// ==========================================
// USERS
// ==========================================

/**
 * Obtener perfil de usuario por UID
 */
export const getUser = async (uid) => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
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
 * Obtener múltiples usuarios por sus IDs
 */
export const getUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  const users = [];
  for (const uid of userIds) {
    const user = await getUser(uid);
    if (user) users.push(user);
  }
  return users;
};

/**
 * Marcar usuario como activo en un chat
 */
export const setUserPresence = async (uid, groupId) => {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, {
    activeInChat: groupId,
    lastActive: new Date().toISOString(),
  });
};

/**
 * Limpiar presencia del usuario al salir del chat
 */
export const clearUserPresence = async (uid) => {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, {
    activeInChat: null,
    lastActive: new Date().toISOString(),
  });
};

/**
 * Escuchar miembros en línea en un chat (activos en los últimos 2 minutos)
 */
export const getOnlineMembers = (groupId, memberIds, callback) => {
  if (!memberIds?.length) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'users'),
    where('activeInChat', '==', groupId)
  );
  return onSnapshot(q, (snapshot) => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const online = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => memberIds.includes(u.id) && u.lastActive >= twoMinutesAgo);
    callback(online);
  }, logFirestoreError('getOnlineMembers'));
};

/**
 * Actualizar perfil de usuario
 */
export const updateUserProfile = async (uid, data) => {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

// ==========================================
// GROUPS
// ==========================================

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
      callback(groups);
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
 * Crear un nuevo grupo
 */
export const createGroup = async (groupData) => {
  const docRef = await addDoc(collection(db, 'groups'), {
    ...groupData,
    createdAt: new Date().toISOString(),
    status: 'En progreso'
  });
  return docRef.id;
};

/**
 * Agregar miembro a un grupo
 */
export const addMemberToGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, {
    members: arrayUnion(userId)
  });
};

/**
 * Remover miembro de un grupo
 */
export const removeMemberFromGroup = async (groupId, userId) => {
  const docRef = doc(db, 'groups', groupId);
  await updateDoc(docRef, {
    members: arrayRemove(userId)
  });
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
  const docRef = await addDoc(collection(db, 'invitations'), {
    groupId,
    groupName: groupName || '',
    invitedUserId,
    invitedBy,
    invitedByName: invitedByName || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  });
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
 */
export const acceptInvitation = async (invitationId, groupId, userId) => {
  if (!invitationId || !groupId || !userId) {
    throw new Error('Faltan datos para aceptar la invitación');
  }
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);
  const invitationRef = doc(db, 'invitations', invitationId);
  batch.update(groupRef, { members: arrayUnion(userId) });
  batch.update(invitationRef, {
    status: 'accepted',
    respondedAt: new Date().toISOString()
  });
  await batch.commit();
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
  return docRef.id;
};

/**
 * Editar una tarea
 */
export const updateTask = async (taskId, data) => {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
};

/**
 * Actualizar estado de una tarea
 */
export const updateTaskStatus = async (taskId, newStatus) => {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Obtener tareas de múltiples grupos (para la pantalla de mensajes)
 */
export const getTasksByGroups = async (groupIds) => {
  if (!groupIds || groupIds.length === 0) return [];
  const allTasks = [];
  for (const groupId of groupIds) {
    const q = query(
      collection(db, 'tasks'),
      where('groupId', '==', groupId)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      allTasks.push({ id: doc.id, ...doc.data() });
    });
  }
  return allTasks;
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
 */
export const sendMessage = async (messageData) => {
  const docRef = await addDoc(collection(db, 'messages'), {
    ...messageData,
    createdAt: new Date().toISOString(),
    readBy: [messageData.authorId]
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
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.readBy || !data.readBy.includes(userId)) {
      batch.update(docSnap.ref, {
        readBy: arrayUnion(userId)
      });
    }
  });
  
  await batch.commit();
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
    const q = query(
      collection(db, 'messages'),
      where('groupId', '==', groupId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.docs.length === 0) return null;
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    messages.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return messages[0];
  } catch (error) {
    logFirestoreError('getLastMessage')(error);
    return null;
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
        uploadedAt: new Date(),
      }
    );
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
