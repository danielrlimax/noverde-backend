import { Router } from 'express';
import {
  createContact, listContacts, markAsResponded
} from '../controllers/contact.controller';
import { authenticate, authorize } from '../middleware/auth';
import { emailLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/errorHandler';
import { validationSchemas, validators } from '../utils/validators';

const router = Router();

// Criar contato (público)
router.post(
  '/',
  emailLimiter,
  validationSchemas.createContact,
  validateRequest,
  createContact
);

// Rotas protegidas
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// Listar contatos
router.get(
  '/',
  validationSchemas.pagination,
  validateRequest,
  listContacts
);

// Marcar como respondido
router.patch(
  '/:id/respond',
  validators.uuid(),
  validateRequest,
  markAsResponded
);

export default router;
