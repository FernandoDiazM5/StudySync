// ============================================
// SUPABASE CONFIG - StudySync
// Misma resolución de credenciales que Brevo:
// process.env.EXPO_PUBLIC_* primero, luego expoConfig.extra.
// ============================================

import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

function normalizeEnvString(v) {
  if (v == null) return "";
  let s = String(v).replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith(";")) s = s.slice(0, -1).trim();
  return s;
}

function fromExtra(key) {
  const candidates = [
    Constants.expoConfig?.extra?.[key],
    Constants.manifest?.extra?.[key],
    Constants.manifest2?.extra?.[key],
  ];
  for (const ex of candidates) {
    const n = normalizeEnvString(ex);
    if (n) return n;
  }
  return "";
}

export function getSupabaseCredentials() {
  const url =
    normalizeEnvString(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
    fromExtra("supabaseUrl");
  const anonKey =
    normalizeEnvString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    fromExtra("supabaseAnonKey");
  return { url, anonKey };
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseCredentials();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno de Supabase en .env");
  console.error("EXPO_PUBLIC_SUPABASE_URL:", supabaseUrl ? "OK" : "FALTA");
  console.error(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY:",
    supabaseAnonKey ? "OK" : "FALTA",
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
