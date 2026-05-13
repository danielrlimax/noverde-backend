import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { simulationService } from '../services/simulation.service';
import { logger } from '../utils/logger';
import { getRequestInfo } from '../middleware/audit';

/**
 * Calcula simulação (público)
 */
export async function calculateSimulation(req: Request, res: Response): Promise<void> {
  const { ipAddress } = getRequestInfo(req);

  try {
    const { monthly_bill, roof_area, region, session_id, save } = req.body;

    // Calcula simulação
    const result = simulationService.calculate({
      monthly_bill,
      roof_area,
      region,
    });

    // Salva se solicitado
    if (save) {
      await simulationService.save(result, session_id, undefined, ipAddress ?? undefined);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Erro na simulação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular simulação',
    });
  }
}

/**
 * Busca simulações de um lead
 */
export async function getSimulationsByLead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { leadId } = req.params;

    const simulations = await simulationService.findByLeadId(leadId);

    res.json({
      success: true,
      data: simulations,
    });
  } catch (error) {
    logger.error('Erro ao buscar simulações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar simulações',
    });
  }
}

/**
 * Estatísticas de simulações
 */
export async function getSimulationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await simulationService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas',
    });
  }
}
