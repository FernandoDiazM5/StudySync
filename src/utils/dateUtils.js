// ============================================
// DATE UTILITIES - StudySync
// Funciones para manejo de fechas de tareas
// ============================================

/**
 * Verificar si una tarea está vencida
 * @param {string} dueDate - Fecha en formato YYYY-MM-DD
 * @returns {boolean}
 */
export const isOverdue = (dueDate) => {
  if (!dueDate || dueDate === 'Sin fecha') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return due < today;
};

/**
 * Formatear fecha para mostrar
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD o ISO
 * @returns {string} Fecha formateada
 */
export const formatDate = (dateStr) => {
  if (!dateStr || dateStr === 'Sin fecha') return 'Sin fecha';
  // Si es formato YYYY-MM-DD, agregar T00:00:00 para evitar bug de zona horaria
  const isoStr = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Formatear fecha corta (día/mes)
 */
export const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit'
  });
};

/**
 * Obtener días restantes hasta la fecha límite
 * @param {string} dueDate - Fecha en formato YYYY-MM-DD
 * @returns {number} Días restantes (negativo si ya venció)
 */
export const getDaysUntilDue = (dueDate) => {
  if (!dueDate || dueDate === 'Sin fecha') return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Obtener la hora formateada de un timestamp
 */
export const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Obtener fecha de hoy en formato YYYY-MM-DD
 */
export const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};
