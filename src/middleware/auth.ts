import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, UserPayload, UserRole } from '../types';
import { logger } from '../utils/logger';
import { hashToken } from '../utils/crypto';

/**
 * Middleware de autenticação JWT
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verifica se o token não está na blacklist
    const tokenHash = hashToken(token);
    const { data: blacklisted } = await supabaseAdmin
      .from('token_blacklist')
      .select('id')
      .eq('token_hash', tokenHash)
      .single();

    if (blacklisted) {
      res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado',
      });
      return;
    }

    // Verifica e decodifica o token
    const decoded = jwt.verify(token, env.jwt.secret) as UserPayload;

    // Verifica se o usuário ainda existe e está ativo
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, name, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo',
      });
      return;
    }

    // Adiciona usuário ao request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    // Atualiza última atividade da sessão
    await supabaseAdmin
      .from('sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
      return;
    }

    logger.error('Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de autenticação',
    });
  }
}

/**
 * Middleware opcional de autenticação (não falha se não autenticado)
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.secret) as UserPayload;
    
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, role, name, is_active')
      .eq('id', decoded.id)
      .single();

    if (user && user.is_active) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };
    }
  } catch {
    // Ignora erros - usuário simplesmente não estará autenticado
  }

  next();
}

/**
 * Factory para middleware de autorização por roles
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Não autenticado',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Acesso não autorizado', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        message: 'Acesso não autorizado',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware para verificar se é o próprio usuário ou admin
 */
export function authorizeOwnerOrAdmin(userIdParam: string = 'id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Não autenticado',
      });
      return;
    }

    const targetUserId = req.params[userIdParam];
    const isOwner = req.user.id === targetUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Acesso não autorizado',
      });
      return;
    }

    next();
  };
}

/**
 * Gera um par de tokens (access + refresh)
 */
export function generateTokens(user: UserPayload): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

/**
 * Verifica um refresh token
 */
export function verifyRefreshToken(token: string): { id: string } | null {
  try {
    return jwt.verify(token, env.jwt.refreshSecret) as { id: string };
  } catch {
    return null;
  }
}
