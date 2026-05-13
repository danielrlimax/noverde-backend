import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Rate limiter padrão para rotas gerais
 */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.rateLimit.windowMs, // 15 minutos
  max: env.rateLimit.maxRequests, // 100 requisições
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em alguns minutos.',
    retryAfter: Math.ceil(env.rateLimit.windowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usa IP real considerando proxies
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      success: false,
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
    });
  },
  skip: (req: Request) => {
    // Pula rate limiting para health check
    return req.path === '/health';
  },
});

/**
 * Rate limiter estrito para autenticação
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.rateLimit.maxAuthRequests, // 5 tentativas
  message: {
    success: false,
    message: 'Muitas tentativas de login. Conta temporariamente bloqueada.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Combina IP + email para rate limiting
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });
    
    res.status(429).json({
      success: false,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    });
  },
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
});

/**
 * Rate limiter para envio de e-mails (contato/leads)
 */
export const emailLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 submissões por hora
  message: {
    success: false,
    message: 'Limite de envios atingido. Tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || '';
    return `email-${req.ip}-${email}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Email rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });
    
    res.status(429).json({
      success: false,
      message: 'Limite de envios atingido. Tente novamente em 1 hora.',
    });
  },
});

/**
 * Rate limiter para simulações
 */
export const simulationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 simulações por minuto
  message: {
    success: false,
    message: 'Muitas simulações. Aguarde um momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para downloads
 */
export const downloadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // 30 downloads por hora
  message: {
    success: false,
    message: 'Limite de downloads atingido.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para criação de conta
 */
export const registerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 contas por hora por IP
  message: {
    success: false,
    message: 'Limite de registros atingido. Tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
