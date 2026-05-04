import React, { createContext, useContext } from 'react';
import { supabase } from '../config/supabase';

const FileStorageContext = createContext(null);

export const FileStorageProvider = ({ children }) => {
  /**
   * Subir archivo a Supabase Storage
   * @param {string} groupId - ID del grupo
   * @param {string} fileUri - URI del archivo local
   * @param {string} fileName - Nombre del archivo
   * @returns {Promise<{filePath, publicUrl, fileName}>}
   */
  const uploadGroupFile = async (groupId, fileUri, fileName, mimeType, onProgress) => {
    try {
      // Fase 1 – preparando (0 → 10%)
      onProgress?.(5);

      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${groupId}/${timestamp}_${safeName}`;
      const contentType = mimeType || 'application/octet-stream';

      // Leer como Blob (soportado en React Native / Hermes)
      const response = await fetch(fileUri);
      if (!response.ok) throw new Error(`No se pudo leer el archivo (status ${response.status})`);
      const blob = await response.blob();
      onProgress?.(10);

      // Fase 2 – subiendo con XHR para progreso real (10 → 90%)
      await new Promise((resolve, reject) => {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        supabase.auth.getSession().then(({ data: { session } }) => {
          const token = session?.access_token || supabaseAnonKey;
          const uploadUrl = `${supabaseUrl}/storage/v1/object/group-files/${filePath}`;

          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.setRequestHeader('Content-Type', contentType);
          xhr.setRequestHeader('x-upsert', 'false');

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              // mapear 0-100% del XHR a 10-90% del progreso total.
              // Clampear a [10, 90]: en algunos Android e.loaded puede superar
              // e.total (quirk de XHR), lo que daría valores > 100.
              const raw = 10 + Math.round((e.loaded / e.total) * 80);
              onProgress?.(Math.min(90, Math.max(10, raw)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress?.(90);
              resolve();
            } else {
              reject(new Error(`Error al subir (${xhr.status}): ${xhr.responseText}`));
            }
          };
          xhr.onerror   = () => reject(new Error('Error de red al subir archivo'));
          xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado'));

          xhr.send(blob);
        }).catch(reject);
      });

      // Obtener URL pública
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
