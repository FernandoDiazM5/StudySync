import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan variables de entorno de Supabase en .env');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTA');
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'OK' : 'FALTA');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
