import { Router } from 'express';
import {
  login, logout, register, refreshToken,
  forgotPassword, resetPassword, me, changePassword
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/errorHandler';
import { validationSchemas } from '../utils/validators';
import { body } from 'express-validator';

const router = Router();

// Login
router.post(
  '/login',
  authLimiter,
  validationSchemas.login,
  validateRequest,
  login
);

// Registro
router.post(
  '/register',
  registerLimiter,
  validationSchemas.register,
  validateRequest,
  register
);

// Refresh token
router.post(
  '/refresh',
  body('refreshToken').notEmpty().withMessage('Refresh token é obrigatório'),
  validateRequest,
  refreshToken
);

// Logout
router.post('/logout', authenticate, logout);

// Dados do usuário autenticado
router.get('/me', authenticate, me);

// Alterar senha
router.post(
  '/change-password',
  authenticate,
  validationSchemas.changePassword,
  validateRequest,
  changePassword
);

// Esqueci minha senha
router.post(
  '/forgot-password',
  authLimiter,
  validationSchemas.forgotPassword,
  validateRequest,
  forgotPassword
);

// Redefinir senha
router.post(
  '/reset-password',
  authLimiter,
  validationSchemas.resetPassword,
  validateRequest,
  resetPassword
);

export default router;
