import crypto from 'crypto';
import { Request } from 'express';

/**
 * Configurações de segurança avançadas
 */
export const securityConfig = {
  // Tamanho máximo de requisições
  maxBodySize: '10kb',
  maxUrlSize: 2048,
  
  // Rate limiting
  rateLimit: {
    general: { windowMs: 15 * 60 * 1000, max: 100 },
    auth: { windowMs: 15 * 60 * 1000, max: 5 },
    sensitive: { windowMs: 60 * 60 * 1000, max: 10 },
  },
  
  // Sessões
  session: {
    maxConcurrent: 5, // Máximo de sessões por usuário
    inactivityTimeout: 30 * 60 * 1000, // 30 minutos
  },
  
  // Senhas
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    commonPasswords: [
      'password', '123456', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', 'dragon', 'master', 'senha',
    ],
  },
  
  // Bloqueio de contas
  accountLock: {
    maxAttempts: 5,
    lockDuration: 30 * 60 * 1000, // 30 minutos
  },
  
  // Headers a remover
  headersToRemove: [
    'x-powered-by',
    'server',
  ],
  
  // IPs bloqueados (adicione IPs maliciosos conhecidos)
  blockedIPs: new Set<string>([
    // Adicione IPs bloqueados aqui
  ]),
  
  // User agents bloqueados
  blockedUserAgents: [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i,
    /gobuster/i,
    /dirbuster/i,
    /wpscan/i,
    /hydra/i,
  ],
  
  // Padrões de SQL Injection
  sqlInjectionPatterns: [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /(\%3D)|(=)[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION(\s+)ALL(\s+)SELECT/i,
    /UNION(\s+)SELECT/i,
    /INSERT(\s+)INTO/i,
    /DELETE(\s+)FROM/i,
    /DROP(\s+)TABLE/i,
    /UPDATE(\s+)\w+(\s+)SET/i,
  ],
  
  // Padrões de XSS
  xssPatterns: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
  ],
  
  // Padrões de Path Traversal
  pathTraversalPatterns: [
    /\.\.\//g,
    /\.\.%2f/gi,
    /%2e%2e%2f/gi,
    /\.\.%5c/gi,
    /%2e%2e%5c/gi,
  ],
};

/**
 * Gera um nonce para CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Verifica se IP está bloqueado
 */
export function isIPBlocked(ip: string): boolean {
  return securityConfig.blockedIPs.has(ip);
}

/**
 * Verifica se User-Agent é suspeito
 */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  return securityConfig.blockedUserAgents.some(pattern => pattern.test(userAgent));
}

/**
 * Detecta tentativa de SQL Injection
 */
export function detectSQLInjection(input: string): boolean {
  return securityConfig.sqlInjectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Detecta tentativa de XSS
 */
export function detectXSS(input: string): boolean {
  return securityConfig.xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Detecta tentativa de Path Traversal
 */
export function detectPathTraversal(input: string): boolean {
  return securityConfig.pathTraversalPatterns.some(pattern => pattern.test(input));
}

/**
 * Verifica se a senha é comum/fraca
 */
export function isWeakPassword(password: string): boolean {
  const lower = password.toLowerCase();
  return securityConfig.password.commonPasswords.some(p => lower.includes(p));
}

/**
 * Valida força da senha
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { minLength, maxLength, requireUppercase, requireLowercase, requireNumber, requireSpecial } = securityConfig.password;
  
  if (password.length < minLength) {
    errors.push(`Senha deve ter pelo menos ${minLength} caracteres`);
  }
  if (password.length > maxLength) {
    errors.push(`Senha deve ter no máximo ${maxLength} caracteres`);
  }
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Senha deve conter letra maiúscula');
  }
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Senha deve conter letra minúscula');
  }
  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Senha deve conter número');
  }
  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Senha deve conter caractere especial');
  }
  if (isWeakPassword(password)) {
    errors.push('Senha muito comum, escolha outra');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Gera fingerprint do cliente para detecção de anomalias
 */
export function generateClientFingerprint(req: Request): string {
  const data = [
    req.ip,
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ].join('|');
  
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Valida e sanitiza URL
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Permite apenas HTTP e HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Ofusca dados sensíveis para logs
 */
export function obfuscateSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'credit_card', 'cpf', 'cnpj'];
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = obfuscateSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
