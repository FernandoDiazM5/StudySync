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
  const uploadGroupFile = async (groupId, fileUri, fileName) => {
    try {
      console.log(`Subiendo archivo: ${fileName} al grupo: ${groupId}`);

      // 1. Leer archivo desde device
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // 2. Crear ruta única
      const timestamp = Date.now();
      const filePath = `${groupId}/${timestamp}_${fileName}`;

      console.log(`Ruta de archivo: ${filePath}`);

      // 3. Subir a Supabase Storage
      const { data, error } = await supabase.storage
        .from('group-files')
        .upload(filePath, blob);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error(`Error al subir archivo: ${error.message}`);
      }

      console.log('Archivo subido exitosamente');

      // 4. Obtener URL pública
      const { data: publicData } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);

      return {
        filePath,
        publicUrl: publicData.publicUrl,
        fileName: fileName,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error en uploadGroupFile:', error);
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
