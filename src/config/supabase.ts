import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Cliente para operações administrativas (bypass RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Cliente para operações de usuário (respeita RLS)
export const supabaseClient: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

// Verifica conexão com Supabase
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    if (error && !error.message.includes('does not exist')) {
      console.error('Erro ao conectar com Supabase:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Erro ao conectar com Supabase:', error);
    return false;
  }
}
