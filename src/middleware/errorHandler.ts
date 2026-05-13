import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ApiResponse } from '../types';

/**
 * Classe de erro customizada
 */
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erros comuns pré-definidos
 */
export const Errors = {
  NotFound: (resource: string = 'Recurso') => 
    new AppError(`${resource} não encontrado`, 404, 'NOT_FOUND'),
  
  Unauthorized: (message: string = 'Não autorizado') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message: string = 'Acesso negado') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  BadRequest: (message: string) => 
    new AppError(message, 400, 'BAD_REQUEST'),
  
  Conflict: (message: string) => 
    new AppError(message, 409, 'CONFLICT'),
  
  TooManyRequests: (message: string = 'Muitas requisições') => 
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),
  
  Internal: (message: string = 'Erro interno do servidor') => 
    new AppError(message, 500, 'INTERNAL_ERROR'),
  
  Validation: (message: string) => 
    new AppError(message, 422, 'VALIDATION_ERROR'),
};

/**
 * Middleware para validar resultado do express-validator
 */
export function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: 'path' in err ? err.path : 'unknown',
      message: err.msg,
    }));

    res.status(422).json({
      success: false,
      message: 'Dados inválidos',
      errors: formattedErrors,
    } as ApiResponse);
    return;
  }
  
  next();
}

/**
 * Middleware para rotas não encontradas
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.path}`,
  } as ApiResponse);
}

/**
 * Middleware global de tratamento de erros
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log do erro
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Erro operacional:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Erro não tratado:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
    });
  }

  // Determina status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Resposta de erro
  const response: ApiResponse = {
    success: false,
    message: err instanceof AppError ? err.message : 'Erro interno do servidor',
  };

  // Adiciona detalhes em desenvolvimento
  if (env.isDev && !(err instanceof AppError)) {
    (response as Record<string, unknown>).stack = err.stack;
  }

  // Adiciona código de erro se disponível
  if (err instanceof AppError && err.code) {
    (response as Record<string, unknown>).code = err.code;
  }

  res.status(statusCode).json(response);
}

/**
 * Wrapper para async handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handler para erros não capturados
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', { reason });
  });
}
