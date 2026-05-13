import { Router } from 'express';
import {
  calculateSimulation, getSimulationsByLead, getSimulationStats
} from '../controllers/simulation.controller';
import { authenticate, authorize } from '../middleware/auth';
import { simulationLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/errorHandler';
import { validationSchemas, validators } from '../utils/validators';
import { body } from 'express-validator';

const router = Router();

// Calcular simulação (público)
router.post(
  '/calculate',
  simulationLimiter,
  validationSchemas.createSimulation,
  body('save').optional().isBoolean(),
  validateRequest,
  calculateSimulation
);

// Rotas protegidas
router.use(authenticate);

// Simulações de um lead
router.get(
  '/lead/:leadId',
  authorize('admin', 'manager', 'operator'),
  validators.uuid('leadId'),
  validateRequest,
  getSimulationsByLead
);

// Estatísticas
router.get(
  '/stats',
  authorize('admin', 'manager'),
  getSimulationStats
);

export default router;
