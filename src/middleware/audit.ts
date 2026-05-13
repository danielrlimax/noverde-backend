import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { sanitizeIP, maskSensitiveData } from '../utils/sanitizer';

/**
 * Registra uma ação no log de auditoria
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId?: string,
  userId?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      old_data: oldData ? maskSensitiveData(oldData) : null,
      new_data: newData ? maskSensitiveData(newData) : null,
      ip_address: ipAddress,
      user_agent: userAgent?.substring(0, 500),
    });
  } catch (error) {
    logger.error('Erro ao registrar auditoria:', error);
  }
}

/**
 * Extrai informações do request para auditoria
 */
export function getRequestInfo(req: Request): {
  ipAddress: string | null;
  userAgent: string;
} {
  const ipAddress = sanitizeIP(
    req.ip || 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress
  );
  
  const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 500);
  
  return { ipAddress, userAgent };
}

/**
 * Middleware de auditoria para ações sensíveis
 */
export function auditMiddleware(action: string, entityType: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { ipAddress, userAgent } = getRequestInfo(req);
    
    // Armazena função original de send
    const originalSend = res.send.bind(res);
    
    // Sobrescreve send para capturar resposta
    res.send = function (body: unknown): Response {
      // Só loga se a resposta for bem-sucedida
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || (typeof body === 'object' && body !== null && 'data' in body ? (body as Record<string, unknown>).data : undefined);
        
        logAudit(
          action,
          entityType,
          typeof entityId === 'string' ? entityId : undefined,
          req.user?.id,
          req.method === 'PUT' || req.method === 'PATCH' ? req.body : undefined,
          undefined,
          ipAddress ?? undefined,
          userAgent
        ).catch(err => logger.error('Erro no middleware de auditoria:', err));
      }
      
      return originalSend(body);
    };
    
    next();
  };
}

/**
 * Ações de auditoria pré-definidas
 */
export const AuditActions = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // Users
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  
  // Leads
  LEAD_CREATE: 'LEAD_CREATE',
  LEAD_UPDATE: 'LEAD_UPDATE',
  LEAD_DELETE: 'LEAD_DELETE',
  LEAD_STATUS_CHANGE: 'LEAD_STATUS_CHANGE',
  LEAD_ASSIGN: 'LEAD_ASSIGN',
  
  // Contacts
  CONTACT_CREATE: 'CONTACT_CREATE',
  CONTACT_RESPOND: 'CONTACT_RESPOND',
  
  // Simulations
  SIMULATION_CREATE: 'SIMULATION_CREATE',
  
  // Blog
  POST_CREATE: 'POST_CREATE',
  POST_UPDATE: 'POST_UPDATE',
  POST_DELETE: 'POST_DELETE',
  POST_PUBLISH: 'POST_PUBLISH',
  
  // Admin
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  ROLE_CHANGE: 'ROLE_CHANGE',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];
