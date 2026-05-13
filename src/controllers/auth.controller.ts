import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, UserPayload } from '../types';
import { hashPassword, verifyPassword, generateSecureToken, hashToken } from '../utils/crypto';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { logAudit, AuditActions, getRequestInfo } from '../middleware/audit';
import { sanitizeEmail } from '../utils/sanitizer';
import { env } from '../config/env';

/**
 * Login do usuário
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const cleanEmail = sanitizeEmail(email);

    // Busca usuário
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (error || !user) {
      await logAudit(AuditActions.LOGIN_FAILED, 'users', undefined, undefined, { email: cleanEmail }, undefined, ipAddress ?? undefined, userAgent);
      
      res.status(401).json({
        success: false,
        message: 'E-mail ou senha incorretos',
      });
      return;
    }

    // Verifica se está ativo
    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Conta desativada. Entre em contato com o suporte.',
      });
      return;
    }

    // Verifica senha
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await logAudit(AuditActions.LOGIN_FAILED, 'users', user.id, undefined, { email: cleanEmail }, undefined, ipAddress ?? undefined, userAgent);
      
      res.status(401).json({
        success: false,
        message: 'E-mail ou senha incorretos',
      });
      return;
    }

    // Gera tokens
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const { accessToken, refreshToken } = generateTokens(userPayload);

    // Salva sessão
    await supabaseAdmin.from('sessions').insert({
      user_id: user.id,
      token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Atualiza último login
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Log de auditoria
    await logAudit(AuditActions.LOGIN, 'users', user.id, user.id, undefined, undefined, ipAddress ?? undefined, userAgent);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Refresh do token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = req.body;

  if (!token) {
    res.status(400).json({
      success: false,
      message: 'Refresh token não fornecido',
    });
    return;
  }

  try {
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Refresh token inválido ou expirado',
      });
      return;
    }

    // Verifica se a sessão existe
    const tokenHash = hashToken(token);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('refresh_token_hash', tokenHash)
      .single();

    if (sessionError || !session) {
      res.status(401).json({
        success: false,
        message: 'Sessão não encontrada',
      });
      return;
    }

    // Busca usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo',
      });
      return;
    }

    // Gera novos tokens
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const newTokens = generateTokens(userPayload);

    // Atualiza sessão
    await supabaseAdmin
      .from('sessions')
      .update({
        token_hash: hashToken(newTokens.accessToken),
        refresh_token_hash: hashToken(newTokens.refreshToken),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    res.json({
      success: true,
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      },
    });
  } catch (error) {
    logger.error('Erro no refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Logout
 */
export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const tokenHash = hashToken(token);

      // Remove sessão
      await supabaseAdmin
        .from('sessions')
        .delete()
        .eq('token_hash', tokenHash);

      // Adiciona token à blacklist
      await supabaseAdmin.from('token_blacklist').insert({
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (req.user) {
      await logAudit(AuditActions.LOGOUT, 'users', req.user.id, req.user.id, undefined, undefined, ipAddress ?? undefined, userAgent);
    }

    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    logger.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Registro de usuário
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const cleanEmail = sanitizeEmail(email);

    // Verifica se e-mail já existe
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'E-mail já cadastrado',
      });
      return;
    }

    // Cria usuário
    const passwordHash = await hashPassword(password);
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'client',
        is_active: true,
        email_verified: false,
      })
      .select()
      .single();

    if (error || !user) {
      logger.error('Erro ao criar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar conta',
      });
      return;
    }

    // Log de auditoria
    await logAudit(AuditActions.USER_CREATE, 'users', user.id, user.id, undefined, { email: cleanEmail }, ipAddress ?? undefined, userAgent);

    // Envia e-mail de boas-vindas
    await emailService.sendWelcomeEmail(cleanEmail, name);

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });
  } catch (error) {
    logger.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Solicita recuperação de senha
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  try {
    const cleanEmail = sanitizeEmail(email);

    // Busca usuário
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('email', cleanEmail)
      .single();

    // Sempre retorna sucesso (segurança)
    if (!user) {
      res.json({
        success: true,
        message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
      });
      return;
    }

    // Gera token de reset
    const resetToken = generateSecureToken(32);
    const resetTokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salva token
    await supabaseAdmin.from('password_resets').insert({
      user_id: user.id,
      token_hash: resetTokenHash,
      expires_at: expiresAt.toISOString(),
    });

    // Envia e-mail
    const resetLink = `${env.cors.allowedOrigins[0]}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(user.email, user.name, resetLink);

    res.json({
      success: true,
      message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
    });
  } catch (error) {
    logger.error('Erro no forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Redefine a senha
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body;
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    const tokenHash = hashToken(token);

    // Busca token válido
    const { data: resetData, error } = await supabaseAdmin
      .from('password_resets')
      .select('*, users(id, email)')
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !resetData) {
      res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado',
      });
      return;
    }

    // Atualiza senha
    const passwordHash = await hashPassword(password);
    await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetData.user_id);

    // Marca token como usado
    await supabaseAdmin
      .from('password_resets')
      .update({ used: true })
      .eq('id', resetData.id);

    // Invalida todas as sessões
    await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_id', resetData.user_id);

    // Log de auditoria
    await logAudit(AuditActions.PASSWORD_RESET, 'users', resetData.user_id, resetData.user_id, undefined, undefined, ipAddress ?? undefined, userAgent);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso',
    });
  } catch (error) {
    logger.error('Erro no reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Retorna dados do usuário autenticado
 */
export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at, last_login_at')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}

/**
 * Altera senha do usuário autenticado
 */
export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { current_password, password } = req.body;
  const { ipAddress, userAgent } = getRequestInfo(req);

  try {
    // Busca usuário com senha atual
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
      return;
    }

    // Verifica senha atual
    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Senha atual incorreta',
      });
      return;
    }

    // Atualiza senha
    const passwordHash = await hashPassword(password);
    await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    // Log de auditoria
    await logAudit(AuditActions.PASSWORD_CHANGE, 'users', user.id, user.id, undefined, undefined, ipAddress ?? undefined, userAgent);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
}
