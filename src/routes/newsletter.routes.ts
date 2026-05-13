import { Router } from 'express';
import {
  subscribe, unsubscribe, listSubscribers
} from '../controllers/newsletter.controller';
import { authenticate, authorize } from '../middleware/auth';
import { emailLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/errorHandler';
import { validationSchemas } from '../utils/validators';

const router = Router();

// Inscrever (público)
router.post(
  '/subscribe',
  emailLimiter,
  validationSchemas.subscribeNewsletter,
  validateRequest,
  subscribe
);

// Cancelar inscrição (público)
router.post(
  '/unsubscribe',
  validationSchemas.subscribeNewsletter,
  validateRequest,
  unsubscribe
);

// Listar inscritos (admin)
router.get(
  '/',
  authenticate,
  authorize('admin', 'manager'),
  validationSchemas.pagination,
  validateRequest,
  listSubscribers
);

export default router;
