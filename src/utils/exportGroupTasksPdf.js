// ============================================
// EXPORT GROUP TASKS PDF - StudySync
// Genera un PDF tematizado (indigo StudySync) y lo comparte.
// ============================================

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const PDF_MIME = "application/pdf";
/** Base64 de "%PDF" — firma real de un PDF. */
const PDF_BASE64_MAGIC = "JVBERi";

function assertPdfBase64(base64, context) {
  const cleaned = String(base64 || "").replace(/\s+/g, "");
  if (!cleaned.startsWith(PDF_BASE64_MAGIC)) {
    const head = cleaned.slice(0, 16);
    throw new Error(
      `El archivo generado no es un PDF válido (${context}). Cabecera: ${head || "(vacío)"}`,
    );
  }
  return cleaned;
}

async function readPdfBase64FromUri(uri) {
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return assertPdfBase64(raw, "lectura local");
}

const BRAND = {
  indigo: "#4F46E5",
  indigoDark: "#312E81",
  indigoSoft: "#EEF2FF",
  indigoMid: "#A5B4FC",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F9FAFB",
  white: "#FFFFFF",
  pending: "#D97706",
  pendingBg: "#FEF3C7",
  progress: "#4F46E5",
  progressBg: "#EEF2FF",
  done: "#16A34A",
  doneBg: "#DCFCE7",
  alta: "#DC2626",
  media: "#D97706",
  baja: "#3B82F6",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExportDate(locale) {
  try {
    return new Date().toLocaleString(locale || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date().toISOString();
  }
}

function statusMeta(status, labels) {
  if (status === "Completada") {
    return { label: labels.completed, color: BRAND.done, bg: BRAND.doneBg };
  }
  if (status === "En progreso") {
    return {
      label: labels.inProgress,
      color: BRAND.progress,
      bg: BRAND.progressBg,
    };
  }
  return { label: labels.pending, color: BRAND.pending, bg: BRAND.pendingBg };
}

function priorityMeta(priority, labels) {
  if (priority === "alta") {
    return { label: labels.priorityHigh, color: BRAND.alta };
  }
  if (priority === "media") {
    return { label: labels.priorityMedium, color: BRAND.media };
  }
  if (priority === "baja") {
    return { label: labels.priorityLow, color: BRAND.baja };
  }
  return null;
}

function buildTaskRows(tasks, labels, getAssigneeName) {
  if (!tasks.length) {
    return `<tr><td colspan="5" style="padding:18px;text-align:center;color:${BRAND.muted};">${escapeHtml(labels.emptyTasks)}</td></tr>`;
  }

  return tasks
    .map((task, index) => {
      const st = statusMeta(task.status, labels);
      const pr = priorityMeta(task.priority, labels);
      const due =
        task.dueDate && task.dueDate !== "Sin fecha"
          ? task.dueDate
          : labels.noDate;
      const dueTime = task.dueTime ? ` · ${task.dueTime}` : "";
      const assignee = getAssigneeName
        ? getAssigneeName(task.assigneeId, task.assigneeName)
        : task.assigneeName || labels.unassigned;
      const desc = task.description
        ? `<div style="margin-top:6px;font-size:11px;color:${BRAND.muted};line-height:1.45;">${escapeHtml(task.description)}</div>`
        : "";
      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      const subHtml = subtasks.length
        ? `<ul style="margin:8px 0 0;padding-left:16px;color:${BRAND.muted};font-size:11px;line-height:1.5;">
            ${subtasks
              .map(
                (s) =>
                  `<li style="margin-bottom:2px;">${s.done ? "✓" : "○"} ${escapeHtml(s.title || labels.subtaskFallback)}${s.dueDate && s.dueDate !== "Sin fecha" ? ` <span style="color:${BRAND.indigoMid};">(${escapeHtml(s.dueDate)})</span>` : ""}</li>`,
              )
              .join("")}
          </ul>`
        : "";

      return `
        <tr style="background:${index % 2 === 0 ? BRAND.white : BRAND.bg};">
          <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
            <div style="font-weight:700;color:${BRAND.text};font-size:13px;">${escapeHtml(task.title || labels.untitledTask)}</div>
            ${desc}
            ${subHtml}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;color:${st.color};background:${st.bg};">${escapeHtml(st.label)}</span>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};vertical-align:top;font-size:12px;color:${BRAND.text};">
            ${escapeHtml(assignee || labels.unassigned)}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};vertical-align:top;font-size:12px;color:${BRAND.text};white-space:nowrap;">
            ${escapeHtml(due)}${escapeHtml(dueTime)}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};vertical-align:top;font-size:11px;font-weight:700;color:${pr ? pr.color : BRAND.muted};">
            ${pr ? escapeHtml(pr.label) : "—"}
          </td>
        </tr>`;
    })
    .join("");
}

/**
 * @param {object} opts
 * @param {string} opts.groupName
 * @param {Array} opts.tasks
 * @param {object} opts.labels - textos ya traducidos
 * @param {(assigneeId: string, fallback?: string) => string} [opts.getAssigneeName]
 * @param {string} [opts.locale]
 */
export function buildGroupTasksPdfHtml({
  groupName,
  tasks,
  labels,
  getAssigneeName,
  locale,
}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const total = list.length;
  const completed = list.filter((t) => t.status === "Completada").length;
  const inProgress = list.filter((t) => t.status === "En progreso").length;
  const pending = list.filter((t) => t.status === "Pendiente").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const exportedAt = formatExportDate(locale);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.docTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <div style="max-width:900px;margin:0 auto;padding:24px 20px 32px;">
    <!-- Brand header -->
    <div style="background:linear-gradient(135deg,${BRAND.indigo} 0%,${BRAND.indigoDark} 100%);border-radius:16px;padding:22px 24px;color:${BRAND.white};box-shadow:0 8px 24px rgba(79,70,229,0.28);">
      <div style="font-size:11px;letter-spacing:1.6px;font-weight:700;opacity:0.85;text-transform:uppercase;">StudySync</div>
      <div style="font-size:22px;font-weight:800;margin-top:6px;letter-spacing:-0.3px;">${escapeHtml(labels.docTitle)}</div>
      <div style="margin-top:8px;font-size:14px;opacity:0.92;">${escapeHtml(groupName || labels.groupFallback)}</div>
      <div style="margin-top:10px;font-size:11px;opacity:0.75;">${escapeHtml(labels.exportedAt)}: ${escapeHtml(exportedAt)}</div>
    </div>

    <!-- Summary -->
    <div style="display:flex;gap:10px;margin:16px 0 18px;flex-wrap:wrap;">
      <div style="flex:1;min-width:110px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;padding:12px 14px;">
        <div style="font-size:10px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(labels.total)}</div>
        <div style="font-size:20px;font-weight:800;color:${BRAND.indigoDark};margin-top:2px;">${total}</div>
      </div>
      <div style="flex:1;min-width:110px;background:${BRAND.pendingBg};border:1px solid #FDE68A;border-radius:12px;padding:12px 14px;">
        <div style="font-size:10px;color:${BRAND.pending};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(labels.pending)}</div>
        <div style="font-size:20px;font-weight:800;color:${BRAND.pending};margin-top:2px;">${pending}</div>
      </div>
      <div style="flex:1;min-width:110px;background:${BRAND.progressBg};border:1px solid ${BRAND.indigoMid};border-radius:12px;padding:12px 14px;">
        <div style="font-size:10px;color:${BRAND.progress};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(labels.inProgress)}</div>
        <div style="font-size:20px;font-weight:800;color:${BRAND.progress};margin-top:2px;">${inProgress}</div>
      </div>
      <div style="flex:1;min-width:110px;background:${BRAND.doneBg};border:1px solid #86EFAC;border-radius:12px;padding:12px 14px;">
        <div style="font-size:10px;color:${BRAND.done};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(labels.completed)}</div>
        <div style="font-size:20px;font-weight:800;color:${BRAND.done};margin-top:2px;">${completed} <span style="font-size:12px;font-weight:700;">(${pct}%)</span></div>
      </div>
    </div>

    <!-- Progress bar -->
    <div style="background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;padding:12px 14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:${BRAND.muted};margin-bottom:8px;">
        <span>${escapeHtml(labels.workProgress)}</span>
        <span style="color:${BRAND.indigo};">${pct}%</span>
      </div>
      <div style="height:8px;background:${BRAND.indigoSoft};border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${pct === 100 ? BRAND.done : BRAND.indigo};border-radius:999px;"></div>
      </div>
    </div>

    <!-- Table -->
    <div style="background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${BRAND.indigoSoft};">
            <th style="text-align:left;padding:11px 10px;font-size:10px;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.indigoDark};border-bottom:1px solid ${BRAND.indigoMid};">${escapeHtml(labels.colTask)}</th>
            <th style="text-align:left;padding:11px 8px;font-size:10px;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.indigoDark};border-bottom:1px solid ${BRAND.indigoMid};">${escapeHtml(labels.colStatus)}</th>
            <th style="text-align:left;padding:11px 8px;font-size:10px;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.indigoDark};border-bottom:1px solid ${BRAND.indigoMid};">${escapeHtml(labels.colAssignee)}</th>
            <th style="text-align:left;padding:11px 8px;font-size:10px;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.indigoDark};border-bottom:1px solid ${BRAND.indigoMid};">${escapeHtml(labels.colDue)}</th>
            <th style="text-align:left;padding:11px 8px;font-size:10px;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.indigoDark};border-bottom:1px solid ${BRAND.indigoMid};">${escapeHtml(labels.colPriority)}</th>
          </tr>
        </thead>
        <tbody>
          ${buildTaskRows(list, labels, getAssigneeName)}
        </tbody>
      </table>
    </div>

    <div style="margin-top:22px;text-align:center;font-size:10px;color:${BRAND.muted};">
      ${escapeHtml(labels.footerNote)}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera el PDF en documentDirectory con extensión .pdf y firma %PDF.
 * Usa base64 de expo-print (el temp de Print en Android no es legible
 * con copyAsync/readAsStringAsync → "Location ... isn't readable").
 * @returns {{ uri: string, fileName: string, base64: string }}
 */
export async function generateGroupTasksPdfFile(options) {
  const html = buildGroupTasksPdfHtml(options);
  const safeGroup =
    String(options.groupName || "grupo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "grupo";
  const fileName = `StudySync_tareas_${safeGroup}_${Date.now()}.pdf`;

  const printed = await Print.printToFileAsync({
    html,
    base64: true,
  });

  const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!docDir) {
    throw new Error("No hay directorio local disponible para el PDF.");
  }

  const dest = `${docDir}${fileName}`;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
  } catch {
    /* noop */
  }

  if (!printed?.base64) {
    throw new Error("No se pudo generar el contenido PDF.");
  }

  // iOS puede devolver base64 con saltos de línea; Android NO_WRAP.
  const base64 = assertPdfBase64(printed.base64, "expo-print");
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: dest, fileName, base64 };
}

/**
 * Guarda el PDF en una carpeta elegida (Android SAF) forzando MIME + .pdf.
 * En iOS lo deja en Documentos de la app.
 */
export async function saveGroupTasksPdfToDevice(
  localUri,
  fileName,
  labels = {},
  base64 = "",
) {
  const ensuredName = String(fileName || `StudySync_tareas_${Date.now()}.pdf`)
    .replace(/\.pdf$/i, "")
    .concat(".pdf");

  const payload = base64
    ? assertPdfBase64(base64, "payload")
    : await readPdfBase64FromUri(localUri);

  if (Platform.OS === "android") {
    // null = picker libre (Descargas, Documents, Drive, SD, etc.)
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        null,
      );
    if (!permissions.granted) {
      return { saved: false, cancelled: true };
    }

    // Incluir ".pdf" en el display name: varios providers de Android no
    // añaden la extensión solos y el archivo queda tipado como imagen.
    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      ensuredName,
      PDF_MIME,
    );

    await FileSystem.writeAsStringAsync(targetUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { saved: true, cancelled: false, uri: targetUri };
  }

  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    throw new Error("No hay directorio de documentos disponible.");
  }
  const dest = `${docDir}${ensuredName}`;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
  } catch {
    /* noop */
  }

  await FileSystem.writeAsStringAsync(dest, payload, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { saved: true, cancelled: false, uri: dest };
}

/**
 * Comparte el PDF como archivo (no solo el nombre).
 * expo-sharing exige file:// (no content://).
 */
export async function shareGroupTasksPdf(localUri, labels = {}) {
  const fileUri = String(localUri || "");
  const shareUri = fileUri.startsWith("file://")
    ? fileUri
    : fileUri.startsWith("content://")
      ? fileUri
      : `file://${fileUri}`;

  // Sharing rechaza content:// ("expected scheme to be 'file'").
  // Si por algún motivo llega content://, no hay forma segura de
  // convertirlo aquí: el caller debe pasar el file:// de documentDirectory.
  if (shareUri.startsWith("content://")) {
    throw new Error(
      "No se puede compartir un content://. Usa la ruta local del PDF.",
    );
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Compartir no está disponible en este dispositivo.");
  }

  await Sharing.shareAsync(shareUri, {
    mimeType: PDF_MIME,
    dialogTitle: labels.shareTitle || "StudySync",
    UTI: "com.adobe.pdf",
  });

  return { shared: true, uri: shareUri };
}

/** @deprecated Prefer generate + save/share. */
export async function exportAndShareGroupTasksPdf(options) {
  const { uri } = await generateGroupTasksPdfFile(options);
  return shareGroupTasksPdf(uri, options.labels || {});
}
