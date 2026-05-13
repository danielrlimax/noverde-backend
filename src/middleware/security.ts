import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import compression from 'compression';
import { Express, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { generateNonce } from '../config/security';
import { logger } from '../utils/logger';

/**
 * Lista de origens permitidas para CORS
 */
const getAllowedOrigins = (): string[] => {
  const origins = env.cors.allowedOrigins.filter(o => o.trim() !== '');
  
  // Em desenvolvimento, permite localhost
  if (env.isDev) {
    origins.push('http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173');
  }
  
  return origins;
};

/**
 * Configura headers de segurança com Helmet
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", env.supabase.url, ...getAllowedOrigins()],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: env.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Necessário para algumas integrações
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Permite recursos cross-origin
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: env.isProd ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

/**
 * Configura CORS para Vercel + Render
 */
export function configureCors() {
  const allowedOrigins = getAllowedOrigins();
  
  return cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (mobile apps, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      // Verifica se a origem está na lista
      if (allowedOrigins.some(allowed => {
        // Suporta wildcards simples
        if (allowed.includes('*')) {
          const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return allowed === origin;
      })) {
        return callback(null, true);
      }
      
      // Em desenvolvimento, permite mais origens
      if (env.isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      
      logger.warn(`CORS bloqueado para origem: ${origin}`);
      callback(new Error('Bloqueado pelo CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Session-Id',
      'X-Client-Version',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page',
      'X-Limit',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 horas
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
}

/**
 * Middleware para prevenção de parameter pollution
 */
export function configureHpp() {
  return hpp({
    whitelist: ['sort', 'fields', 'filter', 'tags'],
  });
}

/**
 * Middleware de compressão
 */
export function configureCompression() {
  return compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024, // Só comprime acima de 1KB
  });
}

/**
 * Middleware para sanitização de body
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    // Remove campos com valor undefined ou null
    const sanitize = (obj: Record<string, unknown>): void => {
      Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          sanitize(obj[key] as Record<string, unknown>);
        }
      });
    };
    sanitize(req.body);
  }
  next();
}

/**
 * Middleware para adicionar headers de segurança customizados
 */
export function customSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove headers que podem vazar informações
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Headers de segurança adicionais
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // Gera nonce para CSP (pode ser usado em respostas HTML)
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  // Request ID para tracking
  const requestId = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', requestId);
  (req as Record<string, unknown>).requestId = requestId;
  
  next();
}

/**
 * Middleware para desabilitar cache em APIs
 */
export function noCache(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
}

/**
 * Middleware para timeout de requisições
 */
export function requestTimeout(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.setTimeout(timeout, () => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.path}`);
        res.status(408).json({ success: false, message: 'Tempo limite excedido' });
      }
    });
    next();
  };
}

/**
 * Aplica todas as configurações de segurança
 */
export function applySecurityMiddleware(app: Express): void {
  // Ordem importa!
  app.use(configureHelmet());
  app.use(configureCors());
  app.use(configureHpp());
  app.use(configureCompression());
  app.use(customSecurityHeaders);
  app.use(noCache);
  app.use(sanitizeBody);
  app.use(requestTimeout(30000));
  
  // Handler para preflight OPTIONS
  app.options('*', configureCors());
}
