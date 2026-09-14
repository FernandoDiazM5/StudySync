// ============================================
// GROUP COLORS - StudySync
// Paleta compartida para diferenciar grupos.
// ============================================

export const GROUP_COLOR_PALETTE = [
  "#6B7FE8", // índigo
  "#2BA8A0", // teal
  "#5B8FE8", // azul
  "#3BAF78", // verde
  "#E86B8A", // coral
  "#8B6FE8", // violeta
  "#3BA8D4", // cielo
  "#E87A5F", // salmón
];

export function colorFromName(name = "") {
  let hash = 0;
  for (let i = 0; i < String(name).length; i++) {
    hash = String(name).charCodeAt(i) + ((hash << 5) - hash);
  }
  return GROUP_COLOR_PALETTE[Math.abs(hash) % GROUP_COLOR_PALETTE.length];
}

/** Color efectivo: personalizado o hash del nombre (grupos antiguos). */
export function resolveGroupColor(groupOrColor, nameFallback = "") {
  if (typeof groupOrColor === "string" && groupOrColor.trim()) {
    return groupOrColor.trim();
  }
  const color = groupOrColor?.color;
  if (typeof color === "string" && color.trim()) {
    return color.trim();
  }
  return colorFromName(groupOrColor?.name || nameFallback);
}
