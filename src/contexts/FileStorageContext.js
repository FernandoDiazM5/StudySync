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
  const uploadGroupFile = async (groupId, fileUri, fileName, mimeType) => {
    try {
      console.log(`[FileStorage] Subiendo: ${fileName} → grupo: ${groupId}`);
      console.log(`[FileStorage] URI: ${fileUri}`);

      // 1. Crear ruta única dentro del bucket
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${groupId}/${timestamp}_${safeName}`;
      const contentType = mimeType || 'application/octet-stream';

      console.log(`[FileStorage] Ruta destino: ${filePath}`);

      // 2. Leer el contenido del archivo como ArrayBuffer
      //    Funciona tanto con blob: (Expo Web) como con file:// (nativo)
      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error(`No se pudo leer el archivo (status ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[FileStorage] Tamaño leído: ${arrayBuffer.byteLength} bytes`);

      // 3. Subir ArrayBuffer a Supabase Storage
      const { data, error } = await supabase.storage
        .from('group-files')
        .upload(filePath, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error('[FileStorage] Error Supabase:', JSON.stringify(error));
        throw new Error(`Error al subir archivo: ${error.message}`);
      }

      console.log('[FileStorage] Archivo subido OK:', data);

      // 4. Obtener URL pública
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
