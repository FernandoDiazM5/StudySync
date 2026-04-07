// ============================================
// STORAGE SERVICE - StudySync
// Upload/Download de archivos con Firebase Storage
// ============================================

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebaseConfig';
import { addFileRecord } from './firestoreService';

/**
 * Subir un archivo a Firebase Storage y registrar en Firestore
 */
export const uploadFile = async (groupId, fileUri, fileName, fileType) => {
  try {
    // Crear referencia en Storage
    const storageRef = ref(storage, `groups/${groupId}/files/${Date.now()}_${fileName}`);
    
    // Convertir URI a blob
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Subir archivo
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Obtener URL de descarga
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    // Registrar en Firestore
    const fileId = await addFileRecord({
      groupId: groupId,
      name: fileName,
      type: fileType || getFileType(fileName),
      downloadUrl: downloadUrl,
      storagePath: snapshot.ref.fullPath,
      size: snapshot.totalBytes
    });
    
    return { 
      success: true, 
      fileId, 
      downloadUrl 
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { 
      success: false, 
      error: 'Error al subir el archivo. Intenta de nuevo.' 
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
 * Detectar tipo de archivo por extensión
 */
const getFileType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    'pdf': 'PDF',
    'doc': 'DOC',
    'docx': 'DOC',
    'xls': 'XLS',
    'xlsx': 'XLS',
    'ppt': 'PPT',
    'pptx': 'PPT',
    'jpg': 'IMG',
    'jpeg': 'IMG',
    'png': 'IMG',
    'txt': 'TXT',
  };
  return types[ext] || 'FILE';
};
