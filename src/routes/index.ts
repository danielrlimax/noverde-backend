import { Router } from 'express';
import authRoutes from './auth.routes';
import leadRoutes from './lead.routes';
import simulationRoutes from './simulation.routes';
import contactRoutes from './contact.routes';
import newsletterRoutes from './newsletter.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API SolVerde funcionando',
    timestamp: new Date().toISOString(),
  });
});

// Rotas
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/simulations', simulationRoutes);
router.use('/contacts', contactRoutes);
router.use('/newsletter', newsletterRoutes);

export default router;
