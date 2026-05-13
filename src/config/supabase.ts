import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// URL e chave padrão para evitar erro durante o build
const supabaseUrl = env.supabase.url || 'https://placeholder.supabase.co';
const supabaseServiceKey = env.supabase.serviceRoleKey || 'placeholder-key';
const supabaseAnonKey = env.supabase.anonKey || 'placeholder-key';

// Cliente para operações administrativas (bypass RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Cliente para operações de usuário (respeita RLS)
export const supabaseClient: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

// Verifica conexão com Supabase
export async function testConnection(): Promise<boolean> {
  // Não testa se estiver usando placeholder
  if (supabaseUrl.includes('placeholder')) {
    console.warn('Supabase não configurado - usando placeholder');
    return false;
  }
  
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
