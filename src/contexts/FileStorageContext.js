import React, { createContext, useContext } from 'react';
import { supabase, getSupabaseCredentials } from '../config/supabase';

const FileStorageContext = createContext(null);

export const FileStorageProvider = ({ children }) => {
  /**
   * Subir archivo a Supabase Storage
   * Usa arrayBuffer + SDK (mismo patrón que avatares). XHR+Blob en RN
   * suele fallar con "Error de red" aunque la conexión esté bien.
   */
  const uploadGroupFile = async (groupId, fileUri, fileName, mimeType, onProgress) => {
    try {
      const { url: supabaseUrl, anonKey } = getSupabaseCredentials();
      if (!supabaseUrl || !anonKey) {
        throw new Error(
          'Supabase no está configurado. Revisa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.',
        );
      }

      onProgress?.(5);

      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${groupId}/${timestamp}_${safeName}`;
      const contentType = mimeType || 'application/octet-stream';

      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error(`No se pudo leer el archivo (status ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('El archivo está vacío o no se pudo leer.');
      }
      onProgress?.(15);

      // Progreso estimado mientras corre el upload (el SDK no expone % real).
      let fake = 15;
      const tick = setInterval(() => {
        fake = Math.min(85, fake + 5);
        onProgress?.(fake);
      }, 280);

      try {
        const { error } = await supabase.storage
          .from('group-files')
          .upload(filePath, arrayBuffer, {
            contentType,
            upsert: false,
          });

        if (error) {
          console.error('[FileStorage] upload error:', error);
          throw new Error(error.message || 'Error al subir archivo');
        }
      } finally {
        clearInterval(tick);
      }

      onProgress?.(90);

      const { data: publicData } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);

      return {
        filePath,
        publicUrl: publicData.publicUrl,
        fileName: safeName,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[FileStorage] Error en uploadGroupFile:', error);
      throw error;
    }
  };

  /**
   * Eliminar archivo de Supabase Storage
   * @param {string} filePath - Ruta del archivo a eliminar
   */
  const deleteGroupFile = async (filePath) => {
    try {
      console.log(`Eliminando archivo: ${filePath}`);

      const { error } = await supabase.storage
        .from('group-files')
        .remove([filePath]);

      if (error) {
        console.error('Error eliminando archivo:', error);
        throw new Error(`Error al eliminar archivo: ${error.message}`);
      }

      console.log('Archivo eliminado exitosamente');
    } catch (error) {
      console.error('Error en deleteGroupFile:', error);
      throw error;
    }
  };

  /**
   * Obtener lista de archivos de un grupo
   * @param {string} groupId - ID del grupo
   * @returns {Promise<Array>}
   */
  const getGroupFiles = async (groupId) => {
    try {
      console.log(`Obteniendo archivos del grupo: ${groupId}`);

      const { data, error } = await supabase.storage
        .from('group-files')
        .list(groupId);

      if (error) {
        console.warn('Error obteniendo archivos:', error);
        return [];
      }

      console.log(`Se encontraron ${data?.length || 0} archivos`);
      return data || [];
    } catch (error) {
      console.error('Error en getGroupFiles:', error);
      return [];
    }
  };

  /**
   * Subir/reemplazar la foto de perfil de un grupo
   * @param {string} groupId - ID del grupo
   * @param {string} fileUri - URI local de la imagen (blob: o file://)
   * @param {string} mimeType - tipo MIME de la imagen
   * @returns {Promise<string>} URL pública de la foto
   */
  const uploadGroupAvatar = async (groupId, fileUri, mimeType) => {
    try {
      console.log(`[FileStorage] Subiendo avatar del grupo: ${groupId}`);
      const ext = mimeType?.split('/')[1]?.split('+')[0] || 'jpg';
      const filePath = `avatars/${groupId}/photo.${ext}`;
      const contentType = mimeType || 'image/jpeg';

      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error(`No se pudo leer la imagen (status ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[FileStorage] Avatar tamaño: ${arrayBuffer.byteLength} bytes`);

      // upsert: true → sobreescribe el avatar anterior
      const { data, error } = await supabase.storage
        .from('group-files')
        .upload(filePath, arrayBuffer, { contentType, upsert: true });

      if (error) {
        console.error('[FileStorage] Error avatar:', JSON.stringify(error));
        throw new Error(`Error al subir foto: ${error.message}`);
      }

      console.log('[FileStorage] Avatar subido OK:', data);

      const { data: publicData } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);

      // Añadir timestamp para forzar recarga y evitar caché
      return `${publicData.publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('[FileStorage] Error en uploadGroupAvatar:', error);
      throw error;
    }
  };

  /**
   * Subir/reemplazar el avatar del usuario
   * @param {string} userId - UID del usuario
   * @param {string} fileUri - URI local de la imagen
   * @param {string} mimeType - tipo MIME
   * @returns {Promise<string>} URL pública con cache-buster
   */
  const uploadUserAvatar = async (userId, fileUri, mimeType) => {
    try {
      const ext = mimeType?.split('/')[1]?.split('+')[0] || 'jpg';
      const filePath = `avatars/users/${userId}/photo.${ext}`;
      const contentType = mimeType || 'image/jpeg';

      const response = await fetch(fileUri);
      if (!response.ok) throw new Error(`No se pudo leer la imagen (status ${response.status})`);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from('group-files')
        .upload(filePath, arrayBuffer, { contentType, upsert: true });

      if (error) throw new Error(`Error al subir avatar: ${error.message}`);

      const { data: publicData } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);

      return `${publicData.publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('[FileStorage] Error en uploadUserAvatar:', error);
      throw error;
    }
  };

  /**
   * Obtener URL pública de un archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {string}
   */
  const getPublicUrl = (filePath) => {
    const { data } = supabase.storage
      .from('group-files')
      .getPublicUrl(filePath);
    return data?.publicUrl || '';
  };

  return (
    <FileStorageContext.Provider
      value={{
        uploadGroupFile,
        uploadGroupAvatar,
        uploadUserAvatar,
        deleteGroupFile,
        getGroupFiles,
        getPublicUrl,
      }}
    >
      {children}
    </FileStorageContext.Provider>
  );
};

export const useFileStorage = () => {
  const context = useContext(FileStorageContext);
  if (!context) {
    throw new Error(
      'useFileStorage debe usarse dentro de FileStorageProvider'
    );
  }
  return context;
};
