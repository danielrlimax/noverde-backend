import { Router } from 'express';
import {
  createLead, listLeads, getLead, updateLead, getLeadStats
} from '../controllers/lead.controller';
import { authenticate, authorize } from '../middleware/auth';
import { emailLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/errorHandler';
import { validationSchemas, validators } from '../utils/validators';

const router = Router();

// Criar lead (público)
router.post(
  '/',
  emailLimiter,
  validationSchemas.createLead,
  validateRequest,
  createLead
);

// Rotas protegidas
router.use(authenticate);

// Listar leads
router.get(
  '/',
  authorize('admin', 'manager', 'operator'),
  validationSchemas.pagination,
  validateRequest,
  listLeads
);

// Estatísticas
router.get(
  '/stats',
  authorize('admin', 'manager'),
  getLeadStats
);

// Buscar lead por ID
router.get(
  '/:id',
  authorize('admin', 'manager', 'operator'),
  validators.uuid(),
  validateRequest,
  getLead
);

// Atualizar lead
router.patch(
  '/:id',
  authorize('admin', 'manager', 'operator'),
  validationSchemas.updateLead,
  validateRequest,
  updateLead
);

export default router;
