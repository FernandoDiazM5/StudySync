/**
 * Textos de notificaciones: claves i18n + compatibilidad con documentos antiguos
 * (título/cuerpo fijos en español guardados en Firestore).
 */

/** Sufijo de hora para cuerpos de recordatorio ({{when}}) */
export function formatDueTimeSuffix(dueTime, language) {
  if (!dueTime || typeof dueTime !== "string") return "";
  const [hs, ms] = dueTime.split(":");
  const h = parseInt(hs, 10);
  const m = parseInt(ms, 10) || 0;
  if (Number.isNaN(h)) return "";
  if (language === "en") {
    const h12 = h % 12 || 12;
    const am = h < 12;
    return ` at ${h12}:${String(m).padStart(2, "0")} ${am ? "a.m." : "p.m."}`;
  }
  const h12 = h % 12 || 12;
  const period = h >= 12 ? "p.m." : "a.m.";
  return ` a las ${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatNotifDueDate(iso, language) {
  if (!iso || typeof iso !== "string") return "";
  const [y, mo, d] = iso.split("-");
  if (!y) return iso;
  if (language === "en") return `${mo}/${d}/${y}`;
  return `${d}/${mo}/${y}`;
}

function normalizeWho(who, t) {
  if (!who || who === "Alguien") return t("someoneInvited");
  if (who === "Un miembro") return t("notifMemberGeneric");
  return who;
}

/**
 * Intenta deducir plantilla y parámetros desde título/cuerpo en español (notifs antiguas).
 * @returns {{ titleKey?: string, bodyKey?: string, params?: object } | null}
 */
function matchLegacyNotification(item) {
  const { title = "", body = "", type } = item;
  const data = item.data || {};

  if (type === "invitation" && title === "¡Invitación a grupo!") {
    const m = body.match(/^(.+) te invitó a unirte a "(.+)"$/);
    if (m) return { titleKey: "notifInvitationTitle", bodyKey: "notifInvitationBody", params: { who: m[1], group: m[2] } };
  }

  if (type === "task" && title === "Nueva tarea asignada") {
    const m2 = body.match(/^(.+) · (.+)$/);
    if (m2) {
      return {
        titleKey: "notifNewTaskTitle",
        bodyKey: "notifNewTaskBodyWithGroup",
        params: { task: m2[1], group: m2[2] },
      };
    }
    return { titleKey: "notifNewTaskTitle", bodyKey: "notifNewTaskBodyTaskOnly", params: { task: body } };
  }

  if (type === "task" && title === "📅 Tarea — en 3 días") {
    const m = body.match(/^"(.+)" vence en 3 días(.*?)\.$/);
    if (m) {
      const when = (m[2] || "").trim();
      return {
        titleKey: "notifTaskReminder3dTitle",
        bodyKey: "notifTaskReminder3dBody",
        params: { task: m[1], when, dueTime: data.dueTime },
      };
    }
  }
  if (type === "task" && title === "📅 Recordatorio de tarea") {
    const m = body.match(/^"(.+)" vence en 2 días(.*?)\.$/);
    if (m) {
      const when = (m[2] || "").trim();
      return {
        titleKey: "notifTaskReminder2dTitle",
        bodyKey: "notifTaskReminder2dBody",
        params: { task: m[1], when, dueTime: data.dueTime },
      };
    }
  }
  if (type === "task" && title === "⏰ Tarea por vencer") {
    const m = body.match(/^"(.+)" vence mañana(.*?)\.$/);
    if (m) {
      const when = (m[2] || "").trim();
      return {
        titleKey: "notifTaskReminder1dTitle",
        bodyKey: "notifTaskReminder1dBody",
        params: { task: m[1], when, dueTime: data.dueTime },
      };
    }
  }
  if (type === "task" && title === "🔴 Tarea vencida") {
    const m = body.match(/^Oh no, "(.+)" venció el (\d{2}\/\d{2}\/\d{4}) y no se completó\.$/);
    if (m) {
      const [d, mo, y] = m[2].split("/");
      const dueDateISO = `${y}-${mo}-${d}`;
      return {
        titleKey: "notifTaskExpiredTitle",
        bodyKey: "notifTaskExpiredBody",
        params: { task: m[1], dueDateISO },
      };
    }
  }

  if (type === "task" && title === "⚠️ Miembro sin avance") {
    const m = body.match(/^(.+) no ha avanzado en "(.+)" y vence mañana\.$/);
    if (m) return { titleKey: "notifLeaderMemberStuckTitle", bodyKey: "notifLeaderMemberStuckBody", params: { who: m[1], task: m[2] } };
  }
  if (type === "task" && title === "🚨 Tareas en riesgo") {
    const m = body.match(/^Hay (\d+) tareas? por vencer mañana en "(.+)"\.$/);
    if (m) {
      const n = parseInt(m[1], 10);
      return {
        titleKey: "notifLeaderAtRiskTitle",
        bodyKey: n === 1 ? "notifLeaderAtRiskBodyOne" : "notifLeaderAtRiskBodyMany",
        params: { n: String(n), group: m[2] },
      };
    }
  }

  if (type === "task" && title === "⏰ Vence hoy") {
    const m = body.match(/^La tarea "(.+)" vence hoy(?: a las .+)?\.$/);
    if (m) return { titleKey: "notifAssignDueTodayTitle", bodyKey: "notifAssignDueTodayBody", params: { task: m[1] } };
  }
  if (type === "task" && title === "⚠️ Tarea vencida" && body.includes("ya venció")) {
    const m = body.match(/^La tarea "(.+)" ya venció\.$/);
    if (m) return { titleKey: "notifAssignOverdueTitle", bodyKey: "notifAssignOverdueBody", params: { task: m[1] } };
  }

  if (type === "group") {
    const mt = title.match(/^Tarea completada en (.+)$/);
    if (mt) {
      const mb = body.match(/^(.+) completó: (.+)$/);
      if (mb) {
        return {
          titleKey: "notifTaskCompletedTitle",
          bodyKey: "notifTaskCompletedBody",
          params: { group: mt[1], who: mb[1], task: mb[2] },
        };
      }
    }
    const mf = title.match(/^Nuevo archivo en (.+)$/);
    if (mf) {
      if (body.startsWith("Subiste: ")) {
        return {
          titleKey: "notifNewFileTitle",
          bodyKey: "notifNewFileBodySelf",
          params: { group: mf[1], file: body.slice("Subiste: ".length) },
        };
      }
      const mu = body.match(/^(.+) subió: (.+)$/);
      if (mu) {
        return {
          titleKey: "notifNewFileTitle",
          bodyKey: "notifNewFileBodyOther",
          params: { group: mf[1], who: mu[1], file: mu[2] },
        };
      }
    }
  }

  if (type === "mention") {
    const all = body.match(/^(.+) mencionó a todos los integrantes: "(.*)"$/);
    if (all) {
      return { bodyKey: "notifMentionAllBody", params: { sender: all[1], preview: all[2] } };
    }
    const one = body.match(/^(.+) te mencionó: "(.*)"$/);
    if (one) {
      return { bodyKey: "notifMentionUserBody", params: { sender: one[1], preview: one[2] } };
    }
  }

  return null;
}

/**
 * @param {object} item documento notificación
 * @param {function} t función i18n (clave, vars?)
 * @param {string} language 'es' | 'en' | 'qu'
 */
export function resolveNotificationCopy(item, t, language = "es") {
  let titleKey = item.titleKey;
  let bodyKey = item.bodyKey;
  let params = { ...(item.notifParams || {}) };

  if (!titleKey && !bodyKey) {
    const legacy = matchLegacyNotification(item);
    if (legacy) {
      titleKey = legacy.titleKey;
      bodyKey = legacy.bodyKey;
      params = { ...params, ...legacy.params };
    }
  }

  let title = item.title || "";
  let body = item.body || "";

  const p = { ...params };
  if ("who" in p) p.who = normalizeWho(p.who, t);
  else if (bodyKey === "notifInvitationBody") p.who = t("someoneInvited");
  if ("sender" in p) p.sender = normalizeWho(p.sender, t);

  if (titleKey) title = t(titleKey, p);
  if (bodyKey) {
    const pBody = { ...p };
    const hasWhen =
      typeof pBody.when === "string" && pBody.when.trim().length > 0;
    if (pBody.dueTime && !hasWhen) {
      pBody.when = formatDueTimeSuffix(pBody.dueTime, language);
    }
    if (typeof pBody.when !== "string") {
      pBody.when = "";
    }
    if (pBody.dueDateISO) {
      pBody.date = formatNotifDueDate(pBody.dueDateISO, language);
    }
    body = t(bodyKey, pBody);
  }

  return { title, body };
}
