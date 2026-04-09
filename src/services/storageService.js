// ============================================
// STORAGE SERVICE - StudySync
// Upload/Download de archivos con Firebase Storage REST API
// Nota: Se usa REST API en lugar del JS SDK por incompatibilidad
// de uploadBytes con React Native (storage/unknown error).
// ============================================

import { File } from 'expo-file-system/next';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage, auth } from './firebaseConfig';
import { addFileRecord } from './firestoreService';

const STORAGE_BUCKET = 'studysync-e43e3.firebasestorage.app';

/**
 * Subir un archivo a Firebase Storage via REST API y registrar en Firestore
 */
export const uploadFile = async (groupId, fileUri, fileName, fileType) => {
  try {
    // Nueva API: File implementa Blob directamente
    const file = new File(fileUri);
    const arrayBuffer = await file.arrayBuffer();

    // Obtener token del usuario autenticado
    const token = await auth.currentUser.getIdToken();

    // Ruta del archivo en Storage
    const storagePath = `groups/${groupId}/files/${Date.now()}_${fileName}`;
    const encodedPath = encodeURIComponent(storagePath);
    const mimeType = fileType || getMimeType(fileName);

    // Subir via REST API
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errBody = await uploadResponse.text();
      throw new Error(`HTTP ${uploadResponse.status}: ${errBody}`);
    }

    // Obtener URL de descarga
    const storageRef = ref(storage, storagePath);
    const downloadUrl = await getDownloadURL(storageRef);

    // Registrar en Firestore
    const fileId = await addFileRecord({
      groupId,
      name: fileName,
      type: getFileType(fileName),
      downloadUrl,
      storagePath,
    });

    return { success: true, fileId, downloadUrl };
  } catch (error) {
    console.error('Upload error:', error?.message, error);
    return {
      success: false,
      error: 'Error al subir el archivo. Intenta de nuevo.',
    };
  }
};

/**
 * Obtener URL de descarga de un archivo
 */
export const getFileDownloadUrl = async (storagePath) => {
  try {
    const storageRef = ref(storage, storagePath);
    const url = await getDownloadURL(storageRef);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Detectar MIME type por extensión
 */
const getMimeType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    txt: 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
};

/**
 * Detectar tipo de archivo por extensión (label corto)
 */
const getFileType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    pdf: 'PDF', doc: 'DOC', docx: 'DOC',
    xls: 'XLS', xlsx: 'XLS',
    ppt: 'PPT', pptx: 'PPT',
    jpg: 'IMG', jpeg: 'IMG', png: 'IMG',
    txt: 'TXT',
  };
  return types[ext] || 'FILE';
};
