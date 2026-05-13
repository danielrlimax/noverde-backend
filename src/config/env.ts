import dotenv from 'dotenv';
import path from 'path';

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validação de variáveis obrigatórias (apenas em runtime, não no build)
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
];

// Função para validar variáveis (chamada apenas quando o servidor inicia)
export function validateEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error('Variáveis de ambiente faltando:', missing.join(', '));
      process.exit(1);
    }
  }
}

export const env = {
  // Ambiente
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Criptografia
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32chars!',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    maxAuthRequests: parseInt(process.env.RATE_LIMIT_MAX_AUTH_REQUESTS || '5', 10),
  },

  // CORS
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'SolVerde <noreply@solverde.com.br>',
    admin: process.env.EMAIL_ADMIN || 'admin@solverde.com.br',
  },

  // Logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // Admin inicial
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@solverde.com.br',
    password: process.env.ADMIN_PASSWORD || 'MudeEssaSenha123!',
  },
};

export type Env = typeof env;
