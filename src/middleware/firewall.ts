import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
  isIPBlocked,
  isSuspiciousUserAgent,
  detectSQLInjection,
  detectXSS,
  detectPathTraversal,
  securityConfig,
  generateClientFingerprint,
} from '../config/security';
import { supabaseAdmin } from '../config/supabase';

// Cache de IPs bloqueados temporariamente
const temporaryBlockedIPs = new Map<string, { until: number; reason: string }>();

// Cache de tentativas de ataque
const attackAttempts = new Map<string, { count: number; firstAttempt: number }>();

// Limpa caches periodicamente
setInterval(() => {
  const now = Date.now();
  
  // Limpa bloqueios expirados
  for (const [ip, data] of temporaryBlockedIPs) {
    if (data.until < now) {
      temporaryBlockedIPs.delete(ip);
    }
  }
  
  // Limpa tentativas antigas
  for (const [ip, data] of attackAttempts) {
    if (now - data.firstAttempt > 60 * 60 * 1000) { // 1 hora
      attackAttempts.delete(ip);
    }
  }
}, 60000); // A cada minuto

/**
 * Registra tentativa de ataque
 */
function recordAttackAttempt(ip: string, reason: string): void {
  const now = Date.now();
  const attempts = attackAttempts.get(ip);
  
  if (attempts) {
    attempts.count++;
    
    // Bloqueia após 10 tentativas em 1 hora
    if (attempts.count >= 10) {
      temporaryBlockedIPs.set(ip, {
        until: now + 24 * 60 * 60 * 1000, // 24 horas
        reason: `Múltiplas tentativas de ataque: ${reason}`,
      });
      attackAttempts.delete(ip);
      
      // Log no banco para análise
      logSecurityEvent(ip, 'IP_BLOCKED', { reason, attempts: attempts.count });
    }
  } else {
    attackAttempts.set(ip, { count: 1, firstAttempt: now });
  }
}

/**
 * Log de evento de segurança no banco
 */
async function logSecurityEvent(
  ip: string,
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    // Só tenta logar se o Supabase estiver configurado
    if (process.env.SUPABASE_URL) {
      await supabaseAdmin.from('security_logs').insert({
        ip_address: ip,
        event_type: event,
        details,
        created_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Não falha se não conseguir logar - apenas registra no console
    logger.warn('Não foi possível logar evento de segurança:', { event, ip });
  }
}

/**
 * Middleware de Firewall - Primeira linha de defesa
 */
export function firewall(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;
  const method = req.method;
  
  // 1. Verifica IP bloqueado permanentemente
  if (isIPBlocked(ip)) {
    logger.warn(`IP bloqueado permanentemente: ${ip}`);
    res.status(403).json({ success: false, message: 'Acesso negado' });
    return;
  }
  
  // 2. Verifica IP bloqueado temporariamente
  const tempBlock = temporaryBlockedIPs.get(ip);
  if (tempBlock && tempBlock.until > Date.now()) {
    logger.warn(`IP bloqueado temporariamente: ${ip} - ${tempBlock.reason}`);
    res.status(403).json({ success: false, message: 'Acesso temporariamente bloqueado' });
    return;
  }
  
  // 3. Verifica User-Agent suspeito
  if (isSuspiciousUserAgent(userAgent)) {
    logger.warn(`User-Agent suspeito bloqueado: ${userAgent} - IP: ${ip}`);
    recordAttackAttempt(ip, 'Suspicious User-Agent');
    res.status(403).json({ success: false, message: 'Acesso negado' });
    return;
  }
  
  // 4. Verifica tamanho da URL
  if (req.originalUrl.length > securityConfig.maxUrlSize) {
    logger.warn(`URL muito longa bloqueada - IP: ${ip}`);
    recordAttackAttempt(ip, 'URL too long');
    res.status(414).json({ success: false, message: 'URL muito longa' });
    return;
  }
  
  // 5. Verifica Path Traversal na URL
  if (detectPathTraversal(path)) {
    logger.warn(`Path Traversal detectado: ${path} - IP: ${ip}`);
    recordAttackAttempt(ip, 'Path Traversal');
    logSecurityEvent(ip, 'PATH_TRAVERSAL', { path });
    res.status(400).json({ success: false, message: 'Requisição inválida' });
    return;
  }
  
  // 6. Verifica SQL Injection nos parâmetros
  const allParams = { ...req.query, ...req.params };
  for (const [key, value] of Object.entries(allParams)) {
    if (typeof value === 'string' && detectSQLInjection(value)) {
      logger.warn(`SQL Injection detectado em ${key}: ${value} - IP: ${ip}`);
      recordAttackAttempt(ip, 'SQL Injection');
      logSecurityEvent(ip, 'SQL_INJECTION', { param: key, value });
      res.status(400).json({ success: false, message: 'Requisição inválida' });
      return;
    }
  }
  
  // 7. Verifica XSS nos parâmetros
  for (const [key, value] of Object.entries(allParams)) {
    if (typeof value === 'string' && detectXSS(value)) {
      logger.warn(`XSS detectado em ${key}: ${value} - IP: ${ip}`);
      recordAttackAttempt(ip, 'XSS');
      logSecurityEvent(ip, 'XSS_ATTEMPT', { param: key, value });
      res.status(400).json({ success: false, message: 'Requisição inválida' });
      return;
    }
  }
  
  // 8. Adiciona fingerprint do cliente ao request
  (req as Record<string, unknown>).clientFingerprint = generateClientFingerprint(req);
  
  // 9. Log de acesso para análise (apenas em produção para rotas sensíveis)
  if (process.env.NODE_ENV === 'production') {
    const sensitiveRoutes = ['/auth', '/admin', '/users'];
    if (sensitiveRoutes.some(r => path.startsWith(r))) {
      logger.info('Acesso a rota sensível', {
        ip,
        path,
        method,
        userAgent: userAgent.substring(0, 100),
      });
    }
  }
  
  next();
}

/**
 * Middleware para verificar body da requisição
 */
export function validateRequestBody(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || 'unknown';
  
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }
  
  // Função recursiva para verificar todos os valores
  function checkValue(value: unknown, path: string): boolean {
    if (typeof value === 'string') {
      if (detectSQLInjection(value)) {
        logger.warn(`SQL Injection no body: ${path} - IP: ${ip}`);
        recordAttackAttempt(ip, 'SQL Injection in body');
        return false;
      }
      if (detectXSS(value)) {
        logger.warn(`XSS no body: ${path} - IP: ${ip}`);
        recordAttackAttempt(ip, 'XSS in body');
        return false;
      }
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!checkValue(value[i], `${path}[${i}]`)) {
          return false;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (!checkValue(val, `${path}.${key}`)) {
          return false;
        }
      }
    }
    return true;
  }
  
  if (!checkValue(req.body, 'body')) {
    res.status(400).json({ success: false, message: 'Dados inválidos detectados' });
    return;
  }
  
  next();
}

/**
 * Middleware para proteção contra ataques de timing
 */
export function timingProtection(_req: Request, res: Response, next: NextFunction): void {
  // Adiciona delay aleatório pequeno para dificultar timing attacks
  const delay = Math.floor(Math.random() * 50); // 0-50ms
  
  const originalSend = res.send.bind(res);
  res.send = function(body: unknown): Response {
    setTimeout(() => originalSend(body), delay);
    return res;
  };
  
  next();
}

/**
 * Middleware para limitar campos no body
 */
export function limitBodyFields(maxFields: number = 50) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      const fieldCount = Object.keys(req.body).length;
      if (fieldCount > maxFields) {
        logger.warn(`Muitos campos no body: ${fieldCount} - IP: ${req.ip}`);
        res.status(400).json({ success: false, message: 'Muitos campos na requisição' });
        return;
      }
    }
    next();
  };
}

/**
 * Middleware para verificar Content-Type
 */
export function enforceContentType(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      // Permite form-urlencoded para alguns endpoints
      if (!contentType?.includes('application/x-www-form-urlencoded')) {
        res.status(415).json({ success: false, message: 'Content-Type inválido' });
        return;
      }
    }
  }
  next();
}
