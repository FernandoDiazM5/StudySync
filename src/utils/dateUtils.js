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

/** Zona horaria de referencia para chat (Perú, UTC−5, sin DST). */
export const CHAT_TIME_ZONE = 'America/Lima';

/**
 * Fecha civil YYYY-MM-DD en la zona indicada (p. ej. separadores de día en el chat).
 * Evita usar el prefijo ISO en UTC (`split('T')[0]`), que desplaza el día en Perú.
 */
export const getCalendarDateKeyInTimeZone = (isoString, timeZone = CHAT_TIME_ZONE) => {
  if (!isoString) return 'unknown';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'unknown';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return String(isoString).split('T')[0] || 'unknown';
  }
};

/** Hora en zona Perú (12 h, locale es-PE). */
export const formatTimeInTimeZone = (isoString, timeZone = CHAT_TIME_ZONE) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return formatTime(isoString);
  }
};

/** Resta un día civil a YYYY-MM-DD (solo aritmética de calendario gregoriano). */
const prevCalendarDateKey = (ymd) => {
  const parts = String(ymd).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ymd;
  const [y, mo, d] = parts;
  const u = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  u.setUTCDate(u.getUTCDate() - 1);
  const yy = u.getUTCFullYear();
  const mm = String(u.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(u.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/**
 * Etiqueta para chip de fecha en el chat ("Hoy", "Ayer", o fecha larga), según calendario en Perú.
 */
export const formatChatDateSeparatorLabel = (dateKeyYYYYMMDD, timeZone = CHAT_TIME_ZONE) => {
  if (!dateKeyYYYYMMDD || dateKeyYYYYMMDD === 'unknown') return '';
  const todayKey = getCalendarDateKeyInTimeZone(new Date().toISOString(), timeZone);
  if (dateKeyYYYYMMDD === todayKey) return 'Hoy';
  const yesterdayKey = prevCalendarDateKey(todayKey);
  if (dateKeyYYYYMMDD === yesterdayKey) return 'Ayer';
  const parts = dateKeyYYYYMMDD.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dateKeyYYYYMMDD;
  const [y, m, d] = parts;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const thisYear = Number(todayKey.slice(0, 4));
  try {
    if (y === thisYear) {
      return new Intl.DateTimeFormat('es-PE', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'long',
      }).format(anchor);
    }
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(anchor);
  } catch {
    return dateKeyYYYYMMDD;
  }
};

/**
 * Obtener fecha de hoy en formato YYYY-MM-DD
 */
export const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};
